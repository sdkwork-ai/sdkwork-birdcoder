import type { BirdCoderIamUserSummary } from './bird-coder-iam-user-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderIamUserSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
