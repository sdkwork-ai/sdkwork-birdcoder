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
const hostSource = fs.readFileSync(
  path.join(root, 'crates/sdkwork-birdcoder-kernel-bridge/src/host.rs'),
  'utf8',
);
const engineRegistry = fs.readFileSync(
  path.join(root, 'crates/sdkwork-birdcoder-kernel-bridge/src/engine_registry.rs'),
  'utf8',
);
const workflow = JSON.parse(
  fs.readFileSync(path.join(root, 'sdkwork.workflow.json'), 'utf8'),
);

assert.match(bridgeCargo, /sdkwork-agents-runtime-facade/);
assert.doesNotMatch(
  bridgeCargo.match(/\[dependencies\][\s\S]*?(?=\n\[|$)/)?.[0] ?? bridgeCargo,
  /sdkwork-agent-kernel\s*=/,
);
assert.doesNotMatch(bridgeCargo, /sdkwork-code-kernel/);
assert.doesNotMatch(bridgeCargo, /sdkwork-agent-provider-/);
assert.match(bridgeLib, /sdkwork-agents/);
assert.match(bridgeLib, /AgentsCodeEngineHost/);
assert.match(boundaries, /AGENTS_OWNED_CAPABILITIES/);
assert.match(boundaries, /BIRDCODER_OWNED_CAPABILITIES/);
assert.match(boundaries, /agents-runtime-facade/);
assert.match(hostSource, /AgentsCodeEngineHost/);
assert.match(hostSource, /sdkwork_agents_runtime_facade/);
assert.match(engineRegistry, /sdkwork_agents_runtime_facade/);

assert.equal(
  workflow.dependencies.some((dep) => dep.id === 'sdkwork-agents'),
  true,
  'sdkwork.workflow.json must declare sdkwork-agents as a sibling dependency',
);

const agentsFacadeLib = fs.readFileSync(
  path.join(root, '../sdkwork-agents/crates/sdkwork-agents-runtime-facade/src/lib.rs'),
  'utf8',
);
const agentsFacadeTurn = fs.readFileSync(
  path.join(root, '../sdkwork-agents/crates/sdkwork-agents-runtime-facade/src/turn.rs'),
  'utf8',
);
for (const symbol of [
  'AgentsCodeEngineHost',
  'execute_code_engine_turn',
  'bootstrap_canonical_code_engine_catalog',
  'LiveInteractionRegistry',
]) {
  assert.match(
    agentsFacadeLib,
    new RegExp(symbol),
    `sdkwork-agents-runtime-facade must export ${symbol}`,
  );
}
assert.match(
  agentsFacadeTurn,
  /tool_calls:\s*response\.tool_calls/u,
  'agents runtime facade must preserve kernel tool calls in turn output.',
);
assert.match(
  agentsFacadeTurn,
  /if input\.native_session_id\.is_none\(\)\s*\{\s*return execute_code_engine_turn/u,
  'first streamed turns must use the diagnostic-bearing invoke response so native session ids are not lost.',
);

const agentsServiceHttp = fs.readFileSync(
  path.join(
    root,
    '../sdkwork-agents/crates/sdkwork-intelligence-agents-service/src/http.rs',
  ),
  'utf8',
);
assert.match(agentsServiceHttp, /\/app\/v3\/api\/ai\/code_engines/);
assert.match(agentsServiceHttp, /\/app\/v3\/api\/ai\/mcp_servers/);
assert.doesNotMatch(
  fs.readFileSync(
    path.join(
      root,
      '../sdkwork-agents/crates/sdkwork-intelligence-agents-service/src/application.rs',
    ),
    'utf8',
  ),
  /deterministic-local-contract/,
  'agents runtime executions must not use deterministic-local-contract stubs',
);

const alignmentSpec = JSON.parse(
  fs.readFileSync(path.join(root, 'specs/agents-birdcoder-alignment.spec.json'), 'utf8'),
);
assert.equal(
  alignmentSpec.tasks.filter((task) => task.gate).every((task) => task.status === 'done'),
  true,
  'all gate tasks in agents-birdcoder-alignment.spec.json must be done',
);

console.log('birdcoder agents integration contract passed.');
