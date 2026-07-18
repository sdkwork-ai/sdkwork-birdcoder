import assert from 'node:assert/strict';

import {
  BIRDCODER_CODE_ENGINE_MODEL_CONFIG_HOME_RELATIVE_PATH,
  buildDefaultBirdCoderCodeEngineModelConfig,
  createBirdCoderCodeEngineModelConfigSyncPlan,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/modelConfig.ts';
import {
  syncWorkbenchCodeEngineModelConfig,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/preferences.ts';
import {
  deserializeStoredValue,
  readUserHomeTextFile,
  serializeStoredValue,
  writeUserHomeTextFile,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/storage/dataKernel.ts';
import type {
  BirdCoderCodeEngineModelConfig,
  BirdCoderSyncCodeEngineModelConfigRequest,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/engine.ts';

function withCodexModel(
  config: BirdCoderCodeEngineModelConfig,
  modelId: string,
): BirdCoderCodeEngineModelConfig {
  return {
    ...config,
    engines: {
      ...config.engines,
      codex: {
        ...config.engines.codex,
        defaultModelId: modelId,
        selectedModelId: modelId,
      },
    },
  };
}

function readStoredModelConfig(): Promise<BirdCoderCodeEngineModelConfig | null> {
  return readUserHomeTextFile(BIRDCODER_CODE_ENGINE_MODEL_CONFIG_HOME_RELATIVE_PATH)
    .then((rawValue) =>
      deserializeStoredValue<BirdCoderCodeEngineModelConfig | null>(rawValue, null),
    );
}

const serverNewerConfig = withCodexModel(
  buildDefaultBirdCoderCodeEngineModelConfig({
    source: 'server',
    updatedAt: '2026-04-01T00:00:00.000Z',
    version: 'v2',
  }),
  'gpt-5.2-codex',
);
await writeUserHomeTextFile(
  BIRDCODER_CODE_ENGINE_MODEL_CONFIG_HOME_RELATIVE_PATH,
  '',
);

const missingLocalSyncResult = await syncWorkbenchCodeEngineModelConfig({
  appRuntimeReadService: {
    async getModelConfig() {
      return serverNewerConfig;
    },
  },
  appRuntimeWriteService: {
    async syncModelConfig() {
      throw new Error('Missing local config must not push a generated default to the server.');
    },
  },
});
assert.equal(missingLocalSyncResult.action, 'overwrite-local');
assert.equal(missingLocalSyncResult.authoritativeSource, 'server');
assert.equal((await readStoredModelConfig())?.engines.codex.selectedModelId, 'gpt-5.2-codex');

const localOlderConfig = withCodexModel(
  buildDefaultBirdCoderCodeEngineModelConfig({
    source: 'home-file',
    updatedAt: '2026-03-01T00:00:00.000Z',
    version: 'v1',
  }),
  'gpt-5.3-codex',
);
await writeUserHomeTextFile(
  BIRDCODER_CODE_ENGINE_MODEL_CONFIG_HOME_RELATIVE_PATH,
  serializeStoredValue(localOlderConfig),
);

let syncedRequest: BirdCoderSyncCodeEngineModelConfigRequest | null = null;
const serverOverwriteResult = await syncWorkbenchCodeEngineModelConfig({
  appRuntimeReadService: {
    async getModelConfig() {
      return serverNewerConfig;
    },
  },
  appRuntimeWriteService: {
    async syncModelConfig(request) {
      syncedRequest = request;
      return createBirdCoderCodeEngineModelConfigSyncPlan({
        localConfig: request.localConfig,
        serverConfig: serverNewerConfig,
      });
    },
  },
});
assert.equal(serverOverwriteResult.action, 'overwrite-local');
assert.equal(syncedRequest?.localConfig.engines.codex.selectedModelId, 'gpt-5.3-codex');
assert.equal((await readStoredModelConfig())?.engines.codex.selectedModelId, 'gpt-5.2-codex');

const localNewerConfig = withCodexModel(
  buildDefaultBirdCoderCodeEngineModelConfig({
    source: 'home-file',
    updatedAt: '2026-05-01T00:00:00.000Z',
    version: 'v3',
  }),
  'gpt-5.1-codex',
);
await writeUserHomeTextFile(
  BIRDCODER_CODE_ENGINE_MODEL_CONFIG_HOME_RELATIVE_PATH,
  serializeStoredValue(localNewerConfig),
);

const localPushResult = await syncWorkbenchCodeEngineModelConfig({
  appRuntimeReadService: {
    async getModelConfig() {
      return serverNewerConfig;
    },
  },
  appRuntimeWriteService: {
    async syncModelConfig(request) {
      return createBirdCoderCodeEngineModelConfigSyncPlan({
        localConfig: request.localConfig,
        serverConfig: serverNewerConfig,
      });
    },
  },
});
assert.equal(localPushResult.action, 'push-local');
assert.equal(localPushResult.authoritativeSource, 'local');
assert.equal(
  (await readStoredModelConfig())?.engines.codex.selectedModelId,
  'gpt-5.1-codex',
  'When the local home model config is newer, startup sync must push local to server without rewriting the local model choice.',
);

const legacyCustomModelConfig = {
  ...buildDefaultBirdCoderCodeEngineModelConfig({
    source: 'home-file',
    updatedAt: '2026-05-02T00:00:00.000Z',
    version: 'v4',
  }),
  engines: {
    ...buildDefaultBirdCoderCodeEngineModelConfig({
      source: 'home-file',
      updatedAt: '2026-05-02T00:00:00.000Z',
      version: 'v4',
    }).engines,
    gemini: {
      engineId: 'gemini',
      defaultModelId: 'gemini-custom',
      selectedModelId: 'gemini-custom',
      customModels: [{ id: 'gemini-custom', label: 'Legacy custom Gemini model' }],
      models: [],
    },
  },
};
await writeUserHomeTextFile(
  BIRDCODER_CODE_ENGINE_MODEL_CONFIG_HOME_RELATIVE_PATH,
  serializeStoredValue(legacyCustomModelConfig),
);

let sanitizedSyncRequest: BirdCoderSyncCodeEngineModelConfigRequest | null = null;
const legacyCustomModelSyncResult = await syncWorkbenchCodeEngineModelConfig({
  appRuntimeReadService: {
    async getModelConfig() {
      return buildDefaultBirdCoderCodeEngineModelConfig({
        source: 'server',
        updatedAt: '2026-05-02T00:00:00.000Z',
        version: 'v4',
      });
    },
  },
  appRuntimeWriteService: {
    async syncModelConfig(request) {
      sanitizedSyncRequest = request;
      return createBirdCoderCodeEngineModelConfigSyncPlan({
        localConfig: request.localConfig,
        serverConfig: buildDefaultBirdCoderCodeEngineModelConfig({
          source: 'server',
          updatedAt: '2026-05-02T00:00:00.000Z',
          version: 'v4',
        }),
      });
    },
  },
});
assert.equal(legacyCustomModelSyncResult.action, 'noop');
assert.equal(sanitizedSyncRequest?.localConfig.engines.gemini.selectedModelId, 'auto-gemini-3');
assert.equal(
  'customModels' in (sanitizedSyncRequest?.localConfig.engines.gemini ?? {}),
  false,
  'Legacy custom models must be removed before a home-file configuration is sent to the server.',
);
assert.equal(
  'customModels' in ((await readStoredModelConfig())?.engines.gemini ?? {}),
  false,
  'Reading a legacy home-file configuration must rewrite it without unsupported custom model records.',
);

console.log('workbench model config sync contract passed.');
