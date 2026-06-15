import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderWorkspaceMemberSummary } from './bird-coder-workspace-member-summary';

export interface BirdCoderWorkspaceMemberSummaryListEnvelope {
  items: BirdCoderWorkspaceMemberSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
