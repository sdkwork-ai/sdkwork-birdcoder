import {
  createSdkworkVipController,
  type CreateSdkworkVipControllerOptions,
  type SdkworkVipController,
  type SdkworkVipDashboardData,
  type SdkworkVipLevel,
  type SdkworkVipPlan,
  type SdkworkVipPurchaseResult,
  type SdkworkVipService,
  type SdkworkVipSummary,
} from '@sdkwork/vip-pc-react';
import {
  stringifyBirdCoderLongInteger,
  type BirdCoderLongIntegerString,
  type User,
} from '@sdkwork/birdcoder-types';
import {
  readBirdCoderVipMembership,
  writeBirdCoderVipMembership,
} from './storage.ts';
import {
  BIRDCODER_USER_VIP_PLANS,
  type BirdCoderVipMembershipSnapshot,
  type BirdCoderVipPlan,
} from './vip.ts';

const BIRDCODER_VIP_PLAN_INCLUDED_POINTS: Record<BirdCoderVipPlan['id'], number> = {
  free: 0,
  pro: 1500,
  team: 8000,
};

const BIRDCODER_VIP_PLAN_PACK_IDS: Record<BirdCoderVipPlan['id'], number> = {
  free: 1001,
  pro: 1002,
  team: 1003,
};

const BIRDCODER_VIP_PLAN_LEVEL_IDS: Record<BirdCoderVipPlan['id'], string | undefined> = {
  free: undefined,
  pro: '1',
  team: '2',
};

function getBirdCoderVipPlanIncludedPoints(planId: BirdCoderVipPlan['id']): number {
  return BIRDCODER_VIP_PLAN_INCLUDED_POINTS[planId];
}

function toBirdCoderLongIntegerString(value: number): BirdCoderLongIntegerString {
  return stringifyBirdCoderLongInteger(value);
}

function getBirdCoderVipPlanPackId(planId: BirdCoderVipPlan['id']): number {
  return BIRDCODER_VIP_PLAN_PACK_IDS[planId];
}

function resolveBirdCoderVipPlanId(packId: number): BirdCoderVipPlan['id'] {
  return (
    (Object.entries(BIRDCODER_VIP_PLAN_PACK_IDS).find(([, value]) => value === packId)?.[0] as
      | BirdCoderVipPlan['id']
      | undefined)
    ?? 'free'
  );
}

function resolveBirdCoderVipPlanIdFromMembership(
  membership: BirdCoderVipMembershipSnapshot | null,
): BirdCoderVipPlan['id'] {
  const vipLevelId = membership?.vipLevelId?.trim();
  if (vipLevelId === BIRDCODER_VIP_PLAN_LEVEL_IDS.team) {
    return 'team';
  }
  if (vipLevelId === BIRDCODER_VIP_PLAN_LEVEL_IDS.pro) {
    return 'pro';
  }
  return 'free';
}

function findBirdCoderVipPlanById(planId: BirdCoderVipPlan['id']): BirdCoderVipPlan {
  return BIRDCODER_USER_VIP_PLANS.find((plan) => plan.id === planId) ?? BIRDCODER_USER_VIP_PLANS[0]!;
}

function createBirdCoderVipExpiryDate(days: number): string {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt.toISOString().slice(0, 10);
}

function resolveBirdCoderVipRemainingDays(validTo: string | undefined): number | null {
  const normalizedValidTo = validTo?.trim();
  if (!normalizedValidTo) {
    return null;
  }

  const validToEpochMs = Date.parse(normalizedValidTo);
  if (Number.isNaN(validToEpochMs)) {
    return null;
  }

  const remainingMs = validToEpochMs - Date.now();
  if (remainingMs <= 0) {
    return 0;
  }

  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}

function resolveSdkworkVipDisplayNumber(value: BirdCoderLongIntegerString): number | null {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  const numericValue = Number(normalizedValue);
  return Number.isSafeInteger(numericValue) ? numericValue : null;
}

