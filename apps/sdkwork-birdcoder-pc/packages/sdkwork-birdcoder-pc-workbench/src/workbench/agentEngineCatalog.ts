import { useSyncExternalStore } from 'react';

import {
  listBirdCoderAgentEngineCatalog,
  type BirdCoderAgentEngineAccessModeEntry,
  type BirdCoderAgentEngineCatalogEntry,
  type BirdCoderAgentEngineKind,
} from '@sdkwork/birdcoder-pc-infrastructure/services/agentsCatalogService';

export type WorkbenchAgentEngineId = string;
export type WorkbenchModelVendor = 'openai' | 'anthropic' | 'google' | 'opencode' | 'unknown';
export type ModelVendor = WorkbenchModelVendor;
export type WorkbenchAgentEngineKind = BirdCoderAgentEngineKind;

export interface WorkbenchAgentEngineModelDefinition {
  id: string;
  label: string;
  description: string;
  vendor: WorkbenchModelVendor;
  modelVendor: WorkbenchModelVendor;
  providerId: string;
  bindingId: string;
  defaultForEngine: boolean;
  source: 'agents-catalog' | 'user-local';
}

export interface WorkbenchUnifiedCustomAgentModelDefinition {
  configurationId: string;
  modelId: string;
  label: string;
  description: string;
  vendorCode: string;
  baseUrl: string;
  supportedModelIds: string[];
  supportedProviderIds: string[];
  inputContextTokens?: number;
  outputContextTokens?: number;
  toolCallRounds?: number;
  supportsMultimodal: boolean;
  apiKeyConfigured: boolean;
  accessChannelKind: 'official' | 'relay' | 'custom';
  accessChannelName: string;
  defaultVendorCode: string;
  vendorOfferings: WorkbenchModelAccessVendorOfferingDefinition[];
}

export interface WorkbenchModelAccessVendorOfferingDefinition {
  vendorCode: string;
  vendorName: string;
  modelIds: string[];
}

export interface WorkbenchAgentEngineAccessModeDefinition
  extends BirdCoderAgentEngineAccessModeEntry {
  id: string;
}

export interface WorkbenchAgentEngineDefinition {
  id: WorkbenchAgentEngineId;
  agentId: string;
  bindingId: string;
  label: string;
  aliases: readonly string[];
  defaultModelId: string;
  models: readonly WorkbenchAgentEngineModelDefinition[];
  modelCatalog: readonly WorkbenchAgentEngineModelDefinition[];
  modelIds: readonly string[];
  tier: string;
  engineKind: WorkbenchAgentEngineKind;
  defaultAccessModeId: string;
  accessModes: readonly WorkbenchAgentEngineAccessModeDefinition[];
  available: boolean;
  unavailableReason?: string;
}

export interface WorkbenchAgentEngineSettings {
  defaultModelId: string;
  accessModeId?: string;
  modelAccessChannelId?: string;
}

export type WorkbenchAgentEngineSettingsMap = Partial<
  Record<WorkbenchAgentEngineId, WorkbenchAgentEngineSettings>
>;

export interface WorkbenchAgentEngineSettingsCarrier {
  agentEngineSettings?: unknown;
  unifiedCustomAgentModels?: unknown;
  /** Legacy provider-partitioned preference key, read for migration only. */
  customCodeModels?: unknown;
}

export interface WorkbenchChatSelection {
  agentEngineId: WorkbenchAgentEngineId;
  codeModelId: string;
}

export interface WorkbenchServerEngineSupportState {
  engineId: WorkbenchAgentEngineId;
  label: string;
  supported: boolean;
  serverImplemented: boolean;
  isServerImplemented: boolean;
  status: 'implemented' | 'unsupported';
}

export interface WorkbenchPreferredNewSessionInput extends WorkbenchAgentEngineSettingsCarrier {
  requestedEngineId?: unknown;
  currentSessionEngineId?: unknown;
  currentSessionModelId?: unknown;
  preferredEngineId?: unknown;
  preferredModelId?: unknown;
}

export interface WorkbenchNewSessionSelection {
  engineId: WorkbenchAgentEngineId;
  modelId: string;
  engine: WorkbenchAgentEngineDefinition;
  supported: boolean;
}

export interface WorkbenchNewSessionEngineCatalog {
  availableEngines: readonly WorkbenchAgentEngineDefinition[];
  preferredSelection: WorkbenchNewSessionSelection;
}

