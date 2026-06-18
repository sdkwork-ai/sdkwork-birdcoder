import type {
  BirdCoderCodeEngineModelConfigCustomModel,
  BirdCoderModelCatalogEntry,
} from '@sdkwork/birdcoder-pc-types';

import {
  BIRDCODER_CODE_ENGINE_DESCRIPTORS,
  BIRDCODER_CODE_ENGINE_MODELS,
  WORKBENCH_CODE_ENGINE_IDS,
  type WorkbenchCodeEngineId,
} from './catalog.ts';

export type { WorkbenchCodeEngineId } from './catalog.ts';

export const BIRDCODER_STANDARD_DEFAULT_ENGINE_ID: WorkbenchCodeEngineId = 'codex';

export const MODEL_VENDOR_VALUES = [
  'openai',
  'anthropic',
  'google',
  'opencode',
  'custom',
] as const;

export type WorkbenchModelVendor = (typeof MODEL_VENDOR_VALUES)[number];
export type ModelVendor = WorkbenchModelVendor | 'unknown';
export type WorkbenchCodeEngineThemeId = 'amber' | 'blue' | 'emerald' | 'violet';
export type WorkbenchCodeEngineModelSource = 'builtin' | 'custom';

export interface WorkbenchCustomCodeEngineModelInput {
  id: string;
  modelId?: string;
  label?: string;
}

export interface WorkbenchCodeEngineModelDefinition {
  id: string;
  label: string;
  vendor: WorkbenchModelVendor;
  modelVendor: WorkbenchModelVendor;
  providerId?: string;
  defaultForEngine: boolean;
  source: WorkbenchCodeEngineModelSource;
}

export interface WorkbenchCodeEngineDefinition {
  id: WorkbenchCodeEngineId;
  label: string;
  aliases: readonly string[];
  defaultModelId: string;
  monogram: string;
  models: readonly WorkbenchCodeEngineModelDefinition[];
  modelCatalog: readonly WorkbenchCodeEngineModelDefinition[];
  terminalProfileId: WorkbenchCodeEngineId;
  theme: WorkbenchCodeEngineThemeId;
}

export interface WorkbenchCodeEngineSettings {
  defaultModelId: string;
  customModels: readonly BirdCoderCodeEngineModelConfigCustomModel[];
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

const ENGINE_ALIASES: Record<WorkbenchCodeEngineId, readonly string[]> = {
  codex: ['codex', 'openai codex', 'openai-codex', 'gpt-4o'],
  'claude-code': [
    'claude-code',
    'claude code',
    'claude',
    'anthropic',
    'anthropic claude',
  ],
  gemini: ['gemini', 'gemini-cli', 'gemini cli', 'google gemini', 'google'],
  opencode: ['opencode', 'open-code', 'open code'],
};

const ENGINE_MONOGRAMS: Record<WorkbenchCodeEngineId, string> = {
  codex: 'CX',
  'claude-code': 'CC',
  gemini: 'GM',
  opencode: 'OC',
};

const ENGINE_THEMES: Record<WorkbenchCodeEngineId, WorkbenchCodeEngineThemeId> = {
  codex: 'blue',
  'claude-code': 'amber',
  gemini: 'emerald',
  opencode: 'violet',
};

function normalizeKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, ' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function vendorFromProvider(providerId: string | undefined): WorkbenchModelVendor {
  if (providerId === 'openai') {
    return 'openai';
  }
  if (providerId === 'anthropic') {
    return 'anthropic';
  }
  if (providerId === 'google') {
    return 'google';
  }
  if (providerId === 'opencode') {
    return 'opencode';
  }

  return 'custom';
}

function modelToDefinition(
  model: BirdCoderModelCatalogEntry,
): WorkbenchCodeEngineModelDefinition {
  const vendor = vendorFromProvider(model.providerId);

  return {
    id: model.modelId,
    label: model.displayName,
    vendor,
    modelVendor: vendor,
    providerId: model.providerId,
    defaultForEngine: model.defaultForEngine,
    source: 'builtin',
  };
}

export const WORKBENCH_CODE_ENGINES: readonly WorkbenchCodeEngineDefinition[] =
  WORKBENCH_CODE_ENGINE_IDS.map((engineId) => {
    const descriptor = BIRDCODER_CODE_ENGINE_DESCRIPTORS.find(
      (candidate) => candidate.engineKey === engineId,
    );

    if (!descriptor) {
      throw new Error(`Missing workbench code engine descriptor: ${engineId}`);
    }

    const models = BIRDCODER_CODE_ENGINE_MODELS.filter(
      (model) => model.engineKey === engineId,
    ).map(modelToDefinition);

    return {
      id: engineId,
      label: descriptor.displayName,
      aliases: ENGINE_ALIASES[engineId],
      defaultModelId: descriptor.defaultModelId,
      monogram: ENGINE_MONOGRAMS[engineId],
      models,
      modelCatalog: models,
      terminalProfileId: engineId,
      theme: ENGINE_THEMES[engineId],
    };
  });

