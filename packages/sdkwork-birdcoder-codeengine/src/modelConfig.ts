import type {
  BirdCoderCodeEngineModelConfig,
  BirdCoderCodeEngineModelConfigCustomModel,
  BirdCoderCodeEngineModelConfigEngine,
  BirdCoderCodeEngineModelConfigSyncResult,
  BirdCoderCodeEngineKey,
  BirdCoderModelCatalogEntry,
} from '@sdkwork/birdcoder-types';

import { listBirdCoderCodeEngineModels } from './catalog.ts';
import {
  WORKBENCH_CODE_ENGINES,
  findWorkbenchCodeEngineDefinition,
  getWorkbenchCodeEngineDefinition,
  normalizeWorkbenchCodeEngineSettingsMap,
  normalizeWorkbenchCodeModelId,
  type WorkbenchCodeEngineSettingsCarrier,
  type WorkbenchCodeEngineSettingsMap,
  type WorkbenchCustomCodeEngineModelDefinition,
} from './preferences.ts';

export const BIRDCODER_CODE_ENGINE_MODEL_CONFIG_SCHEMA_VERSION = 1;
export const BIRDCODER_CODE_ENGINE_MODEL_CONFIG_HOME_DIRECTORY = '.sdkwork/birdcoder';
export const BIRDCODER_CODE_ENGINE_MODEL_CONFIG_FILE_NAME = 'code-engine-models.json';
export const BIRDCODER_CODE_ENGINE_MODEL_CONFIG_HOME_RELATIVE_PATH =
  `${BIRDCODER_CODE_ENGINE_MODEL_CONFIG_HOME_DIRECTORY}/${BIRDCODER_CODE_ENGINE_MODEL_CONFIG_FILE_NAME}`;

interface BuildDefaultBirdCoderCodeEngineModelConfigOptions {
  models?: readonly BirdCoderModelCatalogEntry[];
  source?: BirdCoderCodeEngineModelConfig['source'];
  updatedAt?: string;
  version?: string;
}

interface WorkbenchCodeEngineSettingsMapToModelConfigOptions {
  source?: BirdCoderCodeEngineModelConfig['source'];
  updatedAt?: string;
  version?: string;
}

interface CreateBirdCoderCodeEngineModelConfigSyncPlanOptions {
  localConfig?: BirdCoderCodeEngineModelConfig | null;
  serverConfig?: BirdCoderCodeEngineModelConfig | null;
}

function nowIsoString(): string {
  return new Date().toISOString();
}

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function normalizeTimestamp(value: string | null | undefined): string {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) {
    return new Date(0).toISOString();
  }

  const timestamp = Date.parse(normalizedValue);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date(0).toISOString();
}

function compareVersionTokens(left: string, right: string): number {
  const leftTokens = left.match(/\d+|[a-z]+/gi) ?? [left];
  const rightTokens = right.match(/\d+|[a-z]+/gi) ?? [right];
  const tokenCount = Math.max(leftTokens.length, rightTokens.length);

  for (let index = 0; index < tokenCount; index += 1) {
    const leftToken = leftTokens[index] ?? '';
    const rightToken = rightTokens[index] ?? '';
    if (leftToken === rightToken) {
      continue;
    }

    const leftNumber = /^\d+$/.test(leftToken) ? Number(leftToken) : null;
    const rightNumber = /^\d+$/.test(rightToken) ? Number(rightToken) : null;
    if (leftNumber !== null && rightNumber !== null) {
      return Math.sign(leftNumber - rightNumber);
    }

    return leftToken.localeCompare(rightToken);
  }

  return 0;
}

function normalizeCustomModels(
  models: readonly BirdCoderCodeEngineModelConfigCustomModel[] | null | undefined,
  builtInModels: readonly BirdCoderModelCatalogEntry[],
): readonly BirdCoderCodeEngineModelConfigCustomModel[] {
  const builtInModelIds = new Set(
    builtInModels.map((model) => model.modelId.trim().toLowerCase()).filter(Boolean),
  );
  const seen = new Set<string>();
  const normalizedModels: BirdCoderCodeEngineModelConfigCustomModel[] = [];

  for (const rawModel of models ?? []) {
    const id = normalizeText(rawModel?.id);
    if (!id) {
      continue;
    }

    const normalizedId = id.toLowerCase();
    if (builtInModelIds.has(normalizedId) || seen.has(normalizedId)) {
      continue;
    }

    seen.add(normalizedId);
    normalizedModels.push({
      id,
      label: normalizeText(rawModel?.label) || id,
    });
  }

  return normalizedModels;
}

function buildCustomModelCatalogEntry(
  engineId: string,
  model: BirdCoderCodeEngineModelConfigCustomModel,
  updatedAt: string,
): BirdCoderModelCatalogEntry {
  return {
    id: `model-catalog:${engineId}:${model.id}`,
    uuid: `model-catalog:${engineId}:${model.id}`,
    createdAt: updatedAt,
    updatedAt,
    engineKey: engineId as BirdCoderCodeEngineKey,
    modelId: model.id,
    displayName: model.label,
    providerId: 'custom',
    status: 'active',
    defaultForEngine: false,
    transportKinds: ['sdk-stream'],
    capabilityMatrix: {},
  };
}

