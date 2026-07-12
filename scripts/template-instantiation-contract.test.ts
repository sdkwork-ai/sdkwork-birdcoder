import assert from 'node:assert/strict';
const typesEntryModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/index.ts',
  import.meta.url,
);

const {
  BIRDCODER_APP_TEMPLATE_STORAGE_BINDINGS,
  BIRDCODER_APP_TEMPLATE_TARGET_PROFILE_IDS,
  BIRDCODER_APP_TEMPLATE_TARGET_PROFILES,
} = await import(`${typesEntryModulePath.href}?t=${Date.now()}`);

assert.deepEqual(BIRDCODER_APP_TEMPLATE_TARGET_PROFILE_IDS, [
  'web',
  'desktop',
  'server',
  'fullstack',
  'plugin',
  'agent-tooling',
]);

assert.deepEqual(
  BIRDCODER_APP_TEMPLATE_TARGET_PROFILES.map((profile) => profile.id),
  BIRDCODER_APP_TEMPLATE_TARGET_PROFILE_IDS,
);
assert.equal(
  new Set(BIRDCODER_APP_TEMPLATE_TARGET_PROFILE_IDS).size,
  BIRDCODER_APP_TEMPLATE_TARGET_PROFILE_IDS.length,
);

assert.deepEqual(
  BIRDCODER_APP_TEMPLATE_STORAGE_BINDINGS.map((binding) => binding.entityName),
  [
    'app_template',
    'app_template_version',
    'app_template_target_profile',
    'app_template_preset',
    'app_template_instantiation',
  ],
);
assert.equal(
  BIRDCODER_APP_TEMPLATE_STORAGE_BINDINGS.every((binding) => binding.storageMode === 'table'),
  true,
);

console.log('template instantiation contract passed.');
