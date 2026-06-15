import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderIamRolePermissionSummary } from './bird-coder-iam-role-permission-summary';

export interface BirdCoderIamRolePermissionSummaryEnvelope {
  data: BirdCoderIamRolePermissionSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
