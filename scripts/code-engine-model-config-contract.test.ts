import assert from 'node:assert/strict';

import {
  BIRDCODER_CODE_ENGINE_MODEL_CONFIG_FILE_NAME,
  BIRDCODER_CODE_ENGINE_MODEL_CONFIG_HOME_DIRECTORY,
  buildDefaultBirdCoderCodeEngineModelConfig,
  compareBirdCoderCodeEngineModelConfigVersions,
  createBirdCoderCodeEngineModelConfigSyncPlan,
  modelConfigToWorkbenchCodeEngineSettingsMap,
  normalizeBirdCoderCodeEngineModelConfig,
  resolveWorkbenchCodeEngineSelectedModelId,
  workbenchCodeEngineSettingsMapToModelConfig,
} from '../packages/sdkwork-birdcoder-codeengine/src/modelConfig.ts';

assert.equal(BIRDCODER_CODE_ENGINE_MODEL_CONFIG_HOME_DIRECTORY, '.sdkwork/birdcoder');
assert.equal(BIRDCODER_CODE_ENGINE_MODEL_CONFIG_FILE_NAME, 'code-engine-models.json');

const defaultConfig = buildDefaultBirdCoderCodeEngineModelConfig({
  updatedAt: '2026-04-28T00:00:00.000Z',
  version: 'v1',
});

assert.equal(defaultConfig.schemaVersion, 1);
assert.equal(defaultConfig.version, 'v1');
assert.equal(defaultConfig.updatedAt, '2026-04-28T00:00:00.000Z');
assert.equal(defaultConfig.engines.codex.defaultModelId, 'gpt-5.4');
assert.equal(defaultConfig.engines['claude-code'].defaultModelId, 'claude-code');
assert.equal(defaultConfig.engines.gemini.defaultModelId, 'gemini');
assert.equal(defaultConfig.engines.opencode.defaultModelId, 'opencode');

const normalizedConfig = normalizeBirdCoderCodeEngineModelConfig({
  ...defaultConfig,
  engines: {
    codex: {
      engineId: 'codex',
      defaultModelId: 'gpt-5.4',
      selectedModelId: 'gpt-5.4',
      customModels: [
        { id: 'custom-codex-fast', label: 'Custom Codex Fast' },
        { id: 'gpt-5.4', label: 'Duplicate built-in should be ignored' },
      ],
      models: [],
    },
    gemini: {
      engineId: 'gemini',
      defaultModelId: 'gemini-1.5-pro',
      selectedModelId: 'gemini-custom',
      customModels: [{ id: 'gemini-custom', label: 'Gemini Custom' }],
      models: [],
    },
  },
});

const settings = modelConfigToWorkbenchCodeEngineSettingsMap(normalizedConfig);
assert.equal(settings.codex?.defaultModelId, 'gpt-5.4');
assert.deepEqual(settings.codex?.customModels, [
  { id: 'custom-codex-fast', label: 'Custom Codex Fast' },
]);
assert.equal(settings.gemini?.defaultModelId, 'gemini-custom');
assert.deepEqual(settings.gemini?.customModels, [
  { id: 'gemini-custom', label: 'Gemini Custom' },
]);

assert.equal(
  resolveWorkbenchCodeEngineSelectedModelId('codex', {
    codeEngineSettings: settings,
  }),
  'gpt-5.4',
);
assert.equal(
  resolveWorkbenchCodeEngineSelectedModelId('gemini', {
    codeEngineSettings: settings,
  }),
  'gemini-custom',
);

const configFromSettings = workbenchCodeEngineSettingsMapToModelConfig(settings, {
  updatedAt: '2026-04-28T00:05:00.000Z',
  version: 'local-v2',
});

assert.equal(configFromSettings.version, 'local-v2');
assert.equal(configFromSettings.engines.codex.defaultModelId, 'gpt-5.4');
assert.equal(configFromSettings.engines.gemini.defaultModelId, 'gemini-custom');

assert.equal(
  compareBirdCoderCodeEngineModelConfigVersions(
    { ...defaultConfig, version: 'v1', updatedAt: '2026-04-28T00:00:00.000Z' },
    { ...defaultConfig, version: 'v1', updatedAt: '2026-04-28T00:01:00.000Z' },
  ),
  -1,
);
assert.equal(
  compareBirdCoderCodeEngineModelConfigVersions(
    { ...defaultConfig, version: 'v2', updatedAt: '2026-04-27T00:00:00.000Z' },
    { ...defaultConfig, version: 'v1', updatedAt: '2026-04-28T00:01:00.000Z' },
  ),
  1,
);

const syncPlan = createBirdCoderCodeEngineModelConfigSyncPlan({
  localConfig: {
    ...defaultConfig,
    version: 'v1',
    updatedAt: '2026-04-28T00:00:00.000Z',
  },
  serverConfig: {
    ...defaultConfig,
    version: 'v2',
    updatedAt: '2026-04-28T00:02:00.000Z',
  },
});

assert.deepEqual(
  {
    action: syncPlan.action,
    authoritativeSource: syncPlan.authoritativeSource,
    shouldWriteLocal: syncPlan.shouldWriteLocal,
    shouldWriteServer: syncPlan.shouldWriteServer,
  },
  {
    action: 'overwrite-local',
    authoritativeSource: 'server',
    shouldWriteLocal: true,
    shouldWriteServer: false,
  },
);
assert.equal(syncPlan.config.version, 'v2');

const localNewerPlan = createBirdCoderCodeEngineModelConfigSyncPlan({
  localConfig: {
    ...defaultConfig,
    version: 'v3',
    updatedAt: '2026-04-28T00:03:00.000Z',
  },
  serverConfig: {
    ...defaultConfig,
    version: 'v2',
    updatedAt: '2026-04-28T00:02:00.000Z',
  },
});

assert.equal(localNewerPlan.action, 'push-local');
assert.equal(localNewerPlan.authoritativeSource, 'local');
assert.equal(localNewerPlan.shouldWriteServer, true);
assert.equal(localNewerPlan.config.version, 'v3');

console.log('code engine model config contract passed.');
