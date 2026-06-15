import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderEngineCapabilityMatrix } from './bird-coder-engine-capability-matrix';

export interface BirdCoderEngineCapabilityMatrixEnvelope {
  data: BirdCoderEngineCapabilityMatrix;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
