import {
  buildMessageTranscriptPrompt,
  createDetectedHealthReport,
  createModuleBackedOfficialSdkBridgeLoader,
  createRawExtensionDescriptor,
  resolveRuntimeWorkingDirectory,
  createStaticIntegrationDescriptor,
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
} from '@sdkwork/birdcoder-chat';

const GEMINI_PACKAGE = resolvePackagePresence({
  packageName: '@google/gemini-cli-sdk',
  mirrorPackageJsonPath: 'external/gemini/packages/sdk/package.json',
});

const GEMINI_INTEGRATION = createStaticIntegrationDescriptor({
  engineId: 'gemini',
  runtimeMode: 'sdk',
  transportKinds: ['sdk-stream'],
  sourceMirrorPath: 'external/gemini/packages/sdk',
  officialEntry: {
    packageName: '@google/gemini-cli-sdk',
    packageVersion: GEMINI_PACKAGE.mirrorVersion,
    cliPackageName: '@google/gemini-cli',
    sdkPath: 'external/gemini/packages/sdk',
    sourceMirrorPath: 'external/gemini/packages/sdk',
    supplementalLanes: ['CLI core runtime', 'tool and skill registry'],
  },
  notes: 'BirdCoder uses the Gemini CLI SDK as the primary session and tool orchestration lane.',
});

const GEMINI_RAW_EXTENSIONS = createRawExtensionDescriptor({
  provider: 'gemini',
  primaryLane: 'session-tool-skill-context',
  supplementalLanes: GEMINI_INTEGRATION.officialEntry.supplementalLanes,
  nativeEventModel: ['session.started', 'tool.called', 'skill.loaded', 'context.updated'],
  nativeArtifactModel: ['diagnostic-bundle', 'todo-list', 'question'],
  experimentalFeatures: ['dynamic-instructions', 'skill-registry-hooks'],
  notes: 'Gemini raw lane preserves skills, tool registry hooks, and dynamic instruction assembly.',
});

export interface GeminiChatEngineOptions {
  officialSdkBridgeLoader?: ChatEngineOfficialSdkBridgeLoader | null;
}

function createUnavailableGeminiSdkError(): Error {
  return new Error(
    'Gemini CLI SDK bridge is unavailable. BirdCoder does not synthesize fallback Gemini responses.',
  );
}

const GEMINI_DEFAULT_PROMPT = 'Inspect the workspace session.';

function buildGeminiInstructions(messages: readonly ChatMessage[]): string {
  const systemMessages = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content.trim())
    .filter(Boolean);

  return systemMessages.join('\n\n') || 'You are the BirdCoder Gemini official SDK adapter.';
}

function buildGeminiPrompt(messages: readonly ChatMessage[]): string {
  const nonSystemMessages = messages.filter(
    (message) => message.role !== 'system' && message.content.trim(),
  );
  return buildMessageTranscriptPrompt(nonSystemMessages)
    || GEMINI_DEFAULT_PROMPT;
}

function extractGeminiText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => extractGeminiText(entry)).filter(Boolean).join('');
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const record = value as Record<string, unknown>;
  const directText = typeof record.text === 'string' ? record.text : '';
  if (directText) {
    return directText;
  }

  return ['value', 'content', 'parts', 'message']
    .map((key) => extractGeminiText(record[key]))
    .find(Boolean) ?? '';
}

