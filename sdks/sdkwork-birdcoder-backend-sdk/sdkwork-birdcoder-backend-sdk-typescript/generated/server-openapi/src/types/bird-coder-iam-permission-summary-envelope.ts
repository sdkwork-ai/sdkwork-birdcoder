import type { BirdCoderIamPermissionSummary } from './bird-coder-iam-permission-summary';

export interface BirdCoderIamPermissionSummaryEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
