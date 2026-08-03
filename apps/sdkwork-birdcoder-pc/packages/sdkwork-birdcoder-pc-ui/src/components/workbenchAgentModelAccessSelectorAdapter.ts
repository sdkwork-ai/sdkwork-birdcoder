import {
  SDKWORK_MAINSTREAM_AGENT_MODEL_CATALOG,
  type AgentModelCatalogOption,
  type MainstreamAgentModelCatalogEntry,
  type ModelAccessChannel,
} from '@sdkwork/models-pc-picker';
import type {
  ModelAccessCatalogChannel,
  ModelAccessCatalogModel,
  ModelAccessCatalogSnapshot,
  UserModelChannel,
} from '@sdkwork/birdcoder-pc-workbench/workbench/modelAccessBridging';
import type {
  WorkbenchCodeEngineDefinition,
  WorkbenchUnifiedCustomAgentModelDefinition,
} from '@sdkwork/birdcoder-pc-workbench/workbench/codeEngineCatalog';

export interface WorkbenchAgentModelAccessSelectorCatalog {
  models: AgentModelCatalogOption[];
  accessChannels: ModelAccessChannel[];
  optionIdByProviderModel: ReadonlyMap<string, string>;
}

export interface WorkbenchAgentModelConfigurationMetadata {
  catalogModel: ModelAccessCatalogModel;
  inputContextTokens?: number;
  outputContextTokens?: number;
  toolCallRounds?: number;
  supportsTools?: boolean;
  supportsMultimodal: boolean;
}

function providerModelIdentity(providerId: string, modelId: string): string {
  return `${providerId.trim().toLowerCase()}\u0000${modelId.trim().toLowerCase()}`;
}

function fallbackOptionId(modelId: string): string {
  return `fallback:${encodeURIComponent(modelId.trim().toLowerCase())}`;
}

function customOptionId(
  configurationId: string,
  vendorCode: string,
  modelId: string,
): string {
  return [
    'custom',
    encodeURIComponent(configurationId.trim().toLowerCase()),
    encodeURIComponent(vendorCode.trim().toLowerCase()),
    encodeURIComponent(modelId.trim().toLowerCase()),
  ].join(':');
}

function catalogModelIdentity(
  catalogKey: string | undefined,
  vendorCode: string,
  modelId: string,
): string {
  return catalogKey?.trim().toLowerCase()
    || `${vendorCode.trim().toLowerCase()}\u0000${modelId.trim().toLowerCase()}`;
}

export function resolveWorkbenchAgentModelConfigurationMetadata(
  models: readonly ModelAccessCatalogModel[],
  vendorCode: string,
  modelId: string,
  catalogKey?: string,
): WorkbenchAgentModelConfigurationMetadata | null {
  const normalizedCatalogKey = catalogKey?.trim().toLowerCase();
  const normalizedVendorCode = vendorCode.trim().toLowerCase();
  const normalizedModelId = modelId.trim().toLowerCase();
  const catalogModel = models.find((model) => (
    Boolean(normalizedCatalogKey)
      && model.catalogKey?.trim().toLowerCase() === normalizedCatalogKey
  )) ?? models.find((model) => (
    model.vendorCode.trim().toLowerCase() === normalizedVendorCode
    && model.modelId.trim().toLowerCase() === normalizedModelId
  ));
  if (!catalogModel) {
    return null;
  }
  const modalities = [
    ...(catalogModel.inputModalities ?? []),
    ...(catalogModel.modalities ?? []),
    ...(catalogModel.outputModalities ?? []),
  ].map((modality) => modality.trim().toLowerCase()).filter(Boolean);
  return {
    catalogModel,
    inputContextTokens: catalogModel.contextTokens,
    outputContextTokens: catalogModel.maxOutputTokens,
    toolCallRounds: catalogModel.toolCallRounds,
    supportsTools: catalogModel.supportsTools,
    supportsMultimodal: modalities.some((modality) => modality !== 'text'),
  };
}

