import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderIamTenantMemberSummary } from './bird-coder-iam-tenant-member-summary';

export interface BirdCoderIamTenantMemberSummaryEnvelope {
  data: BirdCoderIamTenantMemberSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
