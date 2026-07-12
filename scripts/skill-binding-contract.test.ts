import assert from 'node:assert/strict';
const typesEntryModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/index.ts',
  import.meta.url,
);

const {
  BIRDCODER_PROMPT_COMPOSITION_LAYER_IDS,
  BIRDCODER_PROMPT_COMPOSITION_LAYERS,
  BIRDCODER_PROMPT_STORAGE_BINDINGS,
  BIRDCODER_SKILL_BINDING_SCOPE_TYPES,
  BIRDCODER_SKILL_STORAGE_BINDINGS,
} = await import(`${typesEntryModulePath.href}?t=${Date.now()}`);

assert.deepEqual(BIRDCODER_PROMPT_COMPOSITION_LAYER_IDS, [
  'platform_rule',
  'organization_rule',
  'template_preset',
  'skill_binding',
  'project_context',
  'turn_prompt',
]);

assert.deepEqual(
  BIRDCODER_PROMPT_COMPOSITION_LAYERS.map((layer) => layer.id),
  BIRDCODER_PROMPT_COMPOSITION_LAYER_IDS,
);
assert.deepEqual(
  BIRDCODER_PROMPT_COMPOSITION_LAYERS.map((layer) => layer.order),
  [10, 20, 30, 40, 50, 60],
);

assert.deepEqual(BIRDCODER_SKILL_BINDING_SCOPE_TYPES, [
  'workspace',
  'project',
  'coding_session',
  'turn',
]);

assert.deepEqual(
  BIRDCODER_PROMPT_STORAGE_BINDINGS.map((binding) => binding.entityName),
  [
    'saved_prompt_entry',
    'prompt_asset',
    'prompt_asset_version',
    'prompt_bundle',
    'prompt_bundle_item',
    'prompt_run',
    'prompt_evaluation',
  ],
);
assert.equal(
  BIRDCODER_PROMPT_STORAGE_BINDINGS.every((binding) => binding.storageMode === 'table'),
  true,
);

assert.deepEqual(
  BIRDCODER_SKILL_STORAGE_BINDINGS.map((binding) => binding.entityName),
  [
    'skill_package',
    'skill_version',
    'skill_capability',
    'skill_installation',
    'skill_binding',
    'skill_runtime_config',
  ],
);
assert.equal(
  BIRDCODER_SKILL_STORAGE_BINDINGS.every((binding) => binding.storageMode === 'table'),
  true,
);

console.log('skill binding contract passed.');