export const DEFAULT_WORKBENCH_CODE_ENGINE_SETTINGS_MAP: WorkbenchCodeEngineSettingsMap =
  Object.fromEntries(
    WORKBENCH_CODE_ENGINES.map((engine) => [
      engine.id,
      {
        defaultModelId: engine.defaultModelId,
        customModels: [],
      },
    ]),
  ) as WorkbenchCodeEngineSettingsMap;

export const DEFAULT_WORKBENCH_CHAT_SELECTION: WorkbenchChatSelection = {
  codeEngineId: BIRDCODER_STANDARD_DEFAULT_ENGINE_ID,
  codeModelId:
    DEFAULT_WORKBENCH_CODE_ENGINE_SETTINGS_MAP[BIRDCODER_STANDARD_DEFAULT_ENGINE_ID]
      ?.defaultModelId ?? 'gpt-5.4',
};

function customModelToDefinition(
  model: BirdCoderCodeEngineModelConfigCustomModel,
): WorkbenchCodeEngineModelDefinition {
  return {
    id: model.id,
    label: model.label ?? model.id,
    vendor: 'custom',
    modelVendor: 'custom',
    defaultForEngine: false,
    source: 'custom',
  };
}

function withCarrierModelCatalog(
  engine: WorkbenchCodeEngineDefinition,
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchCodeEngineDefinition {
  const customModels = listCustomModels(engine.id, carrier).map(customModelToDefinition);

  if (customModels.length === 0) {
    return engine;
  }

  const modelCatalog = [...engine.models, ...customModels];

  return {
    ...engine,
    modelCatalog,
  };
}

export function listWorkbenchCodeEngines(
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): readonly WorkbenchCodeEngineDefinition[] {
  return carrier
    ? WORKBENCH_CODE_ENGINES.map((engine) => withCarrierModelCatalog(engine, carrier))
    : WORKBENCH_CODE_ENGINES;
}

export function normalizeWorkbenchCodeEngineId(
  value: unknown,
): WorkbenchCodeEngineId | null {
  const key = normalizeKey(value);

  if (!key) {
    return null;
  }

  for (const engine of WORKBENCH_CODE_ENGINES) {
    if (engine.id === key || engine.aliases.some((alias) => normalizeKey(alias) === key)) {
      return engine.id;
    }
  }

  return null;
}

export function findWorkbenchCodeEngineDefinition(
  value: unknown,
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchCodeEngineDefinition | null {
  const engineId = normalizeWorkbenchCodeEngineId(value);

  if (!engineId) {
    return null;
  }

  return listWorkbenchCodeEngines(carrier).find((engine) => engine.id === engineId) ?? null;
}

export function getWorkbenchCodeEngineDefinition(
  value: unknown,
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchCodeEngineDefinition {
  return (
    findWorkbenchCodeEngineDefinition(value, carrier) ??
    findWorkbenchCodeEngineDefinition(BIRDCODER_STANDARD_DEFAULT_ENGINE_ID, carrier)!
  );
}

function listCustomModels(
  engineId: WorkbenchCodeEngineId,
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): readonly BirdCoderCodeEngineModelConfigCustomModel[] {
  const settingsMap = normalizeWorkbenchCodeEngineSettingsMap(
    carrier?.codeEngineSettings,
    {
      includeDefaults: false,
    },
  );

  return settingsMap[engineId]?.customModels ?? [];
}

export function hasWorkbenchCodeModel(
  engineId: unknown,
  modelId: unknown,
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): boolean {
  const normalizedEngineId = normalizeWorkbenchCodeEngineId(engineId);
  const id = String(modelId ?? '').trim();

  if (!normalizedEngineId || !id) {
    return false;
  }

  const definition = getWorkbenchCodeEngineDefinition(normalizedEngineId, carrier);

  return (
    definition.models.some((model) => model.id === id) ||
    listCustomModels(normalizedEngineId, carrier).some((model) => model.id === id)
  );
}

export function normalizeWorkbenchCodeModelId(
  engineId: unknown,
  modelId: unknown,
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
  options: {
    allowUnknown?: boolean;
  } = {},
): string {
  const normalizedEngineId =
    normalizeWorkbenchCodeEngineId(engineId) ?? BIRDCODER_STANDARD_DEFAULT_ENGINE_ID;
  const definition = getWorkbenchCodeEngineDefinition(normalizedEngineId);
  const candidate = String(modelId ?? '').trim();

  if (
    candidate &&
    (options.allowUnknown || hasWorkbenchCodeModel(normalizedEngineId, candidate, carrier))
  ) {
    return candidate;
  }

  return definition.defaultModelId;
}

function normalizeCustomModels(
  value: unknown,
  engineId: WorkbenchCodeEngineId,
): readonly BirdCoderCodeEngineModelConfigCustomModel[] {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const definition = getWorkbenchCodeEngineDefinition(engineId);
  const builtinModelIds = new Set(definition.models.map((model) => model.id));
  const customModels: BirdCoderCodeEngineModelConfigCustomModel[] = [];

  for (const item of source) {
    if (!isRecord(item)) {
      continue;
    }

    const id = String(item.id ?? '').trim();

    if (!id || seen.has(id) || builtinModelIds.has(id)) {
      continue;
    }

    seen.add(id);
    customModels.push({
      id,
      label: String(item.label ?? id).trim() || id,
    });
  }

  return customModels;
}

interface NormalizeSettingsOptions {
  includeDefaults?: boolean;
}

export function normalizeWorkbenchCodeEngineSettingsMap(
  value: unknown,
  options: NormalizeSettingsOptions = {},
): WorkbenchCodeEngineSettingsMap {
  const includeDefaults = options.includeDefaults ?? false;
  const source = isRecord(value) ? value : {};
  const settings: WorkbenchCodeEngineSettingsMap = {};

  for (const engine of WORKBENCH_CODE_ENGINES) {
    const rawEntry = source[engine.id];

    if (!includeDefaults && !isRecord(rawEntry)) {
      continue;
    }

    const entry = isRecord(rawEntry) ? rawEntry : {};
    const customModels = normalizeCustomModels(entry.customModels, engine.id);
    const candidate =
      String(entry.defaultModelId ?? entry.selectedModelId ?? entry.modelId ?? '').trim() ||
      engine.defaultModelId;
    const candidateKnown =
      engine.models.some((model) => model.id === candidate) ||
      customModels.some((model) => model.id === candidate);
    const defaultModelId = candidateKnown ? candidate : engine.defaultModelId;

    if (
      !includeDefaults &&
      defaultModelId === engine.defaultModelId &&
      customModels.length === 0
    ) {
      continue;
    }

    settings[engine.id] = {
      defaultModelId,
      customModels,
    };
  }

  return settings;
}

export function resolveWorkbenchCodeEngineSelectedModelId(
  engineId: unknown,
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
  explicitModelId?: string | null,
): string {
  const normalizedEngineId =
    normalizeWorkbenchCodeEngineId(engineId) ?? BIRDCODER_STANDARD_DEFAULT_ENGINE_ID;
  const explicit = explicitModelId?.trim();

  if (explicit) {
    return explicit;
  }

  const rawSettings = carrier?.codeEngineSettings;
  const settings = isRecord(rawSettings) ? rawSettings[normalizedEngineId] : undefined;

  if (isRecord(settings)) {
    const candidate = String(settings.defaultModelId ?? settings.selectedModelId ?? '').trim();

    if (candidate) {
      return candidate;
    }
  }

  return getWorkbenchCodeEngineDefinition(normalizedEngineId).defaultModelId;
}

export function resolveWorkbenchChatSelection(
  input: {
    codeEngineId?: string | null;
    codeModelId?: string | null;
  } | null | undefined,
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchChatSelection {
  const codeEngineId =
    normalizeWorkbenchCodeEngineId(input?.codeEngineId) ??
    DEFAULT_WORKBENCH_CHAT_SELECTION.codeEngineId;
  const requestedModelId = String(input?.codeModelId ?? '').trim();

  if (requestedModelId && hasWorkbenchCodeModel(codeEngineId, requestedModelId, carrier)) {
    return {
      codeEngineId,
      codeModelId: requestedModelId,
    };
  }

  return {
    codeEngineId,
    codeModelId: resolveWorkbenchCodeEngineSelectedModelId(codeEngineId, carrier),
  };
}

export function getWorkbenchCodeEngineLabel(
  engineId: unknown,
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): string {
  return findWorkbenchCodeEngineDefinition(engineId, carrier)?.label ?? String(engineId ?? '').trim();
}

export function getWorkbenchCodeModelLabel(
  engineId: unknown,
  modelId: unknown,
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): string {
  const id = String(modelId ?? '').trim();

  if (!id) {
    return '';
  }

  const definition = findWorkbenchCodeEngineDefinition(engineId, carrier);
  const model = definition?.modelCatalog.find((entry) => entry.id === id);

  return model?.label ?? id;
}

export function getWorkbenchCodeEngineSummary(
  engineId: unknown,
  modelId: unknown,
): string {
  const engineLabel = getWorkbenchCodeEngineLabel(engineId);
  const modelLabel = getWorkbenchCodeModelLabel(engineId, modelId);

  return modelLabel ? `${engineLabel} / ${modelLabel}` : engineLabel;
}

export function getWorkbenchCodeEngineSessionSummary(
  engineId: unknown,
  modelId: unknown,
): string {
  return getWorkbenchCodeEngineSummary(engineId, modelId);
}

export function getWorkbenchModelVendorLabel(value: unknown): string {
  const vendor = String(value ?? '').trim();

  if (vendor === 'openai') {
    return 'OpenAI';
  }
  if (vendor === 'anthropic') {
    return 'Anthropic';
  }
  if (vendor === 'google') {
    return 'Google';
  }
  if (vendor === 'opencode') {
    return 'OpenCode';
  }
  if (vendor === 'custom') {
    return 'Custom';
  }

  return vendor;
}

export function useModelCatalogLoaded(): boolean {
  return true;
}
