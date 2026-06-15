import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderIamUserRoleSummary } from './bird-coder-iam-user-role-summary';

export interface BirdCoderIamUserRoleSummaryEnvelope {
  data: BirdCoderIamUserRoleSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