export interface WorkbenchAgentEngineCatalogSnapshot {
  engines: readonly WorkbenchAgentEngineDefinition[];
  loaded: boolean;
}

export interface WorkbenchRuntimeBindingIdentity {
  agentId: string;
  engineId: WorkbenchAgentEngineId;
  modelId: string;
  providerBindingId: string;
  providerId: string;
}

export interface WorkbenchRuntimeBindingLookup {
  agentId?: string | null;
  engineId?: string | null;
  modelId?: string | null;
  providerBindingId?: string | null;
  providerId?: string | null;
}

const EMPTY_CATALOG_SNAPSHOT: WorkbenchAgentEngineCatalogSnapshot = {
  engines: [],
  loaded: false,
};

let catalogSnapshot = EMPTY_CATALOG_SNAPSHOT;
let catalogLoad: Promise<readonly WorkbenchAgentEngineDefinition[]> | null = null;
let catalogGeneration = 0;
const catalogListeners = new Set<() => void>();
const MAX_UNIFIED_CUSTOM_AGENT_MODELS = 64;
const MAX_CUSTOM_MODEL_ID_LENGTH = 180;
const MAX_CUSTOM_MODEL_LABEL_LENGTH = 120;
const MAX_CUSTOM_MODEL_DESCRIPTION_LENGTH = 280;
const MAX_CUSTOM_MODEL_CONFIGURATION_ID_LENGTH = 160;
const MAX_CUSTOM_MODEL_VENDOR_LENGTH = 128;
const MAX_CUSTOM_MODEL_BASE_URL_LENGTH = 2048;
const MAX_CUSTOM_MODEL_PROVIDER_IDS = 16;
const MAX_CUSTOM_MODEL_SUPPORTED_IDS = 256;
const MAX_CUSTOM_MODEL_VENDOR_OFFERINGS = 32;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/gu, '-')
    .replace(/\s+/gu, '-');
}

