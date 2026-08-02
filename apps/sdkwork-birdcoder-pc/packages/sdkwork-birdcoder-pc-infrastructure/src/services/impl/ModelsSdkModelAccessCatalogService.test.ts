import { describe, expect, it, vi } from 'vitest';
import type {
  AppModelCatalogItem,
  ModelsAppSdkClient,
} from '@sdkwork/birdcoder-pc-core/sdk/models-app';

import type { ModelAccessCatalogModel } from '../interfaces/IModelAccessCatalogService.ts';
import { ModelsSdkModelAccessCatalogService } from './ModelsSdkModelAccessCatalogService.ts';

function databaseModel(overrides: Partial<AppModelCatalogItem> = {}): AppModelCatalogItem {
  return {
    apiFormat: null,
    capabilities: ['chat'],
    capabilityIntro: null,
    catalogKey: 'openai/gpt-test',
    categories: ['coding'],
    contextTokens: null,
    description: 'Database model',
    displayName: 'GPT Test',
    groups: [],
    inputModalities: ['text'],
    limitations: [],
    maxOutputTokens: null,
    modalities: ['text'],
    model: 'gpt-test',
    officialReferencePrices: [],
    outputModalities: ['text'],
    priceAvailability: {
      reason: null,
      status: 'unavailable',
    },
    providerCodes: [],
    releaseStage: null,
    replacementModel: null,
    routingState: null,
    shelfState: null,
    supportedAgentProviderIds: ['codex'],
    supportedLanguages: [],
    supportsJsonSchema: true,
    supportsStreaming: true,
    supportsTools: true,
    trainingDataCutoff: null,
    useCases: ['code generation'],
    vendor: 'OpenAI',
    vendorCode: 'openai',
    ...overrides,
  };
}

const fallbackModel: ModelAccessCatalogModel = {
  id: 'fallback:gpt-fallback',
  catalogKey: 'openai/gpt-fallback',
  modelId: 'gpt-fallback',
  label: 'GPT Fallback',
  source: 'fallback',
  supportedAgentProviderIds: ['codex'],
  vendorCode: 'openai',
  vendorName: 'OpenAI',
};

function createService({
  listChannels = vi.fn().mockResolvedValue({
    items: [],
    pageInfo: { mode: 'offset', page: 1, pageSize: 100, hasMore: false },
  }),
  listModels = vi.fn().mockResolvedValue({
    items: [],
    groups: [],
    pageInfo: { mode: 'offset', page: 1, pageSize: 100, hasMore: false },
  }),
  upsertChannel = vi.fn().mockResolvedValue({
    id: '42',
    code: 'relay-acme',
    name: 'Acme Relay',
    kind: 'relay',
    baseUrl: 'https://relay.example.com/v1',
    defaultVendorCode: 'openai',
    defaultModelId: 'gpt-test',
    supportedAgentProviderIds: ['codex'],
    offerings: [],
    vendorCount: 1,
    modelCount: 1,
  }),
} = {}) {
  const client = {
    ai: {
      modelAccessChannels: { list: listChannels, upsert: upsertChannel },
      models: { list: listModels },
    },
  } as unknown as ModelsAppSdkClient;
  return {
    listChannels,
    listModels,
    upsertChannel,
    service: new ModelsSdkModelAccessCatalogService(client),
  };
}

