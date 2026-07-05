import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const opencodeTransportSource = readFileSync(
  path.join(root, 'crates/sdkwork-birdcoder-codeengine/src/opencode.rs'),
  'utf8',
);
const opencodeProviderSource = readFileSync(
  path.join(root, 'crates/sdkwork-birdcoder-codeengine/src/opencode_provider.rs'),
  'utf8',
);

assert.match(opencodeTransportSource, /stream_opencode_session_events/);
assert.match(opencodeTransportSource, /project_opencode_stream_events/);
assert.match(opencodeTransportSource, /reply_opencode_permission_request/);
assert.match(opencodeTransportSource, /reply_opencode_question_request/);
assert.match(opencodeProviderSource, /OpencodeCodeEngineProvider/);

const kernelBridgeSource = readFileSync(
  path.join(root, 'crates/sdkwork-birdcoder-kernel-bridge/src/engine_registry.rs'),
  'utf8',
);
const agentsFacadeSource = readFileSync(
  path.join(root, '../sdkwork-agents/crates/sdkwork-agents-runtime-facade/src/code_engines.rs'),
  'utf8',
);

assert.match(kernelBridgeSource, /sdkwork_agents_runtime_facade/);
assert.match(kernelBridgeSource, /canonical_code_engine_keys\(\)/);
assert.match(kernelBridgeSource, /bootstrap_code_engine\(/);
assert.match(agentsFacadeSource, /"opencode"/);

console.log('opencode official sdk bridge contract passed.');
