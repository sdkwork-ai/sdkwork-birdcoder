import assert from 'node:assert/strict';

import {
  createClaudeOfficialSdkBridge,
} from '../packages/sdkwork-birdcoder-chat-claude/src/index.ts';
import {
  createCodexOfficialSdkBridge,
} from '../packages/sdkwork-birdcoder-chat-codex/src/index.ts';
import {
  createGeminiOfficialSdkBridge,
} from '../packages/sdkwork-birdcoder-chat-gemini/src/index.ts';

import type {
  ChatMessage,
  ChatStreamChunk,
} from '../packages/sdkwork-birdcoder-chat/src/index.ts';

const messages: ChatMessage[] = [
  {
    id: 'provider-bridge-user-1',
    role: 'user',
    content: 'Use the official SDK provider bridge.',
    timestamp: Date.now(),
  },
];

async function collectStream(
  iterableOrPromise: AsyncIterable<ChatStreamChunk> | Promise<AsyncIterable<ChatStreamChunk>>,
): Promise<ChatStreamChunk[]> {
  const iterable = await iterableOrPromise;
  const chunks: ChatStreamChunk[] = [];
  for await (const chunk of iterable) {
    chunks.push(chunk);
  }
  return chunks;
}

const codexBridge = createCodexOfficialSdkBridge({
  Codex: class {
    startThread() {
      return {
        run: async () => ({
          finalResponse: 'Codex bridge response',
          usage: {
            input_tokens: 3,
            cached_input_tokens: 1,
            output_tokens: 4,
          },
        }),
        runStreamed: async () => ({
          events: (async function* () {
            yield {
              type: 'item.updated',
              item: {
                type: 'agent_message',
                text: 'Codex ',
              },
            };
            yield {
              type: 'item.completed',
              item: {
                id: 'codex-tool-1',
                type: 'command_execution',
                command: 'pnpm lint',
                aggregated_output: 'ok',
                exit_code: 0,
                status: 'completed',
              },
            };
            yield {
              type: 'turn.completed',
            };
          })(),
        }),
      };
    }
  },
});

assert.ok(codexBridge, 'Codex bridge should be created from the official SDK surface');
const codexResponse = await codexBridge!.sendMessage!(messages, {
  model: 'codex',
});
assert.equal(codexResponse.choices[0]?.message.content, 'Codex bridge response');
assert.deepEqual(codexResponse.usage, {
  prompt_tokens: 4,
  completion_tokens: 4,
  total_tokens: 8,
});
const codexChunks = await collectStream(codexBridge!.sendMessageStream!(messages, {
  model: 'codex',
}));
assert.equal(codexChunks[0]?.choices[0]?.delta.content, 'Codex ');
assert.equal(
  codexChunks.find((chunk) => chunk.choices[0]?.delta.tool_calls?.length)?.choices[0]?.delta.tool_calls?.[0]?.function.name,
  'execute_command',
);
assert.equal(codexChunks.at(-1)?.choices[0]?.finish_reason, 'stop');

const claudeBridge = createClaudeOfficialSdkBridge({
  unstable_v2_prompt: async () => ({
    result: 'Claude bridge response',
  }),
  query: async function* () {
    yield {
      type: 'partial_assistant',
      event: {
        text: 'Claude ',
      },
    };
    yield {
      type: 'tool_progress',
      tool_use_id: 'claude-tool-1',
      tool_name: 'run_command',
      elapsed_time_seconds: 2,
    };
    yield {
      type: 'result',
      result: 'done',
    };
  },
});