export function mergeWorkbenchModelAccessCatalogSnapshot(
  current: ModelAccessCatalogSnapshot,
  update: ModelAccessCatalogSnapshot,
  persistedChannel?: ModelAccessCatalogChannel,
): ModelAccessCatalogSnapshot {
  // A non-empty database catalog is authoritative: discard the fallback
  // snapshot when the first database page arrives. Later database lookups can
  // still enrich an already-authoritative catalog with additional rows.
  // Once the database answers successfully, local fallback rows must never be
  // promoted into the public catalog. Keep already observed database rows for
  // paginated/search enrichment, but discard any fallback rows that may have
  // been carried by a stale snapshot from before the authority was available.
  const currentDatabaseModels = current.models.filter((model) => model.source === 'database');
  const modelsByIdentity = new Map(
    update.source === 'database'
      ? currentDatabaseModels.map((model) => [
        catalogModelIdentity(model.catalogKey, model.vendorCode, model.modelId),
        model,
      ])
      : current.models.map((model) => [
        catalogModelIdentity(model.catalogKey, model.vendorCode, model.modelId),
        model,
      ]),
  );
  if (update.source === 'database') {
    for (const model of update.models) {
      modelsByIdentity.set(
        catalogModelIdentity(model.catalogKey, model.vendorCode, model.modelId),
        model,
      );
    }
  }
  const channelsByCode = new Map(current.accessChannels.map((channel) => [
    (channel.code || channel.id).trim().toLowerCase(),
    channel,
  ]));
  for (const channel of update.accessChannels) {
    channelsByCode.set((channel.code || channel.id).trim().toLowerCase(), channel);
  }
  if (persistedChannel) {
    channelsByCode.set(
      (persistedChannel.code || persistedChannel.id).trim().toLowerCase(),
      persistedChannel,
    );
  }
  return {
    models: [...modelsByIdentity.values()],
    accessChannels: [...channelsByCode.values()],
    source: current.source === 'database' || update.source === 'database'
      ? 'database'
      : 'fallback',
  };
}

export function createWorkbenchModelAccessFallbackModels(
  engines: readonly WorkbenchCodeEngineDefinition[],
): ModelAccessCatalogModel[] {
  const modelsByIdentity = new Map<string, ModelAccessCatalogModel>();
  for (const catalogModel of SDKWORK_MAINSTREAM_AGENT_MODEL_CATALOG as readonly MainstreamAgentModelCatalogEntry[]) {
    modelsByIdentity.set(catalogModel.catalogKey.toLowerCase(), {
      id: fallbackOptionId(catalogModel.modelId),
      catalogKey: catalogModel.catalogKey,
      catalogVersion: catalogModel.catalogVersion,
      contextTokens: catalogModel.contextTokens,
      modelId: catalogModel.modelId,
      label: catalogModel.displayName,
      description: catalogModel.description,
      vendorCode: catalogModel.vendorCode,
      vendorName: catalogModel.vendorName,
      releaseStage: catalogModel.releaseStage,
      source: 'fallback',
      sourceObservedAt: catalogModel.sourceObservedAt,
      searchTerms: [...catalogModel.searchTerms],
      sortOrder: catalogModel.sortOrder,
      rankScore: catalogModel.rankScore,
      maxOutputTokens: catalogModel.maxOutputTokens,
      modalities: catalogModel.modalities ? [...catalogModel.modalities] : undefined,
      inputModalities: [...catalogModel.inputModalities],
      outputModalities: [...catalogModel.outputModalities],
      supportsTools: catalogModel.supportsTools,
      toolCallRounds: catalogModel.toolCallRounds,
      supportedAgentProviderIds: [...catalogModel.supportedProviderIds],
    });
  }

  for (const engine of engines) {
    for (const model of engine.models.filter((entry) => entry.source === 'agents-catalog')) {
      const vendorCode = model.modelVendor.trim().toLowerCase();
      if (!vendorCode || vendorCode === 'unknown') {
        // Engines without a resolvable vendor must not pollute the vendor
        // catalog with an "unknown" entry; the mainstream catalog already
        // covers their real models with correct vendor codes.
        continue;
      }
      const identity = `${model.modelVendor}\u0000${model.id.toLowerCase()}`;
      const existing = [...modelsByIdentity.values()].find((entry) => (
        entry.modelId.toLowerCase() === model.id.toLowerCase()
        && entry.vendorCode.toLowerCase() === model.modelVendor.toLowerCase()
      ));
      if (existing) {
        if (!existing.supportedAgentProviderIds.includes(engine.id)) {
          existing.supportedAgentProviderIds.push(engine.id);
          existing.supportedAgentProviderIds.sort();
        }
        continue;
      }
      modelsByIdentity.set(identity, {
        id: fallbackOptionId(model.id),
        modelId: model.id,
        label: model.label,
        description: model.description,
        vendorCode: model.modelVendor,
        vendorName: model.modelVendor,
        source: 'fallback',
        supportedAgentProviderIds: [engine.id],
      });
    }
  }
  return [...modelsByIdentity.values()];
}

