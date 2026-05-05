import {
  type BirdCoderEngineAccessLane,
  type BirdCoderEngineAccessPlan,
  type BirdCoderModelCatalogEntry,
  type BirdCoderStandardEngineTheme,
} from '@sdkwork/birdcoder-types';
import {
  getWorkbenchCodeEngineKernel,
  normalizeWorkbenchCodeEngineKernelId,
  WORKBENCH_ENGINE_KERNELS,
  type WorkbenchCodeEngineId,
  type WorkbenchCodeEngineExecutionTopology,
} from './kernel.ts';
import { BIRDCODER_STANDARD_DEFAULT_ENGINE_ID } from './catalog.ts';

export type WorkbenchCodeEngineTheme = BirdCoderStandardEngineTheme;
export type WorkbenchCodeEngineModelSource = 'built-in' | 'custom';
export const MODEL_VENDOR_VALUES = [
  'openai',
  'anthropic',
  'google',
  'meta',
  'deepseek',
  'mistral',
  'cohere',
  'moonshot',
  'zhipu',
  'alibaba_qwen',
  'minimax',
  'zero_one_ai',
  'xai',
  'baidu',
  'tencent',
  'bytedance',
  'stability_ai',
  'black_forest_labs',
  'suno',
  'open_source',
  'custom',
  'unknown',
] as const;
export type ModelVendor = typeof MODEL_VENDOR_VALUES[number];

const MODEL_VENDOR_LABELS: Record<ModelVendor, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  meta: 'Meta',
  deepseek: 'DeepSeek',
  mistral: 'Mistral AI',
  cohere: 'Cohere',
  moonshot: 'Moonshot',
  zhipu: 'Zhipu',
  alibaba_qwen: 'Alibaba Qwen',
  minimax: 'MiniMax',
  zero_one_ai: '01.AI',
  xai: 'xAI',
  baidu: 'Baidu',
  tencent: 'Tencent',
  bytedance: 'ByteDance',
  stability_ai: 'Stability AI',
  black_forest_labs: 'Black Forest Labs',
  suno: 'Suno',
  open_source: 'Open Source',
  custom: 'Custom',
  unknown: 'Unknown',
};

interface WorkbenchCodeModelVendorInput {
  engineVendor?: string | null;
  modelId?: string | null;
  modelLabel?: string | null;
  providerId?: string | null;
  source?: WorkbenchCodeEngineModelSource | null;
}

export interface WorkbenchCodeEngineModelDefinition {
  id: string;
  label: string;
  modelVendor: ModelVendor;
  providerId?: string;
  source: WorkbenchCodeEngineModelSource;
}

export interface WorkbenchCustomCodeEngineModelDefinition {
  id: string;
  label: string;
}

export interface WorkbenchCustomCodeEngineModelInput {
  id?: string | null;
  label?: string | null;
  modelId?: string | null;
}

export interface WorkbenchCodeEngineSettings {
  customModels: readonly WorkbenchCustomCodeEngineModelDefinition[];
  defaultModelId: string;
}

export type WorkbenchCodeEngineSettingsMap = Partial<
  Record<WorkbenchCodeEngineId, WorkbenchCodeEngineSettings>
>;

export interface WorkbenchCodeEngineSettingsCarrier {
  codeEngineSettings?: WorkbenchCodeEngineSettingsMap | null | undefined;
}

export interface WorkbenchCodeEngineDefinition {
  id: WorkbenchCodeEngineId;
  label: string;
  terminalProfileId: WorkbenchCodeEngineId;
  description: string;
  aliases: readonly string[];
  monogram: string;
  theme: WorkbenchCodeEngineTheme;
  vendor: string;
  defaultModelId: string;
  modelIds: readonly string[];
  modelCatalog: readonly WorkbenchCodeEngineModelDefinition[];
  accessPlan: BirdCoderEngineAccessPlan | null;
  primaryAccessLane: BirdCoderEngineAccessLane | null;
  executionTopology: WorkbenchCodeEngineExecutionTopology;
}

