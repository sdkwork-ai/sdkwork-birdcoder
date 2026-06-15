import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderIamRoleSummary } from './bird-coder-iam-role-summary';

export interface BirdCoderIamRoleSummaryEnvelope {
  data: BirdCoderIamRoleSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
