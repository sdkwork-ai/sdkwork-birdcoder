export interface BirdCoderCommerceMembershipBenefitSummary {
  id: string;
  name: string;
  benefitKey?: string;
  type?: string;
  description?: string;
  icon?: string;
  claimed: boolean;
  /** Java Long/BIGINT value serialized as an exact decimal string. */
  usageLimit?: string;
  /** Java Long/BIGINT value serialized as an exact decimal string. */
  usedCount?: string;
}
