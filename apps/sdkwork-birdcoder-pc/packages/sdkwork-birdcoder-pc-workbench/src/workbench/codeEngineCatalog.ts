import { useSyncExternalStore } from 'react';

import {
  listBirdCoderCodeEngineCatalog,
  type BirdCoderCodeEngineCatalogEntry,
} from '@sdkwork/birdcoder-pc-infrastructure/services/agentsCatalogService';

export type WorkbenchCodeEngineId = string;
export type WorkbenchCodeEngineThemeId = 'amber' | 'blue' | 'emerald' | 'violet';
export type WorkbenchModelVendor = 'openai' | 'anthropic' | 'google' | 'opencode' | 'unknown';
export type ModelVendor = WorkbenchModelVendor;

export interface WorkbenchCodeEngineModelDefinition {
  id: string;
  label: string;
  description: string;
  vendor: WorkbenchModelVendor;
  modelVendor: WorkbenchModelVendor;
  providerId: string;
  bindingId: string;
  defaultForEngine: boolean;
  source: 'agents-catalog';
}

export interface WorkbenchCodeEngineDefinition {
  id: WorkbenchCodeEngineId;
  agentId: string;
  bindingId: string;
  label: string;
  aliases: readonly string[];
  defaultModelId: string;
  monogram: string;
  models: readonly WorkbenchCodeEngineModelDefinition[];
  modelCatalog: readonly WorkbenchCodeEngineModelDefinition[];
  modelIds: readonly string[];
  theme: WorkbenchCodeEngineThemeId;
}

export interface WorkbenchCodeEngineSettings {
  defaultModelId: string;
}

export type WorkbenchCodeEngineSettingsMap = Partial<
  Record<WorkbenchCodeEngineId, WorkbenchCodeEngineSettings>
>;

export interface WorkbenchCodeEngineSettingsCarrier {
  codeEngineSettings?: unknown;
}

export interface WorkbenchChatSelection {
  codeEngineId: WorkbenchCodeEngineId;
  codeModelId: string;
}

export interface WorkbenchServerEngineSupportState {
  engineId: WorkbenchCodeEngineId;
  label: string;
  supported: boolean;
  serverImplemented: boolean;
  isServerImplemented: boolean;
  status: 'implemented' | 'unsupported';
}

export interface WorkbenchPreferredNewSessionInput extends WorkbenchCodeEngineSettingsCarrier {
  requestedEngineId?: unknown;
  currentSessionEngineId?: unknown;
  currentSessionModelId?: unknown;
  preferredEngineId?: unknown;
  preferredModelId?: unknown;
}

export interface WorkbenchNewSessionSelection {
  engineId: WorkbenchCodeEngineId;
  modelId: string;
  engine: WorkbenchCodeEngineDefinition;
  supported: boolean;
}

export interface WorkbenchNewSessionEngineCatalog {
  availableEngines: readonly WorkbenchCodeEngineDefinition[];
  preferredSelection: WorkbenchNewSessionSelection;
}

export interface WorkbenchCodeEngineCatalogSnapshot {
  engines: readonly WorkbenchCodeEngineDefinition[];
  loaded: boolean;
}

const EMPTY_CATALOG_SNAPSHOT: WorkbenchCodeEngineCatalogSnapshot = {
  engines: [],
  loaded: false,
};

let catalogSnapshot = EMPTY_CATALOG_SNAPSHOT;
let catalogLoad: Promise<readonly WorkbenchCodeEngineDefinition[]> | null = null;
const catalogListeners = new Set<() => void>();

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

function buildMonogram(engineId: string): string {
  const segments = engineId.split(/[^a-z0-9]+/giu).filter(Boolean);
  if (segments.length > 1) {
    return segments.slice(0, 2).map((segment) => segment[0]).join('').toUpperCase();
  }
  return engineId.replace(/[^a-z0-9]/giu, '').slice(0, 2).toUpperCase() || 'AI';
}

