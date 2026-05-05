import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const readSource = (path) => readFile(resolve(path), 'utf8');

const [
  authSurfaceSource,
  codeFileSearchSource,
  draftStoreSource,
  terminalRuntimeSource,
  projectionRepositorySource,
  replaceColorsSource,
  chatIndexSource,
  chatTypesSource,
  chatProviderAdapterSource,
  codexSource,
  claudeSource,
  geminiSource,
  openCodeSource,
] = await Promise.all([
  readSource('packages/sdkwork-birdcoder-auth/src/auth-surface.ts'),
  readSource('packages/sdkwork-birdcoder-code/src/pages/codeFileSearch.ts'),
  readSource('packages/sdkwork-birdcoder-commons/src/chat/draftStore.ts'),
  readSource('packages/sdkwork-birdcoder-commons/src/terminal/runtime.ts'),
  readSource('packages/sdkwork-birdcoder-server/src/projectionRepository.ts'),
  readSource('replace-colors.cjs'),
  readSource('packages/sdkwork-birdcoder-chat/src/index.ts'),
  readSource('packages/sdkwork-birdcoder-chat/src/types.ts'),
  readSource('packages/sdkwork-birdcoder-chat/src/providerAdapter.ts'),
  readSource('packages/sdkwork-birdcoder-chat-codex/src/index.ts'),
  readSource('packages/sdkwork-birdcoder-chat-claude/src/index.ts'),
  readSource('packages/sdkwork-birdcoder-chat-gemini/src/index.ts'),
  readSource('packages/sdkwork-birdcoder-chat-opencode/src/index.ts'),
]);

assert.doesNotMatch(
  authSurfaceSource,
  /local-default@sdkwork-birdcoder\.local|dev123456/,
  'Auth source must not ship built-in local development account or password literals.',
);
assert.match(
  authSurfaceSource,
  /configuredAccount\s*\|\|\s*configuredEmail/,
  'Auth development prefill must be driven by explicit public env values instead of source defaults.',
);

assert.match(
  codeFileSearchSource,
  /CODE_QUICK_OPEN_SEARCH_MAX_STACK_DEPTH/,
  'Quick-open search must bound traversal stack depth to avoid unbounded memory growth on deep trees.',
);
assert.match(
  codeFileSearchSource,
  /if\s*\(\s*searchStack\.length\s*<\s*CODE_QUICK_OPEN_SEARCH_MAX_STACK_DEPTH\s*\)/,
  'Quick-open search must guard child frame pushes with the maximum stack depth.',
);

assert.match(
  draftStoreSource,
  /MAX_CHAT_INPUT_DRAFT_ENTRIES/,
  'Chat input draft store must bound retained draft entries.',
);
assert.match(
  draftStoreSource,
  /pruneChatInputDrafts/,
  'Chat input draft store must prune oldest unused draft entries.',
);

