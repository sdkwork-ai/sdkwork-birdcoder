import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildMessageTranscriptPrompt,
  normalizeProviderToolArgumentRecord,
  resolveCumulativeTextDelta,
  streamResponseAsChunks,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-projection/src/index.ts';

import type {
  ChatMessage,
  ChatStreamChunk,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-projection/src/index.ts';

const root = path.resolve(import.meta.dirname, '..');

const messages: ChatMessage[] = [
  {
    id: 'provider-bridge-user-1',
    role: 'user',
    content: 'Use the official SDK provider bridge.',
    timestamp: Date.now(),
  },
];

const richTranscriptPrompt = buildMessageTranscriptPrompt([
  {
    id: 'provider-bridge-assistant-tool-call',
    role: 'assistant',
    content: 'I will inspect the file.',
    timestamp: Date.now(),
    tool_calls: [
      {
        id: 'tool-read-file',
        type: 'function',
        function: {
          name: 'read_file',
          arguments: '{"path":"src/App.tsx"}',
        },
      },
    ],
  },
  {
    id: 'provider-bridge-tool-response',
    role: 'tool',
    content: 'export const answer = 42;',
    timestamp: Date.now(),
    tool_call_id: 'tool-read-file',
    attachments: [
      {
        id: 'attachment-app',
        workspaceId: 101777208078558037n,
        type: 'file',
        name: 'src/App.tsx',
        content: 'export const answer = 42;',
      },
    ],
  },
]);
assert.equal(
  richTranscriptPrompt,
  [
    'ASSISTANT: I will inspect the file.',
    'TOOL_CALLS: [{"id":"tool-read-file","type":"function","function":{"name":"read_file","arguments":"{\\"path\\":\\"src/App.tsx\\"}"}}]',
    '',
    'TOOL: export const answer = 42;',
    'TOOL_CALL_ID: tool-read-file',
    'ATTACHMENTS: [{"id":"attachment-app","workspaceId":"101777208078558037","type":"file","name":"src/App.tsx","content":"export const answer = 42;"}]',
  ].join('\n'),
  'shared provider transcript prompts must preserve tool calls, tool response ids, and attachments',
);
assert.equal(resolveCumulativeTextDelta('', 'BirdCoder response'), 'BirdCoder response');
assert.equal(resolveCumulativeTextDelta('BirdCoder ', 'BirdCoder response'), 'response');
assert.deepEqual(
  normalizeProviderToolArgumentRecord('{"path":"src/App.tsx","requestId":101777208078558036}'),
  {
    path: 'src/App.tsx',
    requestId: '101777208078558036',
  },
);

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

const responseFallbackChunks = await collectStream(
  streamResponseAsChunks({
    id: 'one-shot-with-tool-calls',
    object: 'chat.completion',
    created: 1,
    model: 'fallback-model',
    choices: [
      {
        index: 0,
        message: {
          id: 'one-shot-with-tool-calls-message',
          role: 'assistant',
          content: 'I need to run a command.',
          timestamp: Date.now(),
          tool_calls: [
            {
              id: 'one-shot-tool-run',
              type: 'function',
              function: {
                name: 'run_command',
                arguments: JSON.stringify({ command: 'pnpm test' }),
              },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
  }),
);
assert.equal(
  responseFallbackChunks.some((chunk) => chunk.choices[0]?.delta.content === 'I need to run a command.'),
  true,
);

const kernelRuntimeSource = readFileSync(
  path.join(
    root,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/kernelRuntime.ts',
  ),
  'utf8',
);
assert.match(kernelRuntimeSource, /buildMessageTranscriptPrompt/);
assert.match(kernelRuntimeSource, /birdcoder-kernel-turn/);

for (const removedPackage of [
  'sdkwork-birdcoder-pc-chat-codex',
  'sdkwork-birdcoder-pc-chat-claude',
  'sdkwork-birdcoder-pc-chat-gemini',
  'sdkwork-birdcoder-pc-chat-opencode',
]) {
  assert.equal(
    existsSync(path.join(root, 'apps/sdkwork-birdcoder-pc/packages', removedPackage)),
    false,
    `Per-engine pc-chat adapter package ${removedPackage} must be retired in favor of sdkwork-kernel bindings.`,
  );
}

const adaptersSource = readFileSync(
  path.join(root, 'crates/sdkwork-birdcoder-api-server/src/bootstrap/adapters.rs'),
  'utf8',
);
assert.match(adaptersSource, /KernelBridgeCodeEngineProvider/);

console.log('provider official sdk bridge contract passed.');
