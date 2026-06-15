import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderIamRolePermissionSummary } from './bird-coder-iam-role-permission-summary';

export interface BirdCoderIamRolePermissionSummaryListEnvelope {
  items: BirdCoderIamRolePermissionSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
