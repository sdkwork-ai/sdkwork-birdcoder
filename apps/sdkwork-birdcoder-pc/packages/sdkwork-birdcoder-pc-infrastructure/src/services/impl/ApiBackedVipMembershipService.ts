import type { BirdcoderAppSdkClient } from '@sdkwork/birdcoder-app-sdk';
import type {
  BirdCoderVipBenefit,
  BirdCoderVipCurrentMembership,
  BirdCoderVipMembershipState,
  BirdCoderVipPackage,
  BirdCoderVipPackageGroup,
  IVipMembershipService,
} from '../interfaces/IVipMembershipService.ts';

type ApiRecord = Record<string, unknown>;

export interface ApiBackedVipMembershipServiceOptions {
  appClient: BirdcoderAppSdkClient;
}

const EMPTY_VIP_STATE: BirdCoderVipMembershipState = {
  current: null,
  isAuthenticated: false,
  packageGroups: [],
};

export class ApiBackedVipMembershipService implements IVipMembershipService {
  private readonly appClient: BirdcoderAppSdkClient;

  constructor({ appClient }: ApiBackedVipMembershipServiceOptions) {
    this.appClient = appClient;
  }

  async loadMembershipState(): Promise<BirdCoderVipMembershipState> {
    const [currentEnvelope, packageGroupsEnvelope] = await Promise.all([
      this.appClient.commerce.memberships.current.retrieve(),
      this.appClient.commerce.memberships.packageGroups.list(),
    ]);

    return {
      current: normalizeCurrentMembership(readRecord(currentEnvelope, 'data')),
      isAuthenticated: true,
      packageGroups: readItems(packageGroupsEnvelope).map(normalizePackageGroup),
    };
  }
}

export function createEmptyBirdCoderVipMembershipState(): BirdCoderVipMembershipState {
  return { ...EMPTY_VIP_STATE, packageGroups: [] };
}

function normalizeCurrentMembership(value: ApiRecord): BirdCoderVipCurrentMembership {
  return {
    benefits: readArray(value.benefits).map(normalizeBenefit),
    expiresAt: readNullableString(value.expiresAt),
    growthValue: readString(value.growthValue) || '0',
    organizationId: readOptionalString(value.organizationId),
    ownerUserId: readString(value.ownerUserId),
    planId: readNullableString(value.planId),
    planName: readString(value.planName) || 'Free',
    points: readString(value.points) || '0',
    remainingDays: readOptionalString(value.remainingDays),
    startedAt: readNullableString(value.startedAt),
    status: readString(value.status) || 'inactive',
    tenantId: readOptionalString(value.tenantId),
    totalDays: readOptionalString(value.totalDays),
    totalSpent: readString(value.totalSpent) || '0',
    upgradeGrowthValue: readString(value.upgradeGrowthValue) || '0',
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

function readRecord(value: unknown, key: string): ApiRecord {
  return asRecord(asRecord(value)[key]);
}

function readItems(value: unknown): unknown[] {
  return readArray(asRecord(value).items);
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
  return typeof value === 'string' ? value : '';
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