describe('ModelsSdkModelAccessCatalogService', () => {
  it('treats a non-empty database model result as authoritative', async () => {
    const listModels = vi.fn().mockResolvedValue({
      items: [
        databaseModel({
          contextTokens: 128_000,
          maxOutputTokens: 16_000,
          releaseStage: 1,
        }),
        databaseModel({
          catalogKey: 'anthropic/claude-test',
          displayName: 'Claude Test',
          model: 'claude-test',
          vendor: 'Anthropic',
          vendorCode: 'anthropic',
        }),
      ],
      groups: [],
      pageInfo: { mode: 'offset', page: 1, pageSize: 100, hasMore: true },
    });
    const listChannels = vi.fn().mockResolvedValue({
      items: [{
        id: '42',
        code: 'relay-acme',
        name: 'Acme Relay',
        kind: 'relay',
        baseUrl: 'https://relay.example.com/v1',
        description: 'Managed relay',
        defaultVendorCode: 'openai',
        defaultModelId: 'gpt-test',
        supportedAgentProviderIds: ['codex', 'claude-code'],
        offerings: [{
          vendorCode: 'openai',
          vendorName: 'OpenAI',
          models: [{
            catalogKey: 'openai/gpt-test',
            model: 'gpt-test',
            displayName: 'GPT Test',
          }],
        }],
        vendorCount: 1,
        modelCount: 1,
        sortOrder: '5',
      }],
      pageInfo: { mode: 'offset', page: 1, pageSize: 100, hasMore: false },
    });
    const { service } = createService({ listChannels, listModels });

    const result = await service.loadCatalog({
      fallbackModels: [fallbackModel],
      query: 'test',
      agentProviderId: 'codex',
    });

    expect(result.source).toBe('database');
    expect(result.models.map((model) => model.modelId)).toEqual([
      'gpt-test',
      'claude-test',
    ]);
    expect(result.models).toMatchObject([
      {
        modelId: 'gpt-test',
        releaseStage: 'active',
        sortOrder: 0,
        contextTokens: 128_000,
        maxOutputTokens: 16_000,
        supportsTools: true,
      },
      { modelId: 'claude-test', sortOrder: 1 },
    ]);
    expect(result.models).not.toContainEqual(expect.objectContaining({ modelId: 'gpt-fallback' }));
    expect(result.accessChannels).toEqual([expect.objectContaining({
      id: '42',
      kind: 'relay',
      defaultVendorCode: 'openai',
      defaultModelId: 'gpt-test',
      sortOrder: 5,
      supportedAgentProviderIds: ['codex', 'claude-code'],
      offerings: [expect.objectContaining({
        vendorCode: 'openai',
        models: [expect.objectContaining({ modelId: 'gpt-test' })],
      })],
    })]);
    expect(listModels).toHaveBeenCalledOnce();
    expect(listModels).toHaveBeenCalledWith(
      { page: 1, pageSize: 100, q: 'test' },
      { signal: undefined },
    );
    expect(listChannels).toHaveBeenCalledWith(
      { page: 1, pageSize: 100, q: 'test', agentProviderId: 'codex' },
      { signal: undefined },
    );
  });

  it('uses the generated fallback when the database returns no models', async () => {
    const { service } = createService();

    await expect(service.loadCatalog({ fallbackModels: [fallbackModel] })).resolves.toEqual({
      models: [fallbackModel],
      accessChannels: [],
      source: 'fallback',
    });
  });

  it('keeps an empty filtered result authoritative when the database has other models', async () => {
    const listModels = vi.fn()
      .mockResolvedValueOnce({
        items: [],
        groups: [],
        pageInfo: { mode: 'offset', page: 1, pageSize: 100, hasMore: false },
      })
      .mockResolvedValueOnce({
        items: [databaseModel()],
        groups: [],
        pageInfo: { mode: 'offset', page: 1, pageSize: 1, hasMore: true },
      });
    const { service } = createService({ listModels });

    await expect(service.loadCatalog({
      fallbackModels: [fallbackModel],
      query: 'does-not-exist',
    })).resolves.toMatchObject({
      models: [],
      source: 'database',
    });
    expect(listModels).toHaveBeenNthCalledWith(
      2,
      { page: 1, pageSize: 1 },
      { signal: undefined },
    );
  });

  it('uses the generated fallback on model request failure without discarding channels', async () => {
    const listModels = vi.fn().mockRejectedValue(new Error('offline'));
    const listChannels = vi.fn().mockResolvedValue({
      items: [{
        id: '7',
        code: 'official-openai',
        name: 'OpenAI',
        kind: 'official',
        baseUrl: 'https://api.openai.com/v1',
        defaultVendorCode: 'openai',
        defaultModelId: 'gpt-test',
        supportedAgentProviderIds: [],
        offerings: [],
        vendorCount: 1,
        modelCount: 0,
      }],
      pageInfo: { mode: 'offset', page: 1, pageSize: 100, hasMore: false },
    });
    const { service } = createService({ listChannels, listModels });

    const result = await service.loadCatalog({ fallbackModels: [fallbackModel] });

    expect(result.source).toBe('fallback');
    expect(result.models).toEqual([fallbackModel]);
    expect(result.accessChannels[0]?.id).toBe('7');
  });

  it('upserts only public channel metadata through the generated Models SDK', async () => {
    const upsertChannel = vi.fn().mockResolvedValue({
      id: '42',
      code: 'relay-acme',
      name: 'Acme Relay',
      kind: 'relay',
      baseUrl: 'https://relay.example.com/v1',
      description: 'Managed relay',
      defaultVendorCode: 'openai',
      defaultModelId: 'gpt-test',
      supportedAgentProviderIds: ['codex', 'claude-code'],
      offerings: [{
        vendorCode: 'openai',
        vendorName: 'OpenAI',
        models: [{
          catalogKey: 'openai/gpt-test',
          model: 'gpt-test',
          displayName: 'GPT Test',
        }],
      }],
      vendorCount: 1,
      modelCount: 1,
    });
    const { service } = createService({ upsertChannel });
    const input = {
      channelCode: 'relay-acme',
      name: 'Acme Relay',
      kind: 'relay' as const,
      baseUrl: 'https://relay.example.com/v1',
      description: 'Managed relay',
      offerings: [{
        vendorCode: 'openai',
        vendorName: 'OpenAI',
        models: [{ modelId: 'gpt-test', displayName: 'GPT Test' }],
      }],
      defaultVendorCode: 'openai',
      defaultModelId: 'gpt-test',
      supportedAgentProviderIds: ['codex', 'claude-code'],
      apiKey: 'must-not-leak',
    };

    const result = await service.upsertAccessChannel(input);

    expect(upsertChannel).toHaveBeenCalledOnce();
    expect(upsertChannel).toHaveBeenCalledWith(
      'relay-acme',
      {
        name: 'Acme Relay',
        kind: 'relay',
        baseUrl: 'https://relay.example.com/v1',
        description: 'Managed relay',
        offerings: [{
          vendorCode: 'openai',
          vendorName: 'OpenAI',
          models: [{ modelId: 'gpt-test', displayName: 'GPT Test' }],
        }],
        defaultVendorCode: 'openai',
        defaultModelId: 'gpt-test',
        supportedAgentProviderIds: ['codex', 'claude-code'],
      },
      { signal: undefined },
    );
    expect(upsertChannel.mock.calls[0]?.[1]).not.toHaveProperty('apiKey');
    expect(result).toMatchObject({
      code: 'relay-acme',
      defaultVendorCode: 'openai',
      defaultModelId: 'gpt-test',
    });
  });

  it('serves the fallback catalog offline without issuing SDK requests', async () => {
    const { listChannels, listModels, upsertChannel } = createService();
    const offlineService = new ModelsSdkModelAccessCatalogService(
      {} as unknown as ModelsAppSdkClient,
      { offline: true },
    );

    await expect(offlineService.loadCatalog({
      fallbackModels: [fallbackModel],
    })).resolves.toEqual({
      models: [{ ...fallbackModel, source: 'fallback' }],
      accessChannels: [],
      source: 'fallback',
    });
    await expect(offlineService.upsertAccessChannel({
      channelCode: 'relay-acme',
      name: 'Acme Relay',
      kind: 'relay',
      baseUrl: 'https://relay.example.com/v1',
      offerings: [],
      defaultVendorCode: 'openai',
      defaultModelId: 'gpt-test',
      supportedAgentProviderIds: ['codex'],
    })).rejects.toThrow('Model access channels require the SDKWork Models platform service.');
    expect(listChannels).not.toHaveBeenCalled();
    expect(listModels).not.toHaveBeenCalled();
    expect(upsertChannel).not.toHaveBeenCalled();
  });
});
