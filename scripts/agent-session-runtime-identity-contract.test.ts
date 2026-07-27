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
  ['gemini-cli', 'google'],
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
  ...engines.map(([engineId, provider]) => ({
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
  })),
  {
    agentId: 'agent.code-engine.codex-enterprise',
    bindingId: 'binding.agent.codex-enterprise',
    defaultModelId: 'codex-default',
    displayName: 'codex-enterprise',
    engineId: 'codex-enterprise',
    healthy: true,
    models: [{
      bindingId: 'binding.provider.codex-enterprise',
      defaultForEngine: true,
      description: 'Enterprise Codex',
      label: 'Enterprise Codex',
      modelId: 'codex-default',
      providerId: 'provider.openai',
    }],
    providerId: 'provider.openai',
  },
]);

assert.equal(
  resolveWorkbenchCodeEngineForRuntimeBinding({
    modelId: 'codex-default',
    providerId: 'provider.openai',
  }),
  null,
  'Ambiguous provider/model lookup must fail closed when more than one engine matches.',
);
assert.equal(
  resolveWorkbenchCodeEngineForRuntimeBinding({
    agentId: 'agent.code-engine.codex',
    engineId: 'codex',
    modelId: 'codex-default',
    providerBindingId: 'binding.provider.codex',
    providerId: 'provider.openai',
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
