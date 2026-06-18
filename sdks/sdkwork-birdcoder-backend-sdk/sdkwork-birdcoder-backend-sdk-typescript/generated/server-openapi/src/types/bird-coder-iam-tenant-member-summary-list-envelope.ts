import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderIamTenantMemberSummary } from './bird-coder-iam-tenant-member-summary';

export interface BirdCoderIamTenantMemberSummaryListEnvelope {
  items: BirdCoderIamTenantMemberSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
