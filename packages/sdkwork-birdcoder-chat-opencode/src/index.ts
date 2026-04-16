import {
  buildMessageTranscriptPrompt,
  createDetectedHealthReport,
  createModuleBackedOfficialSdkBridgeLoader,
  createRawExtensionDescriptor,
  readRuntimeEnvValue,
  createStaticIntegrationDescriptor,
  resolveRuntimeWorkingDirectory,
  createTextChatResponse,
  createTextStreamChunk,
  createToolCallStreamChunk,
  invokeWithOptionalOfficialSdk,
  resolvePackagePresence,
  streamWithOptionalOfficialSdk,
  type ChatEngineOfficialSdkBridge,
  type ChatEngineOfficialSdkBridgeLoader,
  type ChatMessage,
  type ChatOptions,
  type ChatResponse,
  type ChatStreamChunk,
  type IChatEngine,
  type ToolCall,
} from '../../sdkwork-birdcoder-chat/src/index.ts';

const OPENCODE_PACKAGE = resolvePackagePresence({
  packageName: '@opencode-ai/sdk',
  mirrorPackageJsonPath: 'external/opencode/packages/sdk/js/package.json',
});

const OPENCODE_INTEGRATION = createStaticIntegrationDescriptor({
  engineId: 'opencode',
  runtimeMode: 'sdk',
  transportKinds: ['sdk-stream', 'openapi-http', 'cli-jsonl'],
  sourceMirrorPath: 'external/opencode/packages/sdk/js',
  officialEntry: {
    packageName: '@opencode-ai/sdk',
    packageVersion: OPENCODE_PACKAGE.mirrorVersion,
    cliPackageName: 'opencode-ai',
    sdkPath: 'external/opencode/packages/sdk/js',
    sourceMirrorPath: 'external/opencode/packages/sdk/js',
    supplementalLanes: ['OpenAPI', 'SSE', 'server mode'],
  },
  notes: 'BirdCoder uses the official OpenCode SDK as the primary client and server adapter lane.',
});

const OPENCODE_RAW_EXTENSIONS = createRawExtensionDescriptor({
  provider: 'opencode',
  primaryLane: 'session-part-artifact-event',
  supplementalLanes: OPENCODE_INTEGRATION.officialEntry.supplementalLanes,
  nativeEventModel: ['session.updated', 'part.delta', 'artifact.created', 'event.subscribed'],
  nativeArtifactModel: ['diff', 'todo', 'pty', 'question'],
  experimentalFeatures: ['server-mode', 'sse-subscriptions'],
  notes: 'OpenCode raw lane preserves client/server duality and native artifact streams.',
});

export interface OpenCodeChatEngineOptions {
  officialSdkBridgeLoader?: ChatEngineOfficialSdkBridgeLoader | null;
}

interface OpenCodeSessionRecord {
  id: string | number;
}

interface OpenCodeSseResult {
  stream: AsyncIterable<unknown>;
}

interface OpenCodeSessionApi {
  create: (options?: Record<string, unknown>) => Promise<OpenCodeSessionRecord>;
  prompt: (options: Record<string, unknown>) => Promise<Record<string, unknown>>;
  promptAsync?: (options: Record<string, unknown>) => Promise<unknown>;
}

interface OpenCodeEventApi {
  subscribe?: (options?: Record<string, unknown>) => Promise<OpenCodeSseResult>;
}

interface OpenCodeSdkClient {
  session: OpenCodeSessionApi;
  event?: OpenCodeEventApi;
}

function buildOpenCodePrompt(messages: readonly ChatMessage[]): string {
  const nonSystemMessages = messages.filter((message) => message.role !== 'system');
  return buildMessageTranscriptPrompt(nonSystemMessages.length ? nonSystemMessages : messages)
    || 'Prepare the next artifact update.';
}

