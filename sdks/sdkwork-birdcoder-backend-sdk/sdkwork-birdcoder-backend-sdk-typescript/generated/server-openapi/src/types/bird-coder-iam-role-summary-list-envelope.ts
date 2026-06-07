import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderIamRoleSummary } from './bird-coder-iam-role-summary';

export interface BirdCoderIamRoleSummaryListEnvelope {
  items: BirdCoderIamRoleSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
