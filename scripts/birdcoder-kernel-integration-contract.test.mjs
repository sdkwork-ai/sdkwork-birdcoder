import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

const bridgeCargo = fs.readFileSync(
  path.join(root, 'crates/sdkwork-birdcoder-kernel-bridge/Cargo.toml'),
  'utf8',
);
const bridgeLib = fs.readFileSync(
  path.join(root, 'crates/sdkwork-birdcoder-kernel-bridge/src/lib.rs'),
  'utf8',
);
const boundaries = fs.readFileSync(
  path.join(root, 'crates/sdkwork-birdcoder-kernel-bridge/src/boundaries.rs'),
  'utf8',
);
const engineRegistry = fs.readFileSync(
  path.join(root, 'crates/sdkwork-birdcoder-kernel-bridge/src/engine_registry.rs'),
  'utf8',
);
const workflow = JSON.parse(
  fs.readFileSync(path.join(root, 'sdkwork.workflow.json'), 'utf8'),
);
const chatReadme = fs.readFileSync(
  path.join(
    root,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-projection/README.md',
  ),
  'utf8',
);

assert.match(bridgeCargo, /sdkwork-agent-kernel/);
assert.match(bridgeCargo, /sdkwork-code-kernel/);
assert.match(bridgeCargo, /sdkwork-agent-adapter-codex/);
assert.match(bridgeLib, /sdkwork-kernel/);
assert.match(boundaries, /KERNEL_OWNED_CAPABILITIES/);
assert.match(boundaries, /BIRDCODER_OWNED_CAPABILITIES/);
assert.match(boundaries, /LEGACY_CODEENGINE_SURFACES/);
assert.match(boundaries, /coding_session/);
assert.match(boundaries, /agent\.runtime/);

assert.match(engineRegistry, /CANONICAL_ENGINE_KEYS.*codex.*claude-code.*gemini.*opencode/s);
assert.equal(
  engineRegistry.includes('"codex"') &&
    engineRegistry.includes('"claude-code"') &&
    engineRegistry.includes('"gemini"') &&
    engineRegistry.includes('"opencode"'),
  true,
);

assert.equal(
  workflow.dependencies.some((dep) => dep.id === 'sdkwork-kernel'),
  true,
  'sdkwork.workflow.json must declare sdkwork-kernel as a sibling dependency',
);

assert.match(
  chatReadme,
  /kernel/i,
  'pc-projection README must document kernel bridge ownership',
);

const kernelBindingsDir = path.join(
  root,
  '../sdkwork-kernel/sdks/external-agent-sdks',
);
for (const engine of ['claude-code', 'gemini-cli']) {
  const manifest = path.join(kernelBindingsDir, engine, 'sdk-binding.manifest.json');
  assert.equal(
    fs.existsSync(manifest),
    true,
    `sdkwork-kernel must provide sdk-binding.manifest.json for ${engine}`,
  );
}

const alignmentSpec = JSON.parse(
  fs.readFileSync(path.join(root, 'specs/kernel-birdcoder-alignment.spec.json'), 'utf8'),
);
assert.ok(
  alignmentSpec.authorityDocs.includes('docs/架构/31-Kernel-BirdCoder-集成实施方案.md'),
  'alignment spec must index implementation doc 31',
);

const projectionSpec = path.join(
  root,
  '../sdkwork-kernel/specs/KERNEL_PRODUCT_PROJECTION_SPEC.md',
);
assert.equal(
  fs.existsSync(projectionSpec),
  true,
  'sdkwork-kernel must publish KERNEL_PRODUCT_PROJECTION_SPEC.md',
);

const mockPolicy = path.join(
  root,
  '../sdkwork-kernel/sdkwork-kernel-plugins/crates/sdkwork-agent-adapter-core/src/mock_policy.rs',
);
assert.equal(
  fs.existsSync(mockPolicy),
  true,
  'sdkwork-kernel must provide adapter-core mock_policy for production fail-closed',
);

const engineSdkLive = path.join(
  root,
  '../sdkwork-kernel/scripts/sdk-backend-workers/engine-sdk-live.mjs',
);
assert.equal(
  fs.existsSync(engineSdkLive),
  true,
  'sdkwork-kernel must provide engine-sdk-live worker dispatch for official SDK invokes',
);
assert.equal(
  alignmentSpec.tasks.filter((task) => task.gate).every((task) => task.status === 'done'),
  true,
  'all gate tasks in kernel-birdcoder-alignment.spec.json must be done',
);

const codeengineIndex = fs.readFileSync(
  path.join(
    root,
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/index.ts',
  ),
  'utf8',
);
for (const forbiddenExport of ['serverRuntime', 'kernelRuntime', './engines']) {
  assert.doesNotMatch(
    codeengineIndex,
    new RegExp(forbiddenExport.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')),
    `Browser-facing @sdkwork/birdcoder-pc-codeengine index must not re-export Node kernel turn surfaces (${forbiddenExport}).`,
  );
}

console.log('birdcoder kernel integration contract passed.');
