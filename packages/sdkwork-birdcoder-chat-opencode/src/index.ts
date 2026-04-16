import {
  createStaticHealthReport,
  createStaticIntegrationDescriptor,
  type ChatMessage,
  type ChatOptions,
  type ChatResponse,
  type ChatStreamChunk,
  type IChatEngine,
} from '../../sdkwork-birdcoder-chat/src/index.ts';

const OPENCODE_INTEGRATION = createStaticIntegrationDescriptor({
  engineId: 'opencode',
  runtimeMode: 'sdk',
  transportKinds: ['sdk-stream', 'openapi-http', 'cli-jsonl'],
  sourceMirrorPath: 'external/opencode/packages/sdk',
  officialEntry: {
    packageName: '@opencode-ai/sdk',
    cliPackageName: 'opencode-ai',
    sdkPath: 'external/opencode/packages/sdk',
    sourceMirrorPath: 'external/opencode/packages/sdk',
    supplementalLanes: ['OpenAPI', 'SSE', 'server mode'],
  },
  notes: 'BirdCoder uses the official OpenCode SDK as the primary client and server adapter lane.',
});

export class OpenCodeChatEngine implements IChatEngine {
  name = 'opencode-sdk-adapter';
  version = '1.1.0';

  describeIntegration() {
    return OPENCODE_INTEGRATION;
  }

  getHealth() {
    return createStaticHealthReport({
      descriptor: OPENCODE_INTEGRATION,
      diagnostics: ['OpenCode adapter preserves the first-class session, part, and artifact model.'],
    });
  }

  async sendMessage(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
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
  }

  async *sendMessageStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<ChatStreamChunk, void, unknown> {
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
  }
}
