import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderIamTenantSummary } from './bird-coder-iam-tenant-summary';

export interface BirdCoderIamTenantSummaryEnvelope {
  data: BirdCoderIamTenantSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
