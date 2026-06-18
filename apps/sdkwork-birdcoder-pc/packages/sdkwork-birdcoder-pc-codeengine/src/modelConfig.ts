import type {
  BirdCoderCodeEngineModelConfig,
  BirdCoderCodeEngineModelConfigCustomModel,
  BirdCoderCodeEngineModelConfigEngine,
  BirdCoderCodeEngineModelConfigSource,
  BirdCoderCodeEngineModelConfigSyncResult,
} from '@sdkwork/birdcoder-pc-types';

import {
  BIRDCODER_CODE_ENGINE_MODELS,
  type WorkbenchCodeEngineId,
  WORKBENCH_CODE_ENGINE_IDS,
} from './catalog.ts';
import {
  normalizeWorkbenchCodeEngineSettingsMap,
  resolveWorkbenchCodeEngineSelectedModelId,
  type WorkbenchCodeEngineSettingsCarrier,
  type WorkbenchCodeEngineSettingsMap,
} from './preferences.ts';

export {
  resolveWorkbenchCodeEngineSelectedModelId,
  type WorkbenchCodeEngineSettingsCarrier,
  type WorkbenchCodeEngineSettingsMap,
} from './preferences.ts';

export const BIRDCODER_CODE_ENGINE_MODEL_CONFIG_HOME_DIRECTORY = '.sdkwork/birdcoder';
export const BIRDCODER_CODE_ENGINE_MODEL_CONFIG_FILE_NAME = 'code-engine-models.json';
export const BIRDCODER_CODE_ENGINE_MODEL_CONFIG_HOME_RELATIVE_PATH =
  `${BIRDCODER_CODE_ENGINE_MODEL_CONFIG_HOME_DIRECTORY}/${BIRDCODER_CODE_ENGINE_MODEL_CONFIG_FILE_NAME}`;

const DEFAULT_CONFIG_MODEL_IDS: Record<WorkbenchCodeEngineId, string> = {
  codex: 'gpt-5.4',
  'claude-code': 'claude-code',
  gemini: 'gemini',
  opencode: 'opencode',
};

export interface BuildDefaultBirdCoderCodeEngineModelConfigInput {
  source?: BirdCoderCodeEngineModelConfigSource;
  version?: string;
  updatedAt?: string;
  models?: readonly unknown[];
}

