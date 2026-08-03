import { describe, expect, it } from 'vitest';
import type { ModelAccessCatalogSnapshot } from '@sdkwork/birdcoder-pc-workbench/workbench/modelAccessBridging';
import type {
  WorkbenchCodeEngineDefinition,
  WorkbenchCodeEngineModelDefinition,
  WorkbenchUnifiedCustomAgentModelDefinition,
} from '@sdkwork/birdcoder-pc-workbench/workbench/codeEngineCatalog';

import {
  createWorkbenchAgentModelAccessSelectorCatalog,
  createWorkbenchModelAccessFallbackModels,
  mergeWorkbenchModelAccessCatalogSnapshot,
  resolveWorkbenchAgentModelConfigurationMetadata,
  resolveWorkbenchAgentModelOptionId,
  resolveWorkbenchModelAccessChannelId,
} from './workbenchAgentModelAccessSelectorAdapter';

const catalogModel = {
  id: 'catalog-model',
  label: 'Catalog model',
  description: 'Agents catalog model',
  vendor: 'openai',
  modelVendor: 'openai',
  providerId: 'provider.openai',
  bindingId: 'binding.provider.codex',
  defaultForEngine: true,
  source: 'agents-catalog',
} as const;

const engine: WorkbenchCodeEngineDefinition = {
  id: 'codex',
  agentId: 'agent.code-engine.codex',
  bindingId: 'binding.agent.codex',
  label: 'Codex',
  aliases: [],
  defaultModelId: catalogModel.id,
  models: [catalogModel],
  modelCatalog: [catalogModel],
  modelIds: [catalogModel.id],
  tier: 'official-sdk',
  defaultAccessModeId: '',
  accessModes: [],
};

const customConfiguration: WorkbenchUnifiedCustomAgentModelDefinition = {
  configurationId: 'model-access.relay.example',
  modelId: 'gpt-custom',
  label: 'Custom relay',
  description: 'Multi-vendor relay',
  vendorCode: 'openai',
  baseUrl: 'https://models.example.test/v1',
  supportedModelIds: ['gpt-custom'],
  supportedProviderIds: ['codex', 'claude-code'],
  supportsMultimodal: true,
  apiKeyConfigured: true,
  accessChannelKind: 'relay',
  accessChannelName: 'Example Relay',
  defaultVendorCode: 'openai',
  vendorOfferings: [
    { vendorCode: 'openai', vendorName: 'OpenAI', modelIds: ['gpt-custom'] },
    { vendorCode: 'anthropic', vendorName: 'Anthropic', modelIds: ['claude-custom'] },
  ],
};