function normalizePositiveInteger(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeStringList(
  value: unknown,
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const values: string[] = [];
  const identities = new Set<string>();
  for (const item of value) {
    const normalized = String(item ?? '').trim().slice(0, maxLength);
    const identity = normalized.toLowerCase();
    if (!normalized || identities.has(identity)) {
      continue;
    }
    identities.add(identity);
    values.push(normalized);
    if (values.length >= maxItems) {
      break;
    }
  }
  return values;
}

function normalizeCustomModelVendorOfferings(
  value: unknown,
  fallback: WorkbenchModelAccessVendorOfferingDefinition,
): WorkbenchModelAccessVendorOfferingDefinition[] {
  const source = Array.isArray(value) ? value : [];
  const offerings: WorkbenchModelAccessVendorOfferingDefinition[] = [];
  const vendorCodes = new Set<string>();
  for (const entry of source) {
    if (!isRecord(entry)) {
      continue;
    }
    const vendorCode = String(entry.vendorCode ?? '')
      .trim()
      .slice(0, MAX_CUSTOM_MODEL_VENDOR_LENGTH);
    const identity = vendorCode.toLowerCase();
    const modelIds = normalizeStringList(
      entry.modelIds,
      MAX_CUSTOM_MODEL_SUPPORTED_IDS,
      MAX_CUSTOM_MODEL_ID_LENGTH,
    );
    if (!vendorCode || modelIds.length === 0 || vendorCodes.has(identity)) {
      continue;
    }
    vendorCodes.add(identity);
    offerings.push({
      vendorCode,
      vendorName: String(entry.vendorName ?? vendorCode)
        .trim()
        .slice(0, MAX_CUSTOM_MODEL_LABEL_LENGTH) || vendorCode,
      modelIds,
    });
    if (offerings.length >= MAX_CUSTOM_MODEL_VENDOR_OFFERINGS) {
      break;
    }
  }
  return offerings.length > 0 ? offerings : [fallback];
}

export function normalizeWorkbenchUnifiedCustomAgentModels(
  value: unknown,
): WorkbenchUnifiedCustomAgentModelDefinition[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const models: WorkbenchUnifiedCustomAgentModelDefinition[] = [];
  const identities = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }
    const modelId = String(entry.modelId ?? entry.id ?? '')
      .trim()
      .slice(0, MAX_CUSTOM_MODEL_ID_LENGTH);
    const legacyEngineId = normalizeKey(entry.engineId);
    const supportedProviderIds = normalizeStringList(
      entry.supportedProviderIds ?? (legacyEngineId ? [legacyEngineId] : []),
      MAX_CUSTOM_MODEL_PROVIDER_IDS,
      64,
    ).map(normalizeKey).filter(Boolean);
    const vendorCode = String(entry.vendorCode ?? entry.vendor ?? '')
      .trim()
      .slice(0, MAX_CUSTOM_MODEL_VENDOR_LENGTH);
    const baseUrl = String(entry.baseUrl ?? '')
      .trim()
      .replace(/\/+$/u, '')
      .slice(0, MAX_CUSTOM_MODEL_BASE_URL_LENGTH);
    if (!modelId || !vendorCode || !baseUrl || supportedProviderIds.length === 0) {
      continue;
    }
    const configurationId = String(
      entry.configurationId ?? `model.custom.${normalizeKey(vendorCode)}.${normalizeKey(modelId)}`,
    ).trim().slice(0, MAX_CUSTOM_MODEL_CONFIGURATION_ID_LENGTH);
    if (!configurationId) {
      continue;
    }
    const identity = configurationId.toLowerCase();
    if (identities.has(identity)) {
      continue;
    }
    identities.add(identity);
    const label = String(entry.label ?? entry.displayName ?? modelId)
      .trim()
      .slice(0, MAX_CUSTOM_MODEL_LABEL_LENGTH) || modelId;
    const supportedModelIds = normalizeStringList(
      [modelId, ...normalizeStringList(
        entry.supportedModelIds,
        MAX_CUSTOM_MODEL_SUPPORTED_IDS,
        MAX_CUSTOM_MODEL_ID_LENGTH,
      )],
      MAX_CUSTOM_MODEL_SUPPORTED_IDS,
      MAX_CUSTOM_MODEL_ID_LENGTH,
    );
    const vendorOfferings = normalizeCustomModelVendorOfferings(
      entry.vendorOfferings,
      { vendorCode, vendorName: vendorCode, modelIds: supportedModelIds },
    );
    const requestedDefaultVendorCode = String(entry.defaultVendorCode ?? vendorCode).trim();
    const defaultVendor = vendorOfferings.find(
      (offering) => offering.vendorCode.toLowerCase() === requestedDefaultVendorCode.toLowerCase(),
    ) ?? vendorOfferings[0];
    models.push({
      configurationId,
      modelId,
      label,
      description: String(entry.description ?? '')
        .trim()
        .slice(0, MAX_CUSTOM_MODEL_DESCRIPTION_LENGTH),
      vendorCode,
      baseUrl,
      supportedModelIds,
      supportedProviderIds,
      inputContextTokens: normalizePositiveInteger(entry.inputContextTokens),
      outputContextTokens: normalizePositiveInteger(entry.outputContextTokens),
      toolCallRounds: normalizePositiveInteger(entry.toolCallRounds),
      supportsMultimodal: entry.supportsMultimodal === true,
      apiKeyConfigured: entry.apiKeyConfigured === true,
      accessChannelKind: entry.accessChannelKind === 'official' ? 'official' : 'relay',
      accessChannelName: String(entry.accessChannelName ?? label)
        .trim()
        .slice(0, MAX_CUSTOM_MODEL_LABEL_LENGTH) || label,
      defaultVendorCode: defaultVendor.vendorCode,
      vendorOfferings,
    });
    if (models.length >= MAX_UNIFIED_CUSTOM_AGENT_MODELS) {
      break;
    }
  }
  return models;
}

function includeUnifiedCustomAgentModels(
  engine: WorkbenchAgentEngineDefinition,
  carrier?: WorkbenchAgentEngineSettingsCarrier | null,
): WorkbenchAgentEngineDefinition {
  const customModels = normalizeWorkbenchUnifiedCustomAgentModels(
    carrier?.unifiedCustomAgentModels ?? carrier?.customCodeModels,
  ).filter((model) => model.supportedProviderIds.includes(engine.id));
  if (customModels.length === 0) {
    return engine;
  }

  const bindingModel = engine.models.find((model) => model.defaultForEngine) ?? engine.models[0];
  if (!bindingModel) {
    return engine;
  }
  const knownModelIds = new Set(engine.models.map((model) => model.id));
  const localModels: WorkbenchAgentEngineModelDefinition[] = [];
  for (const configuration of customModels) {
    for (const modelId of configuration.supportedModelIds) {
      if (knownModelIds.has(modelId)) {
        continue;
      }
      knownModelIds.add(modelId);
      localModels.push({
        id: modelId,
        label: modelId === configuration.modelId ? configuration.label : modelId,
        description: configuration.description,
        vendor: vendorFromProvider(configuration.vendorCode),
        modelVendor: vendorFromProvider(configuration.vendorCode),
        providerId: bindingModel.providerId,
        bindingId: bindingModel.bindingId || engine.bindingId,
        defaultForEngine: false,
        source: 'user-local',
      });
    }
  }
  if (localModels.length === 0) {
    return engine;
  }
  const models = [...engine.models, ...localModels];
  return {
    ...engine,
    models,
    modelCatalog: models,
    modelIds: models.map((model) => model.id),
  };
}