function buildModelConfigEngine(
  engineId: string,
  input: Partial<BirdCoderCodeEngineModelConfigEngine> | null | undefined,
  allModels: readonly BirdCoderModelCatalogEntry[],
  updatedAt: string,
): BirdCoderCodeEngineModelConfigEngine {
  const engine = getWorkbenchCodeEngineDefinition(engineId);
  const builtInModels = allModels.filter(
    (model) => model.engineKey === engine.id && model.providerId !== 'custom',
  );
  const customModels = normalizeCustomModels(input?.customModels, builtInModels);
  const customModelCatalog = customModels.map((model) =>
    buildCustomModelCatalogEntry(engine.id, model, updatedAt),
  );
  const mergedModelCatalog = [...builtInModels, ...customModelCatalog];
  const knownModelIds = new Set(mergedModelCatalog.map((model) => model.modelId.toLowerCase()));
  const requestedDefaultModelId = normalizeText(input?.defaultModelId);
  const requestedSelectedModelId = normalizeText(input?.selectedModelId);
  const defaultModelId =
    requestedDefaultModelId && knownModelIds.has(requestedDefaultModelId.toLowerCase())
      ? mergedModelCatalog.find(
          (model) => model.modelId.toLowerCase() === requestedDefaultModelId.toLowerCase(),
        )?.modelId ?? engine.defaultModelId
      : engine.defaultModelId;
  const selectedModelId =
    requestedSelectedModelId && knownModelIds.has(requestedSelectedModelId.toLowerCase())
      ? mergedModelCatalog.find(
          (model) => model.modelId.toLowerCase() === requestedSelectedModelId.toLowerCase(),
        )?.modelId ?? defaultModelId
      : defaultModelId;

  return {
    engineId: engine.id,
    defaultModelId,
    selectedModelId,
    customModels,
    models: mergedModelCatalog,
  };
}

function indexModelsByEngine(
  models: readonly BirdCoderModelCatalogEntry[],
): Readonly<Record<string, readonly BirdCoderModelCatalogEntry[]>> {
  const entries = new Map<string, BirdCoderModelCatalogEntry[]>();
  for (const model of models) {
    const engineId = normalizeText(model.engineKey);
    if (!engineId) {
      continue;
    }

    const engineModels = entries.get(engineId) ?? [];
    engineModels.push(model);
    entries.set(engineId, engineModels);
  }

  return Object.fromEntries(entries);
}

export function buildDefaultBirdCoderCodeEngineModelConfig(
  options: BuildDefaultBirdCoderCodeEngineModelConfigOptions = {},
): BirdCoderCodeEngineModelConfig {
  const models = options.models ?? listBirdCoderCodeEngineModels();
  const modelsByEngine = indexModelsByEngine(models);
  const updatedAt = options.updatedAt ?? nowIsoString();
  const engines = Object.fromEntries(
    WORKBENCH_CODE_ENGINES.map((engine) => [
      engine.id,
      {
        engineId: engine.id,
        defaultModelId: engine.defaultModelId,
        selectedModelId: engine.defaultModelId,
        customModels: [],
        models: modelsByEngine[engine.id] ?? [],
      } satisfies BirdCoderCodeEngineModelConfigEngine,
    ]),
  );

  return {
    schemaVersion: BIRDCODER_CODE_ENGINE_MODEL_CONFIG_SCHEMA_VERSION,
    source: options.source ?? 'local-default',
    version: options.version ?? 'v1',
    updatedAt,
    engines,
  };
}

export function normalizeBirdCoderCodeEngineModelConfig(
  value: Partial<BirdCoderCodeEngineModelConfig> | null | undefined,
  fallback: BirdCoderCodeEngineModelConfig = buildDefaultBirdCoderCodeEngineModelConfig(),
): BirdCoderCodeEngineModelConfig {
  const updatedAt = normalizeTimestamp(value?.updatedAt ?? fallback.updatedAt);
  const models = Object.values(value?.engines ?? {}).flatMap((engine) =>
    Array.isArray(engine?.models) ? engine.models : [],
  );
  const modelCatalog = models.length > 0 ? models : listBirdCoderCodeEngineModels();
  const rawEngines = value?.engines ?? {};
  const engines = Object.fromEntries(
    WORKBENCH_CODE_ENGINES.map((engine) => [
      engine.id,
      buildModelConfigEngine(engine.id, rawEngines[engine.id], modelCatalog, updatedAt),
    ]),
  );

  return {
    schemaVersion: BIRDCODER_CODE_ENGINE_MODEL_CONFIG_SCHEMA_VERSION,
    source: value?.source ?? fallback.source,
    version: normalizeText(value?.version) || fallback.version || 'v1',
    updatedAt,
    engines,
  };
}

