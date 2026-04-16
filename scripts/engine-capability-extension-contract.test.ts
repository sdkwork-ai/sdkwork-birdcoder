import assert from 'node:assert/strict';

import { createChatEngineById } from '../packages/sdkwork-birdcoder-commons/src/workbench/engines.ts';
import { listWorkbenchCliEngines } from '../packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts';

for (const engine of listWorkbenchCliEngines()) {
  const runtime = createChatEngineById(engine.id);

  assert.equal(
    typeof runtime.getCapabilities,
    'function',
    `${engine.id} must expose a capability snapshot`,
  );
  assert.equal(
    typeof runtime.describeRawExtensions,
    'function',
    `${engine.id} must expose the explicit extensions/raw lane`,
  );

  const capabilities = await runtime.getCapabilities?.();
  const rawExtensions = runtime.describeRawExtensions?.();

  assert.ok(capabilities, `${engine.id} capability snapshot must be available`);
  assert.ok(rawExtensions, `${engine.id} raw extension descriptor must be available`);
  assert.equal(capabilities?.declaredCapabilities.includes('chat'), true);
  assert.equal(capabilities?.declaredCapabilities.includes('streaming'), true);
  assert.equal(capabilities?.declaredCapabilities.includes('toolCalls'), true);
  assert.equal(
    capabilities?.runtimeMode,
    (await runtime.getHealth?.())?.runtimeMode,
    `${engine.id} capability snapshot must align to the resolved health runtime`,
  );
  assert.equal(rawExtensions?.channel, 'extensions/raw');
  assert.equal(rawExtensions?.provider, engine.id);
  assert.equal(
    rawExtensions?.supplementalLanes.length ? true : false,
    true,
    `${engine.id} raw extension lane must document at least one supplemental lane`,
  );
  assert.equal(
    rawExtensions?.nativeEventModel.length ? true : false,
    true,
    `${engine.id} raw extension lane must document provider-native event semantics`,
  );
}

const geminiCapabilities = await createChatEngineById('gemini').getCapabilities?.();
assert.equal(
  geminiCapabilities?.disabledCapabilities.includes('ptyArtifacts'),
  true,
  'gemini must keep disabled capability flags visible in the snapshot',
);

const opencodeCapabilities = await createChatEngineById('opencode').getCapabilities?.();
assert.equal(
  opencodeCapabilities?.disabledCapabilities.includes('structuredOutput'),
  true,
  'opencode must keep disabled capability flags visible in the snapshot',
);

const claudeExtensions = createChatEngineById('claude-code').describeRawExtensions?.();
assert.equal(
  claudeExtensions?.experimentalFeatures.includes('preview-session-api'),
  true,
  'claude-code raw extension lane must expose preview session capability as experimental',
);

console.log('engine capability extension contract passed.');
