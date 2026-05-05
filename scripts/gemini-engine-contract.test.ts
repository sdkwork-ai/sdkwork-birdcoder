import assert from 'node:assert/strict';

import { GeminiChatEngine } from '../packages/sdkwork-birdcoder-chat-gemini/src/index.ts';
import { createChatEngineById } from '../packages/sdkwork-birdcoder-codeengine/src/engines.ts';
import {
  WORKBENCH_CODE_ENGINES,
  normalizeWorkbenchCodeEngineId,
} from '../packages/sdkwork-birdcoder-codeengine/src/preferences.ts';

assert.deepEqual(
  WORKBENCH_CODE_ENGINES.map((engine) => engine.id),
  ['codex', 'claude-code', 'gemini', 'opencode'],
);

assert.equal(normalizeWorkbenchCodeEngineId('Gemini'), 'gemini');
assert.equal(normalizeWorkbenchCodeEngineId('gemini cli'), 'gemini');

const geminiEngine = createChatEngineById('gemini');
assert.equal(geminiEngine.name, 'gemini-cli-sdk-adapter');

assert.throws(
  () => createChatEngineById('unknown-engine'),
  /unknown engineId/i,
  'Chat engine creation must reject unknown engine ids instead of silently falling back to Codex.',
);

const localFallbackGeminiEngine = new GeminiChatEngine({
  officialSdkBridgeLoader: null,
  geminiCliJsonlTurnExecutor: async function* geminiCliJsonlTurn(prompt, options) {
    assert.match(
      prompt,
      /Use the local workspace index/,
      'Gemini CLI fallback should receive the canonical transcript prompt.',
    );
    assert.equal(
      options?.model,
      'gemini',
      'Gemini CLI fallback should preserve the selected BirdCoder model in ChatOptions.',
    );
    yield {
      type: 'message',
      role: 'assistant',
      content: 'Gemini CLI fallback inspected the workspace.',
      delta: true,
    };
    yield {
      type: 'result',
      status: 'success',
    };
  },
});

const systemOnlyMessages = [
  {
    id: 'system-1',
    role: 'system' as const,
    content: 'Use the local workspace index when no user prompt is available.',
    timestamp: Date.now(),
  },
];

const localFallbackGeminiResponse = await localFallbackGeminiEngine.sendMessage(systemOnlyMessages, {
  model: 'gemini',
});
assert.equal(
  localFallbackGeminiResponse.choices[0]?.message.content,
  'Gemini CLI fallback inspected the workspace.',
  'Gemini should use the real CLI JSONL fallback when the official SDK bridge is unavailable.',
);
const localFallbackGeminiChunks = [];
for await (const chunk of localFallbackGeminiEngine.sendMessageStream(systemOnlyMessages, {
  model: 'gemini',
  context: {
    workspaceRoot: 'D:\\workspace',
  },
})) {
  localFallbackGeminiChunks.push(chunk);
}
assert.equal(
  localFallbackGeminiChunks.map((chunk) => chunk.choices[0]?.delta.content ?? '').join(''),
  'Gemini CLI fallback inspected the workspace.',
  'Gemini streaming should yield deltas from the real CLI JSONL fallback when the official SDK bridge is unavailable.',
);

const unavailableGeminiEngine = new GeminiChatEngine({
  officialSdkBridgeLoader: null,
  geminiCliJsonlTurnExecutor: null,
});
await assert.rejects(
  () =>
    unavailableGeminiEngine.sendMessage(systemOnlyMessages, {
      model: 'gemini',
    }),
  /CLI fallback.*unavailable/i,
  'Gemini must fail loudly when both the official SDK bridge and CLI fallback are unavailable.',
);
await assert.rejects(
  async () => {
    for await (const _chunk of unavailableGeminiEngine.sendMessageStream(systemOnlyMessages, {
      model: 'gemini',
    })) {
      // Exhaust the stream so the bridge error propagates.
    }
  },
  /CLI fallback.*unavailable/i,
  'Gemini streaming must fail loudly when both the official SDK bridge and CLI fallback are unavailable.',
);

console.log('gemini engine contract passed.');
