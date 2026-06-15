import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderIamPolicySummary } from './bird-coder-iam-policy-summary';

export interface BirdCoderIamPolicySummaryEnvelope {
  data: BirdCoderIamPolicySummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
