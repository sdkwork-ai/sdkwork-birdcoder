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
});
