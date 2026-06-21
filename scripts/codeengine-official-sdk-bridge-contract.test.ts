import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

assert.equal(
  existsSync(path.join(root, 'scripts/codeengine-official-sdk-bridge.ts')),
  false,
  'Node official SDK bridge script must be removed; turn execution belongs to sdkwork-kernel via sdkwork-birdcoder-kernel-bridge.',
);

const sdkBridgeSource = readFileSync(
  path.join(root, 'crates/sdkwork-birdcoder-codeengine/src/sdk_bridge.rs'),
  'utf8',
);
assert.doesNotMatch(sdkBridgeSource, /execute_official_sdk_bridge_turn/);
assert.match(sdkBridgeSource, /list_sdk_bridge_session_summaries/);
assert.match(sdkBridgeSource, /get_sdk_bridge_session_detail/);

console.log('codeengine official sdk bridge contract passed.');
