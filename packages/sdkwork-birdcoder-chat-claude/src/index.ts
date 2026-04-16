import {
  createStaticHealthReport,
  createStaticIntegrationDescriptor,
  type ChatMessage,
  type ChatOptions,
  type ChatResponse,
  type ChatStreamChunk,
  type IChatEngine,
} from '../../sdkwork-birdcoder-chat/src/index.ts';

const CLAUDE_INTEGRATION = createStaticIntegrationDescriptor({
  engineId: 'claude-code',
  runtimeMode: 'sdk',
  transportKinds: ['sdk-stream', 'remote-control-http'],
  sourceMirrorPath: 'external/claude-code',
  officialEntry: {
    packageName: '@anthropic-ai/claude-agent-sdk',
    cliPackageName: 'claude-code',
    sdkPath: 'external/claude-code',
    sourceMirrorPath: 'external/claude-code',
    supplementalLanes: ['Headless CLI', 'remote-control', 'preview sessions'],
  },
  notes: 'BirdCoder uses the official Claude Agent SDK as the primary stable integration lane.',
});

export class ClaudeChatEngine implements IChatEngine {
  name = 'claude-agent-sdk-adapter';
  version = '1.1.0';

  describeIntegration() {
    return CLAUDE_INTEGRATION;
  }

  getHealth() {
    return createStaticHealthReport({
      descriptor: CLAUDE_INTEGRATION,
      diagnostics: ['Claude adapter keeps Agent SDK as the primary lane and remote-control as supplemental.'],
    });
  }

  async sendMessage(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const prompt = messages.at(-1)?.content ?? 'Review the current workspace.';
    return {
      id: `claude-chat-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: options?.model || 'claude-code',
      choices: [
        {
          index: 0,
          message: {
            id: `claude-msg-${Date.now()}`,
            role: 'assistant',
            content: `Claude Agent SDK adapter reviewed the local task for: ${prompt}`,
            timestamp: Date.now(),
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 18,
        completion_tokens: 18,
        total_tokens: 36,
      },
    };
  }

  async *sendMessageStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<ChatStreamChunk, void, unknown> {
    const words = ['Claude ', 'agent ', 'planned ', 'the ', 'tool ', 'progress. '];
    const id = `claude-chat-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);
    const model = options?.model || 'claude-code';

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
                id: `claude-call-${Date.now()}`,
                type: 'function',
                function: {
                  name: 'run_command',
                  arguments: JSON.stringify({
                    sessionRef: 'claude-agent-local',
                    command: 'pnpm lint',
                    rationale: messages.at(-1)?.content ?? 'Validate the current workbench change.',
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
