import {
  createSdkworkVipController,
  createSdkworkVipService,
  type CreateSdkworkVipControllerOptions,
  type SdkworkVipController,
  type SdkworkVipService,
} from '@sdkwork/vip-pc-react';
import type {
  BirdCoderUserCenterMembershipSummary,
  User,
} from '@sdkwork/birdcoder-types';
import { createBirdCoderRuntimeUserCenterClient } from './user-center-runtime.ts';

function requireRuntimeUserCenterClient() {
  const runtimeClient = createBirdCoderRuntimeUserCenterClient();
  if (!runtimeClient) {
    throw new Error(
      'BirdCoder user-center runtime client is unavailable; check the appbase IAM runtime binding.',
    );
  }

  return runtimeClient;
}

function createUnsupportedVipCatalogMethod(name: string) {
  return async () => {
    throw new Error(
      `${name} is not exposed by the active appbase user-center runtime.`,
    );
  };
}

function toNullableDisplayNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number(value);
    return Number.isSafeInteger(parsedValue) ? parsedValue : null;
  }

  return null;
}

function createEmptyWalletAccount() {
  return {
    availablePoints: 0,
    cashAvailable: 0,
    cashFrozen: 0,
    experience: null,
    frozenPoints: 0,
    hasPayPassword: false,
    level: null,
    tokenBalance: 0,
    totalEarned: 0,
    totalPoints: 0,
    totalSpent: 0,
  };
}

export interface CreateBirdCoderVipServiceOptions {
  user: User | null;
}

export function createBirdCoderVipService({
  user,
}: CreateBirdCoderVipServiceOptions): SdkworkVipService {
  return createSdkworkVipService({
    getClient() {
      const runtimeClient = requireRuntimeUserCenterClient();

      return {
        vip: {
          listVipBenefits: createUnsupportedVipCatalogMethod('vip.listVipBenefits'),
          listVipLevels: createUnsupportedVipCatalogMethod('vip.listVipLevels'),
          renew: (payload) =>
            runtimeClient.updateMembership<
              BirdCoderUserCenterMembershipSummary,
              Record<string, unknown>
            >(payload),
          upgrade: (payload) =>
            runtimeClient.updateMembership<
              BirdCoderUserCenterMembershipSummary,
              Record<string, unknown>
            >(payload),
        },
      };
    },
    getSessionTokens() {
      return {
        authToken: user ? user.id : undefined,
      };
    },
    walletService: {
      async getOverview() {
        if (!user) {
          const emptyDashboard = createSdkworkVipService().getEmptyDashboard();

          return {
            account: createEmptyWalletAccount(),
            isAuthenticated: false,
            membership: {
              expireTime: undefined,
              growthValue: null,
              isVip: false,
              level: null,
              pointBalance: null,
              remainingDays: null,
              totalSpent: null,
              upgradeGrowthValue: null,
              vipLevelName: undefined,
              vipPoints: null,
            },
            vipPacks: emptyDashboard.plans.map((plan) => ({
              description: plan.description,
              durationDays: plan.durationDays,
              id: plan.packId,
              levelName: plan.levelName,
              name: plan.name,
              originalPriceCny: plan.originalPriceCny,
              points: plan.includedPoints,
              priceCny: plan.priceCny,
              recommended: plan.recommended,
              sortWeight: null,
              tags: plan.tags,
            })),
            pointsToCashRate: null,
            rechargePacks: [],
            transactions: [],
          };
        }

        const membership = await requireRuntimeUserCenterClient()
          .getMembership<BirdCoderUserCenterMembershipSummary>();
        const isVip =
          membership.status === 'active' || membership.status === 'trialing';
        const pointBalance = toNullableDisplayNumber(membership.pointBalance);

        return {
          account: createEmptyWalletAccount(),
          isAuthenticated: true,
          membership: {
            expireTime: membership.validTo,
            growthValue: pointBalance,
            isVip,
            level: membership.vipLevelId ? Number(membership.vipLevelId) : null,
            pointBalance,
            remainingDays: null,
            totalSpent: null,
            upgradeGrowthValue: null,
            vipLevelName: membership.vipLevelId
              ? `VIP ${membership.vipLevelId}`
              : undefined,
            vipPoints: pointBalance,
          },
          pointsToCashRate: null,
          rechargePacks: [],
          transactions: [],
          vipPacks: [],
        };
      },
    },
  });
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
