import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderWorkspaceSummary } from './bird-coder-workspace-summary';

export interface BirdCoderWorkspaceSummaryEnvelope {
  data: BirdCoderWorkspaceSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
