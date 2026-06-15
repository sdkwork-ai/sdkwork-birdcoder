import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderCommerceMembershipPackageGroupSummary } from './bird-coder-commerce-membership-package-group-summary';

export interface BirdCoderCommerceMembershipPackageGroupSummaryListEnvelope {
  items: BirdCoderCommerceMembershipPackageGroupSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
