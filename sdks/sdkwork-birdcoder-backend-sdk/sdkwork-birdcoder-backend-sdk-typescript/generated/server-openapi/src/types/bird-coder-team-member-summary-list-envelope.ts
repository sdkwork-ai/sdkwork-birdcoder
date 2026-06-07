import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderTeamMemberSummary } from './bird-coder-team-member-summary';

export interface BirdCoderTeamMemberSummaryListEnvelope {
  items: BirdCoderTeamMemberSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