function titleCaseEngineId(engineId: string): string {
  return engineId
    .split(/[-_.\s]+/gu)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function vendorFromProvider(providerId: string): WorkbenchModelVendor {
  const normalized = providerId
    .trim()
    .toLowerCase()
    .replace(/^provider[.:/-]/u, '');
  if (normalized === 'openai') return 'openai';
  if (normalized === 'anthropic') return 'anthropic';
  if (normalized === 'google') return 'google';
  if (normalized === 'opencode') return 'opencode';
  return 'unknown';
}

function toWorkbenchDefinition(
  entry: BirdCoderAgentEngineCatalogEntry,
): WorkbenchAgentEngineDefinition | null {
  const id = normalizeKey(entry.engineId);
  if (!id) {
    return null;
  }
  const models = entry.models
    .filter((model) => model.modelId.trim().length > 0)
    .map((model): WorkbenchAgentEngineModelDefinition => {
      const vendor = vendorFromProvider(model.providerId);
      return {
        id: model.modelId,
        label: model.label || model.modelId,
        description: model.description,
        vendor,
        modelVendor: vendor,
        providerId: model.providerId,
        bindingId: model.bindingId,
        defaultForEngine: model.defaultForEngine,
        source: 'agents-catalog',
      };
    });
  const defaultModelId =
    models.find((model) => model.defaultForEngine)?.id ??
    models.find((model) => model.id === entry.defaultModelId)?.id ??
    models[0]?.id ??
    '';
  const accessModes = entry.accessModes
    .filter((mode) => mode.modeId.trim().length > 0)
    .map((mode): WorkbenchAgentEngineAccessModeDefinition => ({
      ...mode,
      id: mode.modeId,
    }));
  const defaultAccessModeId =
    accessModes.find((mode) => mode.enabled && mode.id === entry.defaultAccessModeId)?.id ??
    accessModes.find((mode) => mode.enabled)?.id ??
    '';

  return {
    id,
    agentId: entry.agentId,
    bindingId: entry.bindingId,
    label: titleCaseEngineId(id) || id,
    aliases: [id],
    defaultModelId,
    models,
    modelCatalog: models,
    modelIds: models.map((model) => model.id),
    tier: entry.tier,
    engineKind: entry.engineKind ?? 'unknown',
    defaultAccessModeId,
    accessModes,
    available: entry.available !== false,
    ...(entry.unavailableReason ? { unavailableReason: entry.unavailableReason } : {}),
  };
}

function publishCatalog(engines: readonly WorkbenchAgentEngineDefinition[]): void {
  catalogSnapshot = { engines, loaded: true };
  for (const listener of catalogListeners) {
    listener();
  }
}

export async function loadWorkbenchAgentEngineCatalog(): Promise<
  readonly WorkbenchAgentEngineDefinition[]
> {
  if (catalogLoad) {
    return catalogLoad;
  }
  const requestGeneration = catalogGeneration;
  const loadPromise = listBirdCoderAgentEngineCatalog()
    .then((entries) => {
      const engines = entries
        .map(toWorkbenchDefinition)
        .filter((entry): entry is WorkbenchAgentEngineDefinition => entry !== null);
      if (requestGeneration === catalogGeneration) {
        publishCatalog(engines);
      }
      return engines;
    })
    .finally(() => {
      if (catalogLoad === loadPromise) {
        catalogLoad = null;
      }
    });
  catalogLoad = loadPromise;
  return loadPromise;
}

export function resetWorkbenchAgentEngineCatalog(): void {
  catalogGeneration += 1;
  catalogLoad = null;
  catalogSnapshot = EMPTY_CATALOG_SNAPSHOT;
  for (const listener of catalogListeners) {
    listener();
  }
}

export function replaceWorkbenchAgentEngineCatalogForTesting(
  entries: readonly BirdCoderAgentEngineCatalogEntry[],
): void {
  publishCatalog(
    entries
      .map(toWorkbenchDefinition)
      .filter((entry): entry is WorkbenchAgentEngineDefinition => entry !== null),
  );
}

export function subscribeWorkbenchAgentEngineCatalog(listener: () => void): () => void {
  catalogListeners.add(listener);
  return () => catalogListeners.delete(listener);
}

export function getWorkbenchAgentEngineCatalogSnapshot(): WorkbenchAgentEngineCatalogSnapshot {
  return catalogSnapshot;
}

export function useWorkbenchAgentEngineCatalog(): WorkbenchAgentEngineCatalogSnapshot {
  return useSyncExternalStore(
    subscribeWorkbenchAgentEngineCatalog,
    getWorkbenchAgentEngineCatalogSnapshot,
    getWorkbenchAgentEngineCatalogSnapshot,
  );
}

export function useModelCatalogLoaded(): boolean {
  return useWorkbenchAgentEngineCatalog().loaded;
}

export function listWorkbenchAgentEngines(
  carrier?: WorkbenchAgentEngineSettingsCarrier | null,
): readonly WorkbenchAgentEngineDefinition[] {
  return catalogSnapshot.engines.map((engine) => includeUnifiedCustomAgentModels(engine, carrier));
}

export function normalizeWorkbenchAgentEngineId(value: unknown): WorkbenchAgentEngineId | null {
  const key = normalizeKey(value);
  if (!key) {
    return null;
  }
  const matched = catalogSnapshot.engines.find(
    (engine) => engine.id === key || engine.aliases.some((alias) => normalizeKey(alias) === key),
  );
  if (matched) {
    return matched.id;
  }
  return catalogSnapshot.loaded ? null : key;
}

export function findWorkbenchAgentEngineDefinition(
  value: unknown,
  carrier?: WorkbenchAgentEngineSettingsCarrier | null,
): WorkbenchAgentEngineDefinition | null {
  const key = normalizeKey(value);
  if (!key) {
    return null;
  }
  const engine = catalogSnapshot.engines.find(
    (engine) => engine.id === key || engine.aliases.some((alias) => normalizeKey(alias) === key),
  );
  return engine ? includeUnifiedCustomAgentModels(engine, carrier) : null;
}

export function findWorkbenchAgentEngineDefinitionForAgentId(
  value: unknown,
): WorkbenchAgentEngineDefinition | null {
  const agentId = String(value ?? '').trim();
  if (!agentId) {
    return null;
  }
  return catalogSnapshot.engines.find((engine) => engine.agentId === agentId) ?? null;
}

export function resolveWorkbenchRuntimeBindingIdentity(
  engineId: unknown,
  modelId: unknown,
  carrier?: WorkbenchAgentEngineSettingsCarrier | null,
): WorkbenchRuntimeBindingIdentity {
  const engine = findWorkbenchAgentEngineDefinition(engineId, carrier);
  if (!engine) {
    throw new Error(`Agents did not publish agent engine "${String(engineId)}".`);
  }
  const normalizedModelId = String(modelId ?? '').trim() || engine.defaultModelId;
  const model = engine.models.find((candidate) => candidate.id === normalizedModelId);
  if (!model) {
    throw new Error(
      `Agents did not publish model "${normalizedModelId}" for agent engine "${engine.id}".`,
    );
  }
  const providerBindingId = model.bindingId.trim() || engine.bindingId.trim();
  const providerId = model.providerId.trim();
  const agentId = engine.agentId.trim();
  if (!agentId || !providerBindingId || !providerId) {
    throw new Error(`Agents published incomplete runtime identity for agent engine "${engine.id}".`);
  }
  return {
    agentId,
    engineId: engine.id,
    modelId: model.id,
    providerBindingId,
    providerId,
  };
}

export function resolveWorkbenchAgentEngineForRuntimeBinding(
  binding: WorkbenchRuntimeBindingLookup,
): WorkbenchAgentEngineDefinition | null {
  const agentId = String(binding.agentId ?? '').trim();
  const engineId = normalizeKey(binding.engineId);
  const providerBindingId = String(binding.providerBindingId ?? '').trim();
  const providerId = String(binding.providerId ?? '').trim();
  const modelId = String(binding.modelId ?? '').trim();
  const candidates = catalogSnapshot.engines.filter((engine) => {
    if (agentId && engine.agentId !== agentId) {
      return false;
    }
    if (engineId && engine.id !== engineId) {
      return false;
    }
    if (!providerBindingId && !providerId && !modelId) {
      return Boolean(agentId || engineId);
    }
    return engine.models.some((model) => {
      const bindingMatches = !providerBindingId
        || model.bindingId === providerBindingId
        || engine.bindingId === providerBindingId;
      const modelMatches = !modelId || model.id === modelId;
      const providerMatches = !providerId || model.providerId === providerId;
      return bindingMatches && modelMatches && providerMatches;
    });
  });
  return candidates.length === 1 ? candidates[0] ?? null : null;
}

function createUnknownEngineDefinition(value: unknown): WorkbenchAgentEngineDefinition {
  const id = normalizeKey(value);
  return {
    id,
    agentId: '',
    bindingId: '',
    label: titleCaseEngineId(id) || id,
    aliases: id ? [id] : [],
    defaultModelId: '',
    models: [],
    modelCatalog: [],
    modelIds: [],
    tier: '',
    engineKind: 'unknown',
    defaultAccessModeId: '',
    accessModes: [],
    available: false,
    unavailableReason: id ? `${id} is not bootstrapped in this runtime profile` : undefined,
  };
}

export function getWorkbenchAgentEngineDefinition(
  value: unknown,
  carrier?: WorkbenchAgentEngineSettingsCarrier | null,
): WorkbenchAgentEngineDefinition {
  return findWorkbenchAgentEngineDefinition(value, carrier) ?? createUnknownEngineDefinition(value);
}

export function hasWorkbenchCodeModel(
  engineId: unknown,
  modelId: unknown,
  carrier?: WorkbenchAgentEngineSettingsCarrier | null,
): boolean {
  const definition = findWorkbenchAgentEngineDefinition(engineId, carrier);
  const id = String(modelId ?? '').trim();
  return Boolean(definition && id && definition.models.some((model) => model.id === id));
}

export function normalizeWorkbenchCodeModelId(
  engineId: unknown,
  modelId: unknown,
  carrier?: WorkbenchAgentEngineSettingsCarrier | null,
  options: { allowUnknown?: boolean } = {},
): string {
  const candidate = String(modelId ?? '').trim();
  const definition = findWorkbenchAgentEngineDefinition(engineId, carrier);
  if (!definition) {
    return candidate;
  }
  if (candidate && (options.allowUnknown || definition.models.some((model) => model.id === candidate))) {
    return candidate;
  }
  return definition.defaultModelId;
}

export function findWorkbenchAgentEngineAccessMode(
  engineId: unknown,
  accessModeId: unknown,
  carrier?: WorkbenchAgentEngineSettingsCarrier | null,
): WorkbenchAgentEngineAccessModeDefinition | null {
  const id = String(accessModeId ?? '').trim();
  if (!id) {
    return null;
  }
  return findWorkbenchAgentEngineDefinition(engineId, carrier)?.accessModes.find(
    (mode) => mode.id === id,
  ) ?? null;
}

export function normalizeWorkbenchAgentEngineAccessModeId(
  engineId: unknown,
  accessModeId: unknown,
  carrier?: WorkbenchAgentEngineSettingsCarrier | null,
): string {
  const candidate = String(accessModeId ?? '').trim();
  const definition = findWorkbenchAgentEngineDefinition(engineId, carrier);
  if (!definition) {
    return candidate;
  }
  const requestedMode = definition.accessModes.find(
    (mode) => mode.id === candidate && mode.enabled,
  );
  return requestedMode?.id ?? definition.defaultAccessModeId;
}

export function normalizeWorkbenchAgentEngineSettingsMap(
  value: unknown,
  options: {
    unifiedCustomAgentModels?: readonly WorkbenchUnifiedCustomAgentModelDefinition[];
    includeDefaults?: boolean;
  } = {},
): WorkbenchAgentEngineSettingsMap {
  const source = isRecord(value) ? value : {};
  const settings: WorkbenchAgentEngineSettingsMap = {};
  const engineIds = new Set([
    ...Object.keys(source),
    ...(options.includeDefaults ? catalogSnapshot.engines.map((engine) => engine.id) : []),
  ]);
  for (const engineId of engineIds) {
    const entry = isRecord(source[engineId]) ? source[engineId] as Record<string, unknown> : {};
    const carrier = { unifiedCustomAgentModels: options.unifiedCustomAgentModels };
    const definition = findWorkbenchAgentEngineDefinition(engineId, carrier);
    const candidate = String(
      entry.defaultModelId ?? entry.selectedModelId ?? entry.modelId ?? definition?.defaultModelId ?? '',
    ).trim();
    const defaultModelId = normalizeWorkbenchCodeModelId(engineId, candidate, carrier);
    const accessModeId = normalizeWorkbenchAgentEngineAccessModeId(
      engineId,
      entry.accessModeId ?? definition?.defaultAccessModeId,
    );
    const modelAccessChannelId = String(
      entry.modelAccessChannelId ?? entry.selectedModelAccessChannelId ?? '',
    ).trim().slice(0, 160);
    if (defaultModelId) {
      settings[engineId] = {
        defaultModelId,
        ...(accessModeId ? { accessModeId } : {}),
        ...(modelAccessChannelId ? { modelAccessChannelId } : {}),
      };
    }
  }
  return settings;
}

export function resolveWorkbenchAgentEngineSelectedModelId(
  engineId: unknown,
  carrier?: WorkbenchAgentEngineSettingsCarrier | null,
  explicitModelId?: string | null,
): string {
  const normalizedEngineId = normalizeWorkbenchAgentEngineId(engineId) ?? normalizeKey(engineId);
  const rawSettings = isRecord(carrier?.agentEngineSettings)
    ? carrier.agentEngineSettings[normalizedEngineId]
    : undefined;
  const configuredModelId = isRecord(rawSettings)
    ? String(rawSettings.defaultModelId ?? rawSettings.selectedModelId ?? '').trim()
    : '';
  return normalizeWorkbenchCodeModelId(
    normalizedEngineId,
    explicitModelId?.trim() || configuredModelId,
    carrier,
  );
}

export function resolveWorkbenchAgentEngineSelectedAccessModeId(
  engineId: unknown,
  carrier?: WorkbenchAgentEngineSettingsCarrier | null,
  explicitAccessModeId?: string | null,
): string {
  const normalizedEngineId = normalizeWorkbenchAgentEngineId(engineId) ?? normalizeKey(engineId);
  const rawSettings = isRecord(carrier?.agentEngineSettings)
    ? carrier.agentEngineSettings[normalizedEngineId]
    : undefined;
  const configuredAccessModeId = isRecord(rawSettings)
    ? String(rawSettings.accessModeId ?? '').trim()
    : '';
  return normalizeWorkbenchAgentEngineAccessModeId(
    normalizedEngineId,
    explicitAccessModeId?.trim() || configuredAccessModeId,
    carrier,
  );
}

export function resolveWorkbenchAgentEngineSelectedModelAccessChannelId(
  engineId: unknown,
  carrier?: WorkbenchAgentEngineSettingsCarrier | null,
): string {
  const normalizedEngineId = normalizeWorkbenchAgentEngineId(engineId) ?? normalizeKey(engineId);
  const rawSettings = isRecord(carrier?.agentEngineSettings)
    ? carrier.agentEngineSettings[normalizedEngineId]
    : undefined;
  return isRecord(rawSettings)
    ? String(rawSettings.modelAccessChannelId ?? '').trim().slice(0, 160)
    : '';
}

export function resolveWorkbenchChatSelection(
  input: { agentEngineId?: string | null; codeModelId?: string | null } | null | undefined,
  carrier?: WorkbenchAgentEngineSettingsCarrier | null,
): WorkbenchChatSelection {
  const requestedEngineId = normalizeWorkbenchAgentEngineId(input?.agentEngineId);
  const agentEngineId = requestedEngineId ?? catalogSnapshot.engines[0]?.id ?? normalizeKey(input?.agentEngineId);
  return {
    agentEngineId,
    codeModelId: resolveWorkbenchAgentEngineSelectedModelId(
      agentEngineId,
      carrier,
      input?.codeModelId,
    ),
  };
}

export const DEFAULT_WORKBENCH_CHAT_SELECTION: WorkbenchChatSelection = {
  agentEngineId: '',
  codeModelId: '',
};

export function getWorkbenchAgentEngineLabel(
  engineId: unknown,
  carrier?: WorkbenchAgentEngineSettingsCarrier | null,
): string {
  return getWorkbenchAgentEngineDefinition(engineId, carrier).label;
}

export function getWorkbenchCodeModelLabel(
  engineId: unknown,
  modelId: unknown,
  carrier?: WorkbenchAgentEngineSettingsCarrier | null,
): string {
  const id = String(modelId ?? '').trim();
  return findWorkbenchAgentEngineDefinition(engineId, carrier)?.models.find(
    (model) => model.id === id,
  )?.label ?? id;
}

export function getWorkbenchAgentEngineSummary(engineId: unknown, modelId: unknown): string {
  const engineLabel = getWorkbenchAgentEngineLabel(engineId);
  const modelLabel = getWorkbenchCodeModelLabel(engineId, modelId);
  return modelLabel ? `${engineLabel} / ${modelLabel}` : engineLabel;
}

export function getWorkbenchAgentEngineSessionSummary(engineId: unknown, modelId: unknown): string {
  return getWorkbenchAgentEngineSummary(engineId, modelId);
}

export function getWorkbenchModelVendorLabel(value: unknown): string {
  const vendor = String(value ?? '').trim().toLowerCase();
  if (vendor === 'openai') return 'OpenAI';
  if (vendor === 'anthropic') return 'Anthropic';
  if (vendor === 'google') return 'Google';
  if (vendor === 'opencode') return 'OpenCode';
  return vendor || 'Unknown';
}

export function listWorkbenchServerImplementedAgentEngines(
  carrier?: WorkbenchAgentEngineSettingsCarrier | null,
): readonly WorkbenchAgentEngineDefinition[] {
  return listWorkbenchAgentEngines(carrier);
}

export function isWorkbenchServerImplementedEngineId(
  value: unknown,
): value is WorkbenchAgentEngineId {
  return findWorkbenchAgentEngineDefinition(value) !== null;
}

export function normalizeWorkbenchServerImplementedAgentEngineId(
  value: unknown,
  _carrier?: WorkbenchAgentEngineSettingsCarrier | null,
): WorkbenchAgentEngineId {
  return findWorkbenchAgentEngineDefinition(value)?.id ?? catalogSnapshot.engines[0]?.id ?? '';
}

export function assertWorkbenchServerImplementedEngineId(
  value: unknown,
): asserts value is WorkbenchAgentEngineId {
  if (!isWorkbenchServerImplementedEngineId(value)) {
    throw new Error(`Agents did not publish agent engine "${String(value)}".`);
  }
}

export function getDefaultWorkbenchServerImplementedAgentEngineId(): WorkbenchAgentEngineId {
  return catalogSnapshot.engines[0]?.id ?? '';
}

export function resolveWorkbenchServerEngineSupportState(
  value: unknown,
): WorkbenchServerEngineSupportState {
  const definition = findWorkbenchAgentEngineDefinition(value);
  const engineId = definition?.id ?? normalizeKey(value);
  const supported = definition !== null;
  return {
    engineId,
    label: definition?.label ?? titleCaseEngineId(engineId),
    supported,
    serverImplemented: supported,
    isServerImplemented: supported,
    status: supported ? 'implemented' : 'unsupported',
  };
}

export function resolveWorkbenchPreferredNewSessionSelection(
  input: WorkbenchPreferredNewSessionInput = {},
  carrier?: WorkbenchAgentEngineSettingsCarrier | null,
): WorkbenchNewSessionSelection {
  const resolvedCarrier = carrier ?? input;
  const engineId =
    normalizeWorkbenchAgentEngineId(input.requestedEngineId) ??
    normalizeWorkbenchAgentEngineId(input.currentSessionEngineId) ??
    normalizeWorkbenchAgentEngineId(input.preferredEngineId) ??
    catalogSnapshot.engines[0]?.id ??
    '';
  const engine = getWorkbenchAgentEngineDefinition(engineId, resolvedCarrier);
  const requestedModelId = String(input.preferredModelId ?? '').trim();
  const currentModelId = String(input.currentSessionModelId ?? '').trim();
  const modelId = normalizeWorkbenchCodeModelId(
    engineId,
    requestedModelId || currentModelId || resolveWorkbenchAgentEngineSelectedModelId(engineId, resolvedCarrier),
    resolvedCarrier,
  );
  return {
    engineId,
    modelId,
    engine,
    supported: isWorkbenchServerImplementedEngineId(engineId),
  };
}

export function resolveWorkbenchNewSessionEngineCatalog(
  input: WorkbenchPreferredNewSessionInput | null = {},
  carrier?: WorkbenchAgentEngineSettingsCarrier | null,
): WorkbenchNewSessionEngineCatalog {
  const resolvedInput = input ?? {};
  const resolvedCarrier = carrier ?? resolvedInput;
  return {
    availableEngines: listWorkbenchAgentEngines(resolvedCarrier),
    preferredSelection: resolveWorkbenchPreferredNewSessionSelection(
      resolvedInput,
      resolvedCarrier,
    ),
  };
}