assert.ok(claudeBridge, 'Claude bridge should be created from the official SDK surface');
const claudeResponse = await claudeBridge!.sendMessage!(messages, {
  model: 'claude-code',
});
assert.equal(claudeResponse.choices[0]?.message.content, 'Claude bridge response');
const claudeChunks = await collectStream(claudeBridge!.sendMessageStream!(messages, {
  model: 'claude-code',
}));
assert.equal(claudeChunks[0]?.choices[0]?.delta.content, 'Claude ');
assert.equal(
  claudeChunks.find((chunk) => chunk.choices[0]?.delta.tool_calls?.length)?.choices[0]?.delta.tool_calls?.[0]?.function.name,
  'run_command',
);
assert.equal(claudeChunks.at(-1)?.choices[0]?.finish_reason, 'stop');

const claudeQueryOnlyBridge = createClaudeOfficialSdkBridge({
  query: async function* () {
    yield {
      type: 'partial_assistant',
      event: {
        text: 'Claude ',
      },
    };
    yield {
      type: 'partial_assistant',
      event: {
        text: 'query ',
      },
    };
    yield {
      type: 'result',
      result: 'response',
    };
  },
});

assert.ok(claudeQueryOnlyBridge, 'Claude bridge should support query-only official SDK surfaces');
const claudeQueryOnlyResponse = await claudeQueryOnlyBridge!.sendMessage!(messages, {
  model: 'claude-code',
});
assert.equal(
  claudeQueryOnlyResponse.choices[0]?.message.content,
  'Claude query response',
  'Claude query-only bridge should aggregate streamed partials and the final result into one-shot output',
);

const claudeQueryStreamDedupBridge = createClaudeOfficialSdkBridge({
  query: async function* () {
    yield {
      type: 'partial_assistant',
      event: {
        text: 'Claude ',
      },
    };
    yield {
      type: 'partial_assistant',
      event: {
        text: 'bridge ',
      },
    };
    yield {
      type: 'result',
      result: 'Claude bridge response',
    };
  },
});

assert.ok(
  claudeQueryStreamDedupBridge,
  'Claude bridge should support query streams whose final result repeats the full assistant text',
);
const claudeQueryStreamDedupChunks = await collectStream(
  claudeQueryStreamDedupBridge!.sendMessageStream!(messages, {
    model: 'claude-code',
  }),
);
assert.equal(
  claudeQueryStreamDedupChunks.map((chunk) => chunk.choices[0]?.delta.content ?? '').join(''),
  'Claude bridge response',
  'Claude stream bridge should not duplicate already-streamed partial text when the result event carries the full final response',
);
assert.equal(
  claudeQueryStreamDedupChunks.at(-1)?.choices[0]?.finish_reason,
  'stop',
  'Claude deduplicated result stream should still terminate cleanly',
);

const geminiBridge = createGeminiOfficialSdkBridge({
  GeminiCliAgent: class {
    constructor(_options: Record<string, unknown>) {}

    session() {
      return {
        sendStream: async function* () {
          yield {
            type: 'content',
            value: {
              text: 'Gemini ',
            },
          };
          yield {
            type: 'tool_call_request',
            value: {
              callId: 'gemini-tool-1',
              name: 'search_code',
              args: {
                query: 'TODO',
              },
            },
          };
          yield {
            type: 'content',
            value: {
              text: 'bridge response',
            },
          };
        },
      };
    }
  },
});

assert.ok(geminiBridge, 'Gemini bridge should be created from the official SDK surface');
const geminiResponse = await geminiBridge!.sendMessage!(messages, {
  model: 'gemini',
});
assert.equal(geminiResponse.choices[0]?.message.content, 'Gemini bridge response');
const geminiChunks = await collectStream(geminiBridge!.sendMessageStream!(messages, {
  model: 'gemini',
}));
assert.equal(
  geminiChunks.map((chunk) => chunk.choices[0]?.delta.content ?? '').join(''),
  'Gemini bridge response',
);
assert.equal(
  geminiChunks.find((chunk) => chunk.choices[0]?.delta.tool_calls?.length)?.choices[0]?.delta.tool_calls?.[0]?.function.name,
  'search_code',
);
assert.equal(geminiChunks.at(-1)?.choices[0]?.finish_reason, 'stop');

console.log('provider official sdk bridge contract passed.');
