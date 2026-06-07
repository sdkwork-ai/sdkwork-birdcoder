import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderIamApiKeySummary } from './bird-coder-iam-api-key-summary';

export interface BirdCoderIamApiKeySummaryListEnvelope {
  items: BirdCoderIamApiKeySummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
