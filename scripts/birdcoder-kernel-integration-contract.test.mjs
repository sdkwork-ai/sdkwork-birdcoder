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

console.log('birdcoder kernel integration contract passed.');
