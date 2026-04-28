import assert from 'node:assert/strict';

import {
  BIRDCODER_CODE_ENGINE_MODEL_CONFIG_HOME_RELATIVE_PATH,
  buildDefaultBirdCoderCodeEngineModelConfig,
  createBirdCoderCodeEngineModelConfigSyncPlan,
} from '../packages/sdkwork-birdcoder-codeengine/src/modelConfig.ts';
import {
  syncWorkbenchCodeEngineModelConfig,
} from '../packages/sdkwork-birdcoder-commons/src/workbench/preferences.ts';
import {
  deserializeStoredValue,
  readUserHomeTextFile,
  serializeStoredValue,
  writeUserHomeTextFile,
} from '../packages/sdkwork-birdcoder-commons/src/storage/dataKernel.ts';
import type {
  BirdCoderCodeEngineModelConfig,
  BirdCoderSyncCodeEngineModelConfigRequest,
} from '../packages/sdkwork-birdcoder-types/src/engine.ts';

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
  coreReadService: {
    async getModelConfig() {
      return serverNewerConfig;
    },
  },
  coreWriteService: {
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
  coreReadService: {
    async getModelConfig() {
      return serverNewerConfig;
    },
  },
  coreWriteService: {
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
  coreReadService: {
    async getModelConfig() {
      return serverNewerConfig;
    },
  },
  coreWriteService: {
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

console.log('workbench model config sync contract passed.');
