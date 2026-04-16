import assert from 'node:assert/strict';

import { createCapabilitySnapshot } from '../packages/sdkwork-birdcoder-chat/src/index.ts';
import { createChatEngineById } from '../packages/sdkwork-birdcoder-commons/src/workbench/engines.ts';
import { getWorkbenchCodeEngineKernel, listWorkbenchCliEngines } from '../packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts';

const claudeCapabilityMatrix = getWorkbenchCodeEngineKernel('claude-code').descriptor.capabilityMatrix;

const fallbackSnapshot = createCapabilitySnapshot({
  capabilityMatrix: claudeCapabilityMatrix,
  health: {
    status: 'degraded',
    runtimeMode: 'remote-control',
    officialEntry: {
      packageName: '@anthropic-ai/claude-agent-sdk',
    },
    sdkAvailable: false,
    cliAvailable: true,
    authConfigured: true,
    fallbackActive: true,
    sourceMirrorStatus: 'mirrored',
    diagnostics: ['Runtime fell back to the remote-control lane.'],
    checkedAt: Date.now(),
  },
  experimentalCapabilities: ['preview-session-api'],
});

assert.deepEqual(
  fallbackSnapshot.experimentalCapabilities,
  [],
  'fallback capability snapshots must not advertise experimental provider-native APIs as available',
);

const sdkSnapshot = createCapabilitySnapshot({
  capabilityMatrix: claudeCapabilityMatrix,
  health: {
    status: 'ready',
    runtimeMode: 'sdk',
    officialEntry: {
      packageName: '@anthropic-ai/claude-agent-sdk',
    },
    sdkAvailable: true,
    cliAvailable: true,
    authConfigured: true,
    fallbackActive: false,
    sourceMirrorStatus: 'mirrored',
    diagnostics: [],
    checkedAt: Date.now(),
  },
  experimentalCapabilities: ['preview-session-api'],
});

assert.deepEqual(
  sdkSnapshot.experimentalCapabilities,
  ['preview-session-api'],
  'sdk capability snapshots must preserve documented experimental provider APIs',
);

for (const engine of listWorkbenchCliEngines()) {
  const runtime = createChatEngineById(engine.id);
  const health = await runtime.getHealth?.();
  const capabilities = await runtime.getCapabilities?.();
  const rawExtensions = runtime.describeRawExtensions?.();

  assert.ok(health, `${engine.id} must expose health for experimental capability gating`);
  assert.ok(capabilities, `${engine.id} must expose capability snapshots for experimental gating`);
  assert.ok(rawExtensions, `${engine.id} must expose raw extensions for experimental gating`);

  if (health.runtimeMode === 'sdk' && health.sdkAvailable && !health.fallbackActive) {
    assert.deepEqual(
      capabilities.experimentalCapabilities,
      rawExtensions.experimentalFeatures,
      `${engine.id} sdk runtime must preserve experimental features through capability snapshots`,
    );
  } else {
    assert.deepEqual(
      capabilities.experimentalCapabilities,
      [],
      `${engine.id} fallback runtime must suppress experimental capability advertising`,
    );
  }
}

console.log('engine experimental capability gating contract passed.');
