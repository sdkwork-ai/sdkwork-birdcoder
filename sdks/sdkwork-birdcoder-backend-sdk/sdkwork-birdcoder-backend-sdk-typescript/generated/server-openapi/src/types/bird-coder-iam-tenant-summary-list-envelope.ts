import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderIamTenantSummary } from './bird-coder-iam-tenant-summary';

export interface BirdCoderIamTenantSummaryListEnvelope {
  items: BirdCoderIamTenantSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
