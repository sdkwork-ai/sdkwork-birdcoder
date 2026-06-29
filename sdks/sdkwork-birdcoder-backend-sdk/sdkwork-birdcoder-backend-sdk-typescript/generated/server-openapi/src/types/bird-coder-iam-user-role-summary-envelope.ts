import type { BirdCoderIamUserRoleSummary } from './bird-coder-iam-user-role-summary';

export interface BirdCoderIamUserRoleSummaryEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
