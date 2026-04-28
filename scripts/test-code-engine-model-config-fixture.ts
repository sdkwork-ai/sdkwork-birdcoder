import type {
  BirdCoderCodeEngineModelConfig,
  BirdCoderCodeEngineModelConfigSyncResult,
} from '@sdkwork/birdcoder-types';

export const TEST_CODE_ENGINE_MODEL_CONFIG: BirdCoderCodeEngineModelConfig = {
  schemaVersion: 1,
  source: 'server',
  version: 'test-model-config',
  updatedAt: '2026-04-28T00:00:00.000Z',
  engines: {},
};

export function buildTestCodeEngineModelConfigSyncResult(
  config: BirdCoderCodeEngineModelConfig = TEST_CODE_ENGINE_MODEL_CONFIG,
): BirdCoderCodeEngineModelConfigSyncResult {
  return {
    action: 'noop',
    authoritativeSource: 'equal',
    config,
    shouldWriteLocal: false,
    shouldWriteServer: false,
  };
}
