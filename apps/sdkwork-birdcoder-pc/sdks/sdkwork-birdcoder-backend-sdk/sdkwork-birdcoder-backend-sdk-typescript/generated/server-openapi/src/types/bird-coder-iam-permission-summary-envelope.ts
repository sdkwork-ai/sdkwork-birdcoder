import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderIamPermissionSummary } from './bird-coder-iam-permission-summary';

export interface BirdCoderIamPermissionSummaryEnvelope {
  data: BirdCoderIamPermissionSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