export interface WorkbenchChatSelection {
  codeEngineId: WorkbenchCodeEngineId;
  codeModelId: string;
}

export interface WorkbenchChatSelectionInput {
  codeEngineId?: string | null;
  codeModelId?: string | null;
}

interface WorkbenchCodeEngineSettingsInput {
  customModels?: readonly WorkbenchCustomCodeEngineModelInput[] | null;
  defaultModelId?: string | null;
}

function normalizeVendorSearchText(value: string | null | undefined): string {
  return value?.trim().toLowerCase().replace(/[_\s.]+/g, '-') ?? '';
}

function includesVendorToken(searchText: string, tokens: readonly string[]): boolean {
  return tokens.some((token) => searchText.includes(token));
}

export function getWorkbenchModelVendorLabel(modelVendor: ModelVendor): string {
  return MODEL_VENDOR_LABELS[modelVendor] ?? MODEL_VENDOR_LABELS.unknown;
}

export function resolveWorkbenchCodeModelVendor({
  engineVendor,
  modelId,
  modelLabel,
  providerId,
  source,
}: WorkbenchCodeModelVendorInput): ModelVendor {
  if (source === 'custom' || normalizeVendorSearchText(providerId) === 'custom') {
    return 'custom';
  }

  const searchText = [
    providerId,
    modelId,
    modelLabel,
    engineVendor,
  ]
    .map(normalizeVendorSearchText)
    .filter(Boolean)
    .join(' ');

  if (includesVendorToken(searchText, ['openai', 'gpt-', 'gpt-oss', 'codex', 'o1', 'o3', 'o4'])) {
    return 'openai';
  }
  if (includesVendorToken(searchText, ['anthropic', 'claude'])) {
    return 'anthropic';
  }
  if (includesVendorToken(searchText, ['google', 'gemini'])) {
    return 'google';
  }
  if (includesVendorToken(searchText, ['meta', 'llama'])) {
    return 'meta';
  }
  if (includesVendorToken(searchText, ['deepseek'])) {
    return 'deepseek';
  }
  if (includesVendorToken(searchText, ['mistral', 'pixtral'])) {
    return 'mistral';
  }
  if (includesVendorToken(searchText, ['cohere', 'command-r'])) {
    return 'cohere';
  }
  if (includesVendorToken(searchText, ['moonshot', 'kimi'])) {
    return 'moonshot';
  }
  if (includesVendorToken(searchText, ['zhipu', 'glm'])) {
    return 'zhipu';
  }
  if (includesVendorToken(searchText, ['alibaba', 'qwen'])) {
    return 'alibaba_qwen';
  }
  if (includesVendorToken(searchText, ['minimax'])) {
    return 'minimax';
  }
  if (includesVendorToken(searchText, ['zero-one', 'yi-'])) {
    return 'zero_one_ai';
  }
  if (includesVendorToken(searchText, ['xai', 'grok'])) {
    return 'xai';
  }
  if (includesVendorToken(searchText, ['baidu', 'ernie'])) {
    return 'baidu';
  }
  if (includesVendorToken(searchText, ['tencent', 'hunyuan'])) {
    return 'tencent';
  }
  if (includesVendorToken(searchText, ['bytedance', 'doubao'])) {
    return 'bytedance';
  }
  if (includesVendorToken(searchText, ['stability'])) {
    return 'stability_ai';
  }
  if (includesVendorToken(searchText, ['black-forest', 'flux'])) {
    return 'black_forest_labs';
  }
  if (includesVendorToken(searchText, ['suno'])) {
    return 'suno';
  }
  if (includesVendorToken(searchText, ['open-source', 'oss', 'nemotron'])) {
    return 'open_source';
  }

  return 'unknown';
}

function toWorkbenchCodeEngineModelDefinition(
  value: BirdCoderModelCatalogEntry,
  engineVendor: string,
): WorkbenchCodeEngineModelDefinition {
  return {
    id: value.modelId,
    label: value.displayName,
    modelVendor: resolveWorkbenchCodeModelVendor({
      engineVendor,
      modelId: value.modelId,
      modelLabel: value.displayName,
      providerId: value.providerId,
      source: 'built-in',
    }),
    providerId: value.providerId,
    source: 'built-in',
  };
}

