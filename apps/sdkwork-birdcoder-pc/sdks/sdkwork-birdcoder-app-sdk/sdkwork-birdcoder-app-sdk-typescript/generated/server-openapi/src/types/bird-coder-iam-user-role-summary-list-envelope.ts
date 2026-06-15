import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderIamUserRoleSummary } from './bird-coder-iam-user-role-summary';

export interface BirdCoderIamUserRoleSummaryListEnvelope {
  items: BirdCoderIamUserRoleSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
