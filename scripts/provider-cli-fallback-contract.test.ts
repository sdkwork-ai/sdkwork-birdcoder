import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { listWorkbenchCliEngines } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/kernel.ts';

const root = path.resolve(import.meta.dirname, '..');

for (const engine of listWorkbenchCliEngines()) {
  const cliFallbackLane = engine.descriptor.accessPlan?.lanes.find(
    (lane) => lane.transportKind === 'cli-jsonl',
  );
  if (engine.executionTopology.bridgeRequired) {
    assert.ok(cliFallbackLane, `${engine.id} must declare a CLI JSONL fallback lane in catalog metadata`);
    assert.equal(cliFallbackLane?.status, 'ready');
  }
}

const kernelBridgeSource = readFileSync(
  path.join(root, 'crates/sdkwork-birdcoder-kernel-bridge/src/engine_registry.rs'),
  'utf8',
);
assert.match(kernelBridgeSource, /sdkwork-agent-adapter/);

console.log('provider cli fallback contract passed.');
