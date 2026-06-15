import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderCoreRuntimeSummary } from './bird-coder-core-runtime-summary';

export interface BirdCoderCoreRuntimeSummaryEnvelope {
  data: BirdCoderCoreRuntimeSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