function toSelectorModel(model: ModelAccessCatalogModel): AgentModelCatalogOption {
  return {
    id: model.id,
    catalogKey: model.catalogKey,
    catalogVersion: model.catalogVersion,
    modelId: model.modelId,
    label: model.label,
    description: model.description,
    iconKey: model.vendorCode,
    kind: 'built-in',
    metadataLabel: model.vendorName,
    vendorCode: model.vendorCode,
    vendorName: model.vendorName,
    releaseStage: model.releaseStage,
    source: model.source,
    sourceObservedAt: model.sourceObservedAt,
    searchTerms: model.searchTerms,
    sortOrder: model.sortOrder,
    rankScore: model.rankScore,
    supportedAgentProviderIds: model.supportedAgentProviderIds,
  };
}

function createCustomModels(
  configurations: readonly WorkbenchUnifiedCustomAgentModelDefinition[],
): AgentModelCatalogOption[] {
  return configurations.flatMap((configuration) =>
    configuration.vendorOfferings.flatMap((offering) =>
      offering.modelIds.map((modelId) => ({
        id: customOptionId(configuration.configurationId, offering.vendorCode, modelId),
        modelId,
        label: modelId === configuration.modelId ? configuration.label : modelId,
        description: configuration.description,
        iconKey: offering.vendorCode,
        kind: 'custom' as const,
        metadataLabel: configuration.accessChannelName,
        vendorCode: offering.vendorCode,
        vendorName: offering.vendorName,
        source: 'custom' as const,
        supportedAgentProviderIds: configuration.supportedProviderIds,
      }))),
  );
}

function createCustomAccessChannels(
  configurations: readonly WorkbenchUnifiedCustomAgentModelDefinition[],
): ModelAccessChannel[] {
  return configurations.map((configuration) => ({
    id: configuration.configurationId,
    code: configuration.configurationId,
    name: configuration.accessChannelName,
    kind: configuration.accessChannelKind,
    source: 'custom',
    baseUrl: configuration.baseUrl,
    description: configuration.description,
    defaultVendorCode: configuration.defaultVendorCode,
    defaultModelId: configuration.modelId,
    isCustom: true,
    apiKeyConfigured: configuration.apiKeyConfigured,
    supportedAgentProviderIds: configuration.supportedProviderIds,
    offerings: configuration.vendorOfferings.map((offering) => ({
      vendorCode: offering.vendorCode,
      vendorName: offering.vendorName,
      models: offering.modelIds.map((modelId) => ({
        model: modelId,
        displayName: modelId === configuration.modelId ? configuration.label : modelId,
        modelOptionId: customOptionId(
          configuration.configurationId,
          offering.vendorCode,
          modelId,
        ),
      })),
    })),
    vendorCount: configuration.vendorOfferings.length,
    modelCount: configuration.vendorOfferings.reduce(
      (count, offering) => count + offering.modelIds.length,
      0,
    ),
  }));
}

