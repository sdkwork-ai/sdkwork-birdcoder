import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderIamPermissionSummary } from './bird-coder-iam-permission-summary';

export interface BirdCoderIamPermissionSummaryListEnvelope {
  items: BirdCoderIamPermissionSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