export const WORKBENCH_CODE_ENGINES: ReadonlyArray<WorkbenchCodeEngineDefinition> =
  WORKBENCH_ENGINE_KERNELS.map((engine) => ({
    id: engine.id,
    label: engine.label,
    terminalProfileId: engine.terminalProfileId,
    description: engine.description,
    aliases: [...engine.aliases],
    monogram: engine.monogram,
    theme: engine.theme,
    vendor: engine.descriptor.vendor,
    defaultModelId: engine.defaultModelId,
    modelIds: [...engine.modelIds],
    modelCatalog: engine.modelCatalog.map((model) =>
      toWorkbenchCodeEngineModelDefinition(model, engine.descriptor.vendor),
    ),
    accessPlan: engine.accessPlan,
    primaryAccessLane: engine.primaryAccessLane,
    executionTopology: engine.executionTopology,
  }));

export const DEFAULT_WORKBENCH_CHAT_SELECTION: WorkbenchChatSelection = {
  codeEngineId: BIRDCODER_STANDARD_DEFAULT_ENGINE_ID,
  codeModelId: getWorkbenchCodeEngineKernel(BIRDCODER_STANDARD_DEFAULT_ENGINE_ID).defaultModelId,
};

export function normalizeWorkbenchCodeEngineId(
  value: string | null | undefined,
): WorkbenchCodeEngineId {
  return normalizeWorkbenchCodeEngineKernelId(value);
}

function createCustomModelRecord(
  input: WorkbenchCustomCodeEngineModelInput | null | undefined,
): WorkbenchCustomCodeEngineModelDefinition | null {
  const id = input?.id?.trim() || input?.modelId?.trim() || '';
  if (!id) {
    return null;
  }

  const label = input?.label?.trim() || id;
  return {
    id,
    label,
  };
}

function normalizeWorkbenchCodeEngineSettingsEntry(
  engineId: WorkbenchCodeEngineId,
  value: WorkbenchCodeEngineSettingsInput | null | undefined,
): WorkbenchCodeEngineSettings | null {
  const engine =
    WORKBENCH_CODE_ENGINES.find((item) => item.id === engineId) ?? WORKBENCH_CODE_ENGINES[0];
  const builtInModelIds = new Set(engine.modelIds.map((modelId) => modelId.toLowerCase()));
  const seenCustomModelIds = new Set<string>();
  const customModels: WorkbenchCustomCodeEngineModelDefinition[] = [];

  for (const rawModel of value?.customModels ?? []) {
    const model = createCustomModelRecord(rawModel);
    if (!model) {
      continue;
    }

    const normalizedModelId = model.id.toLowerCase();
    if (builtInModelIds.has(normalizedModelId) || seenCustomModelIds.has(normalizedModelId)) {
      continue;
    }

    seenCustomModelIds.add(normalizedModelId);
    customModels.push(model);
  }

  const allowedModelIds = new Set<string>([
    ...engine.modelIds.map((modelId) => modelId.toLowerCase()),
    ...customModels.map((model) => model.id.toLowerCase()),
  ]);
  const requestedDefaultModelId = value?.defaultModelId?.trim() || '';
  const defaultModelId =
    requestedDefaultModelId && allowedModelIds.has(requestedDefaultModelId.toLowerCase())
      ? [...engine.modelIds, ...customModels.map((model) => model.id)].find(
          (modelId) => modelId.toLowerCase() === requestedDefaultModelId.toLowerCase(),
        ) ?? engine.defaultModelId
      : engine.defaultModelId;

  if (customModels.length === 0 && defaultModelId === engine.defaultModelId) {
    return null;
  }

  return {
    customModels,
    defaultModelId,
  };
}

