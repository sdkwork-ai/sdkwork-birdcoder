import type {
  BirdCoderCodeEngineModelConfig,
  BirdCoderCodeEngineModelConfigEngine,
  BirdCoderCodeEngineModelConfigSource,
  BirdCoderCodeEngineModelConfigSyncResult,
} from '@sdkwork/birdcoder-pc-contracts-commons';

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

export interface BuildDefaultBirdCoderCodeEngineModelConfigInput {
  source?: BirdCoderCodeEngineModelConfigSource;
  version?: string;
  updatedAt?: string;
}

function nowIsoString(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function listModelsForEngine(engineId: WorkbenchCodeEngineId) {
  return BIRDCODER_CODE_ENGINE_MODELS.filter(
    (model) => model.engineKey === engineId && model.status === 'active',
  );
}

function getDefaultBuiltinModelId(engineId: WorkbenchCodeEngineId): string {
  const defaultModelId = listModelsForEngine(engineId).find(
    (model) => model.defaultForEngine,
  )?.modelId;

  if (!defaultModelId) {
    throw new Error(`Missing active default model for code engine: ${engineId}`);
  }

  return defaultModelId;
}

function normalizeBuiltinModelId(
  engineId: WorkbenchCodeEngineId,
  value: unknown,
): string {
  const candidate = String(value ?? '').trim();
  const matchedModel = listModelsForEngine(engineId).find(
    (model) => model.modelId === candidate,
  );

  return matchedModel?.modelId ?? getDefaultBuiltinModelId(engineId);
}

function buildDefaultEngineConfig(
  engineId: WorkbenchCodeEngineId,
): BirdCoderCodeEngineModelConfigEngine {
  const defaultModelId = getDefaultBuiltinModelId(engineId);

  return {
    engineId,
    defaultModelId,
    selectedModelId: defaultModelId,
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
    const candidate =
      String(rawEngine.selectedModelId ?? rawEngine.defaultModelId ?? '').trim() ||
      defaultEngine.defaultModelId;
    const selectedModelId = normalizeBuiltinModelId(engineId, candidate);

    engines[engineId] = {
      engineId,
      defaultModelId: selectedModelId,
      selectedModelId,
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
    const selectedModelId = normalizeBuiltinModelId(
      engineId,
      settings[engineId]?.defaultModelId ?? defaultEngine.selectedModelId,
    );

    engines[engineId] = {
      ...defaultEngine,
      defaultModelId: selectedModelId,
      selectedModelId,
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
