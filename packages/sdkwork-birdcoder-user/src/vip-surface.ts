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
import type { User } from '@sdkwork/birdcoder-types';
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

function getBirdCoderVipPlanIncludedPoints(planId: BirdCoderVipPlan['id']): number {
  return BIRDCODER_VIP_PLAN_INCLUDED_POINTS[planId];
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

function findBirdCoderVipPlanById(planId: BirdCoderVipPlan['id']): BirdCoderVipPlan {
  return BIRDCODER_USER_VIP_PLANS.find((plan) => plan.id === planId) ?? BIRDCODER_USER_VIP_PLANS[0]!;
}

function createBirdCoderVipExpiryDate(days: number): string {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt.toISOString().slice(0, 10);
}

function resolveBirdCoderVipRemainingDays(renewAt: string): number | null {
  const normalizedRenewAt = renewAt.trim();
  if (!normalizedRenewAt || normalizedRenewAt.toLowerCase() === 'not scheduled') {
    return null;
  }

  const renewAtEpochMs = Date.parse(normalizedRenewAt);
  if (Number.isNaN(renewAtEpochMs)) {
    return null;
  }

  const remainingMs = renewAtEpochMs - Date.now();
  if (remainingMs <= 0) {
    return 0;
  }

  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}

function createBirdCoderVipBenefits(
  membership: BirdCoderVipMembershipSnapshot | null,
): SdkworkVipDashboardData['benefits'] {
  const plan = membership ? findBirdCoderVipPlanById(membership.planId) : null;
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
  const currentPlanId = membership?.planId ?? 'free';

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

  const resolvedMembership = membership ?? {
    creditsPerMonth: 0,
    planId: 'free',
    planTitle: 'Free',
    renewAt: 'Not scheduled',
    seats: 1,
    status: 'inactive',
  };
  const currentLevelValue =
    resolvedMembership.planId === 'team'
      ? 2
      : resolvedMembership.planId === 'pro'
        ? 1
        : 0;
  const isVip = resolvedMembership.status === 'active' || resolvedMembership.status === 'trialing';

  return {
    currentLevelName: resolvedMembership.planTitle,
    currentLevelValue,
    expireTime:
      resolvedMembership.renewAt.trim().toLowerCase() === 'not scheduled'
        ? undefined
        : resolvedMembership.renewAt,
    growthValue: resolvedMembership.creditsPerMonth,
    isAuthenticated: true,
    isVip,
    pointBalance: resolvedMembership.creditsPerMonth,
    remainingDays: resolveBirdCoderVipRemainingDays(resolvedMembership.renewAt),
    status: isVip ? 'vip' : 'free',
    totalSpent: null,
    upgradeGrowthValue: getBirdCoderVipPlanIncludedPoints('team'),
    vipPoints: resolvedMembership.creditsPerMonth,
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
  return {
    amountCny: findBirdCoderVipPlanById(membership.planId).monthlyPrice,
    durationDays: membership.planId === 'free' ? null : 30,
    orderId: `birdcoder-vip-${packId}-${Date.now()}`,
    packId,
    packName: membership.planTitle,
    status: 'completed',
    targetLevelId:
      membership.planId === 'team'
        ? 2
        : membership.planId === 'pro'
          ? 1
          : 0,
    targetLevelName: membership.planTitle,
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
      const plan = findBirdCoderVipPlanById(planId);
      const membership = await writeBirdCoderVipMembership({
        creditsPerMonth: getBirdCoderVipPlanIncludedPoints(planId),
        planId,
        planTitle: plan.title,
        renewAt: planId === 'free' ? 'Not scheduled' : createBirdCoderVipExpiryDate(30),
        seats: planId === 'team' ? 5 : 1,
        status: planId === 'free' ? 'inactive' : 'active',
      });

      return mapBirdCoderVipPurchaseResult(membership, input.packId);
    },

    async upgradeMembership(input) {
      if (!user) {
        throw new Error('Sign in through the unified appbase auth workflow before upgrading a membership.');
      }

      const planId = resolveBirdCoderVipPlanId(input.packId);
      const plan = findBirdCoderVipPlanById(planId);
      const membership = await writeBirdCoderVipMembership({
        creditsPerMonth: getBirdCoderVipPlanIncludedPoints(planId),
        planId,
        planTitle: plan.title,
        renewAt: planId === 'free' ? 'Not scheduled' : createBirdCoderVipExpiryDate(30),
        seats: planId === 'team' ? 5 : 1,
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