export function resolveWorkbenchCodeEngineSelectedModelId(
  engineId: string | null | undefined,
  settings?: WorkbenchCodeEngineSettingsCarrier | null,
  preferredModelId?: string | null,
): string {
  const engine = findWorkbenchCodeEngineDefinition(engineId, settings) ??
    getWorkbenchCodeEngineDefinition(engineId, settings);
  const preferred = normalizeText(preferredModelId);
  if (preferred) {
    const normalizedPreferred = normalizeWorkbenchCodeModelId(
      engine.id,
      preferred,
      settings,
    );
    if (normalizedPreferred.toLowerCase() === preferred.toLowerCase()) {
      return normalizedPreferred;
    }
  }

  return normalizeWorkbenchCodeModelId(
    engine.id,
    settings?.codeEngineSettings?.[engine.id]?.defaultModelId ?? engine.defaultModelId,
    settings,
  );
}

export function modelConfigToWorkbenchCodeEngineSettingsMap(
  config: BirdCoderCodeEngineModelConfig | null | undefined,
): WorkbenchCodeEngineSettingsMap {
  const normalizedConfig = normalizeBirdCoderCodeEngineModelConfig(config);
  const settingsEntries = WORKBENCH_CODE_ENGINES.map((engine) => {
    const engineConfig = normalizedConfig.engines[engine.id];
    const customModels: WorkbenchCustomCodeEngineModelDefinition[] =
      engineConfig.customModels.map((model) => ({
        id: model.id,
        label: model.label,
      }));

    return [
      engine.id,
      {
        customModels,
        defaultModelId: engineConfig.selectedModelId || engineConfig.defaultModelId,
      },
    ] as const;
  });

  return normalizeWorkbenchCodeEngineSettingsMap(Object.fromEntries(settingsEntries));
}

export function workbenchCodeEngineSettingsMapToModelConfig(
  value: WorkbenchCodeEngineSettingsMap | null | undefined,
  options: WorkbenchCodeEngineSettingsMapToModelConfigOptions = {},
): BirdCoderCodeEngineModelConfig {
  const settings = normalizeWorkbenchCodeEngineSettingsMap(value);
  const defaultConfig = buildDefaultBirdCoderCodeEngineModelConfig({
    source: options.source ?? 'home-file',
    updatedAt: options.updatedAt,
    version: options.version,
  });
  const engines = Object.fromEntries(
    WORKBENCH_CODE_ENGINES.map((engine) => {
      const setting = settings[engine.id];
      return [
        engine.id,
        buildModelConfigEngine(
          engine.id,
          {
            ...defaultConfig.engines[engine.id],
            customModels: setting?.customModels ?? [],
            defaultModelId: setting?.defaultModelId ?? defaultConfig.engines[engine.id].defaultModelId,
            selectedModelId:
              setting?.defaultModelId ?? defaultConfig.engines[engine.id].selectedModelId,
          },
          defaultConfig.engines[engine.id].models,
          defaultConfig.updatedAt,
        ),
      ];
    }),
  );

  return {
    ...defaultConfig,
    engines,
  };
}

export function compareBirdCoderCodeEngineModelConfigVersions(
  left: BirdCoderCodeEngineModelConfig | null | undefined,
  right: BirdCoderCodeEngineModelConfig | null | undefined,
): number {
  if (!left && !right) {
    return 0;
  }
  if (!left) {
    return -1;
  }
  if (!right) {
    return 1;
  }

  const versionComparison = compareVersionTokens(left.version, right.version);
  if (versionComparison !== 0) {
    return versionComparison > 0 ? 1 : -1;
  }

  const leftUpdatedAt = Date.parse(normalizeTimestamp(left.updatedAt));
  const rightUpdatedAt = Date.parse(normalizeTimestamp(right.updatedAt));
  return Math.sign(leftUpdatedAt - rightUpdatedAt);
}

export function createBirdCoderCodeEngineModelConfigSyncPlan({
  localConfig,
  serverConfig,
}: CreateBirdCoderCodeEngineModelConfigSyncPlanOptions): BirdCoderCodeEngineModelConfigSyncResult {
  const normalizedLocalConfig = localConfig
    ? normalizeBirdCoderCodeEngineModelConfig(localConfig)
    : null;
  const normalizedServerConfig = serverConfig
    ? normalizeBirdCoderCodeEngineModelConfig(serverConfig)
    : buildDefaultBirdCoderCodeEngineModelConfig({ source: 'server' });

  const comparison = compareBirdCoderCodeEngineModelConfigVersions(
    normalizedLocalConfig,
    normalizedServerConfig,
  );

  if (comparison === 0 && normalizedLocalConfig) {
    return {
      action: 'noop',
      authoritativeSource: 'equal',
      config: normalizedLocalConfig,
      shouldWriteLocal: false,
      shouldWriteServer: false,
    };
  }

  if (comparison > 0 && normalizedLocalConfig) {
    return {
      action: 'push-local',
      authoritativeSource: 'local',
      config: normalizedLocalConfig,
      shouldWriteLocal: false,
      shouldWriteServer: true,
    };
  }

  return {
    action: 'overwrite-local',
    authoritativeSource: 'server',
    config: normalizedServerConfig,
    shouldWriteLocal: true,
    shouldWriteServer: false,
  };
}
