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

  return birdCoderUserProfileRepository.read();
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

  return birdCoderUserProfileRepository.write(profile);
}

export async function readBirdCoderVipMembership(): Promise<BirdCoderVipMembershipSnapshot> {
  const runtimeClient = createRuntimeUserCenterClient();
  if (runtimeClient) {
    const membership = await runtimeClient.getMembership<BirdCoderUserCenterMembershipSummary>();
    const snapshot = mapRuntimeMembershipToSnapshot(membership);
    await birdCoderVipMembershipRepository.write(snapshot);
    return snapshot;
  }

  return birdCoderVipMembershipRepository.read();
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

  return birdCoderVipMembershipRepository.write(membership);
}

export {
  getBirdCoderUserProfileRepository,
  getBirdCoderVipMembershipRepository,
};
