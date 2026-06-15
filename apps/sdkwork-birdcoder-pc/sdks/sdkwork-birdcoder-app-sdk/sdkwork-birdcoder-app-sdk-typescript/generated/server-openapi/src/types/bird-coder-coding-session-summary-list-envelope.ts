import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderCodingSessionSummary } from './bird-coder-coding-session-summary';

export interface BirdCoderCodingSessionSummaryListEnvelope {
  items: BirdCoderCodingSessionSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
