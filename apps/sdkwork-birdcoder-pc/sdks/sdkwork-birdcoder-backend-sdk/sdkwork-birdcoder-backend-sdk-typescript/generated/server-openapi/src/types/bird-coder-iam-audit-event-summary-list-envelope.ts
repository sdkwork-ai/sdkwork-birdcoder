import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderIamAuditEventSummary } from './bird-coder-iam-audit-event-summary';

export interface BirdCoderIamAuditEventSummaryListEnvelope {
  items: BirdCoderIamAuditEventSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
