import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderIamSessionSummary } from './bird-coder-iam-session-summary';

export interface BirdCoderIamSessionEnvelope {
  data: BirdCoderIamSessionSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
