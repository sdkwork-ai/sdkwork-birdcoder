import type { BirdCoderIamRolePermissionSummary } from './bird-coder-iam-role-permission-summary';

export interface BirdCoderIamRolePermissionSummaryEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