function mapDatabaseAccessChannels(
  snapshot: ModelAccessCatalogSnapshot,
  models: readonly AgentModelCatalogOption[],
  localConfigurations: readonly WorkbenchUnifiedCustomAgentModelDefinition[],
): ModelAccessChannel[] {
  const modelOptionIdByIdentity = new Map(models.map((model) => [
    catalogModelIdentity(model.catalogKey, model.vendorCode, model.modelId),
    model.id,
  ]));
  const localConfigurationById = new Map(localConfigurations.map((configuration) => [
    configuration.configurationId.trim().toLowerCase(),
    configuration,
  ]));
  return snapshot.accessChannels.map((channel) => {
    const stableChannelId = channel.code || channel.id;
    const localConfiguration = localConfigurationById.get(
      stableChannelId.trim().toLowerCase(),
    );
    return {
      id: stableChannelId,
      code: channel.code,
      name: channel.name,
      kind: channel.kind,
      source: 'database',
      baseUrl: channel.baseUrl,
      description: channel.description,
      defaultVendorCode: channel.defaultVendorCode,
      defaultModelId: channel.defaultModelId,
      // Public metadata comes from sdkwork-models. A missing local credential
      // is still an actionable configuration state for official channels.
      isCustom: channel.kind !== 'official' || Boolean(localConfiguration),
      apiKeyConfigured: localConfiguration?.apiKeyConfigured ?? false,
      supportedAgentProviderIds: channel.supportedAgentProviderIds,
      offerings: channel.offerings.map((offering) => ({
        vendorCode: offering.vendorCode,
        vendorName: offering.vendorName,
        models: offering.models.map((model) => ({
          catalogKey: model.catalogKey,
          model: model.modelId,
          displayName: model.modelLabel,
          modelOptionId: modelOptionIdByIdentity.get(catalogModelIdentity(
            model.catalogKey,
            offering.vendorCode,
            model.modelId,
          )),
        })),
      })),
      sortOrder: channel.sortOrder,
      vendorCount: channel.vendorCount,
      modelCount: channel.modelCount,
    };
  });
}

export function createWorkbenchAgentModelAccessSelectorCatalog(
  snapshot: ModelAccessCatalogSnapshot,
  customModels: readonly WorkbenchUnifiedCustomAgentModelDefinition[],
  providerIds: readonly string[],
): WorkbenchAgentModelAccessSelectorCatalog {
  const catalogModels = snapshot.models.map(toSelectorModel);
  const databaseChannelIds = new Set(snapshot.accessChannels.flatMap((channel) => [
    channel.id.trim().toLowerCase(),
    channel.code.trim().toLowerCase(),
  ]).filter(Boolean));
  const localOnlyConfigurations = customModels.filter((configuration) => (
    !databaseChannelIds.has(configuration.configurationId.trim().toLowerCase())
  ));
  const customModelOptions = createCustomModels(localOnlyConfigurations);
  // Custom channel models are NOT flattened into the model list: custom
  // channels behave like official/relay channels (channel rows whose models
  // are listed in the right-side detail panel). The options stay available
  // only for selection-identity resolution below.
  const models = catalogModels;
  const accessChannelsById = new Map<string, ModelAccessChannel>();
  for (const channel of createCustomAccessChannels(localOnlyConfigurations)) {
    accessChannelsById.set(channel.id, channel);
  }
  for (const channel of mapDatabaseAccessChannels(snapshot, catalogModels, customModels)) {
    accessChannelsById.set(channel.id, channel);
  }

  const optionIdByProviderModel = new Map<string, string>();
  for (const model of [...catalogModels, ...customModelOptions]) {
    const supportedProviderIds = model.supportedAgentProviderIds?.length
      ? model.supportedAgentProviderIds
      : providerIds;
    for (const providerId of supportedProviderIds) {
      optionIdByProviderModel.set(
        providerModelIdentity(providerId, model.modelId),
        model.id,
      );
    }
  }
  return {
    models,
    accessChannels: [...accessChannelsById.values()],
    optionIdByProviderModel,
  };
}

