import assert from 'node:assert/strict';

import {
  replaceWorkbenchCodeEngineCatalogForTesting,
  resetWorkbenchCodeEngineCatalog,
  resolveWorkbenchCodeEngineForRuntimeBinding,
  resolveWorkbenchRuntimeBindingIdentity,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/codeEngineCatalog.ts';
import {
  resolveBirdcoderWorkbenchHostMode,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/terminal/runtimeTarget.ts';

const engines = ['codex', 'claude-code', 'opencode', 'gemini'] as const;

const testAccessModeCatalog = {
  accessModes: [{
    approvalBehavior: 'user_review' as const,
    description: 'Ask before risky operations',
    displayName: 'Ask for approval',
    enabled: true,
    modeId: 'ask_for_approval',
    networkAccess: 'restricted' as const,
    riskLevel: 'scoped' as const,
    workspaceAccess: 'workspace_write' as const,
  }],
  defaultAccessModeId: 'ask_for_approval',
  tier: 'official-sdk',
};

replaceWorkbenchCodeEngineCatalogForTesting(engines.map((engineId) => ({
  ...testAccessModeCatalog,
  agentId: `agent.${engineId}`,
  bindingId: `binding.${engineId}`,
  defaultModelId: `${engineId}-default`,
  displayName: engineId,
  engineId,
  healthy: true,
  models: [{
    bindingId: `binding.${engineId}`,
    defaultForEngine: true,
    description: `${engineId} default model`,
    label: `${engineId} default`,
    modelId: `${engineId}-default`,
    providerId: `provider.${engineId}`,
  }],
  providerId: `provider.${engineId}`,
})));

for (const engineId of engines) {
  const identity = resolveWorkbenchRuntimeBindingIdentity(engineId, `${engineId}-default`);
  assert.deepEqual(identity, {
    agentId: `agent.${engineId}`,
    engineId,
    modelId: `${engineId}-default`,
    providerBindingId: `binding.${engineId}`,
    providerId: `provider.${engineId}`,
  });
  assert.equal(
    resolveWorkbenchCodeEngineForRuntimeBinding({
      agentId: identity.agentId,
      engineId: identity.engineId,
      modelId: identity.modelId,
      providerBindingId: identity.providerBindingId,
      providerId: identity.providerId,
    })?.id,
    engineId,
  );
}

replaceWorkbenchCodeEngineCatalogForTesting([
  ...engines.map((engineId) => ({
    ...testAccessModeCatalog,
    agentId: `agent.${engineId}`,
    bindingId: `binding.${engineId}`,
    defaultModelId: `${engineId}-default`,
    displayName: engineId,
    engineId,
    healthy: true,
    models: [{
      bindingId: `binding.${engineId}`,
      defaultForEngine: true,
      description: `${engineId} default model`,
      label: `${engineId} default`,
      modelId: `${engineId}-default`,
      providerId: `provider.${engineId}`,
    }],
    providerId: `provider.${engineId}`,
  })),
  {
    ...testAccessModeCatalog,
    agentId: 'agent.codex-enterprise',
    bindingId: 'binding.codex-enterprise',
    defaultModelId: 'codex-default',
    displayName: 'codex-enterprise',
    engineId: 'codex-enterprise',
    healthy: true,
    models: [{
      bindingId: 'binding.codex-enterprise',
      defaultForEngine: true,
      description: 'Enterprise Codex',
      label: 'Enterprise Codex',
      modelId: 'codex-default',
      providerId: 'provider.codex',
    }],
    providerId: 'provider.codex',
  },
]);

assert.equal(
  resolveWorkbenchCodeEngineForRuntimeBinding({
    modelId: 'codex-default',
    providerId: 'provider.codex',
  }),
  null,
  'Ambiguous provider/model lookup must fail closed when more than one engine matches.',
);
assert.equal(
  resolveWorkbenchCodeEngineForRuntimeBinding({
    agentId: 'agent.codex',
    engineId: 'codex',
    modelId: 'codex-default',
    providerBindingId: 'binding.codex',
    providerId: 'provider.codex',
  })?.id,
  'codex',
);

assert.equal(resolveBirdcoderWorkbenchHostMode(), 'web');
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { __TAURI_INTERNALS__: { invoke() {} } },
});
assert.equal(resolveBirdcoderWorkbenchHostMode(), 'desktop');
if (previousWindow) {
  Object.defineProperty(globalThis, 'window', previousWindow);
} else {
  Reflect.deleteProperty(globalThis, 'window');
}

const previousIsTauri = Object.getOwnPropertyDescriptor(globalThis, 'isTauri');
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {},
});
Object.defineProperty(globalThis, 'isTauri', {
  configurable: true,
  value: true,
});
assert.equal(
  resolveBirdcoderWorkbenchHostMode(),
  'desktop',
  'The official Tauri runtime marker must select the desktop host even when private globals are absent.',
);
if (previousWindow) {
  Object.defineProperty(globalThis, 'window', previousWindow);
} else {
  Reflect.deleteProperty(globalThis, 'window');
}
if (previousIsTauri) {
  Object.defineProperty(globalThis, 'isTauri', previousIsTauri);
} else {
  Reflect.deleteProperty(globalThis, 'isTauri');
}

resetWorkbenchCodeEngineCatalog();
console.log('agent session runtime identity contract passed.');
