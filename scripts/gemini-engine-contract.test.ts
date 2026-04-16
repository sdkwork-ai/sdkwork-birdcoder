import assert from 'node:assert/strict';

import { GeminiChatEngine } from '../packages/sdkwork-birdcoder-chat-gemini/src/index.ts';
import { WORKBENCH_CODE_ENGINES, normalizeWorkbenchCodeEngineId } from '../packages/sdkwork-birdcoder-commons/src/workbench/preferences.ts';
import { createChatEngineById } from '../packages/sdkwork-birdcoder-commons/src/workbench/engines.ts';

assert.deepEqual(
  WORKBENCH_CODE_ENGINES.map((engine) => engine.id),
  ['codex', 'claude-code', 'gemini', 'opencode'],
);

assert.equal(normalizeWorkbenchCodeEngineId('Gemini'), 'gemini');
assert.equal(normalizeWorkbenchCodeEngineId('gemini cli'), 'gemini');

const geminiEngine = createChatEngineById('gemini');
assert.equal(geminiEngine.name, 'gemini-cli-sdk-adapter');

const fallbackEngine = createChatEngineById('unknown-engine');
assert.equal(fallbackEngine.name, 'codex-official-sdk-adapter');

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

const localFallbackGeminiResponse = await localFallbackGeminiEngine.sendMessage(systemOnlyMessages, {
  model: 'gemini',
});
assert.equal(
  localFallbackGeminiResponse.choices[0]?.message.content,
  'Gemini SDK adapter assembled a local session plan for: Inspect the workspace session.',
  'Gemini fallback response should not reuse system instructions as the user prompt.',
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

const fallbackToolCall = localFallbackGeminiChunks.find(
  (chunk) => chunk.choices[0]?.delta.tool_calls?.length,
)?.choices[0]?.delta.tool_calls?.[0];

assert.ok(fallbackToolCall, 'Gemini fallback stream should emit a workspace search tool call.');
assert.equal(fallbackToolCall.function.name, 'search_code');
assert.deepEqual(
  JSON.parse(fallbackToolCall.function.arguments),
  {
    sessionId: 'gemini-session-local',
    query: 'Inspect the workspace session.',
    skill: 'workspace-index',
  },
  'Gemini fallback stream should use a safe default workspace query instead of leaking placeholder text.',
);

console.log('gemini engine contract passed.');
