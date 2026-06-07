import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderCommerceMembershipCurrentSummary } from './bird-coder-commerce-membership-current-summary';

export interface BirdCoderCommerceMembershipCurrentEnvelope {
  data: BirdCoderCommerceMembershipCurrentSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