function createBirdCoderVipBenefits(
  membership: BirdCoderVipMembershipSnapshot | null,
): SdkworkVipDashboardData['benefits'] {
  const plan = membership
    ? findBirdCoderVipPlanById(resolveBirdCoderVipPlanIdFromMembership(membership))
    : null;
  if (!plan) {
    return [];
  }

  return plan.highlights.map((highlight, index) => ({
    claimed: membership.status === 'active' || membership.status === 'trialing',
    description: highlight,
    id: `birdcoder-vip-benefit-${plan.id}-${index + 1}`,
    name: highlight,
    type: 'feature',
    usageLimit: null,
    usedCount: null,
  }));
}

function createBirdCoderVipLevels(
  membership: BirdCoderVipMembershipSnapshot | null,
): SdkworkVipLevel[] {
  const currentPlanId = resolveBirdCoderVipPlanIdFromMembership(membership);

  return BIRDCODER_USER_VIP_PLANS.map((plan) => ({
    description: plan.description,
    id: `birdcoder-vip-level-${plan.id}`,
    isCurrent: plan.id === currentPlanId,
    levelValue: plan.id === 'free' ? 0 : plan.id === 'pro' ? 1 : 2,
    name: plan.title,
    requiredPoints: getBirdCoderVipPlanIncludedPoints(plan.id),
  }));
}

function createBirdCoderVipPlans(): SdkworkVipPlan[] {
  return BIRDCODER_USER_VIP_PLANS.map((plan) => ({
    description: plan.description,
    durationDays: plan.id === 'free' ? null : 30,
    id: `birdcoder-vip-plan-${plan.id}`,
    includedPoints: getBirdCoderVipPlanIncludedPoints(plan.id),
    levelName: plan.title,
    name: plan.title,
    originalPriceCny: null,
    packId: getBirdCoderVipPlanPackId(plan.id),
    priceCny: plan.monthlyPrice,
    recommended: plan.id === 'pro',
    tags:
      plan.id === 'team'
        ? ['Shared', 'Governance']
        : plan.id === 'pro'
          ? ['Recommended', 'Desktop']
          : ['Local', 'Starter'],
  }));
}

function createBirdCoderVipSummary(
  membership: BirdCoderVipMembershipSnapshot | null,
  user: User | null,
): SdkworkVipSummary {
  if (!user) {
    return {
      currentLevelName: 'Guest',
      currentLevelValue: null,
      growthValue: null,
      isAuthenticated: false,
      isVip: false,
      pointBalance: null,
      remainingDays: null,
      status: 'guest',
      totalSpent: null,
      upgradeGrowthValue: null,
      vipPoints: null,
    };
  }

  const resolvedMembership: BirdCoderVipMembershipSnapshot = membership ?? {
    pointBalance: '0',
    totalRechargedPoints: '0',
    status: 'inactive',
  };
  const currentPlanId = resolveBirdCoderVipPlanIdFromMembership(resolvedMembership);
  const currentPlan = findBirdCoderVipPlanById(currentPlanId);
  const currentLevelValue =
    currentPlanId === 'team'
      ? 2
      : currentPlanId === 'pro'
        ? 1
        : 0;
  const isVip = resolvedMembership.status === 'active' || resolvedMembership.status === 'trialing';
  const pointBalance = resolveSdkworkVipDisplayNumber(resolvedMembership.pointBalance);

  return {
    currentLevelName: currentPlan.title,
    currentLevelValue,
    expireTime: resolvedMembership.validTo,
    growthValue: pointBalance,
    isAuthenticated: true,
    isVip,
    pointBalance,
    remainingDays: resolveBirdCoderVipRemainingDays(resolvedMembership.validTo),
    status: isVip ? 'vip' : 'free',
    totalSpent: null,
    upgradeGrowthValue: getBirdCoderVipPlanIncludedPoints('team'),
    vipPoints: pointBalance,
  };
}

