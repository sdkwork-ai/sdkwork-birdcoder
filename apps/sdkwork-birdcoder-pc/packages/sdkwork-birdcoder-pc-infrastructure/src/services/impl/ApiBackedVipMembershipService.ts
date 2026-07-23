/**
 * BirdCoder VIP membership service adapter.
 *
 * Delegates to `@sdkwork/membership-service`, which is bootstrapped with the
 * BirdCoder global TokenManager. The membership service provider is configured
 * by `bootstrapBirdCoderMembershipSdk()` during shell bootstrap.
 *
 * This adapter binds the BirdCoder presentation port (`IVipMembershipService`)
 * to the sdkwork-membership owner service.
 */

import {
  getSdkworkMembershipService,
  hasSdkworkMembershipSession,
  unwrapSdkworkMembershipPageItems,
  unwrapSdkworkMembershipResponse,
  type SdkworkMembershipAppService,
} from '@sdkwork/membership-service';
import type {
  BirdCoderVipBenefit,
  BirdCoderVipCurrentMembership,
  BirdCoderVipMembershipState,
  BirdCoderVipPackage,
  BirdCoderVipPackageGroup,
  IVipMembershipService,
} from '../interfaces/IVipMembershipService.ts';

type ApiRecord = Record<string, unknown>;

export class ApiBackedVipMembershipService implements IVipMembershipService {
  async loadMembershipState(): Promise<BirdCoderVipMembershipState> {
    if (!hasSdkworkMembershipSession()) {
      return {
        current: null,
        isAuthenticated: false,
        packageGroups: [],
      };
    }

    const membershipService = getSdkworkMembershipService();
    const [currentEnvelope, packageGroupsEnvelope] = await Promise.all([
      membershipService.memberships.current.retrieve(),
      membershipService.memberships.packageGroups.list({}),
    ]);

    return {
      current: normalizeCurrentMembership(
        unwrapSdkworkMembershipResponse<ApiRecord | null>(currentEnvelope),
      ),
      isAuthenticated: true,
      packageGroups: unwrapSdkworkMembershipPageItems<ApiRecord>(
        packageGroupsEnvelope,
      ).map(normalizePackageGroup),
    };
  }
}

export function createEmptyBirdCoderVipMembershipState(): BirdCoderVipMembershipState {
  return {
    current: null,
    isAuthenticated: false,
    packageGroups: [],
  };
}

function normalizeCurrentMembership(
  value: ApiRecord | null | undefined,
): BirdCoderVipCurrentMembership {
  const record = value ?? {};
  return {
    benefits: readArray(record.benefits).map(normalizeBenefit),
    expiresAt: readNullableString(record.expiresAt),
    growthValue: readString(record.growthValue) || '0',
    organizationId: readOptionalString(record.organizationId),
    ownerUserId: readString(record.ownerUserId),
    planId: readNullableString(record.planId),
    planName: readString(record.planName) || 'Free',
    points: readString(record.points) || '0',
    remainingDays: readOptionalString(record.remainingDays),
    startedAt: readNullableString(record.startedAt),
    status: readString(record.status) || 'inactive',
    tenantId: readOptionalString(record.tenantId),
    totalDays: readOptionalString(record.totalDays),
    totalSpent: readString(record.totalSpent) || '0',
    upgradeGrowthValue: readString(record.upgradeGrowthValue) || '0',
  };
}

function normalizeBenefit(value: unknown): BirdCoderVipBenefit {
  const record = asRecord(value);
  return {
    benefitKey: readOptionalString(record.benefitKey),
    claimed: readBoolean(record.claimed),
    description: readOptionalString(record.description),
    icon: readOptionalString(record.icon),
    id: readString(record.id),
    name: readString(record.name),
    type: readOptionalString(record.type),
    usageLimit: readOptionalString(record.usageLimit),
    usedCount: readOptionalString(record.usedCount),
  };
}

function normalizePackage(value: unknown): BirdCoderVipPackage {
  const record = asRecord(value);
  return {
    description: readOptionalString(record.description),
    durationDays: readString(record.durationDays) || '0',
    id: readString(record.id),
    name: readString(record.name),
    originalPrice: readOptionalString(record.originalPrice),
    planName: readOptionalString(record.planName),
    pointAmount: readString(record.pointAmount) || '0',
    price: readString(record.price) || '0',
    recommended: readBoolean(record.recommended),
    sortWeight: readString(record.sortWeight) || '0',
    tags: readArray(record.tags).map((item) => readString(item)).filter(Boolean),
  };
}

function normalizePackageGroup(value: unknown): BirdCoderVipPackageGroup {
  const record = asRecord(value);
  return {
    description: readOptionalString(record.description),
    id: readString(record.id),
    name: readString(record.name),
    packages: readArray(record.packages).map(normalizePackage),
    sortWeight: readString(record.sortWeight) || '0',
  };
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): ApiRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as ApiRecord
    : {};
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '');
}

function readOptionalString(value: unknown): string | undefined {
  const text = readString(value).trim();
  return text || undefined;
}

function readNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  return readOptionalString(value);
}

function readBoolean(value: unknown): boolean {
  return value === true;
}