assert.match(
  terminalRuntimeSource,
  /TERMINAL_CLI_PROFILE_AVAILABILITY_CONCURRENCY/,
  'Terminal CLI profile availability checks must use an explicit concurrency limit.',
);
assert.match(
  terminalRuntimeSource,
  /mapWithConcurrencyLimit/,
  'Terminal CLI profile availability checks must be scheduled through a bounded concurrency helper.',
);
assert.doesNotMatch(
  terminalRuntimeSource,
  /Promise\.all\(\s*TERMINAL_CLI_PROFILE_REGISTRY\.map/,
  'Terminal CLI profile availability must not fan out all Tauri invoke calls through an unbounded Promise.all.',
);

assert.doesNotMatch(
  projectionRepositorySource,
  /if\s*\(\s*!normalizedModelId\s*\)\s*\{\s*return null;\s*\}/,
  'Projection runtime normalization must keep rows whose model_id is temporarily unknown.',
);
assert.match(
  projectionRepositorySource,
  /DEFAULT_UNKNOWN_RUNTIME_MODEL_ID/,
  'Projection runtime normalization must use an explicit placeholder for unknown model ids.',
);

assert.match(
  replaceColorsSource,
  /writeBackupFileSync/,
  'replace-colors.cjs must write a backup before mutating source files.',
);
assert.match(
  replaceColorsSource,
  /backupPath/,
  'replace-colors.cjs must keep backup path handling explicit.',
);

assert.match(
  chatTypesSource,
  /ChatEngineRegistryEntry/,
  'Chat package types must expose a typed engine registry entry contract.',
);
assert.match(
  chatIndexSource,
  /createChatEngineRegistry/,
  'Chat package must expose engine registry helpers for unified engine discovery.',
);
assert.match(
  chatProviderAdapterSource,
  /createDefaultChatEngineCapabilitySnapshot/,
  'Chat provider adapter must expose shared default capability snapshots for engines.',
);
assert.match(
  chatProviderAdapterSource,
  /createDefaultChatCanonicalRuntimeDescriptor/,
  'Chat provider adapter must expose shared runtime descriptor creation for engines.',
);
assert.match(
  chatProviderAdapterSource,
  /createRuntimeIntegrationDescriptor/,
  'Chat provider adapter must expose runtime integration descriptor creation for dynamic SDK/package discovery.',
);
assert.match(
  chatProviderAdapterSource,
  /canonicalEventsFromChatStream/,
  'Chat provider adapter must expose a canonical event adapter for default engine implementations.',
);

assert.match(
  codexSource,
  /invokeWithOptionalOfficialSdk/,
  'Codex must import and use the shared optional official SDK invocation helper.',
);
assert.match(
  codexSource,
  /streamWithOptionalOfficialSdk/,
  'Codex must import and use the shared optional official SDK stream helper.',
);
assert.doesNotMatch(
  codexSource,
  /const bridge = await this\.officialSdkBridgeLoader\?\.load\(\);/,
  'Codex must not directly load the official SDK bridge in sendMessage/sendMessageStream.',
);

for (const [engineName, source] of [
  ['Claude', claudeSource],
  ['Codex', codexSource],
]) {
  assert.doesNotMatch(
    source,
    /addEventListener\('abort', handleAbort, \{ once: true \}\)/,
    `${engineName} CLI abort cleanup must not combine once listeners with explicit removeEventListener cleanup.`,
  );
}

assert.match(
  claudeSource,
  /streamClaudeCliJsonlTurn/,
  'Claude must implement a real default CLI JSONL fallback streamer.',
);
assert.match(
  claudeSource,
  /claudeCliTurnEventStreamer/,
  'Claude stream fallback must consume the default CLI JSONL event streamer directly.',
);
assert.doesNotMatch(
  claudeSource,
  /yield\*\s*streamResponseAsChunks\(\s*await sendMessageViaClaudeCli\(streamOptions\),\s*\)/,
  'Claude default sendMessageStream fallback must not wait for a complete non-streaming CLI turn before yielding chunks.',
);

for (const [engineName, source] of [
  ['Claude', claudeSource],
  ['Codex', codexSource],
  ['Gemini', geminiSource],
  ['OpenCode', openCodeSource],
]) {
  assert.match(
    source,
    /createRuntimeIntegrationDescriptor/,
    `${engineName} must build integration descriptors from runtime package/source discovery instead of frozen module-load constants.`,
  );
  assert.doesNotMatch(
    source,
    /describeIntegration\(\)\s*\{\s*return\s+[A-Z_]+_INTEGRATION;\s*\}/,
    `${engineName} describeIntegration() must not return a stale static descriptor.`,
  );
}

for (const [engineName, source] of [
  ['Gemini', geminiSource],
  ['OpenCode', openCodeSource],
]) {
  assert.doesNotMatch(
    source,
    /fallbackRuntimeMode:\s*null,[\s\S]*fallbackAvailable:\s*false/,
    `${engineName} must not hard-disable CLI/protocol fallback in health checks.`,
  );
  assert.match(
    source,
    /fallbackRuntimeMode:\s*'headless'/,
    `${engineName} health checks must expose the executable CLI fallback lane when SDK is unavailable.`,
  );
  assert.match(
    source,
    /createUnavailable.*SdkError/,
    `${engineName} must keep explicit unavailable-SDK/CLI error construction for unsupported fallback execution.`,
  );
  assert.match(
    source,
    engineName === 'Gemini'
      ? /geminiCliJsonlTurnExecutor/
      : /openCodeCliJsonlTurnExecutor/,
    `${engineName} must expose an injectable CLI JSONL executor for fallback testing and runtime bridging.`,
  );
  assert.match(
    source,
    engineName === 'Gemini'
      ? /streamGeminiCliJsonlTurn/
      : /streamOpenCodeCliJsonlTurn/,
    `${engineName} must implement a real default CLI JSONL fallback streamer.`,
  );
  assert.doesNotMatch(
    source,
    /fallback:\s*async\s*\(\)\s*=>\s*\{\s*throw createUnavailable.*SdkError\(\);\s*\}/,
    `${engineName} sendMessage fallback must execute the real CLI JSONL lane instead of immediately throwing.`,
  );
}

for (const [engineName, source] of [
  ['Claude', claudeSource],
  ['Codex', codexSource],
  ['Gemini', geminiSource],
  ['OpenCode', openCodeSource],
]) {
  assert.match(source, /describeRuntime\(/, `${engineName} must expose describeRuntime().`);
  assert.match(source, /getCapabilities\(/, `${engineName} must expose getCapabilities().`);
  assert.match(source, /sendCanonicalEvents\(/, `${engineName} must expose sendCanonicalEvents().`);
  assert.match(source, /createSession\(/, `${engineName} must expose local session management.`);
  assert.match(source, /getSession\(/, `${engineName} must expose local session lookup.`);
  assert.match(source, /createCodingSession\(/, `${engineName} must expose local coding-session management.`);
  assert.match(source, /getCodingSession\(/, `${engineName} must expose local coding-session lookup.`);
  assert.match(source, /addMessageToCodingSession\(/, `${engineName} must expose local coding-session append.`);
  assert.match(source, /updateContext\(/, `${engineName} must expose context update.`);
  assert.match(source, /onToolCall\(/, `${engineName} must expose tool-call callback.`);
}

console.log('problem list remediation contract passed.');
