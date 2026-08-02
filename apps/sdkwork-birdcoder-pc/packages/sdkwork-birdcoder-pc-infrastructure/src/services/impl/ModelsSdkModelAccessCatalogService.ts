import type {
  AppModelAccessChannelItem,
  AppModelCatalogItem,
  ModelsAppSdkClient,
} from '@sdkwork/birdcoder-pc-core/sdk/models-app';

import type {
  IModelAccessCatalogService,
  LoadModelAccessCatalogOptions,
  ModelAccessCatalogChannel,
  ModelAccessCatalogModel,
  ModelAccessCatalogSnapshot,
  UpsertModelAccessCatalogChannelInput,
  UpsertModelAccessCatalogChannelOptions,
} from '../interfaces/IModelAccessCatalogService.ts';
const CATALOG_PAGE_SIZE = 100;

function nonBlank(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean))];
}

function databaseModelId(item: AppModelCatalogItem): string {
  return `database:${encodeURIComponent(item.catalogKey.trim().toLowerCase())}`;
}

function databaseReleaseStage(value: number | null): string | undefined {
  switch (value) {
    case 1:
      return 'active';
    case 2:
      return 'preview';
    case 3:
      return 'deprecated';
    default:
      return undefined;
  }
}

function optionalPositiveInteger(value: number | null | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return undefined;
  }
  return value;
}

function mapDatabaseModel(
  item: AppModelCatalogItem,
  sortOrder: number,
): ModelAccessCatalogModel {
  return {
    id: databaseModelId(item),
    catalogKey: item.catalogKey,
    modelId: item.model,
    label: item.displayName,
    description: nonBlank(item.description) ?? nonBlank(item.capabilityIntro),
    vendorCode: item.vendorCode,
    vendorName: item.vendor,
    source: 'database',
    releaseStage: databaseReleaseStage(item.releaseStage),
    searchTerms: uniqueStrings([
      ...item.capabilities,
      ...item.categories,
      ...item.groups,
      ...item.inputModalities,
      ...item.modalities,
      ...item.outputModalities,
      ...item.supportedLanguages,
      ...item.useCases,
      item.apiFormat,
      item.capabilityIntro,
      item.replacementModel,
    ]),
    sortOrder,
    contextTokens: optionalPositiveInteger(item.contextTokens),
    maxOutputTokens: optionalPositiveInteger(item.maxOutputTokens),
    supportsTools: item.supportsTools,
    inputModalities: uniqueStrings(item.inputModalities),
    modalities: uniqueStrings(item.modalities),
    outputModalities: uniqueStrings(item.outputModalities),
    supportedAgentProviderIds: uniqueStrings(item.supportedAgentProviderIds),
  };
}

function optionalSortOrder(value: string | null | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function mapDatabaseChannel(
  channel: AppModelAccessChannelItem,
): ModelAccessCatalogChannel {
  return {
    id: channel.id,
    code: channel.code,
    name: channel.name,
    kind: channel.kind,
    baseUrl: nonBlank(channel.baseUrl),
    description: nonBlank(channel.description),
    defaultVendorCode: nonBlank(channel.defaultVendorCode),
    defaultModelId: nonBlank(channel.defaultModelId),
    offerings: channel.offerings.map((offering) => ({
      vendorCode: offering.vendorCode,
      vendorName: offering.vendorName,
      models: offering.models.map((model) => ({
        catalogKey: nonBlank(model.catalogKey),
        modelId: model.model,
        modelLabel: model.displayName,
      })),
    })),
    sortOrder: optionalSortOrder(channel.sortOrder),
    supportedAgentProviderIds: uniqueStrings(channel.supportedAgentProviderIds),
    vendorCount: channel.vendorCount,
    modelCount: channel.modelCount,
  };
}

function boundedPageSize(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return CATALOG_PAGE_SIZE;
  }
  return Math.min(value, CATALOG_PAGE_SIZE);
}