function createBirdCoderVipEmptyDashboard(user: User | null): SdkworkVipDashboardData {
  return {
    benefits: [],
    levels: createBirdCoderVipLevels(null),
    plans: createBirdCoderVipPlans(),
    summary: createBirdCoderVipSummary(null, user),
  };
}

function mapBirdCoderVipPurchaseResult(
  membership: BirdCoderVipMembershipSnapshot,
  packId: number,
): SdkworkVipPurchaseResult {
  const planId = resolveBirdCoderVipPlanIdFromMembership(membership);
  const plan = findBirdCoderVipPlanById(planId);
  return {
    amountCny: plan.monthlyPrice,
    durationDays: planId === 'free' ? null : 30,
    orderId: `birdcoder-vip-${packId}-${Date.now()}`,
    packId,
    packName: plan.title,
    status: 'completed',
    targetLevelId:
      planId === 'team'
        ? 2
        : planId === 'pro'
          ? 1
          : 0,
    targetLevelName: plan.title,
  };
}

export interface CreateBirdCoderVipServiceOptions {
  user: User | null;
}

export function createBirdCoderVipService({
  user,
}: CreateBirdCoderVipServiceOptions): SdkworkVipService {
  return {
    async getDashboard() {
      const membership = user ? await readBirdCoderVipMembership() : null;
      return {
        benefits: createBirdCoderVipBenefits(membership),
        levels: createBirdCoderVipLevels(membership),
        plans: createBirdCoderVipPlans(),
        summary: createBirdCoderVipSummary(membership, user),
      };
    },

    getEmptyDashboard() {
      return createBirdCoderVipEmptyDashboard(user);
    },

    async renewMembership(input) {
      if (!user) {
        throw new Error('Sign in through the unified appbase auth workflow before renewing a membership.');
      }

      const planId = resolveBirdCoderVipPlanId(input.packId);
      const membership = await writeBirdCoderVipMembership({
        ...(BIRDCODER_VIP_PLAN_LEVEL_IDS[planId]
          ? { vipLevelId: BIRDCODER_VIP_PLAN_LEVEL_IDS[planId] }
          : {}),
        pointBalance: toBirdCoderLongIntegerString(getBirdCoderVipPlanIncludedPoints(planId)),
        totalRechargedPoints: toBirdCoderLongIntegerString(getBirdCoderVipPlanIncludedPoints(planId)),
        ...(planId === 'free' ? {} : { validTo: createBirdCoderVipExpiryDate(30) }),
        lastActiveTime: new Date().toISOString(),
        status: planId === 'free' ? 'inactive' : 'active',
      });

      return mapBirdCoderVipPurchaseResult(membership, input.packId);
    },

    async upgradeMembership(input) {
      if (!user) {
        throw new Error('Sign in through the unified appbase auth workflow before upgrading a membership.');
      }

      const planId = resolveBirdCoderVipPlanId(input.packId);
      const membership = await writeBirdCoderVipMembership({
        ...(BIRDCODER_VIP_PLAN_LEVEL_IDS[planId]
          ? { vipLevelId: BIRDCODER_VIP_PLAN_LEVEL_IDS[planId] }
          : {}),
        pointBalance: toBirdCoderLongIntegerString(getBirdCoderVipPlanIncludedPoints(planId)),
        totalRechargedPoints: toBirdCoderLongIntegerString(getBirdCoderVipPlanIncludedPoints(planId)),
        ...(planId === 'free' ? {} : { validTo: createBirdCoderVipExpiryDate(30) }),
        lastActiveTime: new Date().toISOString(),
        status: planId === 'free' ? 'inactive' : 'active',
      });

      return mapBirdCoderVipPurchaseResult(membership, input.packId);
    },
  };
}

export interface CreateBirdCoderVipControllerOptions
  extends Omit<CreateSdkworkVipControllerOptions, 'service'> {
  user: User | null;
}

export function createBirdCoderVipController(
  options: CreateBirdCoderVipControllerOptions,
): SdkworkVipController {
  return createSdkworkVipController({
    ...options,
    service: createBirdCoderVipService({
      user: options.user,
    }),
  });
}
