import type { IChatEngine, ChatMessage, ChatOptions, ChatResponse, ChatStreamChunk } from '../../sdkwork-birdcoder-chat/src/index.ts';

export class GeminiChatEngine implements IChatEngine {
  name = 'gemini';
  version = '1.0.0';

  async sendMessage(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: options?.model || 'gemini-1.5-pro',
      choices: [
        {
          index: 0,
          message: {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'This is a mock response from Gemini engine.',
            timestamp: Date.now(),
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 12,
        completion_tokens: 14,
        total_tokens: 26,
      },
    };
  }

  async *sendMessageStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<ChatStreamChunk, void, unknown> {
    const summary = options?.context?.workspaceRoot
      ? `Workspace: ${options.context.workspaceRoot}. `
      : '';
    const words = ['Gemini ', 'engine ', 'analyzed ', 'the ', 'workspace. ', summary];
    const id = `chatcmpl-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);
    const model = options?.model || 'gemini-1.5-pro';

    for (let index = 0; index < words.length; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 40));
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

    await new Promise((resolve) => setTimeout(resolve, 50));
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
                id: `call_${Date.now()}`,
                type: 'function',
                function: {
                  name: 'search_code',
                  arguments: JSON.stringify({
                    query: messages.at(-1)?.content || 'TODO',
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