function nowIsoString(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function listModelsForEngine(engineId: WorkbenchCodeEngineId) {
  return BIRDCODER_CODE_ENGINE_MODELS.filter((model) => model.engineKey === engineId);
}

function normalizeCustomModels(
  value: unknown,
  engineId: WorkbenchCodeEngineId,
): readonly BirdCoderCodeEngineModelConfigCustomModel[] {
  const items = Array.isArray(value) ? value : [];
  const builtinModelIds = new Set(listModelsForEngine(engineId).map((model) => model.modelId));
  const seen = new Set<string>();
  const customModels: BirdCoderCodeEngineModelConfigCustomModel[] = [];

  for (const item of items) {
    if (!isRecord(item)) {
      continue;
    }

    const id = String(item.id ?? '').trim();

    if (!id || builtinModelIds.has(id) || seen.has(id)) {
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

function buildDefaultEngineConfig(
  engineId: WorkbenchCodeEngineId,
): BirdCoderCodeEngineModelConfigEngine {
  const defaultModelId = DEFAULT_CONFIG_MODEL_IDS[engineId];

  return {
    engineId,
    defaultModelId,
    selectedModelId: defaultModelId,
    customModels: [],
    models: listModelsForEngine(engineId),
  };
}

export function buildDefaultBirdCoderCodeEngineModelConfig(
  input: BuildDefaultBirdCoderCodeEngineModelConfigInput = {},
): BirdCoderCodeEngineModelConfig {
  return {
    schemaVersion: 1,
    source: input.source ?? 'local-default',
    version: input.version ?? 'v1',
    updatedAt: input.updatedAt ?? nowIsoString(),
    engines: Object.fromEntries(
      WORKBENCH_CODE_ENGINE_IDS.map((engineId) => [
        engineId,
        buildDefaultEngineConfig(engineId),
      ]),
    ),
  };
}

export function normalizeBirdCoderCodeEngineModelConfig(
  value: unknown,
): BirdCoderCodeEngineModelConfig {
  const input = isRecord(value) ? value : {};
  const defaultConfig = buildDefaultBirdCoderCodeEngineModelConfig({
    source: String(input.source ?? 'local-default') as BirdCoderCodeEngineModelConfigSource,
    version: String(input.version ?? 'v1'),
    updatedAt: String(input.updatedAt ?? nowIsoString()),
  });
  const sourceEngines = isRecord(input.engines) ? input.engines : {};
  const engines: Record<string, BirdCoderCodeEngineModelConfigEngine> = {};

  for (const engineId of WORKBENCH_CODE_ENGINE_IDS) {
    const defaultEngine = defaultConfig.engines[engineId];
    const rawEngine = isRecord(sourceEngines[engineId]) ? sourceEngines[engineId] : {};
    const customModels = normalizeCustomModels(rawEngine.customModels, engineId);
    const candidate =
      String(rawEngine.selectedModelId ?? rawEngine.defaultModelId ?? '').trim() ||
      defaultEngine.defaultModelId;

    engines[engineId] = {
      engineId,
      defaultModelId: candidate,
      selectedModelId: candidate,
      customModels,
      models: listModelsForEngine(engineId),
    };
  }

  return {
    ...defaultConfig,
    schemaVersion: 1,
    engines,
  };
}

export function modelConfigToWorkbenchCodeEngineSettingsMap(
  config: BirdCoderCodeEngineModelConfig,
): WorkbenchCodeEngineSettingsMap {
  const normalizedConfig = normalizeBirdCoderCodeEngineModelConfig(config);
  const settings: WorkbenchCodeEngineSettingsMap = {};

  for (const engineId of WORKBENCH_CODE_ENGINE_IDS) {
    const engineConfig = normalizedConfig.engines[engineId];

    settings[engineId] = {
      defaultModelId: engineConfig.selectedModelId || engineConfig.defaultModelId,
      customModels: engineConfig.customModels,
    };
  }

  return settings;
}

export function workbenchCodeEngineSettingsMapToModelConfig(
  settingsMap: WorkbenchCodeEngineSettingsMap,
  input: BuildDefaultBirdCoderCodeEngineModelConfigInput = {},
): BirdCoderCodeEngineModelConfig {
  const settings = normalizeWorkbenchCodeEngineSettingsMap(settingsMap);
  const config = buildDefaultBirdCoderCodeEngineModelConfig(input);
  const engines: Record<string, BirdCoderCodeEngineModelConfigEngine> = {};

  for (const engineId of WORKBENCH_CODE_ENGINE_IDS) {
    const defaultEngine = config.engines[engineId];
    const selectedModelId =
      settings[engineId]?.defaultModelId ?? defaultEngine.selectedModelId;

    engines[engineId] = {
      ...defaultEngine,
      defaultModelId: selectedModelId,
      selectedModelId,
      customModels: settings[engineId]?.customModels ?? [],
    };
  }

  return {
    ...config,
    engines,
  };
}

function versionNumber(value: string): number | null {
  const match = /^v?(\d+)$/iu.exec(value.trim());

  return match ? Number(match[1]) : null;
}

export function compareBirdCoderCodeEngineModelConfigVersions(
  left: BirdCoderCodeEngineModelConfig,
  right: BirdCoderCodeEngineModelConfig,
): -1 | 0 | 1 {
  const leftVersion = versionNumber(left.version);
  const rightVersion = versionNumber(right.version);

  if (leftVersion !== null && rightVersion !== null && leftVersion !== rightVersion) {
    return leftVersion < rightVersion ? -1 : 1;
  }

  if (left.version !== right.version) {
    return left.version < right.version ? -1 : 1;
  }

  const leftTime = Date.parse(left.updatedAt);
  const rightTime = Date.parse(right.updatedAt);

  if (leftTime === rightTime) {
    return 0;
  }

  return leftTime < rightTime ? -1 : 1;
}

export interface CreateBirdCoderCodeEngineModelConfigSyncPlanInput {
  localConfig?: BirdCoderCodeEngineModelConfig | null;
  serverConfig?: BirdCoderCodeEngineModelConfig | null;
}

export function createBirdCoderCodeEngineModelConfigSyncPlan(
  input: CreateBirdCoderCodeEngineModelConfigSyncPlanInput,
): BirdCoderCodeEngineModelConfigSyncResult {
  const localConfig = input.localConfig
    ? normalizeBirdCoderCodeEngineModelConfig(input.localConfig)
    : null;
  const serverConfig = input.serverConfig
    ? normalizeBirdCoderCodeEngineModelConfig(input.serverConfig)
    : null;

  if (!localConfig && serverConfig) {
    return {
      action: 'overwrite-local',
      authoritativeSource: 'server',
      config: serverConfig,
      shouldWriteLocal: true,
      shouldWriteServer: false,
    };
  }

  if (localConfig && !serverConfig) {
    return {
      action: 'push-local',
      authoritativeSource: 'local',
      config: localConfig,
      shouldWriteLocal: false,
      shouldWriteServer: true,
    };
  }

  if (!localConfig && !serverConfig) {
    const config = buildDefaultBirdCoderCodeEngineModelConfig();

    return {
      action: 'overwrite-local',
      authoritativeSource: 'server',
      config,
      shouldWriteLocal: true,
      shouldWriteServer: false,
    };
  }

  const comparison = compareBirdCoderCodeEngineModelConfigVersions(
    localConfig!,
    serverConfig!,
  );

  if (comparison < 0) {
    return {
      action: 'overwrite-local',
      authoritativeSource: 'server',
      config: serverConfig!,
      shouldWriteLocal: true,
      shouldWriteServer: false,
    };
  }

  if (comparison > 0) {
    return {
      action: 'push-local',
      authoritativeSource: 'local',
      config: localConfig!,
      shouldWriteLocal: false,
      shouldWriteServer: true,
    };
  }

  return {
    action: 'noop',
    authoritativeSource: 'equal',
    config: serverConfig!,
    shouldWriteLocal: false,
    shouldWriteServer: false,
  };
}

export function resolveModelConfigSelectedModelId(
  engineId: WorkbenchCodeEngineId,
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): string {
  return resolveWorkbenchCodeEngineSelectedModelId(engineId, carrier);
}