export function resolveWorkbenchAgentModelOptionId(
  catalog: WorkbenchAgentModelAccessSelectorCatalog,
  providerId: string,
  modelId: string,
): string {
  return catalog.optionIdByProviderModel.get(providerModelIdentity(providerId, modelId)) ?? '';
}

export function resolveWorkbenchModelAccessChannelId(
  catalog: WorkbenchAgentModelAccessSelectorCatalog,
  modelOptionId: string,
  preferredChannelId?: string,
): string | undefined {
  const compatibleChannels = catalog.accessChannels.filter((channel) =>
    channel.offerings.some((offering) =>
      offering.models.some((model) => model.modelOptionId === modelOptionId)));
  return compatibleChannels.find((channel) => channel.id === preferredChannelId)?.id
    ?? compatibleChannels[0]?.id;
}

/**
 * Converts a client-local user model channel (sqlite) into the workbench
 * custom agent model configuration shape.
 *
 * The per-provider bindings are not part of the channel row; they are
 * persisted in the per-engine config rows, so callers pass the resolved
 * provider ids (`user_model_engine_config` rows for the channel) to keep the
 * picker's provider support information accurate.
 */
export function toWorkbenchUnifiedCustomAgentModelDefinition(
  channel: UserModelChannel,
  supportedProviderIds: readonly string[] = [],
): WorkbenchUnifiedCustomAgentModelDefinition {
  const defaultModel = channel.offerings
    .find((offering) => (
      offering.vendorCode.trim().toLowerCase() === channel.defaultVendorCode.trim().toLowerCase()
    ))
    ?.models.find((model) => model.modelId.trim().toLowerCase() === channel.defaultModelId.trim().toLowerCase());
  return {
    configurationId: channel.code,
    modelId: channel.defaultModelId,
    label: defaultModel?.displayName ?? channel.defaultModelId,
    description: channel.description,
    vendorCode: channel.defaultVendorCode,
    baseUrl: channel.baseUrl,
    supportedModelIds: channel.offerings.flatMap((offering) => (
      offering.models.map((model) => model.modelId)
    )),
    supportedProviderIds: [...new Set(supportedProviderIds)],
    supportsMultimodal: defaultModel?.supportsMultimodal ?? false,
    apiKeyConfigured: channel.apiKeyConfigured,
    accessChannelKind: channel.kind,
    accessChannelName: channel.name,
    defaultVendorCode: channel.defaultVendorCode,
    vendorOfferings: channel.offerings.map((offering) => ({
      vendorCode: offering.vendorCode,
      vendorName: offering.vendorName,
      modelIds: offering.models.map((model) => model.modelId),
    })),
  };
}

/**
 * Projects a client-local user model channel into the catalog channel shape
 * so the picker list can show it without a server round-trip.
 *
 * The provider support set is not part of the channel row; pass the resolved
 * engine-config bindings so the merged catalog carries the same provider
 * information the settings panel persisted.
 */
export function toModelAccessCatalogChannel(
  channel: UserModelChannel,
  supportedProviderIds: readonly string[] = [],
): ModelAccessCatalogChannel {
  return {
    id: channel.code,
    code: channel.code,
    name: channel.name,
    kind: channel.kind,
    baseUrl: channel.baseUrl,
    description: channel.description,
    defaultVendorCode: channel.defaultVendorCode,
    defaultModelId: channel.defaultModelId,
    supportedAgentProviderIds: [...new Set(supportedProviderIds)],
    offerings: channel.offerings.map((offering) => ({
      vendorCode: offering.vendorCode,
      vendorName: offering.vendorName,
      models: offering.models.map((model) => ({
        modelId: model.modelId,
        modelLabel: model.displayName,
      })),
    })),
    vendorCount: channel.offerings.length,
    modelCount: channel.offerings.reduce(
      (count, offering) => count + offering.models.length,
      0,
    ),
  };
}

