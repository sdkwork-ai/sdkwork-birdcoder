import type { BirdCoderIamRoleSummary } from './bird-coder-iam-role-summary';

export interface BirdCoderIamRoleSummaryEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
