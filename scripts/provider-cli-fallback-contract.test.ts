import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { listWorkbenchCliEngines } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/kernel.ts';

const root = path.resolve(import.meta.dirname, '..');

for (const engine of listWorkbenchCliEngines()) {
    const cliLane = engine.descriptor.accessPlan?.lanes.find(
      (lane) => lane.transportKind === 'cli-jsonl',
    );
  if (engine.executionTopology.bridgeRequired) {
    assert.ok(cliLane, `${engine.id} must declare a CLI JSONL lane in catalog metadata`);
    assert.equal(cliLane?.status, 'ready');
    assert.equal(engine.descriptor.accessPlan?.primaryLaneId, cliLane?.laneId);
  }
}

const kernelBridgeSource = readFileSync(
  path.join(root, 'crates/sdkwork-birdcoder-kernel-bridge/src/engine_registry.rs'),
  'utf8',
);
assert.match(kernelBridgeSource, /sdkwork_agents_runtime_facade/);
assert.doesNotMatch(
  kernelBridgeSource,
  /sdkwork-agent-adapter/,
  'BirdCoder must reach Provider transport through the agents runtime facade instead of a direct adapter dependency.',
);

console.log('provider cli fallback contract passed.');
