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

assert.match(bridgeCargo, /sdkwork-agents-runtime-facade/);
assert.doesNotMatch(
  bridgeCargo.match(/\[dependencies\][\s\S]*?(?=\n\[|$)/)?.[0] ?? bridgeCargo,
  /sdkwork-agent-kernel\s*=/,
);
assert.doesNotMatch(bridgeCargo, /sdkwork-code-kernel/);
assert.doesNotMatch(bridgeCargo, /sdkwork-agent-provider-/);
assert.match(bridgeLib, /sdkwork-agents/);
assert.match(boundaries, /AGENTS_OWNED_CAPABILITIES/);
assert.match(boundaries, /BIRDCODER_OWNED_CAPABILITIES/);
assert.match(boundaries, /LEGACY_CODEENGINE_SURFACES/);
assert.match(boundaries, /coding_session/);

assert.match(engineRegistry, /sdkwork_agents_runtime_facade/);

assert.equal(
  workflow.dependencies.some((dep) => dep.id === 'sdkwork-kernel'),
  true,
  'sdkwork.workflow.json must declare sdkwork-kernel as a sibling dependency',
);
assert.equal(
  workflow.dependencies.some((dep) => dep.id === 'sdkwork-agents'),
  true,
  'sdkwork.workflow.json must declare sdkwork-agents as a sibling dependency',
);

assert.match(
  chatReadme,
  /agents|runtime facade/i,
  'pc-projection README must document agents runtime facade ownership',
);

const alignmentSpec = JSON.parse(
  fs.readFileSync(path.join(root, 'specs/kernel-birdcoder-alignment.spec.json'), 'utf8'),
);
assert.ok(
  alignmentSpec.authorityDocs.includes(
    'docs/architecture/tech/TECH_ARCHITECTURE.md',
  ),
  'alignment spec must index the canonical technical architecture',
);

const agentsAlignmentSpec = JSON.parse(
  fs.readFileSync(path.join(root, 'specs/agents-birdcoder-alignment.spec.json'), 'utf8'),
);
assert.equal(
  agentsAlignmentSpec.tasks.filter((task) => task.gate).every((task) => task.status === 'done'),
  true,
  'all gate tasks in agents-birdcoder-alignment.spec.json must be done',
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
    `Browser-facing @sdkwork/birdcoder-pc-codeengine index must not re-export Node turn surfaces (${forbiddenExport}).`,
  );
}

console.log('birdcoder kernel integration contract passed.');
