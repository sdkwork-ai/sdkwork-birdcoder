import { createJsonRecordRepository } from '@sdkwork/birdcoder-workbench-storage';
import {
  BIRDCODER_APPBASE_USER_PROFILE_STORAGE_BINDING,
  BIRDCODER_APPBASE_VIP_USER_STORAGE_BINDING,
  stringifyBirdCoderLongInteger,
  type BirdCoderLongIntegerString,
} from '@sdkwork/birdcoder-types';

export interface BirdCoderUserProfileSnapshot {
  bio: string;
  company: string;
  displayName: string;
  location: string;
  website: string;
}

export interface BirdCoderVipMembershipSnapshot {
  vipLevelId?: string;
  pointBalance: BirdCoderLongIntegerString;
  totalRechargedPoints: BirdCoderLongIntegerString;
  validFrom?: string;
  validTo?: string;
  lastActiveTime?: string;
  remark?: string;
  status: 'inactive' | 'trialing' | 'active';
}

export const DEFAULT_BIRDCODER_USER_PROFILE: BirdCoderUserProfileSnapshot = {
  bio: 'Build and ship professional AI-native development systems with unified engine governance.',
  company: 'SDKWork',
  displayName: '',
  location: 'Shanghai',
  website: 'https://sdkwork.com',
};

export const DEFAULT_BIRDCODER_VIP_MEMBERSHIP: BirdCoderVipMembershipSnapshot = {
  pointBalance: '0',
  totalRechargedPoints: '0',
  status: 'inactive',
};

function normalizeBirdCoderUserProfile(
  value: unknown,
  fallback: BirdCoderUserProfileSnapshot,
): BirdCoderUserProfileSnapshot {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const candidate = value as Partial<BirdCoderUserProfileSnapshot>;
  return {
    bio: candidate.bio?.trim() || fallback.bio,
    company: candidate.company?.trim() || fallback.company,
    displayName: candidate.displayName?.trim() || fallback.displayName,
    location: candidate.location?.trim() || fallback.location,
    website: candidate.website?.trim() || fallback.website,
  };
}

function normalizeBirdCoderLongIntegerString(
  value: unknown,
  fallback: BirdCoderLongIntegerString,
): BirdCoderLongIntegerString {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    return fallback;
  }

  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    throw new Error('BirdCoder VIP Long value must be an exact decimal string.');
  }

  try {
    return stringifyBirdCoderLongInteger(value);
  } catch (error) {
    throw new Error(
      `BirdCoder VIP Long value is invalid: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function normalizeBirdCoderVipMembership(
  value: unknown,
  fallback: BirdCoderVipMembershipSnapshot,
): BirdCoderVipMembershipSnapshot {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const candidate = value as Partial<BirdCoderVipMembershipSnapshot>;
  return {
    ...(candidate.vipLevelId?.trim() ? { vipLevelId: candidate.vipLevelId.trim() } : {}),
    pointBalance: normalizeBirdCoderLongIntegerString(
      candidate.pointBalance,
      fallback.pointBalance,
    ),
    totalRechargedPoints: normalizeBirdCoderLongIntegerString(
      candidate.totalRechargedPoints,
      fallback.totalRechargedPoints,
    ),
    ...(candidate.validFrom?.trim() ? { validFrom: candidate.validFrom.trim() } : {}),
    ...(candidate.validTo?.trim() ? { validTo: candidate.validTo.trim() } : {}),
    ...(candidate.lastActiveTime?.trim()
      ? { lastActiveTime: candidate.lastActiveTime.trim() }
      : {}),
    ...(candidate.remark?.trim() ? { remark: candidate.remark.trim() } : {}),
    status:
      candidate.status === 'inactive' ||
      candidate.status === 'trialing' ||
      candidate.status === 'active'
        ? candidate.status
        : fallback.status,
  };
}

const birdCoderUserProfileRepository = createJsonRecordRepository<BirdCoderUserProfileSnapshot>({
  binding: BIRDCODER_APPBASE_USER_PROFILE_STORAGE_BINDING,
  fallback: DEFAULT_BIRDCODER_USER_PROFILE,
  normalize: normalizeBirdCoderUserProfile,
});

const birdCoderVipMembershipRepository = createJsonRecordRepository<BirdCoderVipMembershipSnapshot>({
  binding: BIRDCODER_APPBASE_VIP_USER_STORAGE_BINDING,
  fallback: DEFAULT_BIRDCODER_VIP_MEMBERSHIP,
  normalize: normalizeBirdCoderVipMembership,
});

export function getBirdCoderUserProfileRepository() {
  return birdCoderUserProfileRepository;
}

export function getBirdCoderVipMembershipRepository() {
  return birdCoderVipMembershipRepository;
}
