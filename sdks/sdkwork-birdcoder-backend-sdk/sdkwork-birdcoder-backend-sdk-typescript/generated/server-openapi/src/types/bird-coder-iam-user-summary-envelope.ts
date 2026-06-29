import type { BirdCoderIamUserSummary } from './bird-coder-iam-user-summary';

export interface BirdCoderIamUserSummaryEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
