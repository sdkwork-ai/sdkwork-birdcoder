import type { BirdCoderIamPolicySummary } from './bird-coder-iam-policy-summary';

export interface BirdCoderIamPolicySummaryEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
