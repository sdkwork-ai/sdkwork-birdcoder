import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const typesEntryModulePath = new URL(
  '../packages/sdkwork-birdcoder-types/src/index.ts',
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
  'web',
  'desktop',
  'server',
  'fullstack',
  'plugin',
  'agent-tooling',
  'app_template_instantiation',
]) {
  assert.match(architectureSource, new RegExp(token));
  assert.match(runtimeSource, new RegExp(token));
}

assert.match(stepSource, /test:template-instantiation-contract/);
assert.match(promptSource, /test:template-instantiation-contract/);

console.log('template instantiation contract passed.');
