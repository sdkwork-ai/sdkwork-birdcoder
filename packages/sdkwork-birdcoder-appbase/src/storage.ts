import {
  createJsonRecordRepository,
} from '@sdkwork/birdcoder-commons/storage/dataKernel';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from '@sdkwork/birdcoder-commons';
import {
  BIRDCODER_APPBASE_USER_PROFILE_STORAGE_BINDING,
  BIRDCODER_APPBASE_VIP_SUBSCRIPTION_STORAGE_BINDING,
} from '@sdkwork/birdcoder-types/storageBindings';
import type {
  BirdCoderApiEnvelope,
  BirdCoderUserCenterMembershipSummary,
  BirdCoderUserCenterProfileSummary,
} from '@sdkwork/birdcoder-types';
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
  displayName: string;
  location: string;
  website: string;
}

export const DEFAULT_BIRDCODER_USER_PROFILE: BirdCoderUserProfileSnapshot = {
  bio: 'Build and ship professional AI-native development systems with unified engine governance.',
  company: 'SDKWork',
  displayName: '',
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
    displayName: candidate.displayName?.trim() || fallback.displayName,
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

const RUNTIME_SERVER_SESSION_STORAGE_KEY = 'birdcoder.server.user-center.session.v1';
const RUNTIME_SERVER_SESSION_HEADER_NAME = 'x-birdcoder-session-id';

function resolveRuntimeUserCenterApiBaseUrl(): string | null {
  const apiBaseUrl = getDefaultBirdCoderIdeServicesRuntimeConfig().apiBaseUrl?.trim();
  return apiBaseUrl && apiBaseUrl.length > 0 ? apiBaseUrl : null;
}

function readRuntimeUserCenterSessionId(): string | null {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return null;
  }

  try {
    const value = globalThis.localStorage.getItem(RUNTIME_SERVER_SESSION_STORAGE_KEY)?.trim();
    return value ? value : null;
  } catch {
    return null;
  }
}

function buildRuntimeUserCenterUrl(apiBaseUrl: string, path: string): URL {
  const url = new URL(apiBaseUrl);
  const normalizedBasePath = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/u, '');
  url.pathname = `${normalizedBasePath}${path}`;
  return url;
}

async function requestRuntimeUserCenter<TResponse>(
  method: 'GET' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<TResponse> {
  const apiBaseUrl = resolveRuntimeUserCenterApiBaseUrl();
  if (!apiBaseUrl) {
    throw new Error('Runtime user center API base URL is not configured.');
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  const sessionId = readRuntimeUserCenterSessionId();
  if (sessionId) {
    headers[RUNTIME_SERVER_SESSION_HEADER_NAME] = sessionId;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(buildRuntimeUserCenterUrl(apiBaseUrl, path), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Runtime user center request failed: ${method} ${path} -> ${response.status}`);
  }

  const envelope = (await response.json()) as BirdCoderApiEnvelope<TResponse>;
  return envelope.data;
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
    creditsPerMonth: membership.creditsPerMonth,
    planId:
      membership.planId === 'free' ||
      membership.planId === 'pro' ||
      membership.planId === 'team'
        ? membership.planId
        : 'free',
    planTitle: membership.planTitle,
    renewAt: membership.renewAt ?? DEFAULT_BIRDCODER_VIP_MEMBERSHIP.renewAt,
    seats: membership.seats,
    status:
      membership.status === 'inactive' ||
      membership.status === 'trialing' ||
      membership.status === 'active'
        ? membership.status
        : 'inactive',
  };
}

export async function readBirdCoderUserProfile(): Promise<BirdCoderUserProfileSnapshot> {
  if (resolveRuntimeUserCenterApiBaseUrl()) {
    const profile = await requestRuntimeUserCenter<BirdCoderUserCenterProfileSummary>(
      'GET',
      '/api/app/v1/user-center/profile',
    );
    const snapshot = mapRuntimeProfileToSnapshot(profile);
    await birdCoderUserProfileRepository.write(snapshot);
    return snapshot;
  }

  return birdCoderUserProfileRepository.read();
}

export async function writeBirdCoderUserProfile(
  profile: BirdCoderUserProfileSnapshot,
): Promise<BirdCoderUserProfileSnapshot> {
  if (resolveRuntimeUserCenterApiBaseUrl()) {
    const updatedProfile = await requestRuntimeUserCenter<BirdCoderUserCenterProfileSummary>(
      'PATCH',
      '/api/app/v1/user-center/profile',
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
  if (resolveRuntimeUserCenterApiBaseUrl()) {
    const membership = await requestRuntimeUserCenter<BirdCoderUserCenterMembershipSummary>(
      'GET',
      '/api/app/v1/user-center/membership',
    );
    const snapshot = mapRuntimeMembershipToSnapshot(membership);
    await birdCoderVipMembershipRepository.write(snapshot);
    return snapshot;
  }

  return birdCoderVipMembershipRepository.read();
}

export async function writeBirdCoderVipMembership(
  membership: BirdCoderVipMembershipSnapshot,
): Promise<BirdCoderVipMembershipSnapshot> {
  if (resolveRuntimeUserCenterApiBaseUrl()) {
    const updatedMembership = await requestRuntimeUserCenter<BirdCoderUserCenterMembershipSummary>(
      'PATCH',
      '/api/app/v1/user-center/membership',
      {
        creditsPerMonth: membership.creditsPerMonth,
        planId: membership.planId,
        planTitle: membership.planTitle,
        renewAt: membership.renewAt,
        seats: membership.seats,
        status: membership.status,
      },
    );
    const snapshot = mapRuntimeMembershipToSnapshot(updatedMembership);
    await birdCoderVipMembershipRepository.write(snapshot);
    return snapshot;
  }

  return birdCoderVipMembershipRepository.write(membership);
}
