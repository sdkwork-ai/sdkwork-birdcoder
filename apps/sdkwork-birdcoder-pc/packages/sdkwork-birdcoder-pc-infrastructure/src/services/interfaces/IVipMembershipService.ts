export interface BirdCoderVipBenefit {
  benefitKey?: string;
  claimed: boolean;
  description?: string;
  icon?: string;
  id: string;
  name: string;
  type?: string;
  usageLimit?: string;
  usedCount?: string;
}

export interface BirdCoderVipCurrentMembership {
  benefits: BirdCoderVipBenefit[];
  expiresAt?: string | null;
  growthValue: string;
  organizationId?: string;
  ownerUserId: string;
  planId?: string | null;
  planName: string;
  points: string;
  remainingDays?: string;
  startedAt?: string | null;
  status: string;
  tenantId?: string;
  totalDays?: string;
  totalSpent: string;
  upgradeGrowthValue: string;
}

export interface BirdCoderVipPackage {
  description?: string;
  durationDays: string;
  id: string;
  name: string;
  originalPrice?: string;
  planName?: string;
  pointAmount: string;
  price: string;
  recommended: boolean;
  sortWeight: string;
  tags: string[];
}

export interface BirdCoderVipPackageGroup {
  description?: string;
  id: string;
  name: string;
  packages: BirdCoderVipPackage[];
  sortWeight: string;
}

export interface BirdCoderVipMembershipState {
  current: BirdCoderVipCurrentMembership | null;
  isAuthenticated: boolean;
  packageGroups: BirdCoderVipPackageGroup[];
}

export interface IVipMembershipService {
  loadMembershipState(): Promise<BirdCoderVipMembershipState>;
}
