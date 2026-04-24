import {
  buildMessageTranscriptPrompt,
  createDetectedHealthReport,
  createModuleBackedOfficialSdkBridgeLoader,
  createRawExtensionDescriptor,
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

const CLAUDE_PACKAGE = resolvePackagePresence({
  packageName: '@anthropic-ai/claude-agent-sdk',
});

const CLAUDE_INTEGRATION = createStaticIntegrationDescriptor({
  engineId: 'claude-code',
  runtimeMode: 'sdk',
  transportKinds: ['sdk-stream'],
  sourceMirrorPath: 'external/claude-code',
  officialEntry: {
    packageName: '@anthropic-ai/claude-agent-sdk',
    packageVersion: CLAUDE_PACKAGE.installedVersion,
    cliPackageName: 'claude-code',
    sdkPath: null,
    sourceMirrorPath: 'external/claude-code',
    supplementalLanes: ['query stream', 'tool progress', 'preview sessions'],
  },
  notes: 'BirdCoder uses the official Claude Agent SDK as the primary stable integration lane.',
});

const CLAUDE_RAW_EXTENSIONS = createRawExtensionDescriptor({
  provider: 'claude-code',
  primaryLane: 'agent-query-tool-progress',
  supplementalLanes: CLAUDE_INTEGRATION.officialEntry.supplementalLanes,
  nativeEventModel: ['query.delta', 'tool.progress', 'approval.requested'],
  nativeArtifactModel: ['command-log', 'patch', 'review-note'],
  experimentalFeatures: ['preview-session-api'],
  notes: 'Claude raw lane preserves agent progress, headless control, and preview session semantics.',
});

export interface ClaudeChatEngineOptions {
  officialSdkBridgeLoader?: ChatEngineOfficialSdkBridgeLoader | null;
}

function createUnavailableClaudeSdkError(): Error {
  return new Error(
    'Claude Agent SDK bridge is unavailable. BirdCoder does not synthesize fallback Claude responses.',
  );
}

function buildClaudePrompt(messages: readonly ChatMessage[]): string {
  return buildMessageTranscriptPrompt(messages) || 'Review the current workspace.';
}

function extractClaudeText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => extractClaudeText(entry)).filter(Boolean).join('');
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const record = value as Record<string, unknown>;
  const preferredKeys = ['result', 'text', 'content', 'message', 'event'];
  for (const key of preferredKeys) {
    const text = extractClaudeText(record[key]);
    if (text) {
      return text;
    }
  }

  return '';
}

function createClaudeSdkOptions(options?: ChatOptions): Record<string, unknown> {
  return {
    ...(options?.model ? { model: options.model } : {}),
    ...(options?.context?.workspaceRoot ? { cwd: options.context.workspaceRoot } : {}),
    ...(options?.signal ? { signal: options.signal } : {}),
  };
}

function mergeClaudeQueryResultText(
  streamedText: string,
  resultText: string,
): string {
  if (!resultText) {
    return streamedText;
  }

  if (!streamedText) {
    return resultText;
  }

  return streamedText + getClaudeQueryResultDelta(streamedText, resultText);
}

function getClaudeQueryResultDelta(
  streamedText: string,
  resultText: string,
): string {
  if (!resultText) {
    return '';
  }

  if (!streamedText) {
    return resultText;
  }

  const overlapLimit = Math.min(streamedText.length, resultText.length);
  for (let overlapLength = overlapLimit; overlapLength > 0; overlapLength -= 1) {
    if (streamedText.slice(-overlapLength) === resultText.slice(0, overlapLength)) {
      return resultText.slice(overlapLength);
    }
  }

  return resultText;
}

