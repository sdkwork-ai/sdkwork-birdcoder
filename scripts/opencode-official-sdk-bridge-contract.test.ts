import assert from 'node:assert/strict';

import {
  createOpenCodeOfficialSdkBridge,
} from '../packages/sdkwork-birdcoder-chat-opencode/src/index.ts';

import type {
  ChatStreamChunk,
} from '../packages/sdkwork-birdcoder-chat/src/index.ts';

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

const bridge = createOpenCodeOfficialSdkBridge({
  createOpencodeClient: () => ({
    session: {
      create: async () => ({
        id: 'session-1',
      }),
      prompt: async () => ({
        parts: [],
      }),
      promptAsync: async () => undefined,
    },
    event: {
      subscribe: async () => ({
        stream: (async function* () {
          yield {
            type: 'message.part.updated',
            properties: {
              part: {
                id: 'part-text-1',
                sessionID: 'session-1',
                messageID: 'message-1',
                type: 'text',
                text: 'OpenCode final text',
              },
              delta: 'OpenCode ',
            },
          };

          yield {
            type: 'message.part.updated',
            properties: {
              part: {
                id: 'part-tool-1',
                sessionID: 'session-1',
                messageID: 'message-1',
                type: 'tool',
                callID: 'tool-1',
                tool: 'write_file',
                state: {
                  status: 'running',
                  input: {
                    path: 'src/App.tsx',
                  },
                  time: {
                    start: Date.now(),
                  },
                },
              },
            },
          };

          yield {
            type: 'session.idle',
            properties: {
              sessionID: 'session-1',
            },
          };
        })(),
      }),
    },
  }),
});

assert.ok(bridge, 'OpenCode bridge should be created from the official SDK surface');

const streamChunks = await collectStream(
  bridge!.sendMessageStream!(
    [
      {
        id: 'user-1',
        role: 'user',
        content: 'Create an artifact stream.',
        timestamp: Date.now(),
      },
    ],
    {
      model: 'opencode',
      context: {
        workspaceRoot: 'D:/workspace/demo',
      },
    },
  ),
);

assert.equal(
  streamChunks.map((chunk) => chunk.choices[0]?.delta.content ?? '').join(''),
  'OpenCode ',
  'OpenCode official SDK bridge should forward text deltas from SSE events',
);

const toolChunk = streamChunks.find(
  (chunk) => (chunk.choices[0]?.delta.tool_calls?.length ?? 0) > 0,
);

assert.ok(toolChunk, 'OpenCode official SDK bridge should project tool parts into canonical tool call chunks');
assert.equal(
  toolChunk?.choices[0]?.delta.tool_calls?.[0]?.function.name,
  'write_file',
);
assert.equal(
  streamChunks.at(-1)?.choices[0]?.finish_reason,
  'stop',
  'OpenCode official SDK bridge should stop when the session becomes idle',
);

console.log('opencode official sdk bridge contract passed.');
