export type ModelAccessCatalogSource = 'database' | 'fallback';

export type ModelAccessChannelKind = 'official' | 'relay' | 'custom';

/** Capability code of LLM (chat) models in the sdkwork-models catalog. */
export const AGENT_MODEL_LLM_CAPABILITY = 'chat';

/**
 * Default agent-model capability set: LLM (chat) models only. Non-agent
 * catalog rows (embedding, image/video/audio generation, rerank, ...) stay
 * out of every model-selection surface unless a caller widens the filter.
 */
export const DEFAULT_AGENT_MODEL_CAPABILITIES: readonly string[] = [
  AGENT_MODEL_LLM_CAPABILITY,
];

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
  /** Capability codes declared by the authoritative catalog (e.g. chat/embedding). */
  capabilities?: string[];
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

/** Resolved capability/modality projection applied to a catalog load. */
export interface ModelAccessCatalogFilter {
  /**
   * Capability codes the projection is limited to. Empty means no capability
   * constraint; non-empty means the model must declare at least one.
   */
  capabilities?: readonly string[];
  /**
   * Input/output modality codes the projection is limited to. Empty or
   * undefined means no modality constraint.
   */
  modalities?: readonly string[];
}

function normalizeFilterTokens(
  tokens: readonly string[] | undefined,
): string[] | undefined {
  if (tokens === undefined) {
    return undefined;
  }
  return [...new Set(tokens
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean))];
}

/**
 * Resolves the effective catalog filter for a load request.
 *
 * The model-selection surfaces are LLM-first: `capabilities: undefined`
 * applies the default `['chat']` set, an explicit empty array lifts the
 * capability constraint (every catalog model), and an explicit list selects
 * exactly that set. Modality narrowing is opt-in via `modalities`.
 */
export function resolveModelAccessCatalogFilters(
  options: Pick<LoadModelAccessCatalogOptions, 'capabilities' | 'modalities'>,
): ModelAccessCatalogFilter {
  const capabilities = options.capabilities === undefined
    ? DEFAULT_AGENT_MODEL_CAPABILITIES
    : normalizeFilterTokens(options.capabilities) ?? [];
  const modalities = normalizeFilterTokens(options.modalities);
  return {
    capabilities,
    ...(modalities && modalities.length > 0 ? { modalities } : {}),
  };
}

export interface LoadModelAccessCatalogOptions {
  fallbackModels: readonly ModelAccessCatalogModel[];
  query?: string;
  pageSize?: number;
  agentProviderId?: string;
  signal?: AbortSignal;
  /**
   * Capability codes allowed in the catalog projection. Undefined applies
   * the agent-model default (LLM/chat models only); an empty array lifts the
   * capability constraint (all catalog models); an explicit list selects
   * exactly that set.
   */
  capabilities?: readonly string[];
  /**
   * Optional input/output modality narrowing (for example `['image']` for
   * multimodal input). Undefined means no modality constraint.
   */
  modalities?: readonly string[];
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
