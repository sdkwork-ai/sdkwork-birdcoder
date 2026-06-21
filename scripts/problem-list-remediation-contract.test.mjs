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
  vipSource,
  chatIndexSource,
  chatTypesSource,
  chatProviderAdapterSource,
  kernelRuntimeSource,
] = await Promise.all([
  readSource('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/src/auth-surface.ts'),
  readSource('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/codeFileSearch.ts'),
  readSource('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/chat/draftStore.ts'),
  readSource('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/terminal/runtime.ts'),
  readSource('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/projectionRepository.ts'),
  readSource('replace-colors.cjs'),
  readSource('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/src/vip.ts'),
  readSource('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-projection/src/index.ts'),
  readSource('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-projection/src/types.ts'),
  readSource('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-projection/src/providerAdapter.ts'),
  readSource('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/kernelRuntime.ts'),
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

const forbiddenVipRouteCompatibilityPattern = new RegExp(
  `@${'depre'}${'cated'}|sectionId`,
  'u',
);
assert.doesNotMatch(
  vipSource,
  forbiddenVipRouteCompatibilityPattern,
  'VIP route intent must remove legacy sectionId compatibility debt and expose only the canonical section option.',
);
assert.match(
  vipSource,
  /function resolveVipRoutePath/,
  'VIP route intent must resolve through canonical routePath/basePath options only.',
);
assert.match(
  vipSource,
  /options\.routePath \?\? options\.basePath \?\? BIRDCODER_VIP_ROUTE_PATH/,
  'VIP route intent must not keep legacy section compatibility shims.',
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
  kernelRuntimeSource,
  /birdcoder-kernel-turn/,
  'Kernel runtime must delegate turn execution to sdkwork-birdcoder-kernel-bridge.',
);
assert.match(
  kernelRuntimeSource,
  /createRuntimeIntegrationDescriptor/,
  'Kernel runtime must build integration descriptors from runtime package/source discovery.',
);
assert.match(kernelRuntimeSource, /describeRuntime\(/);
assert.match(kernelRuntimeSource, /getHealth\(/);
assert.match(kernelRuntimeSource, /sendCanonicalEvents\(/);
assert.doesNotMatch(
  kernelRuntimeSource,
  /officialSdkBridgeLoader/,
  'Kernel runtime must not keep per-engine official SDK bridge loaders in BirdCoder.',
);

console.log('problem list remediation contract passed.');
