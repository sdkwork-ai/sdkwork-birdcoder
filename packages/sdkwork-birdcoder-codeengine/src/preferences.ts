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
} from './kernel.ts';
import { BIRDCODER_STANDARD_DEFAULT_ENGINE_ID } from './catalog.ts';

export type WorkbenchCodeEngineTheme = BirdCoderStandardEngineTheme;
export type WorkbenchCodeEngineModelSource = 'built-in' | 'custom';

export interface WorkbenchCodeEngineModelDefinition {
  id: string;
  label: string;
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

function toWorkbenchCodeEngineModelDefinition(
  value: BirdCoderModelCatalogEntry,
): WorkbenchCodeEngineModelDefinition {
  return {
    id: value.modelId,
    label: value.displayName,
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
    modelCatalog: engine.modelCatalog.map(toWorkbenchCodeEngineModelDefinition),
    accessPlan: engine.accessPlan,
    primaryAccessLane: engine.primaryAccessLane,
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

export function getWorkbenchCodeEngineDefinition(
  value: string | null | undefined,
  settings?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchCodeEngineDefinition {
  const normalizedEngineId = normalizeWorkbenchCodeEngineId(value);
  const settingsMap = resolveEngineSettingsCarrier(settings);
  return (
    listWorkbenchCodeEngines({ codeEngineSettings: settingsMap }).find(
      (engine) => engine.id === normalizedEngineId,
    ) ?? WORKBENCH_CODE_ENGINES[0]
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
  const engine = getWorkbenchCodeEngineDefinition(engineId, settings);
  const normalizedModelId = modelId?.trim().toLowerCase() || engine.defaultModelId.toLowerCase();
  const model =
    engine.modelCatalog.find((candidate) => candidate.id.toLowerCase() === normalizedModelId) ??
    engine.modelCatalog.find(
      (candidate) => candidate.id.toLowerCase() === engine.defaultModelId.toLowerCase(),
    );

  return model?.label ?? modelId?.trim() ?? engine.defaultModelId;
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

  const engine = getWorkbenchCodeEngineDefinition(engineId, settings);
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
