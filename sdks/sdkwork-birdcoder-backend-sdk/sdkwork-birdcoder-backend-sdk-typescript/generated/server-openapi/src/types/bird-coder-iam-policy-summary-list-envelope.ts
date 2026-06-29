import type { BirdCoderIamPolicySummary } from './bird-coder-iam-policy-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderIamPolicySummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
