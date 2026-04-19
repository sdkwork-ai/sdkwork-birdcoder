import assert from 'node:assert/strict';

import { CodexChatEngine } from '../packages/sdkwork-birdcoder-chat-codex/src/index.ts';
import type {
  ChatEngineOfficialSdkBridgeLoader,
  ChatMessage,
  ChatStreamChunk,
} from '../packages/sdkwork-birdcoder-chat/src/index.ts';
import { getWorkbenchCodeEngineKernel } from '../packages/sdkwork-birdcoder-codeengine/src/kernel.ts';

const NULL_OFFICIAL_SDK_BRIDGE_LOADER: ChatEngineOfficialSdkBridgeLoader = {
  load: async () => null,
};

const messages: ChatMessage[] = [
  {
    id: 'codex-cli-jsonl-contract-user-1',
    role: 'user',
    content: 'Use the CLI JSONL runtime when the official SDK package is unavailable.',
    timestamp: Date.now(),
  },
];

async function collectStream(
  iterable: AsyncIterable<ChatStreamChunk>,
): Promise<ChatStreamChunk[]> {
  const chunks: ChatStreamChunk[] = [];
  for await (const chunk of iterable) {
    chunks.push(chunk);
  }
  return chunks;
}

const codexKernel = getWorkbenchCodeEngineKernel('codex');
assert.equal(
  codexKernel.descriptor.transportKinds.includes('cli-jsonl'),
  true,
  'Codex kernel must keep the real CLI JSONL lane enabled.',
);
assert.equal(
  codexKernel.descriptor.transportKinds.includes('json-rpc-v2'),
  false,
  'Codex kernel must not advertise json-rpc-v2 until the app-server lane is actually implemented.',
);

const fakeCliJsonlEvents = [
  {
    type: 'thread.started',
    thread_id: 'fake-codex-thread',
  },
  {
    type: 'item.updated',
    item: {
      id: 'fake-codex-message',
      type: 'agent_message',
      text: 'Codex CLI bridge response.',
    },
  },
  {
    type: 'item.completed',
    item: {
      id: 'fake-codex-command',
      type: 'command_execution',
      command: 'pnpm lint',
      aggregated_output: 'ok',
      exit_code: 0,
      status: 'completed',
    },
  },
  {
    type: 'turn.completed',
  },
] as const satisfies ReadonlyArray<Record<string, unknown>>;

const engine = new CodexChatEngine({
  officialSdkBridgeLoader: NULL_OFFICIAL_SDK_BRIDGE_LOADER,
  cliJsonlTurnExecutor: async () => [...fakeCliJsonlEvents],
});

const integration = engine.describeIntegration?.();
assert.deepEqual(
  integration?.transportKinds,
  ['sdk-stream', 'cli-jsonl'],
  'Codex adapter must only advertise the SDK lane plus the implemented CLI JSONL fallback.',
);

const response = await engine.sendMessage(messages, {
  model: 'codex',
  context: {
    workspaceRoot: process.cwd(),
  },
});

assert.equal(
  response.choices[0]?.message.content,
  'Codex CLI bridge response.',
  'Codex one-shot fallback must use the CLI JSONL runtime instead of fabricating a local reply.',
);

const chunks = await collectStream(engine.sendMessageStream(messages, {
  model: 'codex',
  context: {
    workspaceRoot: process.cwd(),
  },
}));

assert.equal(
  chunks[0]?.choices[0]?.delta.content,
  'Codex CLI bridge response.',
  'Codex streaming fallback must forward assistant text from the CLI JSONL lane.',
);
assert.equal(
  chunks.find((chunk) => chunk.choices[0]?.delta.tool_calls?.length)?.choices[0]?.delta.tool_calls?.[0]?.function.name,
  'execute_command',
  'Codex streaming fallback must preserve command artifacts from the CLI JSONL lane.',
);
assert.equal(
  chunks.at(-1)?.choices[0]?.finish_reason,
  'stop',
  'Codex streaming fallback must terminate cleanly after the CLI turn completes.',
);

const missingRuntimeEngine = new CodexChatEngine({
  officialSdkBridgeLoader: NULL_OFFICIAL_SDK_BRIDGE_LOADER,
  cliJsonlTurnExecutor: null,
});

await assert.rejects(
  () => missingRuntimeEngine.sendMessage(messages, { model: 'codex' }),
  /codex/i,
  'Codex must fail clearly when neither the official SDK nor the CLI runtime is available.',
);

console.log('codex CLI JSONL runtime contract passed.');