export function createClaudeOfficialSdkBridge(
  moduleNamespace: Record<string, unknown>,
): ChatEngineOfficialSdkBridge | null {
  const promptOnce = typeof moduleNamespace.unstable_v2_prompt === 'function'
    ? moduleNamespace.unstable_v2_prompt as (
      prompt: string,
      options?: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>
    : null;
  const query = typeof moduleNamespace.query === 'function'
    ? moduleNamespace.query as (input: {
      prompt: string;
      options?: Record<string, unknown>;
    }) => AsyncIterable<Record<string, unknown>>
    : null;

  if (!promptOnce && !query) {
    return null;
  }

  return {
    async sendMessage(messages, options) {
      const prompt = buildClaudePrompt(messages);
      const sdkOptions = createClaudeSdkOptions(options);

      if (promptOnce) {
        const result = await promptOnce(prompt, sdkOptions);
        return createTextChatResponse({
          id: `claude-chat-${Date.now()}`,
          model: options?.model || 'claude-code',
          content: extractClaudeText(result),
        });
      }

      let streamedResponseText = '';
      let resultResponseText = '';
      for await (const event of query!({ prompt, options: sdkOptions })) {
        switch (event.type) {
          case 'partial_assistant':
            streamedResponseText += extractClaudeText(event.event);
            break;
          case 'assistant':
            streamedResponseText += extractClaudeText(event);
            break;
          case 'result':
            resultResponseText = extractClaudeText(event);
            break;
          default:
            break;
        }
      }

      return createTextChatResponse({
        id: `claude-chat-${Date.now()}`,
        model: options?.model || 'claude-code',
        content: mergeClaudeQueryResultText(
          streamedResponseText,
          resultResponseText,
        ),
      });
    },
    async *sendMessageStream(messages, options) {
      if (!query) {
        return;
      }

      const id = `claude-chat-${Date.now()}`;
      const created = Math.floor(Date.now() / 1000);
      const model = options?.model || 'claude-code';
      const prompt = buildClaudePrompt(messages);
      let streamedResponseText = '';

      for await (const event of query({
        prompt,
        options: createClaudeSdkOptions(options),
      })) {
        switch (event.type) {
          case 'partial_assistant': {
            const content = extractClaudeText(event.event);
            if (content) {
              streamedResponseText += content;
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
          case 'assistant': {
            const content = extractClaudeText(event);
            if (content) {
              streamedResponseText += content;
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
          case 'tool_progress':
            yield createToolCallStreamChunk({
              id,
              created,
              model,
              toolCall: {
                id: String(event.tool_use_id ?? `claude-tool-${Date.now()}`),
                type: 'function',
                function: {
                  name: String(event.tool_name ?? 'tool_progress'),
                  arguments: JSON.stringify({
                    elapsedTimeSeconds: event.elapsed_time_seconds,
                  }),
                },
              },
            });
            break;
          case 'result': {
            const content = getClaudeQueryResultDelta(
              streamedResponseText,
              extractClaudeText(event),
            );
            if (content) {
              streamedResponseText += content;
              yield createTextStreamChunk({
                id,
                created,
                model,
                content,
                finishReason: 'stop',
              });
            } else {
              yield createTextStreamChunk({
                id,
                created,
                model,
                finishReason: 'stop',
              });
            }
            break;
          }
          case 'assistant_error':
            throw new Error(extractClaudeText(event.error) || 'Claude Agent SDK stream failed.');
          default:
            break;
        }
      }
    },
  };
}

const DEFAULT_CLAUDE_OFFICIAL_SDK_BRIDGE_LOADER = createModuleBackedOfficialSdkBridgeLoader({
  candidates: [
    {
      kind: 'package',
      specifier: '@anthropic-ai/claude-agent-sdk',
    },
    {
      kind: 'path',
      specifier: 'packages/sdkwork-birdcoder-chat-claude/src/developmentOfficialSdkCandidate.ts',
    },
  ],
  createBridge: createClaudeOfficialSdkBridge,
});

export class ClaudeChatEngine implements IChatEngine {
  name = 'claude-agent-sdk-adapter';
  version = '1.2.0';

  private readonly officialSdkBridgeLoader: ChatEngineOfficialSdkBridgeLoader | null;

  constructor(options: ClaudeChatEngineOptions = {}) {
    this.officialSdkBridgeLoader =
      options.officialSdkBridgeLoader ?? DEFAULT_CLAUDE_OFFICIAL_SDK_BRIDGE_LOADER;
  }

  describeIntegration() {
    return CLAUDE_INTEGRATION;
  }

  describeRawExtensions() {
    return CLAUDE_RAW_EXTENSIONS;
  }

  getHealth() {
    return createDetectedHealthReport({
      descriptor: CLAUDE_INTEGRATION,
      packagePresence: CLAUDE_PACKAGE,
      executable: 'claude',
      authEnvKeys: ['ANTHROPIC_API_KEY'],
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
        throw createUnavailableClaudeSdkError();
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
        throw createUnavailableClaudeSdkError();
      },
    });
  }
}
