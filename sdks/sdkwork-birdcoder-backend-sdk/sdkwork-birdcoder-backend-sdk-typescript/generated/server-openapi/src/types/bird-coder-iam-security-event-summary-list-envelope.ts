import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderIamSecurityEventSummary } from './bird-coder-iam-security-event-summary';

export interface BirdCoderIamSecurityEventSummaryListEnvelope {
  items: BirdCoderIamSecurityEventSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
