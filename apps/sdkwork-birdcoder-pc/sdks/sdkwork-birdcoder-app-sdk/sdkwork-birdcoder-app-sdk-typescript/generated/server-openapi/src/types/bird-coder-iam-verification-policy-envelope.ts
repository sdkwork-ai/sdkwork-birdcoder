import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderIamVerificationPolicySummary } from './bird-coder-iam-verification-policy-summary';

export interface BirdCoderIamVerificationPolicyEnvelope {
  data: BirdCoderIamVerificationPolicySummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
