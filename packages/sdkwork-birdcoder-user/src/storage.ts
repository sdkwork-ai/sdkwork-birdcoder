import type {
  BirdCoderUserCenterMembershipSummary,
  BirdCoderUserCenterProfileSummary,
} from '@sdkwork/birdcoder-types';
import {
  createBirdCoderRuntimeUserCenterClient,
} from './user-center-runtime.ts';
import {
  type BirdCoderVipMembershipSnapshot,
} from './vip.ts';
import {
  getBirdCoderUserProfileRepository,
  getBirdCoderVipMembershipRepository,
  type BirdCoderUserProfileSnapshot,
} from './profileStorage.ts';

const birdCoderUserProfileRepository = getBirdCoderUserProfileRepository();
const birdCoderVipMembershipRepository = getBirdCoderVipMembershipRepository();

function createRuntimeUnavailableError(operation: string): Error {
  return new Error(
    `BirdCoder user center runtime client is unavailable for ${operation}; using local profile storage only because no remote authority is bound.`,
  );
}

function markLocalOnlySnapshot<TSnapshot extends object>(
  snapshot: TSnapshot,
  operation: string,
): TSnapshot {
  return {
    ...snapshot,
    syncMode: 'local-only',
    syncReason: createRuntimeUnavailableError(operation).message,
  };
}

function createRuntimeUserCenterClient() {
  return createBirdCoderRuntimeUserCenterClient();
}

function mapRuntimeProfileToSnapshot(
  profile: BirdCoderUserCenterProfileSummary,
): BirdCoderUserProfileSnapshot {
  return {
    bio: profile.bio,
    company: profile.company,
    displayName: profile.displayName,
    location: profile.location,
    website: profile.website,
  };
}

function mapRuntimeMembershipToSnapshot(
  membership: BirdCoderUserCenterMembershipSummary,
): BirdCoderVipMembershipSnapshot {
  return {
    ...(membership.vipLevelId ? { vipLevelId: membership.vipLevelId } : {}),
    pointBalance: membership.pointBalance,
    totalRechargedPoints: membership.totalRechargedPoints,
    ...(membership.validFrom ? { validFrom: membership.validFrom } : {}),
    ...(membership.validTo ? { validTo: membership.validTo } : {}),
    ...(membership.lastActiveTime ? { lastActiveTime: membership.lastActiveTime } : {}),
    ...(membership.remark ? { remark: membership.remark } : {}),
    status:
      membership.status === 'inactive' ||
      membership.status === 'trialing' ||
      membership.status === 'active'
        ? membership.status
        : 'inactive',
  };
}

export async function readBirdCoderUserProfile(): Promise<BirdCoderUserProfileSnapshot> {
  const runtimeClient = createRuntimeUserCenterClient();
  if (runtimeClient) {
    const profile = await runtimeClient.getProfile<BirdCoderUserCenterProfileSummary>();
    const snapshot = mapRuntimeProfileToSnapshot(profile);
    await birdCoderUserProfileRepository.write(snapshot);
    return snapshot;
  }

  return markLocalOnlySnapshot(
    await birdCoderUserProfileRepository.read(),
    'readBirdCoderUserProfile',
  );
}

export async function writeBirdCoderUserProfile(
  profile: BirdCoderUserProfileSnapshot,
): Promise<BirdCoderUserProfileSnapshot> {
  const runtimeClient = createRuntimeUserCenterClient();
  if (runtimeClient) {
    const updatedProfile = await runtimeClient.updateProfile<BirdCoderUserCenterProfileSummary>(
      {
        bio: profile.bio,
        company: profile.company,
        displayName: profile.displayName,
        location: profile.location,
        website: profile.website,
      },
    );
    const snapshot = mapRuntimeProfileToSnapshot(updatedProfile);
    await birdCoderUserProfileRepository.write(snapshot);
    return snapshot;
  }

  return markLocalOnlySnapshot(
    await birdCoderUserProfileRepository.write(profile),
    'writeBirdCoderUserProfile',
  );
}

export async function readBirdCoderVipMembership(): Promise<BirdCoderVipMembershipSnapshot> {
  const runtimeClient = createRuntimeUserCenterClient();
  if (runtimeClient) {
    const membership = await runtimeClient.getMembership<BirdCoderUserCenterMembershipSummary>();
    const snapshot = mapRuntimeMembershipToSnapshot(membership);
    await birdCoderVipMembershipRepository.write(snapshot);
    return snapshot;
  }

  return markLocalOnlySnapshot(
    await birdCoderVipMembershipRepository.read(),
    'readBirdCoderVipMembership',
  );
}

export async function writeBirdCoderVipMembership(
  membership: BirdCoderVipMembershipSnapshot,
): Promise<BirdCoderVipMembershipSnapshot> {
  const runtimeClient = createRuntimeUserCenterClient();
  if (runtimeClient) {
    const updatedMembership = await runtimeClient.updateMembership<BirdCoderUserCenterMembershipSummary>(
      {
        vipLevelId: membership.vipLevelId,
        pointBalance: membership.pointBalance,
        totalRechargedPoints: membership.totalRechargedPoints,
        validFrom: membership.validFrom,
        validTo: membership.validTo,
        lastActiveTime: membership.lastActiveTime,
        remark: membership.remark,
        status: membership.status,
      },
    );
    const snapshot = mapRuntimeMembershipToSnapshot(updatedMembership);
    await birdCoderVipMembershipRepository.write(snapshot);
    return snapshot;
  }

  return markLocalOnlySnapshot(
    await birdCoderVipMembershipRepository.write(membership),
    'writeBirdCoderVipMembership',
  );
}

export {
  getBirdCoderUserProfileRepository,
  getBirdCoderVipMembershipRepository,
};
