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
});

const systemOnlyMessages = [
  {
    id: 'system-1',
    role: 'system' as const,
    content: 'Use the local workspace index when no user prompt is available.',
    timestamp: Date.now(),
  },
];

await assert.rejects(
  () =>
    localFallbackGeminiEngine.sendMessage(systemOnlyMessages, {
      model: 'gemini',
    }),
  /bridge is unavailable/i,
  'Gemini must fail loudly when the official SDK bridge is unavailable instead of synthesizing a local fallback response.',
);
await assert.rejects(
  async () => {
    for await (const _chunk of localFallbackGeminiEngine.sendMessageStream(systemOnlyMessages, {
      model: 'gemini',
      context: {
        workspaceRoot: 'D:\\workspace',
      },
    })) {
      // Exhaust the stream so the bridge error propagates.
    }
  },
  /bridge is unavailable/i,
  'Gemini streaming must fail loudly when the official SDK bridge is unavailable instead of synthesizing local tool calls.',
);

console.log('gemini engine contract passed.');
