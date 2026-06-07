import type { BirdCoderCommerceMembershipPackageSummary } from './bird-coder-commerce-membership-package-summary';

export interface BirdCoderCommerceMembershipPackageGroupSummary {
  id: string;
  name: string;
  description?: string;
  /** Java Long/BIGINT value serialized as an exact decimal string. */
  sortWeight: string;
  packages: BirdCoderCommerceMembershipPackageSummary[];
}
