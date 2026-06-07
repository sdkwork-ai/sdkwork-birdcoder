import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderWorkspaceMemberSummary } from './bird-coder-workspace-member-summary';

export interface BirdCoderWorkspaceMemberSummaryEnvelope {
  data: BirdCoderWorkspaceMemberSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
