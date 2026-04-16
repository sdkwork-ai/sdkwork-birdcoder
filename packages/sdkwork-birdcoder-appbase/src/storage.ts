import {
  createJsonRecordRepository,
} from '@sdkwork/birdcoder-commons/storage/dataKernel';
import {
  BIRDCODER_APPBASE_USER_PROFILE_STORAGE_BINDING,
  BIRDCODER_APPBASE_VIP_SUBSCRIPTION_STORAGE_BINDING,
} from '@sdkwork/birdcoder-types/storageBindings';
import {
  BIRDCODER_APPBASE_USER_PROFILE_KEY,
  BIRDCODER_APPBASE_USER_STORAGE_SCOPE,
} from './user.ts';
import {
  BIRDCODER_APPBASE_VIP_MEMBERSHIP_KEY,
  BIRDCODER_APPBASE_VIP_STORAGE_SCOPE,
  type BirdCoderVipMembershipSnapshot,
} from './vip.ts';

export interface BirdCoderUserProfileSnapshot {
  bio: string;
  company: string;
  location: string;
  website: string;
}

export const DEFAULT_BIRDCODER_USER_PROFILE: BirdCoderUserProfileSnapshot = {
  bio: 'Build and ship professional AI-native development systems with unified engine governance.',
  company: 'SDKWork',
  location: 'Shanghai',
  website: 'https://sdkwork.com',
};

export const DEFAULT_BIRDCODER_VIP_MEMBERSHIP: BirdCoderVipMembershipSnapshot = {
  creditsPerMonth: 0,
  planId: 'free',
  planTitle: 'Free',
  renewAt: 'Not scheduled',
  seats: 1,
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
    location: candidate.location?.trim() || fallback.location,
    website: candidate.website?.trim() || fallback.website,
  };
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
    creditsPerMonth:
      typeof candidate.creditsPerMonth === 'number'
        ? candidate.creditsPerMonth
        : fallback.creditsPerMonth,
    planId:
      candidate.planId === 'free' || candidate.planId === 'pro' || candidate.planId === 'team'
        ? candidate.planId
        : fallback.planId,
    planTitle: candidate.planTitle?.trim() || fallback.planTitle,
    renewAt: candidate.renewAt?.trim() || fallback.renewAt,
    seats: typeof candidate.seats === 'number' ? candidate.seats : fallback.seats,
    status:
      candidate.status === 'inactive' ||
      candidate.status === 'trialing' ||
      candidate.status === 'active'
        ? candidate.status
        : fallback.status,
  };
}

const birdCoderUserProfileRepository = createJsonRecordRepository<BirdCoderUserProfileSnapshot>({
  binding: {
    ...BIRDCODER_APPBASE_USER_PROFILE_STORAGE_BINDING,
    storageScope: BIRDCODER_APPBASE_USER_STORAGE_SCOPE,
    storageKey: BIRDCODER_APPBASE_USER_PROFILE_KEY,
  },
  fallback: DEFAULT_BIRDCODER_USER_PROFILE,
  normalize: normalizeBirdCoderUserProfile,
});

const birdCoderVipMembershipRepository = createJsonRecordRepository<BirdCoderVipMembershipSnapshot>({
  binding: {
    ...BIRDCODER_APPBASE_VIP_SUBSCRIPTION_STORAGE_BINDING,
    storageScope: BIRDCODER_APPBASE_VIP_STORAGE_SCOPE,
    storageKey: BIRDCODER_APPBASE_VIP_MEMBERSHIP_KEY,
  },
  fallback: DEFAULT_BIRDCODER_VIP_MEMBERSHIP,
  normalize: normalizeBirdCoderVipMembership,
});

export function getBirdCoderUserProfileRepository() {
  return birdCoderUserProfileRepository;
}

export function getBirdCoderVipMembershipRepository() {
  return birdCoderVipMembershipRepository;
}

export async function readBirdCoderUserProfile(): Promise<BirdCoderUserProfileSnapshot> {
  return birdCoderUserProfileRepository.read();
}

export async function writeBirdCoderUserProfile(
  profile: BirdCoderUserProfileSnapshot,
): Promise<BirdCoderUserProfileSnapshot> {
  return birdCoderUserProfileRepository.write(profile);
}

export async function readBirdCoderVipMembership(): Promise<BirdCoderVipMembershipSnapshot> {
  return birdCoderVipMembershipRepository.read();
}

export async function writeBirdCoderVipMembership(
  membership: BirdCoderVipMembershipSnapshot,
): Promise<BirdCoderVipMembershipSnapshot> {
  return birdCoderVipMembershipRepository.write(membership);
}
