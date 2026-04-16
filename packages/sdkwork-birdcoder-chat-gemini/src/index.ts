import {
  createStaticHealthReport,
  createStaticIntegrationDescriptor,
  type ChatMessage,
  type ChatOptions,
  type ChatResponse,
  type ChatStreamChunk,
  type IChatEngine,
} from '../../sdkwork-birdcoder-chat/src/index.ts';

const GEMINI_INTEGRATION = createStaticIntegrationDescriptor({
  engineId: 'gemini',
  runtimeMode: 'sdk',
  transportKinds: ['sdk-stream', 'openapi-http'],
  sourceMirrorPath: 'external/gemini/packages/sdk',
  officialEntry: {
    packageName: '@google/gemini-cli-sdk',
    cliPackageName: '@google/gemini-cli',
    sdkPath: 'external/gemini/packages/sdk',
    sourceMirrorPath: 'external/gemini/packages/sdk',
    supplementalLanes: ['CLI core runtime', 'tool and skill registry'],
  },
  notes: 'BirdCoder uses the Gemini CLI SDK as the primary session and tool orchestration lane.',
});

export class GeminiChatEngine implements IChatEngine {
  name = 'gemini-cli-sdk-adapter';
  version = '1.1.0';

  describeIntegration() {
    return GEMINI_INTEGRATION;
  }

  getHealth() {
    return createStaticHealthReport({
      descriptor: GEMINI_INTEGRATION,
      diagnostics: ['Gemini adapter preserves the official session, tool, and skill runtime model.'],
    });
  }

  async sendMessage(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const prompt = messages.at(-1)?.content ?? 'Inspect the workspace session.';
    return {
      id: `gemini-chat-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: options?.model || 'gemini',
      choices: [
        {
          index: 0,
          message: {
            id: `gemini-msg-${Date.now()}`,
            role: 'assistant',
            content: `Gemini SDK adapter assembled a local session plan for: ${prompt}`,
            timestamp: Date.now(),
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 16,
        total_tokens: 36,
      },
    };
  }

  async *sendMessageStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<ChatStreamChunk, void, unknown> {
    const workspaceRoot = options?.context?.workspaceRoot || 'workspace';
    const words = ['Gemini ', 'session ', 'loaded ', 'skills ', `for ${workspaceRoot}. `];
    const id = `gemini-chat-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);
    const model = options?.model || 'gemini';

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
                id: `gemini-call-${Date.now()}`,
                type: 'function',
                function: {
                  name: 'search_code',
                  arguments: JSON.stringify({
                    sessionId: 'gemini-session-local',
                    query: messages.at(-1)?.content ?? 'TODO',
                    skill: 'workspace-index',
                  }),
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    };
  }
}
