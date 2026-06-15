import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderIamUserSummary } from './bird-coder-iam-user-summary';

export interface BirdCoderIamUserSummaryListEnvelope {
  items: BirdCoderIamUserSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
