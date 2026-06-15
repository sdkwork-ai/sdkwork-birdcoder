import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderCodeEngineModelConfigSyncResult } from './bird-coder-code-engine-model-config-sync-result';

export interface BirdCoderCodeEngineModelConfigSyncResultEnvelope {
  data: BirdCoderCodeEngineModelConfigSyncResult;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
