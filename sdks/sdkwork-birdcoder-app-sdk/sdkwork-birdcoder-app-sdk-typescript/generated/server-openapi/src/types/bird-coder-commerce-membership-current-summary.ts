import type { BirdCoderCommerceMembershipBenefitSummary } from './bird-coder-commerce-membership-benefit-summary';

export interface BirdCoderCommerceMembershipCurrentSummary {
  tenantId?: string;
  organizationId?: string;
  ownerUserId: string;
  planId?: string | null;
  planName: string;
  status: string;
  startedAt?: string | null;
  expiresAt?: string | null;
  /** Java Long/BIGINT value serialized as an exact decimal string. */
  remainingDays?: string;
  /** Java Long/BIGINT value serialized as an exact decimal string. */
  totalDays?: string;
  /** Java Long/BIGINT value serialized as an exact decimal string. */
  totalSpent: string;
  /** Java Long/BIGINT value serialized as an exact decimal string. */
  points: string;
  /** Java Long/BIGINT value serialized as an exact decimal string. */
  growthValue: string;
  /** Java Long/BIGINT value serialized as an exact decimal string. */
  upgradeGrowthValue: string;
  benefits: BirdCoderCommerceMembershipBenefitSummary[];
}