export function normalizeWorkbenchCodeEngineSettingsMap(
  value: unknown,
): WorkbenchCodeEngineSettingsMap {
  const rawRecord =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const normalizedEntries: [WorkbenchCodeEngineId, WorkbenchCodeEngineSettings][] = [];

  for (const engine of WORKBENCH_CODE_ENGINES) {
    const entry = normalizeWorkbenchCodeEngineSettingsEntry(
      engine.id,
      rawRecord[engine.id] as WorkbenchCodeEngineSettingsInput | null | undefined,
    );
    if (entry) {
      normalizedEntries.push([engine.id, entry]);
    }
  }

  return Object.fromEntries(normalizedEntries) as WorkbenchCodeEngineSettingsMap;
}

function resolveEngineSettingsCarrier(
  value: WorkbenchCodeEngineSettingsCarrier | null | undefined,
): WorkbenchCodeEngineSettingsMap {
  return normalizeWorkbenchCodeEngineSettingsMap(value?.codeEngineSettings);
}

function buildMergedEngineDefinition(
  baseEngine: WorkbenchCodeEngineDefinition,
  settingsMap: WorkbenchCodeEngineSettingsMap,
): WorkbenchCodeEngineDefinition {
  const settings = settingsMap[baseEngine.id];
  const customModels = settings?.customModels ?? [];
  const mergedModelCatalog: WorkbenchCodeEngineModelDefinition[] = [
    ...baseEngine.modelCatalog,
    ...customModels.map((model) => ({
      id: model.id,
      label: model.label,
      modelVendor: 'custom' as const,
      source: 'custom' as const,
    })),
  ];
  const mergedModelIds = mergedModelCatalog.map((model) => model.id);
  const mergedModelIdSet = new Set(mergedModelIds.map((modelId) => modelId.toLowerCase()));
  const defaultModelId =
    settings?.defaultModelId &&
    mergedModelIdSet.has(settings.defaultModelId.toLowerCase())
      ? mergedModelIds.find(
          (modelId) => modelId.toLowerCase() === settings.defaultModelId.toLowerCase(),
        ) ?? baseEngine.defaultModelId
      : baseEngine.defaultModelId;

  return {
    ...baseEngine,
    defaultModelId,
    modelIds: mergedModelIds,
    modelCatalog: mergedModelCatalog,
  };
}

export function listWorkbenchCodeEngines(
  value?: WorkbenchCodeEngineSettingsCarrier | null,
): ReadonlyArray<WorkbenchCodeEngineDefinition> {
  const settingsMap = resolveEngineSettingsCarrier(value);
  return WORKBENCH_CODE_ENGINES.map((engine) => buildMergedEngineDefinition(engine, settingsMap));
}

