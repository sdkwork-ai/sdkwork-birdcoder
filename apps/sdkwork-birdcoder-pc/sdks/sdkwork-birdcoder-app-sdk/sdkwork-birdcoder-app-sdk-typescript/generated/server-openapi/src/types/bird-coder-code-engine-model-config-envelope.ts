import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderCodeEngineModelConfig } from './bird-coder-code-engine-model-config';

export interface BirdCoderCodeEngineModelConfigEnvelope {
  data: BirdCoderCodeEngineModelConfig;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
