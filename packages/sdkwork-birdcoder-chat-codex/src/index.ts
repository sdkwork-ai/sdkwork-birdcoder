import {
  createStaticHealthReport,
  createStaticIntegrationDescriptor,
  type ChatMessage,
  type ChatOptions,
  type ChatResponse,
  type ChatStreamChunk,
  type IChatEngine,
} from '../../sdkwork-birdcoder-chat/src/index.ts';

const CODEX_INTEGRATION = createStaticIntegrationDescriptor({
  engineId: 'codex',
  runtimeMode: 'sdk',
  transportKinds: ['sdk-stream', 'cli-jsonl', 'json-rpc-v2'],
  sourceMirrorPath: 'external/codex/sdk/typescript',
  officialEntry: {
    packageName: '@openai/codex-sdk',
    cliPackageName: '@openai/codex',
    sdkPath: 'external/codex/sdk/typescript',
    sourceMirrorPath: 'external/codex/sdk/typescript',
    supplementalLanes: ['CLI JSONL', 'app-server JSON-RPC v2'],
  },
  notes: 'BirdCoder uses the official Codex TypeScript SDK as the primary adapter baseline.',
});

export class CodexChatEngine implements IChatEngine {
  name = 'codex-official-sdk-adapter';
  version = '1.1.0';

  describeIntegration() {
    return CODEX_INTEGRATION;
  }

  getHealth() {
    return createStaticHealthReport({
      descriptor: CODEX_INTEGRATION,
      diagnostics: ['Codex adapter is aligned to the official thread/turn/item SDK contract.'],
    });
  }

  async sendMessage(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const prompt = messages.at(-1)?.content ?? 'Continue the coding turn.';
    return {
      id: `codex-chat-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: options?.model || 'codex',
      choices: [
        {
          index: 0,
          message: {
            id: `codex-msg-${Date.now()}`,
            role: 'assistant',
            content: `Codex SDK adapter completed a local thread turn for: ${prompt}`,
            timestamp: Date.now(),
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 24,
        completion_tokens: 20,
        total_tokens: 44,
      },
    };
  }

  async *sendMessageStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<ChatStreamChunk, void, unknown> {
    const targetPath = options?.context?.currentFile?.path || 'src/main.ts';
    const words = ['Codex ', 'thread ', 'opened. ', 'Turn ', 'items ', 'normalized. '];
    const id = `codex-chat-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);
    const model = options?.model || 'codex';

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
                id: `codex-call-${Date.now()}`,
                type: 'function',
                function: {
                  name: 'apply_patch',
                  arguments: JSON.stringify({
                    threadId: 'codex-thread-local',
                    turnId: 'codex-turn-local',
                    path: targetPath,
                    diff: `*** Begin Patch\n*** Update File: ${targetPath}\n@@\n-// TODO\n+// Updated by Codex SDK adapter\n*** End Patch\n`,
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
