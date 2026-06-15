import assert from 'node:assert/strict';

import {
  BIRDCODER_CODE_ENGINE_MODEL_CONFIG_HOME_RELATIVE_PATH,
  buildDefaultBirdCoderCodeEngineModelConfig,
  createBirdCoderCodeEngineModelConfigSyncPlan,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/modelConfig.ts';
import {
  deserializeStoredValue,
  readUserHomeTextFile,
  writeUserHomeTextFile,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/storage/dataKernel.ts';
import type {
  BirdCoderCodeEngineModelConfig,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/engine.ts';

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

const bootstrapModule = await import(
  `../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapShellUserState.ts?modelConfigBootstrap=${Date.now()}`
);
const serverConfig = withCodexModel(
  buildDefaultBirdCoderCodeEngineModelConfig({
    source: 'server',
    updatedAt: '2026-06-01T00:00:00.000Z',
    version: 'v2',
  }),
  'gpt-5.2-codex',
);

await writeUserHomeTextFile(
  BIRDCODER_CODE_ENGINE_MODEL_CONFIG_HOME_RELATIVE_PATH,
  '',
);

await bootstrapModule.bootstrapShellUserState();
await bootstrapModule.bootstrapShellUserState({
  appRuntimeReadService: {
    async getModelConfig() {
      return serverConfig;
    },
  },
  appRuntimeWriteService: {
    async syncModelConfig(request) {
      return createBirdCoderCodeEngineModelConfigSyncPlan({
        localConfig: request.localConfig,
        serverConfig,
      });
    },
  },
});

const storedConfig = deserializeStoredValue<BirdCoderCodeEngineModelConfig | null>(
  await readUserHomeTextFile(BIRDCODER_CODE_ENGINE_MODEL_CONFIG_HOME_RELATIVE_PATH),
  null,
);
assert.equal(
  storedConfig?.engines.codex.selectedModelId,
  'gpt-5.2-codex',
  'Shell user-state bootstrap must sync the code-engine model config before workbench preferences are hydrated.',
);

console.log('shell runtime model config bootstrap contract passed.');
