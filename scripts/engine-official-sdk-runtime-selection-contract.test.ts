import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createChatEngineById } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/engines.ts';
import { listWorkbenchCliEngines } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/kernel.ts';

const root = path.resolve(import.meta.dirname, '..');
const kernelRuntimeSource = readFileSync(
  path.join(root, 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/kernelRuntime.ts'),
  'utf8',
);

assert.match(kernelRuntimeSource, /birdcoder-kernel-turn/);
assert.doesNotMatch(kernelRuntimeSource, /officialSdkBridgeLoader/);

for (const engine of listWorkbenchCliEngines()) {
  const runtime = createChatEngineById(engine.id);
  const integration = runtime.describeIntegration?.();
  assert.equal(integration?.runtimeMode, 'sdk');
  assert.equal(
    integration?.officialEntry.packageName,
    engine.descriptor.officialIntegration?.officialEntry.packageName,
  );
  assert.match(runtime.name, /-kernel-sdk-adapter$/);

  const accessPlan = engine.descriptor.accessPlan;
  assert.ok(accessPlan?.lanes.length, `${engine.id} must declare an access plan`);
  assert.ok(
    accessPlan.lanes.some((lane) => lane.status === 'ready'),
    `${engine.id} must expose at least one ready runtime lane in catalog metadata`,
  );
}

console.log('engine official sdk runtime selection contract passed.');