export function createGeminiOfficialSdkBridge(
  moduleNamespace: Record<string, unknown>,
): ChatEngineOfficialSdkBridge | null {
  const GeminiCliAgent = typeof moduleNamespace.GeminiCliAgent === 'function'
    ? moduleNamespace.GeminiCliAgent as new (options: Record<string, unknown>) => {
      session: (options?: Record<string, unknown>) => {
        sendStream: (
          prompt: string,
          signal?: AbortSignal,
        ) => AsyncIterable<Record<string, unknown>>;
      };
    }
    : null;

  if (!GeminiCliAgent) {
    return null;
  }

  return {
    async sendMessage(messages, options) {
      const agent = new GeminiCliAgent({
        instructions: buildGeminiInstructions(messages),
        model: options?.model,
        cwd: options?.context?.workspaceRoot ?? resolveRuntimeWorkingDirectory(),
      });
      const session = agent.session();
      const prompt = buildGeminiPrompt(messages);
      let responseText = '';

      for await (const event of session.sendStream(prompt, options?.signal)) {
        if (event.type === 'content') {
          responseText += extractGeminiText(event.value);
        }
      }

      return createTextChatResponse({
        id: `gemini-chat-${Date.now()}`,
        model: options?.model || 'gemini',
        content: responseText,
      });
    },
    async *sendMessageStream(messages, options) {
      const id = `gemini-chat-${Date.now()}`;
      const created = Math.floor(Date.now() / 1000);
      const model = options?.model || 'gemini';
      const agent = new GeminiCliAgent({
        instructions: buildGeminiInstructions(messages),
        model: options?.model,
        cwd: options?.context?.workspaceRoot ?? resolveRuntimeWorkingDirectory(),
      });
      const session = agent.session();
      const prompt = buildGeminiPrompt(messages);

      for await (const event of session.sendStream(prompt, options?.signal)) {
        switch (event.type) {
          case 'content': {
            const content = extractGeminiText(event.value);
            if (content) {
              yield createTextStreamChunk({
                id,
                created,
                model,
                role: 'assistant',
                content,
              });
            }
            break;
          }
          case 'tool_call_request': {
            const toolRequest =
              event.value && typeof event.value === 'object'
                ? event.value as Record<string, unknown>
                : {};
            yield createToolCallStreamChunk({
              id,
              created,
              model,
              toolCall: {
                id: String(toolRequest.callId ?? `gemini-tool-${Date.now()}`),
                type: 'function',
                function: {
                  name: String(toolRequest.name ?? 'tool_call_request'),
                  arguments: JSON.stringify(toolRequest.args ?? {}),
                },
              },
            });
            break;
          }
          default:
            break;
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

const DEFAULT_GEMINI_OFFICIAL_SDK_BRIDGE_LOADER = createModuleBackedOfficialSdkBridgeLoader({
  candidates: [
    {
      kind: 'package',
      specifier: '@google/gemini-cli-sdk',
    },
    {
      kind: 'path',
      specifier: 'external/gemini/packages/sdk/dist/index.js',
    },
    {
      kind: 'path',
      specifier: 'external/gemini/packages/sdk/src/index.ts',
    },
    {
      kind: 'path',
      specifier: 'packages/sdkwork-birdcoder-chat-gemini/src/developmentOfficialSdkCandidate.ts',
    },
  ],
  createBridge: createGeminiOfficialSdkBridge,
});

export class GeminiChatEngine implements IChatEngine {
  name = 'gemini-cli-sdk-adapter';
  version = '1.2.0';

  private readonly officialSdkBridgeLoader: ChatEngineOfficialSdkBridgeLoader | null;

  constructor(options: GeminiChatEngineOptions = {}) {
    this.officialSdkBridgeLoader =
      options.officialSdkBridgeLoader ?? DEFAULT_GEMINI_OFFICIAL_SDK_BRIDGE_LOADER;
  }

  describeIntegration() {
    return GEMINI_INTEGRATION;
  }

  describeRawExtensions() {
    return GEMINI_RAW_EXTENSIONS;
  }

  getHealth() {
    return createDetectedHealthReport({
      descriptor: GEMINI_INTEGRATION,
      packagePresence: GEMINI_PACKAGE,
      executable: 'gemini',
      authEnvKeys: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'],
      fallbackRuntimeMode: null,
      fallbackAvailable: false,
    });
  }

  async sendMessage(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    return invokeWithOptionalOfficialSdk({
      loader: this.officialSdkBridgeLoader,
      messages,
      options,
      fallback: async () => {
        throw createUnavailableGeminiSdkError();
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
        throw createUnavailableGeminiSdkError();
      },
    });
  }
}
