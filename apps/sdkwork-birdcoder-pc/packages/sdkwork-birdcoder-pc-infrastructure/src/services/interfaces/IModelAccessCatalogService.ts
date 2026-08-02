export type ModelAccessCatalogSource = 'database' | 'fallback';

export type ModelAccessChannelKind = 'official' | 'relay' | 'custom';

export interface ModelAccessCatalogModel {
  id: string;
  catalogKey?: string;
  catalogVersion?: string;
  modelId: string;
  label: string;
  description?: string;
  vendorCode: string;
  vendorName: string;
  releaseStage?: string;
  source: ModelAccessCatalogSource;
  sourceObservedAt?: string;
  searchTerms?: string[];
  sortOrder?: number;
  rankScore?: number;
  contextTokens?: number;
  maxOutputTokens?: number;
  toolCallRounds?: number;
  supportsTools?: boolean;
  inputModalities?: string[];
  modalities?: string[];
  outputModalities?: string[];
  supportedAgentProviderIds: string[];
}

export interface ModelAccessCatalogOfferingModel {
  catalogKey?: string;
  modelId: string;
  modelLabel: string;
}

export interface ModelAccessCatalogOffering {
  vendorCode: string;
  vendorName: string;
  models: ModelAccessCatalogOfferingModel[];
}

export interface ModelAccessCatalogChannel {
  id: string;
  code: string;
  name: string;
  kind: ModelAccessChannelKind;
  baseUrl?: string;
  description?: string;
  defaultVendorCode?: string;
  defaultModelId?: string;
  offerings: ModelAccessCatalogOffering[];
  sortOrder?: number;
  supportedAgentProviderIds: string[];
  vendorCount: number;
  modelCount: number;
}

export interface ModelAccessCatalogSnapshot {
  models: ModelAccessCatalogModel[];
  accessChannels: ModelAccessCatalogChannel[];
  source: ModelAccessCatalogSource;
}

export interface LoadModelAccessCatalogOptions {
  fallbackModels: readonly ModelAccessCatalogModel[];
  query?: string;
  pageSize?: number;
  agentProviderId?: string;
  signal?: AbortSignal;
}

export interface UpsertModelAccessCatalogChannelInput {
  channelCode: string;
  name: string;
  kind: ModelAccessChannelKind;
  baseUrl: string;
  description?: string;
  offerings: Array<{
    vendorCode: string;
    vendorName: string;
    /** Ordered model rows; display names are persisted with the public catalog metadata. */
    models: Array<{
      modelId: string;
      displayName: string;
    }>;
  }>;
  defaultVendorCode: string;
  defaultModelId: string;
  supportedAgentProviderIds: string[];
}

export interface UpsertModelAccessCatalogChannelOptions {
  signal?: AbortSignal;
}

export interface IModelAccessCatalogService {
  loadCatalog(
    options: LoadModelAccessCatalogOptions,
  ): Promise<ModelAccessCatalogSnapshot>;
  upsertAccessChannel(
    input: UpsertModelAccessCatalogChannelInput,
    options?: UpsertModelAccessCatalogChannelOptions,
  ): Promise<ModelAccessCatalogChannel>;
}