export function findWorkbenchCodeEngineDefinition(
  value: string | null | undefined,
  settings?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchCodeEngineDefinition | null {
  const normalizedValue = value?.trim().toLowerCase();
  if (!normalizedValue) {
    return null;
  }

  const settingsMap = resolveEngineSettingsCarrier(settings);
  return (
    listWorkbenchCodeEngines({ codeEngineSettings: settingsMap }).find(
      (engine) =>
        engine.id === normalizedValue ||
        engine.aliases.some((alias) => alias.toLowerCase() === normalizedValue) ||
        engine.label.toLowerCase() === normalizedValue,
    ) ?? null
  );
}

export function getWorkbenchCodeEngineDefinition(
  value: string | null | undefined,
  settings?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchCodeEngineDefinition {
  const normalizedEngineId = normalizeWorkbenchCodeEngineId(value);
  return (
    findWorkbenchCodeEngineDefinition(normalizedEngineId, settings) ?? WORKBENCH_CODE_ENGINES[0]
  );
}

export function getWorkbenchCodeEngineLabel(
  value: string | null | undefined,
  settings?: WorkbenchCodeEngineSettingsCarrier | null,
): string {
  return (
    findWorkbenchCodeEngineDefinition(value, settings)?.label ??
    value?.trim() ??
    getWorkbenchCodeEngineDefinition(null, settings).label
  );
}

export function normalizeWorkbenchCodeModelId(
  engineId: string | null | undefined,
  modelId: string | null | undefined,
  settings?: WorkbenchCodeEngineSettingsCarrier | null,
  options?: {
    allowUnknown?: boolean;
  },
): string {
  const engine = getWorkbenchCodeEngineDefinition(engineId, settings);
  const normalizedValue = modelId?.trim().toLowerCase();
  if (!normalizedValue) {
    return engine.defaultModelId;
  }

  const matchedModelId = engine.modelCatalog.find(
    (candidate) => candidate.id.toLowerCase() === normalizedValue,
  );
  if (matchedModelId) {
    return matchedModelId.id;
  }

  return options?.allowUnknown ? modelId?.trim() ?? engine.defaultModelId : engine.defaultModelId;
}

export function getWorkbenchCodeModelLabel(
  engineId: string | null | undefined,
  modelId: string | null | undefined,
  settings?: WorkbenchCodeEngineSettingsCarrier | null,
): string {
  const normalizedModelId = modelId?.trim() ?? '';
  if (!normalizedModelId) {
    return '';
  }

  const engine = findWorkbenchCodeEngineDefinition(engineId, settings);
  if (!engine) {
    return normalizedModelId;
  }

  return (
    engine.modelCatalog.find(
      (candidate) => candidate.id.toLowerCase() === normalizedModelId.toLowerCase(),
    )?.label ?? normalizedModelId
  );
}

export function getWorkbenchCodeEngineSummary(
  engineId: string | null | undefined,
  modelId: string | null | undefined,
  settings?: WorkbenchCodeEngineSettingsCarrier | null,
): string {
  const engineLabel = getWorkbenchCodeEngineLabel(engineId, settings);
  const modelLabel = getWorkbenchCodeModelLabel(engineId, modelId, settings).trim();
  if (!modelLabel || modelLabel.toLowerCase() === engineLabel.trim().toLowerCase()) {
    return engineLabel;
  }

  return `${engineLabel} / ${modelLabel}`;
}

export function getWorkbenchCodeEngineSessionSummary(
  engineId: string | null | undefined,
  modelId: string | null | undefined,
  settings?: WorkbenchCodeEngineSettingsCarrier | null,
): string {
  const normalizedEngineId = engineId?.trim() ?? '';
  if (!normalizedEngineId) {
    return '';
  }

  const engine = findWorkbenchCodeEngineDefinition(normalizedEngineId, settings);
  const engineLabel = engine?.label ?? normalizedEngineId;
  const normalizedModelId = modelId?.trim() ?? '';
  if (!normalizedModelId) {
    return engineLabel;
  }

  const modelLabel =
    engine?.modelCatalog.find(
      (candidate) => candidate.id.toLowerCase() === normalizedModelId.toLowerCase(),
    )?.label ?? normalizedModelId;
  if (!modelLabel || modelLabel.toLowerCase() === engineLabel.trim().toLowerCase()) {
    return engineLabel;
  }

  return `${engineLabel} / ${modelLabel}`;
}

export function hasWorkbenchCodeModel(
  engineId: string | null | undefined,
  modelId: string | null | undefined,
  settings?: WorkbenchCodeEngineSettingsCarrier | null,
): boolean {
  const normalizedModelId = modelId?.trim().toLowerCase() || '';
  if (!normalizedModelId) {
    return false;
  }

  const engine = findWorkbenchCodeEngineDefinition(engineId, settings);
  if (!engine) {
    return false;
  }

  return engine.modelCatalog.some((candidate) => candidate.id.toLowerCase() === normalizedModelId);
}

export function resolveWorkbenchChatSelection(
  value: WorkbenchChatSelectionInput | null | undefined,
  settings?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchChatSelection {
  const codeEngineId = normalizeWorkbenchCodeEngineId(value?.codeEngineId);
  return {
    codeEngineId,
    codeModelId: normalizeWorkbenchCodeModelId(codeEngineId, value?.codeModelId, settings),
  };
}
