import type { BirdCoderIamPermissionSummary } from './bird-coder-iam-permission-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderIamPermissionSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
