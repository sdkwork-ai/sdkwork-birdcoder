import { describe, expect, it, vi } from 'vitest';

import { AgentsSdkModelConfigurationService } from './agentsModelConfigurationService.ts';

type AgentsClient = ConstructorParameters<typeof AgentsSdkModelConfigurationService>[0];

describe('AgentsSdkModelConfigurationService', () => {
  it('uses the generated semantic SDK method and maps int64 settings', async () => {
    const apply = vi.fn().mockResolvedValue({
      configurationId: 'model.custom.openai-compatible.example-chat',
      profileId: 'profile-1',
      engineId: 'codex',
      agentId: 'agent.code-engine.codex',
      providerScope: 'codex',
      vendorCode: 'openai-compatible',
      baseUrl: 'https://models.example.test/v1',
      defaultModelId: 'example-chat',
      supportedModelIds: ['example-chat', 'example-reasoning'],
      supportedProviderIds: ['codex', 'claude-code'],
      inputContextTokens: '128000',
      outputContextTokens: '16000',
      toolCallRounds: '32',
      supportsMultimodal: true,
      apiKeyConfigured: true,
    });
    const client = {
      ai: {
        agents: {
          modelConfigurations: { apply },
        },
      },
    } as unknown as AgentsClient;
    const service = new AgentsSdkModelConfigurationService(client);

    const result = await service.apply({
      configurationId: 'model.custom.openai-compatible.example-chat',
      engineId: 'codex',
      vendorCode: 'openai-compatible',
      baseUrl: 'https://models.example.test/v1',
      apiKey: 'write-only-secret',
      defaultModelId: 'example-chat',
      supportedModelIds: ['example-chat', 'example-reasoning'],
      supportedProviderIds: ['codex', 'claude-code'],
      inputContextTokens: 128000,
      outputContextTokens: 16000,
      toolCallRounds: 32,
      supportsMultimodal: true,
    });

    expect(apply).toHaveBeenCalledOnce();
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'write-only-secret',
      inputContextTokens: '128000',
      outputContextTokens: '16000',
      toolCallRounds: '32',
    }));
    expect(result).toMatchObject({
      inputContextTokens: 128000,
      outputContextTokens: 16000,
      toolCallRounds: 32,
      apiKeyConfigured: true,
    });
    expect(result).not.toHaveProperty('apiKey');
  });

  it('applies built-in and custom selections through the generated semantic SDK method', async () => {
    const applySelection = vi.fn().mockResolvedValue({
      configurationId: 'model.custom.openai-compatible.example-chat',
      profileId: 'profile-1',
      engineId: 'codex',
      agentId: 'agent.code-engine.codex',
      providerScope: 'codex',
      modelId: 'example-chat',
    });
    const client = {
      ai: {
        agents: {
          modelSelections: { apply: applySelection },
        },
      },
    } as unknown as AgentsClient;
    const service = new AgentsSdkModelConfigurationService(client);

    await service.applySelection({
      engineId: 'codex',
      modelId: 'catalog-model',
    });
    const custom = await service.applySelection({
      configurationId: 'model.custom.openai-compatible.example-chat',
      engineId: 'codex',
      modelId: 'example-chat',
    });

    expect(applySelection).toHaveBeenNthCalledWith(1, {
      configurationId: undefined,
      engineId: 'codex',
      modelId: 'catalog-model',
    });
    expect(applySelection).toHaveBeenNthCalledWith(2, {
      configurationId: 'model.custom.openai-compatible.example-chat',
      engineId: 'codex',
      modelId: 'example-chat',
    });
    expect(custom).toMatchObject({
      configurationId: 'model.custom.openai-compatible.example-chat',
      providerScope: 'codex',
    });
  });

  it('configures a custom model once for the active provider before selecting it', async () => {
    const applyConfiguration = vi.fn().mockResolvedValue({
      configurationId: 'model.custom.example.chat',
      profileId: 'profile-1',
      engineId: 'claude-code',
      agentId: 'agent.code-engine.claude-code',
      providerScope: 'claude-code',
      vendorCode: 'openai-compatible',
      baseUrl: 'https://models.example.test/v1',
      defaultModelId: 'example-chat',
      supportedModelIds: ['example-chat'],
      supportedProviderIds: ['codex', 'claude-code'],
      supportsMultimodal: false,
      apiKeyConfigured: true,
    });
    const applySelection = vi.fn().mockResolvedValue({
      configurationId: 'model.custom.example.chat',
      profileId: 'profile-1',
      engineId: 'claude-code',
      agentId: 'agent.code-engine.claude-code',
      providerScope: 'claude-code',
      modelId: 'example-chat',
    });
    const client = {
      ai: {
        agents: {
          modelConfigurations: { apply: applyConfiguration },
          modelSelections: { apply: applySelection },
        },
      },
    } as unknown as AgentsClient;
    const service = new AgentsSdkModelConfigurationService(client);

    const result = await service.applySelection({
      configurationId: 'model.custom.example.chat',
      engineId: 'claude-code',
      modelId: 'example-chat',
      configuration: {
        vendorCode: 'openai-compatible',
        baseUrl: 'https://models.example.test/v1',
        apiKey: 'write-only-secret',
        defaultModelId: 'example-chat',
        supportedModelIds: ['example-chat'],
        supportedProviderIds: ['codex', 'claude-code'],
        supportsMultimodal: false,
      },
    });

    expect(applyConfiguration).toHaveBeenCalledOnce();
    expect(applyConfiguration).toHaveBeenCalledWith(expect.objectContaining({
      configurationId: 'model.custom.example.chat',
      engineId: 'claude-code',
    }));
    expect(applySelection).toHaveBeenCalledOnce();
    expect(applySelection).toHaveBeenCalledWith({
      configurationId: 'model.custom.example.chat',
      engineId: 'claude-code',
      modelId: 'example-chat',
    });
    expect(result.configurationApplied?.engineId).toBe('claude-code');
  });

  it('reuses the unified session configuration when a custom model moves providers', async () => {
    const applyConfiguration = vi.fn().mockImplementation(async (input) => ({
      configurationId: input.configurationId,
      profileId: `profile-${input.engineId}`,
      engineId: input.engineId,
      agentId: `agent.code-engine.${input.engineId}`,
      providerScope: input.engineId,
      vendorCode: input.vendorCode,
      baseUrl: input.baseUrl,
      defaultModelId: input.defaultModelId,
      supportedModelIds: input.supportedModelIds,
      supportedProviderIds: input.supportedProviderIds,
      supportsMultimodal: input.supportsMultimodal,
      apiKeyConfigured: true,
    }));
    const applySelection = vi.fn().mockImplementation(async (input) => ({
      configurationId: input.configurationId,
      profileId: `profile-${input.engineId}`,
      engineId: input.engineId,
      agentId: `agent.code-engine.${input.engineId}`,
      providerScope: input.engineId,
      modelId: input.modelId,
    }));
    const client = {
      ai: {
        agents: {
          modelConfigurations: { apply: applyConfiguration },
          modelSelections: { apply: applySelection },
        },
      },
    } as unknown as AgentsClient;
    const service = new AgentsSdkModelConfigurationService(client);
    const configuration = {
      vendorCode: 'openai-compatible',
      baseUrl: 'https://models.example.test/v1',
      apiKey: 'write-only-secret',
      defaultModelId: 'example-chat',
      supportedModelIds: ['example-chat'],
      supportedProviderIds: ['codex', 'claude-code'] as ('codex' | 'claude-code')[],
      supportsMultimodal: false,
    };

    await service.applySelection({
      configurationId: 'model.custom.example.chat',
      engineId: 'codex',
      modelId: 'example-chat',
      configuration,
    });
    const moved = await service.applySelection({
      configurationId: 'model.custom.example.chat',
      engineId: 'claude-code',
      modelId: 'example-chat',
    });

    expect(applyConfiguration).toHaveBeenCalledTimes(2);
    expect(applyConfiguration).toHaveBeenLastCalledWith(expect.objectContaining({
      engineId: 'claude-code',
      apiKey: 'write-only-secret',
    }));
    expect(moved.configurationApplied?.engineId).toBe('claude-code');
  });
});
