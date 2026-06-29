import type { BirdCoderIamVerificationPolicySummary } from './bird-coder-iam-verification-policy-summary';

export interface BirdCoderIamVerificationPolicyEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
