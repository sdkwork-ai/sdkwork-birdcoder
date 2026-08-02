import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  listWorkbenchServerImplementedCodeEngines,
  replaceWorkbenchCodeEngineCatalogForTesting,
  resetWorkbenchCodeEngineCatalog,
  resolveWorkbenchCodeEngineSelectedModelAccessChannelId,
  resolveWorkbenchRuntimeBindingIdentity,
} from '../src/workbench/codeEngineCatalog.ts';
import {
  normalizeWorkbenchPreferences,
  saveWorkbenchUnifiedCustomAgentModel,
  setWorkbenchCodeEngineModelAccessChannel,
} from '../src/workbench/preferences.ts';

const catalogEntry = {
  accessModes: [],
  agentId: 'agent.code-engine.codex',
  bindingId: 'binding.agent.codex',
  defaultAccessModeId: '',
  defaultModelId: 'codex-default',
  displayName: 'Codex',
  engineId: 'codex',
  healthy: true,
  models: [{
    bindingId: 'binding.provider.codex',
    defaultForEngine: true,
    description: 'Default Codex model',
    label: 'Codex default',
    modelId: 'codex-default',
    providerId: 'provider.openai',
  }],
  providerId: 'provider.openai',
  tier: 'official-sdk',
};

const claudeCatalogEntry = {
  ...catalogEntry,
  agentId: 'agent.code-engine.claude-code',
  bindingId: 'binding.agent.claude-code',
  defaultModelId: 'claude-default',
  displayName: 'Claude Code',
  engineId: 'claude-code',
  models: [{
    bindingId: 'binding.provider.claude-code',
    defaultForEngine: true,
    description: 'Default Claude Code model',
    label: 'Claude default',
    modelId: 'claude-default',
    providerId: 'provider.anthropic',
  }],
  providerId: 'provider.anthropic',
};

function saveUnifiedModel() {
  return saveWorkbenchUnifiedCustomAgentModel(
    normalizeWorkbenchPreferences({ codeEngineId: 'codex' }),
    {
      activeProviderId: 'codex',
      configurationId: 'model.custom.openai-compatible.gpt-5-custom',
      modelId: 'gpt-5-custom',
      label: 'GPT-5 Custom',
      description: 'Unified model configuration',
      vendorCode: 'openai-compatible',
      baseUrl: 'https://models.example.test/v1',
      supportedModelIds: ['gpt-5-custom', 'gpt-5-fast'],
      supportedProviderIds: ['codex', 'claude-code'],
      inputContextTokens: 128000,
      outputContextTokens: 16000,
      toolCallRounds: 32,
      supportsMultimodal: true,
      apiKeyConfigured: true,
    },
  );
}

describe('custom code model preferences', () => {
  beforeEach(() => {
    replaceWorkbenchCodeEngineCatalogForTesting([catalogEntry, claudeCatalogEntry]);
  });

  afterEach(() => {
    resetWorkbenchCodeEngineCatalog();
  });

  it('persists a bounded non-sensitive model definition and selects it', () => {
    const preferences = saveUnifiedModel();

    expect(preferences.unifiedCustomAgentModels).toEqual([{
      configurationId: 'model.custom.openai-compatible.gpt-5-custom',
      modelId: 'gpt-5-custom',
      label: 'GPT-5 Custom',
      description: 'Unified model configuration',
      vendorCode: 'openai-compatible',
      baseUrl: 'https://models.example.test/v1',
      supportedModelIds: ['gpt-5-custom', 'gpt-5-fast'],
      supportedProviderIds: ['codex', 'claude-code'],
      inputContextTokens: 128000,
      outputContextTokens: 16000,
      toolCallRounds: 32,
      supportsMultimodal: true,
      apiKeyConfigured: true,
      accessChannelKind: 'relay',
      accessChannelName: 'GPT-5 Custom',
      defaultVendorCode: 'openai-compatible',
      vendorOfferings: [{
        vendorCode: 'openai-compatible',
        vendorName: 'openai-compatible',
        modelIds: ['gpt-5-custom', 'gpt-5-fast'],
      }],
    }]);
    expect(preferences.unifiedCustomAgentModels[0]).not.toHaveProperty('apiKey');
    expect(preferences.codeModelId).toBe('gpt-5-custom');
    expect(preferences.codeEngineSettings.codex?.defaultModelId).toBe('gpt-5-custom');
  });

  it('projects one unified model through every supported Agent provider binding', () => {
    const preferences = saveUnifiedModel();
    const engines = listWorkbenchServerImplementedCodeEngines(preferences);

    expect(engines).toHaveLength(2);
    for (const engine of engines) {
      expect(engine.models.slice(-2)).toMatchObject([
        {
          id: 'gpt-5-custom',
          label: 'GPT-5 Custom',
          source: 'user-local',
        },
        {
          id: 'gpt-5-fast',
          label: 'gpt-5-fast',
          source: 'user-local',
        },
      ]);
    }
    expect(resolveWorkbenchRuntimeBindingIdentity(
      'codex',
      'gpt-5-custom',
      preferences,
    )).toEqual({
      agentId: 'agent.code-engine.codex',
      engineId: 'codex',
      modelId: 'gpt-5-custom',
      providerBindingId: 'binding.provider.codex',
      providerId: 'provider.openai',
    });
    expect(resolveWorkbenchRuntimeBindingIdentity(
      'claude-code',
      'gpt-5-fast',
      preferences,
    )).toEqual({
      agentId: 'agent.code-engine.claude-code',
      engineId: 'claude-code',
      modelId: 'gpt-5-fast',
      providerBindingId: 'binding.provider.claude-code',
      providerId: 'provider.anthropic',
    });
  });

  it('persists a stable model access channel code for each Agent provider', () => {
    const preferences = setWorkbenchCodeEngineModelAccessChannel(
      saveUnifiedModel(),
      'codex',
      'relay.team-gateway',
    );

    expect(resolveWorkbenchCodeEngineSelectedModelAccessChannelId(
      'codex',
      preferences,
    )).toBe('relay.team-gateway');
    expect(resolveWorkbenchCodeEngineSelectedModelAccessChannelId(
      'claude-code',
      preferences,
    )).toBe('');
    expect(preferences.codeEngineSettings.codex?.modelAccessChannelId)
      .toBe('relay.team-gateway');
  });
});
