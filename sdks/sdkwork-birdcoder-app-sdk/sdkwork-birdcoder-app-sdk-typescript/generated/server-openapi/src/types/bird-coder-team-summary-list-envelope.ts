import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderTeamSummary } from './bird-coder-team-summary';

export interface BirdCoderTeamSummaryListEnvelope {
  items: BirdCoderTeamSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