describe('workbench Agent model access selector adapter', () => {
  it('builds fallback models from the current sdkwork-models generated catalog', () => {
    const models = createWorkbenchModelAccessFallbackModels([engine]);

    expect(models).toEqual(expect.arrayContaining([
      expect.objectContaining({
        catalogKey: 'openai/gpt-5.6-sol',
        catalogVersion: expect.stringMatching(/^2026\./u),
        contextTokens: 1_050_000,
        inputModalities: ['text', 'image'],
        maxOutputTokens: 128_000,
        modelId: 'gpt-5.6-sol',
        outputModalities: ['text'],
        supportedAgentProviderIds: expect.arrayContaining(['codex']),
        supportsTools: true,
        toolCallRounds: undefined,
        vendorCode: 'openai',
      }),
      expect.objectContaining({
        catalogKey: 'anthropic/claude-opus-5',
        modelId: 'claude-opus-5',
        vendorCode: 'anthropic',
      }),
      expect.objectContaining({
        catalogKey: 'alibaba/qwen3.8-max-preview',
        modelId: 'qwen3.8-max-preview',
        releaseStage: 'preview',
      }),
      expect.objectContaining({ modelId: catalogModel.id }),
    ]));
    expect(models.some((model) => model.modelId === 'claude-mythos-5')).toBe(false);
    expect(resolveWorkbenchAgentModelConfigurationMetadata(
      models,
      'openai',
      'gpt-5.6-sol',
      'openai/gpt-5.6-sol',
    )).toMatchObject({
      inputContextTokens: 1_050_000,
      outputContextTokens: 128_000,
      toolCallRounds: undefined,
      supportsTools: true,
      supportsMultimodal: true,
    });
  });

  it('skips engine models whose vendor cannot be resolved', () => {
    const unknownVendorModel: WorkbenchCodeEngineModelDefinition = {
      ...catalogModel,
      id: 'mystery-model',
      label: 'Mystery model',
      modelVendor: 'unknown',
      vendor: 'unknown',
    };
    const engineWithUnknownVendorModel: WorkbenchCodeEngineDefinition = {
      ...engine,
      models: [catalogModel, unknownVendorModel],
      modelCatalog: [catalogModel, unknownVendorModel],
      modelIds: [catalogModel.id, unknownVendorModel.id],
    };
    const models = createWorkbenchModelAccessFallbackModels([engineWithUnknownVendorModel]);
    expect(models.some((model) => model.vendorCode === 'unknown')).toBe(false);
    expect(models.some((model) => model.modelId === catalogModel.id)).toBe(true);
  });

  it('projects database channels and keeps user custom relay offerings separate', () => {
    const snapshot: ModelAccessCatalogSnapshot = {
      source: 'database',
      models: [{
        id: 'database:openai%2Fgpt-db',
        catalogKey: 'openai/gpt-db',
        modelId: 'gpt-db',
        label: 'GPT DB',
        vendorCode: 'openai',
        vendorName: 'OpenAI',
        source: 'database',
        contextTokens: 128_000,
        maxOutputTokens: 16_000,
        toolCallRounds: 24,
        inputModalities: ['text', 'image'],
        outputModalities: ['text'],
        supportsTools: true,
        supportedAgentProviderIds: ['codex'],
      }],
      accessChannels: [{
        id: '42',
        code: 'official-openai',
        name: 'OpenAI Official',
        kind: 'official',
        baseUrl: 'https://api.openai.com/v1',
        defaultVendorCode: 'openai',
        defaultModelId: 'gpt-db',
        supportedAgentProviderIds: ['codex'],
        vendorCount: 1,
        modelCount: 1,
        offerings: [{
          vendorCode: 'openai',
          vendorName: 'OpenAI',
          models: [{
            catalogKey: 'openai/gpt-db',
            modelId: 'gpt-db',
            modelLabel: 'GPT DB',
          }],
        }],
      }],
    };

    const catalog = createWorkbenchAgentModelAccessSelectorCatalog(
      snapshot,
      [customConfiguration],
      ['codex', 'claude-code'],
    );

    expect(catalog.models.some((model) => model.modelId === 'gpt-5.6-sol')).toBe(false);
    // Custom channel models are not flattened into the model list; they stay
    // reachable through the owning channel's offerings (right-side panel).
    expect(catalog.models).toEqual(expect.arrayContaining([
      expect.objectContaining({ modelId: 'gpt-db', source: 'database' }),
    ]));
    expect(catalog.models.some((model) => model.modelId === 'gpt-custom')).toBe(false);
    expect(catalog.models.some((model) => model.modelId === 'claude-custom')).toBe(false);
    const customChannel = catalog.accessChannels.find(
      (channel) => channel.id === customConfiguration.configurationId,
    );
    expect(customChannel?.offerings.some(
      (offering) => offering.models.some((model) => model.model === 'gpt-custom'),
    )).toBe(true);
    expect(customChannel?.offerings.some(
      (offering) => offering.models.some((model) => model.model === 'claude-custom'),
    )).toBe(true);
    expect(catalog.accessChannels).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'official-openai',
        code: 'official-openai',
        defaultVendorCode: 'openai',
        defaultModelId: 'gpt-db',
        kind: 'official',
        isCustom: false,
        apiKeyConfigured: false,
      }),
      expect.objectContaining({
        id: customConfiguration.configurationId,
        kind: 'relay',
        isCustom: true,
        vendorCount: 2,
      }),
    ]));
    const customOptionId = resolveWorkbenchAgentModelOptionId(
      catalog,
      'claude-code',
      'claude-custom',
    );
    expect(customOptionId).not.toBe('');
    expect(resolveWorkbenchModelAccessChannelId(catalog, customOptionId)).toBe(
      customConfiguration.configurationId,
    );
    expect(resolveWorkbenchModelAccessChannelId(
      catalog,
      resolveWorkbenchAgentModelOptionId(catalog, 'codex', 'gpt-db'),
      'official-openai',
    )).toBe('official-openai');
    expect(resolveWorkbenchAgentModelConfigurationMetadata(
      snapshot.models,
      'openai',
      'gpt-db',
      'openai/gpt-db',
    )).toMatchObject({
      inputContextTokens: 128_000,
      outputContextTokens: 16_000,
      toolCallRounds: 24,
      supportsMultimodal: true,
    });
  });

  it('keeps database public metadata authoritative and supplements credential state locally', () => {
    const snapshot: ModelAccessCatalogSnapshot = {
      source: 'database',
      models: [{
        id: 'database:openai%2Fgpt-custom',
        catalogKey: 'openai/gpt-custom',
        modelId: 'gpt-custom',
        label: 'Database GPT Custom',
        vendorCode: 'openai',
        vendorName: 'OpenAI',
        source: 'database',
        supportedAgentProviderIds: ['codex'],
      }],
      accessChannels: [{
        id: '99',
        code: customConfiguration.configurationId,
        name: 'Database Relay Name',
        kind: 'relay',
        baseUrl: 'https://database.example.test/v1',
        defaultVendorCode: 'openai',
        defaultModelId: 'gpt-custom',
        supportedAgentProviderIds: ['codex'],
        vendorCount: 1,
        modelCount: 1,
        offerings: [{
          vendorCode: 'openai',
          vendorName: 'OpenAI from database',
          models: [{
            catalogKey: 'openai/gpt-custom',
            modelId: 'gpt-custom',
            modelLabel: 'Database GPT Custom',
          }],
        }],
      }],
    };

    const catalog = createWorkbenchAgentModelAccessSelectorCatalog(
      snapshot,
      [customConfiguration],
      ['codex', 'claude-code'],
    );

    expect(catalog.models).toEqual([
      expect.objectContaining({
        label: 'Database GPT Custom',
        modelId: 'gpt-custom',
        source: 'database',
      }),
    ]);
    expect(catalog.accessChannels).toEqual([
      expect.objectContaining({
        id: customConfiguration.configurationId,
        name: 'Database Relay Name',
        baseUrl: 'https://database.example.test/v1',
        apiKeyConfigured: true,
        isCustom: true,
        defaultVendorCode: 'openai',
        defaultModelId: 'gpt-custom',
      }),
    ]);
  });

  it('removes fallback public rows when a database snapshot is merged', () => {
    const current: ModelAccessCatalogSnapshot = {
      source: 'database',
      models: [
        {
          id: 'database:openai%2Fold',
          catalogKey: 'openai/old',
          modelId: 'old',
          label: 'Database old',
          vendorCode: 'openai',
          vendorName: 'OpenAI',
          source: 'database',
          supportedAgentProviderIds: ['codex'],
        },
        {
          id: 'fallback:stale',
          catalogKey: 'openai/stale',
          modelId: 'stale',
          label: 'Stale fallback',
          vendorCode: 'openai',
          vendorName: 'OpenAI',
          source: 'fallback',
          supportedAgentProviderIds: ['codex'],
        },
      ],
      accessChannels: [],
    };
    const update: ModelAccessCatalogSnapshot = {
      source: 'database',
      models: [{
        id: 'database:anthropic%2Fnew',
        catalogKey: 'anthropic/new',
        modelId: 'new',
        label: 'Database new',
        vendorCode: 'anthropic',
        vendorName: 'Anthropic',
        source: 'database',
        supportedAgentProviderIds: ['codex'],
      }],
      accessChannels: [],
    };

    const result = mergeWorkbenchModelAccessCatalogSnapshot(current, update);

    expect(result.source).toBe('database');
    expect(result.models.map((model) => model.modelId)).toEqual(['old', 'new']);
    expect(result.models).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ modelId: 'stale', source: 'fallback' }),
    ]));
  });
});
