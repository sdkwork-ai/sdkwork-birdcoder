import type { BirdCoderIamAuditEventSummary } from './bird-coder-iam-audit-event-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderIamAuditEventSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
