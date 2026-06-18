import type { BirdCoderCodeEngineModelConfig } from './bird-coder-code-engine-model-config';

export interface BirdCoderCodeEngineModelConfigSyncResult {
  action: 'noop' | 'overwrite-local' | 'push-local';
  authoritativeSource: 'equal' | 'local' | 'server';
  config: BirdCoderCodeEngineModelConfig;
  shouldWriteLocal: boolean;
  shouldWriteServer: boolean;
}
