import type { IChatEngine, ChatMessage, ChatOptions, ChatResponse, ChatStreamChunk } from '../../sdkwork-birdcoder-chat/src/index.ts';

export class OpenCodeChatEngine implements IChatEngine {
  name = 'opencode';
  version = '1.0.0';

  async sendMessage(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    // Mock implementation for OpenCode
    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: options?.model || 'opencode',
      choices: [
        {
          index: 0,
          message: {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'This is a mock response from OpenCode engine.',
            timestamp: Date.now(),
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 10,
        total_tokens: 20
      }
    };
  }

  async *sendMessageStream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<ChatStreamChunk, void, unknown> {
    const words = ['This ', 'is ', 'a ', 'mock ', 'stream ', 'from ', 'OpenCode ', 'engine.'];
    const id = `chatcmpl-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);
    const model = options?.model || 'opencode';

    for (let i = 0; i < words.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      yield {
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [
          {
            index: 0,
            delta: {
              content: words[i],
              role: i === 0 ? 'assistant' : undefined
            },
            finish_reason: null
          }
        ]
      };
    }

    // Simulate a tool call at the end
    await new Promise(resolve => setTimeout(resolve, 50));
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
                  name: 'edit_file',
                  arguments: JSON.stringify({
                    path: '/src/App.tsx',
                    content: '// OpenCode modification\nexport default function App() { return <div>OpenCode</div>; }'
                  })
                }
              }
            ]
          },
          finish_reason: 'tool_calls'
        }
      ]
    };
  }
}
