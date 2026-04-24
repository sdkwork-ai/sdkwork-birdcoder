import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const typesEntryModulePath = new URL(
  '../packages/sdkwork-birdcoder-types/src/index.ts',
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

const architectureSource = fs.readFileSync(
  path.join(rootDir, 'docs/架构/13-规则-技能-MCP-知识系统标准.md'),
  'utf8',
);
const runtimeSource = fs.readFileSync(
  path.join(rootDir, 'docs/架构/19-统一会话运行时-Prompt-SkillHub-AppTemplate标准.md'),
  'utf8',
);
const stepSource = fs.readFileSync(
  path.join(rootDir, 'docs/step/16-Prompt-SkillHub-AppTemplate-项目模板体系.md'),
  'utf8',
);
const promptSource = fs.readFileSync(
  path.join(rootDir, 'docs/prompts/反复执行Step指令.md'),
  'utf8',
);

for (const token of [
  'platform_rule',
  'organization_rule',
  'template_preset',
  'skill_binding',
  'project_context',
  'turn_prompt',
  'workspace',
  'project',
  'coding_session',
  'turn',
]) {
  assert.match(architectureSource, new RegExp(token));
  assert.match(runtimeSource, new RegExp(token));
}

assert.match(stepSource, /test:skill-binding-contract/);
assert.match(promptSource, /test:skill-binding-contract/);

console.log('skill binding contract passed.');
