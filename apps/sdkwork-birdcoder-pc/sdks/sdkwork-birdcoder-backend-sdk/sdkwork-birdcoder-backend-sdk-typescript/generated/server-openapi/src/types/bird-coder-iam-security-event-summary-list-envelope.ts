import type { BirdCoderIamSecurityEventSummary } from './bird-coder-iam-security-event-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderIamSecurityEventSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