function buildOpenCodeSystemPrompt(messages: readonly ChatMessage[]): string | undefined {
  const systemMessages = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content.trim())
    .filter(Boolean);

  return systemMessages.length ? systemMessages.join('\n\n') : undefined;
}

function extractOpenCodeText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => extractOpenCodeText(entry)).filter(Boolean).join('');
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const record = value as Record<string, unknown>;
  if (typeof record.text === 'string') {
    return record.text;
  }
  if (typeof record.delta === 'string') {
    return record.delta;
  }

  return ['parts', 'message', 'content', 'properties']
    .map((key) => extractOpenCodeText(record[key]))
    .find(Boolean) ?? '';
}

function createOpenCodePromptBody(
  messages: readonly ChatMessage[],
): Record<string, unknown> {
  return {
    system: buildOpenCodeSystemPrompt(messages),
    parts: [
      {
        type: 'text',
        text: buildOpenCodePrompt(messages),
      },
    ],
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : null;
}

function getOpenCodeEventType(event: Record<string, unknown>): string | null {
  return typeof event.type === 'string' ? event.type : null;
}

function getOpenCodeEventProperties(
  event: Record<string, unknown>,
): Record<string, unknown> {
  return asRecord(event.properties) ?? {};
}

function getOpenCodeEventSessionId(
  event: Record<string, unknown>,
): string | null {
  const properties = getOpenCodeEventProperties(event);
  if (typeof properties.sessionID === 'string') {
    return properties.sessionID;
  }

  const info = asRecord(properties.info);
  if (typeof info?.id === 'string') {
    return info.id;
  }

  const part = asRecord(properties.part);
  if (typeof part?.sessionID === 'string') {
    return part.sessionID;
  }

  return null;
}

function toOpenCodeToolCall(
  event: Record<string, unknown>,
): ToolCall | null {
  const eventType = getOpenCodeEventType(event);
  const properties = getOpenCodeEventProperties(event);

  if (eventType === 'permission.updated') {
    return {
      id: String(properties.id ?? `opencode-permission-${Date.now()}`),
      type: 'function',
      function: {
        name: 'permission_request',
        arguments: JSON.stringify({
          type: properties.type,
          title: properties.title,
          pattern: properties.pattern,
          metadata: properties.metadata,
        }),
      },
    };
  }

  if (eventType !== 'message.part.updated') {
    return null;
  }

  const part = asRecord(properties.part);
  if (!part || part.type !== 'tool') {
    return null;
  }

  return {
    id: String(part.callID ?? part.id ?? `opencode-tool-${Date.now()}`),
    type: 'function',
    function: {
      name: String(part.tool ?? 'opencode_tool'),
      arguments: JSON.stringify({
        state: part.state ?? null,
        metadata: part.metadata ?? null,
      }),
    },
  };
}

function getOpenCodeTextDelta(
  event: Record<string, unknown>,
): string {
  if (getOpenCodeEventType(event) !== 'message.part.updated') {
    return '';
  }

  const properties = getOpenCodeEventProperties(event);
  if (typeof properties.delta === 'string') {
    return properties.delta;
  }

  const part = asRecord(properties.part);
  return part?.type === 'text' && typeof part.text === 'string'
    ? part.text
    : '';
}

function getOpenCodeEventErrorMessage(
  event: Record<string, unknown>,
): string {
  const properties = getOpenCodeEventProperties(event);
  const errorRecord = asRecord(properties.error);
  const errorData = asRecord(errorRecord?.data);

  return String(
    errorData?.message ??
    errorRecord?.message ??
    'OpenCode official SDK stream failed.',
  );
}

export function createOpenCodeOfficialSdkBridge(
  moduleNamespace: Record<string, unknown>,
): ChatEngineOfficialSdkBridge | null {
  const createOpencodeClient = typeof moduleNamespace.createOpencodeClient === 'function'
    ? moduleNamespace.createOpencodeClient as (options?: Record<string, unknown>) => OpenCodeSdkClient
    : null;
  const createOpencode = typeof moduleNamespace.createOpencode === 'function'
    ? moduleNamespace.createOpencode as (options?: Record<string, unknown>) => Promise<{
      client: OpenCodeSdkClient;
    }>
    : null;

  if (!createOpencodeClient && !createOpencode) {
    return null;
  }

  let clientPromise: Promise<OpenCodeSdkClient> | null = null;

  async function resolveClient(options?: ChatOptions) {
    if (!clientPromise) {
      clientPromise = (async () => {
        const directory = options?.context?.workspaceRoot ?? resolveRuntimeWorkingDirectory();
        const baseUrl = readRuntimeEnvValue('OPENCODE_BASE_URL');

        if (baseUrl && createOpencodeClient) {
          return createOpencodeClient({
            baseUrl,
            directory,
          });
        }

        if (createOpencode) {
          const runtime = await createOpencode();
          return runtime.client;
        }

        if (createOpencodeClient) {
          return createOpencodeClient({
            directory,
          });
        }

        throw new Error(
          'OpenCode official SDK requires OPENCODE_BASE_URL or a runtime that can create a local OpenCode server.',
        );
      })();
    }

    return clientPromise;
  }

  async function createSession(
    client: OpenCodeSdkClient,
    directory: string,
  ): Promise<OpenCodeSessionRecord> {
    return client.session.create({
      query: {
        directory,
      },
      body: {
        title: 'BirdCoder OpenCode SDK session',
      },
    });
  }

  return {
    async sendMessage(messages, options) {
      const client = await resolveClient(options);
      const directory = options?.context?.workspaceRoot ?? resolveRuntimeWorkingDirectory();
      const session = await createSession(client, directory);
      const promptResponse = await client.session.prompt({
        path: {
          id: String(session.id),
        },
        query: {
          directory,
        },
        body: createOpenCodePromptBody(messages),
      });

      return createTextChatResponse({
        id: `opencode-chat-${Date.now()}`,
        model: options?.model || 'opencode',
        content: extractOpenCodeText(promptResponse),
      });
    },
    async *sendMessageStream(messages, options) {
      const client = await resolveClient(options);
      const directory = options?.context?.workspaceRoot ?? resolveRuntimeWorkingDirectory();
      const session = await createSession(client, directory);
      const sessionId = String(session.id);
      const id = `opencode-chat-${Date.now()}`;
      const created = Math.floor(Date.now() / 1000);
      const model = options?.model || 'opencode';

      if (!client.session.promptAsync || !client.event?.subscribe) {
        const promptResponse = await client.session.prompt({
          path: {
            id: sessionId,
          },
          query: {
            directory,
          },
          body: createOpenCodePromptBody(messages),
        });
        const content = extractOpenCodeText(promptResponse);
        if (content) {
          yield createTextStreamChunk({
            id,
            created,
            model,
            role: 'assistant',
            content,
          });
        }
        yield createTextStreamChunk({
          id,
          created,
          model,
          finishReason: 'stop',
        });
        return;
      }

      const eventStream = await client.event.subscribe({
        query: {
          directory,
        },
      });

      await client.session.promptAsync({
        path: {
          id: sessionId,
        },
        query: {
          directory,
        },
        body: createOpenCodePromptBody(messages),
      });

      for await (const rawEvent of eventStream.stream) {
        const event = asRecord(rawEvent);
        if (!event) {
          continue;
        }

        const eventSessionId = getOpenCodeEventSessionId(event);
        if (eventSessionId && eventSessionId !== sessionId) {
          continue;
        }

        const eventType = getOpenCodeEventType(event);
        if (!eventType) {
          continue;
        }

        if (eventType === 'session.error') {
          throw new Error(getOpenCodeEventErrorMessage(event));
        }

        if (eventType === 'session.idle') {
          yield createTextStreamChunk({
            id,
            created,
            model,
            finishReason: 'stop',
          });
          return;
        }

        const textDelta = getOpenCodeTextDelta(event);
        if (textDelta) {
          yield createTextStreamChunk({
            id,
            created,
            model,
            role: 'assistant',
            content: textDelta,
          });
        }

        const toolCall = toOpenCodeToolCall(event);
        if (toolCall) {
          yield createToolCallStreamChunk({
            id,
            created,
            model,
            toolCall,
          });
        }
      }

      yield createTextStreamChunk({
        id,
        created,
        model,
        finishReason: 'stop',
      });
    },
  };
}

const DEFAULT_OPENCODE_OFFICIAL_SDK_BRIDGE_LOADER = createModuleBackedOfficialSdkBridgeLoader({
  candidates: [
    {
      kind: 'package',
      specifier: '@opencode-ai/sdk',
    },
    {
      kind: 'path',
      specifier: 'external/opencode/packages/sdk/js/src/index.ts',
    },
  ],
  createBridge: createOpenCodeOfficialSdkBridge,
});

export class OpenCodeChatEngine implements IChatEngine {
  name = 'opencode-sdk-adapter';
  version = '1.2.0';

  private readonly officialSdkBridgeLoader: ChatEngineOfficialSdkBridgeLoader | null;

  constructor(options: OpenCodeChatEngineOptions = {}) {
    this.officialSdkBridgeLoader =
      options.officialSdkBridgeLoader ?? DEFAULT_OPENCODE_OFFICIAL_SDK_BRIDGE_LOADER;
  }

  describeIntegration() {
    return OPENCODE_INTEGRATION;
  }

  describeRawExtensions() {
    return OPENCODE_RAW_EXTENSIONS;
  }

  getHealth() {
    return createDetectedHealthReport({
      descriptor: OPENCODE_INTEGRATION,
      packagePresence: OPENCODE_PACKAGE,
      executable: 'opencode',
      authEnvKeys: ['OPENCODE_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_API_KEY'],
    });
  }

  async sendMessage(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    return invokeWithOptionalOfficialSdk({
      loader: this.officialSdkBridgeLoader,
      messages,
      options,
      fallback: async () => {
        const prompt = messages.at(-1)?.content ?? 'Prepare the next artifact update.';
        return {
          id: `opencode-chat-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: options?.model || 'opencode',
          choices: [
            {
              index: 0,
              message: {
                id: `opencode-msg-${Date.now()}`,
                role: 'assistant',
                content: `OpenCode SDK adapter prepared a local artifact update for: ${prompt}`,
                timestamp: Date.now(),
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 16,
            completion_tokens: 18,
            total_tokens: 34,
          },
        };
      },
    });
  }

  async *sendMessageStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<ChatStreamChunk, void, unknown> {
    yield* streamWithOptionalOfficialSdk({
      loader: this.officialSdkBridgeLoader,
      messages,
      options,
      fallback: async function* fallbackStream() {
        const targetPath = options?.context?.currentFile?.path || 'src/App.tsx';
        const words = ['OpenCode ', 'session ', 'parts ', 'materialized ', 'an artifact. '];
        const id = `opencode-chat-${Date.now()}`;
        const created = Math.floor(Date.now() / 1000);
        const model = options?.model || 'opencode';

        for (let index = 0; index < words.length; index += 1) {
          yield {
            id,
            object: 'chat.completion.chunk',
            created,
            model,
            choices: [
              {
                index: 0,
                delta: {
                  content: words[index],
                  role: index === 0 ? 'assistant' : undefined,
                },
                finish_reason: null,
              },
            ],
          };
        }

        yield {
          id,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    id: `opencode-call-${Date.now()}`,
                    type: 'function',
                    function: {
                      name: 'write_file',
                      arguments: JSON.stringify({
                        sessionId: 'opencode-session-local',
                        path: targetPath,
                        content: '// OpenCode SDK adapter artifact\nexport default function App() { return null; }\n',
                      }),
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        };
      },
    });
  }
}