function fallbackModelMatchesQuery(
  model: ModelAccessCatalogModel,
  query: string | undefined,
): boolean {
  if (!query) {
    return true;
  }
  const terms = query.toLowerCase().split(/\s+/u).filter(Boolean);
  const haystack = [
    model.catalogKey,
    model.modelId,
    model.label,
    model.description,
    model.vendorCode,
    model.vendorName,
    ...(model.searchTerms ?? []),
  ].filter(Boolean).join(' ').toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function fallbackSnapshot(
  fallbackModels: readonly ModelAccessCatalogModel[],
  accessChannels: ModelAccessCatalogChannel[] = [],
  query?: string,
): ModelAccessCatalogSnapshot {
  return {
    models: fallbackModels
      .filter((model) => fallbackModelMatchesQuery(model, query))
      .map((model) => ({ ...model, source: 'fallback' })),
    accessChannels,
    source: 'fallback',
  };
}

export class ModelsSdkModelAccessCatalogService
implements IModelAccessCatalogService {
  private readonly offline: boolean;

  constructor(
    private readonly client: ModelsAppSdkClient,
    options: { offline?: boolean } = {},
  ) {
    // The standalone desktop gateway mounts the Models App API against the
    // client-local SQLite database, so the platform client is authoritative
    // in every deployment profile. An explicit offline flag remains for tests.
    this.offline = options.offline ?? false;
  }

  async loadCatalog(
    options: LoadModelAccessCatalogOptions,
  ): Promise<ModelAccessCatalogSnapshot> {
    const query = nonBlank(options.query);
    if (this.offline) {
      return fallbackSnapshot(options.fallbackModels, [], query);
    }
    const [modelsResult, channelsResult] = await Promise.allSettled([
      this.listModels(options),
      this.listAccessChannels(options),
    ]);
    const accessChannels = channelsResult.status === 'fulfilled'
      ? channelsResult.value
      : [];
    if (modelsResult.status === 'rejected') {
      return fallbackSnapshot(options.fallbackModels, accessChannels, query);
    }
    if (modelsResult.value.length === 0) {
      // A filtered database query returning no rows is authoritative when the
      // underlying catalog is non-empty. Probe the unfiltered catalog only in
      // this case so an empty database still gets the built-in fallback.
      if (query) {
        try {
          const authorityProbe = await this.listModels({
            ...options,
            query: undefined,
            pageSize: 1,
          });
          if (authorityProbe.length > 0) {
            return {
              models: [],
              accessChannels,
              source: 'database',
            };
          }
        } catch {
          // Treat an unavailable authority probe as an unavailable database.
        }
      }
      return fallbackSnapshot(options.fallbackModels, accessChannels, query);
    }
    return {
      models: modelsResult.value,
      accessChannels,
      source: 'database',
    };
  }

  async upsertAccessChannel(
    input: UpsertModelAccessCatalogChannelInput,
    options: UpsertModelAccessCatalogChannelOptions = {},
  ): Promise<ModelAccessCatalogChannel> {
    if (this.offline) {
      throw new Error('Model access channels require the SDKWork Models platform service.');
    }
    const channel = await this.client.ai.modelAccessChannels.upsert(
      input.channelCode,
      {
        name: input.name,
        kind: input.kind,
        baseUrl: input.baseUrl,
        ...(input.description ? { description: input.description } : {}),
        offerings: input.offerings.map((offering) => ({
          vendorCode: offering.vendorCode,
          vendorName: offering.vendorName,
          models: offering.models.map((model) => ({
            modelId: model.modelId,
            displayName: model.displayName,
          })),
        })),
        defaultVendorCode: input.defaultVendorCode,
        defaultModelId: input.defaultModelId,
        supportedAgentProviderIds: [...input.supportedAgentProviderIds],
      },
      { signal: options.signal },
    );
    return mapDatabaseChannel(channel);
  }

  private async listModels(
    options: LoadModelAccessCatalogOptions,
  ): Promise<ModelAccessCatalogModel[]> {
    const query = nonBlank(options.query);
    const result = await this.client.ai.models.list(
      {
        page: 1,
        pageSize: boundedPageSize(options.pageSize),
        ...(query ? { q: query } : {}),
      },
      { signal: options.signal },
    );
    return result.items.map(mapDatabaseModel);
  }

  private async listAccessChannels(
    options: LoadModelAccessCatalogOptions,
  ): Promise<ModelAccessCatalogChannel[]> {
    const query = nonBlank(options.query);
    const agentProviderId = nonBlank(options.agentProviderId);
    const result = await this.client.ai.modelAccessChannels.list(
      {
        page: 1,
        pageSize: boundedPageSize(options.pageSize),
        ...(query ? { q: query } : {}),
        ...(agentProviderId ? { agentProviderId } : {}),
      },
      { signal: options.signal },
    );
    return result.items.map(mapDatabaseChannel);
  }
}
