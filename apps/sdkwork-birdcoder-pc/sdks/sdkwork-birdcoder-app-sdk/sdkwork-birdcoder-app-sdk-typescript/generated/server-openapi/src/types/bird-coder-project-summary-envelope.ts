import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderProjectSummary } from './bird-coder-project-summary';

export interface BirdCoderProjectSummaryEnvelope {
  data: BirdCoderProjectSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