function resolveTheme(engineId: string): WorkbenchCodeEngineThemeId {
  const themes: readonly WorkbenchCodeEngineThemeId[] = ['blue', 'amber', 'emerald', 'violet'];
  let hash = 0;
  for (const character of engineId) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  }
  return themes[hash % themes.length] ?? 'blue';
}

function titleCaseEngineId(engineId: string): string {
  return engineId
    .split(/[-_.\s]+/gu)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function vendorFromProvider(providerId: string): WorkbenchModelVendor {
  const normalized = providerId.trim().toLowerCase();
  if (normalized === 'openai') return 'openai';
  if (normalized === 'anthropic') return 'anthropic';
  if (normalized === 'google') return 'google';
  if (normalized === 'opencode') return 'opencode';
  return 'unknown';
}

function toWorkbenchDefinition(
  entry: BirdCoderCodeEngineCatalogEntry,
): WorkbenchCodeEngineDefinition | null {
  const id = normalizeKey(entry.engineId);
  if (!id) {
    return null;
  }
  const models = entry.models
    .filter((model) => model.modelId.trim().length > 0)
    .map((model): WorkbenchCodeEngineModelDefinition => {
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

  return {
    id,
    agentId: entry.agentId,
    bindingId: entry.bindingId,
    label: titleCaseEngineId(id) || id,
    aliases: [id],
    defaultModelId,
    monogram: buildMonogram(id),
    models,
    modelCatalog: models,
    modelIds: models.map((model) => model.id),
    theme: resolveTheme(id),
  };
}

function publishCatalog(engines: readonly WorkbenchCodeEngineDefinition[]): void {
  catalogSnapshot = { engines, loaded: true };
  for (const listener of catalogListeners) {
    listener();
  }
}

export async function loadWorkbenchCodeEngineCatalog(): Promise<
  readonly WorkbenchCodeEngineDefinition[]
> {
  if (catalogLoad) {
    return catalogLoad;
  }
  catalogLoad = listBirdCoderCodeEngineCatalog()
    .then((entries) => {
      const engines = entries
        .map(toWorkbenchDefinition)
        .filter((entry): entry is WorkbenchCodeEngineDefinition => entry !== null);
      publishCatalog(engines);
      return engines;
    })
    .finally(() => {
      catalogLoad = null;
    });
  return catalogLoad;
}

export function replaceWorkbenchCodeEngineCatalogForTesting(
  entries: readonly BirdCoderCodeEngineCatalogEntry[],
): void {
  publishCatalog(
    entries
      .map(toWorkbenchDefinition)
      .filter((entry): entry is WorkbenchCodeEngineDefinition => entry !== null),
  );
}

export function subscribeWorkbenchCodeEngineCatalog(listener: () => void): () => void {
  catalogListeners.add(listener);
  return () => catalogListeners.delete(listener);
}

export function getWorkbenchCodeEngineCatalogSnapshot(): WorkbenchCodeEngineCatalogSnapshot {
  return catalogSnapshot;
}

export function useWorkbenchCodeEngineCatalog(): WorkbenchCodeEngineCatalogSnapshot {
  return useSyncExternalStore(
    subscribeWorkbenchCodeEngineCatalog,
    getWorkbenchCodeEngineCatalogSnapshot,
    getWorkbenchCodeEngineCatalogSnapshot,
  );
}

export function useModelCatalogLoaded(): boolean {
  return useWorkbenchCodeEngineCatalog().loaded;
}

export function listWorkbenchCodeEngines(
  _carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): readonly WorkbenchCodeEngineDefinition[] {
  return catalogSnapshot.engines;
}

export function normalizeWorkbenchCodeEngineId(value: unknown): WorkbenchCodeEngineId | null {
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

export function findWorkbenchCodeEngineDefinition(
  value: unknown,
  _carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchCodeEngineDefinition | null {
  const key = normalizeKey(value);
  if (!key) {
    return null;
  }
  return catalogSnapshot.engines.find(
    (engine) => engine.id === key || engine.aliases.some((alias) => normalizeKey(alias) === key),
  ) ?? null;
}

function createUnknownEngineDefinition(value: unknown): WorkbenchCodeEngineDefinition {
  const id = normalizeKey(value);
  return {
    id,
    agentId: '',
    bindingId: '',
    label: titleCaseEngineId(id) || id,
    aliases: id ? [id] : [],
    defaultModelId: '',
    monogram: buildMonogram(id),
    models: [],
    modelCatalog: [],
    modelIds: [],
    theme: resolveTheme(id),
  };
}

export function getWorkbenchCodeEngineDefinition(
  value: unknown,
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchCodeEngineDefinition {
  return findWorkbenchCodeEngineDefinition(value, carrier) ?? createUnknownEngineDefinition(value);
}

export function hasWorkbenchCodeModel(
  engineId: unknown,
  modelId: unknown,
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): boolean {
  const definition = findWorkbenchCodeEngineDefinition(engineId, carrier);
  const id = String(modelId ?? '').trim();
  return Boolean(definition && id && definition.models.some((model) => model.id === id));
}

export function normalizeWorkbenchCodeModelId(
  engineId: unknown,
  modelId: unknown,
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
  options: { allowUnknown?: boolean } = {},
): string {
  const candidate = String(modelId ?? '').trim();
  const definition = findWorkbenchCodeEngineDefinition(engineId, carrier);
  if (!definition) {
    return candidate;
  }
  if (candidate && (options.allowUnknown || definition.models.some((model) => model.id === candidate))) {
    return candidate;
  }
  return definition.defaultModelId;
}

export function normalizeWorkbenchCodeEngineSettingsMap(
  value: unknown,
  options: { includeDefaults?: boolean } = {},
): WorkbenchCodeEngineSettingsMap {
  const source = isRecord(value) ? value : {};
  const settings: WorkbenchCodeEngineSettingsMap = {};
  const engineIds = new Set([
    ...Object.keys(source),
    ...(options.includeDefaults ? catalogSnapshot.engines.map((engine) => engine.id) : []),
  ]);
  for (const engineId of engineIds) {
    const entry = isRecord(source[engineId]) ? source[engineId] as Record<string, unknown> : {};
    const definition = findWorkbenchCodeEngineDefinition(engineId);
    const candidate = String(
      entry.defaultModelId ?? entry.selectedModelId ?? entry.modelId ?? definition?.defaultModelId ?? '',
    ).trim();
    const defaultModelId = normalizeWorkbenchCodeModelId(engineId, candidate);
    if (defaultModelId) {
      settings[engineId] = { defaultModelId };
    }
  }
  return settings;
}

export function resolveWorkbenchCodeEngineSelectedModelId(
  engineId: unknown,
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
  explicitModelId?: string | null,
): string {
  const normalizedEngineId = normalizeWorkbenchCodeEngineId(engineId) ?? normalizeKey(engineId);
  const rawSettings = isRecord(carrier?.codeEngineSettings)
    ? carrier.codeEngineSettings[normalizedEngineId]
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

export function resolveWorkbenchChatSelection(
  input: { codeEngineId?: string | null; codeModelId?: string | null } | null | undefined,
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchChatSelection {
  const requestedEngineId = normalizeWorkbenchCodeEngineId(input?.codeEngineId);
  const codeEngineId = requestedEngineId ?? catalogSnapshot.engines[0]?.id ?? normalizeKey(input?.codeEngineId);
  return {
    codeEngineId,
    codeModelId: resolveWorkbenchCodeEngineSelectedModelId(
      codeEngineId,
      carrier,
      input?.codeModelId,
    ),
  };
}

export const DEFAULT_WORKBENCH_CHAT_SELECTION: WorkbenchChatSelection = {
  codeEngineId: '',
  codeModelId: '',
};

export function getWorkbenchCodeEngineLabel(
  engineId: unknown,
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): string {
  return getWorkbenchCodeEngineDefinition(engineId, carrier).label;
}

export function getWorkbenchCodeModelLabel(
  engineId: unknown,
  modelId: unknown,
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): string {
  const id = String(modelId ?? '').trim();
  return findWorkbenchCodeEngineDefinition(engineId, carrier)?.models.find(
    (model) => model.id === id,
  )?.label ?? id;
}

export function getWorkbenchCodeEngineSummary(engineId: unknown, modelId: unknown): string {
  const engineLabel = getWorkbenchCodeEngineLabel(engineId);
  const modelLabel = getWorkbenchCodeModelLabel(engineId, modelId);
  return modelLabel ? `${engineLabel} / ${modelLabel}` : engineLabel;
}

export function getWorkbenchCodeEngineSessionSummary(engineId: unknown, modelId: unknown): string {
  return getWorkbenchCodeEngineSummary(engineId, modelId);
}

export function getWorkbenchModelVendorLabel(value: unknown): string {
  const vendor = String(value ?? '').trim().toLowerCase();
  if (vendor === 'openai') return 'OpenAI';
  if (vendor === 'anthropic') return 'Anthropic';
  if (vendor === 'google') return 'Google';
  if (vendor === 'opencode') return 'OpenCode';
  return vendor || 'Unknown';
}

export function listWorkbenchServerImplementedCodeEngines(
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): readonly WorkbenchCodeEngineDefinition[] {
  return listWorkbenchCodeEngines(carrier);
}

export function isWorkbenchServerImplementedEngineId(
  value: unknown,
): value is WorkbenchCodeEngineId {
  return findWorkbenchCodeEngineDefinition(value) !== null;
}

export function normalizeWorkbenchServerImplementedCodeEngineId(
  value: unknown,
  _carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchCodeEngineId {
  return findWorkbenchCodeEngineDefinition(value)?.id ?? catalogSnapshot.engines[0]?.id ?? '';
}

export function assertWorkbenchServerImplementedEngineId(
  value: unknown,
): asserts value is WorkbenchCodeEngineId {
  if (!isWorkbenchServerImplementedEngineId(value)) {
    throw new Error(`Agents did not publish code engine "${String(value)}".`);
  }
}

export function getDefaultWorkbenchServerImplementedCodeEngineId(): WorkbenchCodeEngineId {
  return catalogSnapshot.engines[0]?.id ?? '';
}

export function resolveWorkbenchServerEngineSupportState(
  value: unknown,
): WorkbenchServerEngineSupportState {
  const definition = findWorkbenchCodeEngineDefinition(value);
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
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchNewSessionSelection {
  const resolvedCarrier = carrier ?? input;
  const engineId =
    normalizeWorkbenchCodeEngineId(input.requestedEngineId) ??
    normalizeWorkbenchCodeEngineId(input.currentSessionEngineId) ??
    normalizeWorkbenchCodeEngineId(input.preferredEngineId) ??
    catalogSnapshot.engines[0]?.id ??
    '';
  const engine = getWorkbenchCodeEngineDefinition(engineId, resolvedCarrier);
  const requestedModelId = String(input.preferredModelId ?? '').trim();
  const currentModelId = String(input.currentSessionModelId ?? '').trim();
  const modelId = normalizeWorkbenchCodeModelId(
    engineId,
    requestedModelId || currentModelId || resolveWorkbenchCodeEngineSelectedModelId(engineId, resolvedCarrier),
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
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchNewSessionEngineCatalog {
  const resolvedInput = input ?? {};
  const resolvedCarrier = carrier ?? resolvedInput;
  return {
    availableEngines: listWorkbenchCodeEngines(resolvedCarrier),
    preferredSelection: resolveWorkbenchPreferredNewSessionSelection(
      resolvedInput,
      resolvedCarrier,
    ),
  };
}
