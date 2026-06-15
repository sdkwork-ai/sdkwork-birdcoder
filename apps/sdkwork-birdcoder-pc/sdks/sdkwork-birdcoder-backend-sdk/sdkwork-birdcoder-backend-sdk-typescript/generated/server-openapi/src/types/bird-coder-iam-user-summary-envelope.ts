import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderIamUserSummary } from './bird-coder-iam-user-summary';

export interface BirdCoderIamUserSummaryEnvelope {
  data: BirdCoderIamUserSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
