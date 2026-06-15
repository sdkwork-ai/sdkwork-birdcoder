import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderCodingSessionSummary } from './bird-coder-coding-session-summary';

export interface BirdCoderCodingSessionSummaryEnvelope {
  data: BirdCoderCodingSessionSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
