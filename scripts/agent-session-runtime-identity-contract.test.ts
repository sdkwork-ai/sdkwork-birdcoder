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

const engines = [
  ['codex', 'openai'],
  ['claude-code', 'anthropic'],
  ['opencode', 'opencode'],
] as const;

replaceWorkbenchCodeEngineCatalogForTesting(engines.map(([engineId, provider]) => ({
  agentId: `agent.code-engine.${engineId}`,
  bindingId: `binding.agent.${engineId}`,
  defaultModelId: `${engineId}-default`,
  displayName: engineId,
  engineId,
  healthy: true,
  models: [{
    bindingId: `binding.provider.${engineId}`,
    defaultForEngine: true,
    description: `${engineId} default model`,
    label: `${engineId} default`,
    modelId: `${engineId}-default`,
    providerId: `provider.${provider}`,
  }],
  providerId: `provider.${provider}`,
})));

for (const [engineId, provider] of engines) {
  const identity = resolveWorkbenchRuntimeBindingIdentity(engineId, `${engineId}-default`);
  assert.deepEqual(identity, {
    agentId: `agent.code-engine.${engineId}`,
    engineId,
    modelId: `${engineId}-default`,
    providerBindingId: `binding.provider.${engineId}`,
    providerId: `provider.${provider}`,
  });
  assert.equal(
    resolveWorkbenchCodeEngineForRuntimeBinding({
      modelId: identity.modelId,
      providerBindingId: identity.providerBindingId,
      providerId: identity.providerId,
    })?.id,
    engineId,
  );
}

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

resetWorkbenchCodeEngineCatalog();
console.log('agent session runtime identity contract passed.');
