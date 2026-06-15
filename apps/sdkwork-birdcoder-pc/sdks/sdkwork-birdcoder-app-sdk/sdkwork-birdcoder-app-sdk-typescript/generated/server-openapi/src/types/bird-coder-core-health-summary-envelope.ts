import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderCoreHealthSummary } from './bird-coder-core-health-summary';

export interface BirdCoderCoreHealthSummaryEnvelope {
  data: BirdCoderCoreHealthSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
