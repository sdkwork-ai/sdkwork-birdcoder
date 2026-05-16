import {
  createSdkworkCanonicalUserController,
  createSdkworkCanonicalUserProfileAdapter,
  createSdkworkCanonicalUserService,
  resolveSdkworkCanonicalUserDisplayName,
  type CreateSdkworkCanonicalUserControllerOptions,
  type SdkworkUserController,
  type SdkworkUserMessagesOverrides,
  type SdkworkUserPreferences,
  type SdkworkUserProfile,
  type SdkworkUserService,
} from '@sdkwork/user-pc-react';
import type {
  BirdCoderUserCenterProfileSummary,
  User,
} from '@sdkwork/birdcoder-types';
import { BIRDCODER_USER_CENTER_STORAGE_PLAN } from './user-center.ts';
import { createBirdCoderRuntimeUserCenterClient } from './user-center-runtime.ts';

const DEFAULT_BIRDCODER_USER_PREFERENCES: SdkworkUserPreferences = {
  general: {
    compactModelSelector: true,
    launchOnStartup: false,
    startMinimized: false,
  },
  notifications: {
    newMessages: true,
    securityAlerts: true,
    systemUpdates: true,
    taskCompletions: true,
    taskFailures: true,
  },
  privacy: {
    personalizedRecommendations: false,
    shareUsageData: false,
  },
  security: {
    loginAlerts: true,
    twoFactorAuth: false,
  },
};

interface BirdCoderRuntimeUserProfileSnapshot {
  avatarUrl?: string;
  bio?: string;
  displayName?: string;
  email?: string;
  location?: string;
  website?: string;
}

function requireRuntimeUserCenterClient() {
  const runtimeClient = createBirdCoderRuntimeUserCenterClient();
  if (!runtimeClient) {
    throw new Error(
      'BirdCoder user-center runtime client is unavailable; check the appbase IAM runtime binding.',
    );
  }

  return runtimeClient;
}

function createBirdCoderUserMessagesOverrides(
  locale?: string | null,
): SdkworkUserMessagesOverrides {
  const normalizedLocale = String(locale || '').trim().toLowerCase();
  if (normalizedLocale.startsWith('zh')) {
    return {
      notifications: {
        description:
          '\u0042\u0069\u0072\u0064\u0043\u006f\u0064\u0065\u0072 \u7684\u901a\u77e5\u504f\u597d\u901a\u8fc7\u5171\u4eab\u7528\u6237\u4e2d\u5fc3\u754c\u9762\u7edf\u4e00\u7ba1\u7406\uff0c\u79c1\u6709\u5316\u90e8\u7f72\u548c\u7edf\u4e00\u63a5\u5165\u6a21\u5f0f\u4fdd\u6301\u540c\u4e00\u5957\u8bbe\u7f6e\u6a21\u578b\u3002',
      },
      page: {
        description:
          '\u0042\u0069\u0072\u0064\u0043\u006f\u0064\u0065\u0072 \u7684\u8d26\u6237\u8bbe\u7f6e\u901a\u8fc7\u5171\u4eab\u7684 \u0073\u0064\u006b\u0077\u006f\u0072\u006b\u002d\u0061\u0070\u0070\u0062\u0061\u0073\u0065 \u7528\u6237\u4e2d\u5fc3\u754c\u9762\u7edf\u4e00\u627f\u8f7d\u3002',
      },
    };
  }

  return {
    notifications: {
      description:
        'BirdCoder notification preferences stay on the shared user-center surface so private and unified deployments use the same settings model.',
    },
    page: {
      description:
        'BirdCoder account settings are rendered through the shared sdkwork-appbase user-center surface.',
    },
  };
}

function mapRuntimeProfileToSnapshot(
  profile: BirdCoderUserCenterProfileSummary,
): BirdCoderRuntimeUserProfileSnapshot {
  return {
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    displayName: profile.displayName,
    email: profile.email,
    location: profile.location,
    website: profile.website,
  };
}

export function createBirdCoderUserCenterService(user: User | null): SdkworkUserService {
  return createSdkworkCanonicalUserService({
    capabilities: {
      profile: {
        avatarUrlEditable: false,
        emailEditable: false,
      },
      security: {
        passwordChangeEnabled: false,
      },
    },
    preferences: {
      defaults: DEFAULT_BIRDCODER_USER_PREFERENCES,
      key: BIRDCODER_USER_CENTER_STORAGE_PLAN.preferencesKey,
      read: () =>
        requireRuntimeUserCenterClient()
          .getPreferences<Partial<SdkworkUserPreferences>>(),
      write: (preferences) =>
        requireRuntimeUserCenterClient()
          .updatePreferences<
            Partial<SdkworkUserPreferences>,
            SdkworkUserPreferences
          >(preferences),
    },
    profile: createSdkworkCanonicalUserProfileAdapter({
      async mapUserProfileToSnapshot(
        profile: SdkworkUserProfile,
        currentSnapshot: BirdCoderRuntimeUserProfileSnapshot,
        resolvedUser: User,
      ) {
        const displayName = resolveSdkworkCanonicalUserDisplayName(
          profile,
          resolvedUser.email,
        );

        return {
          ...currentSnapshot,
          displayName,
          email: resolvedUser.email,
        };
      },
      async read() {
        return mapRuntimeProfileToSnapshot(
          await requireRuntimeUserCenterClient()
            .getProfile<BirdCoderUserCenterProfileSummary>(),
        );
      },
      resolveIdentity(userSnapshot, profileSnapshot) {
        return {
          avatarUrl: profileSnapshot.avatarUrl || userSnapshot.avatarUrl,
          displayName:
            profileSnapshot.displayName?.trim()
            || userSnapshot.name.trim()
            || userSnapshot.email.trim(),
          email: profileSnapshot.email?.trim() || userSnapshot.email.trim(),
          id: userSnapshot.id || userSnapshot.email.trim(),
          username: userSnapshot.email.trim(),
        };
      },
      async write(profileSnapshot) {
        return mapRuntimeProfileToSnapshot(
          await requireRuntimeUserCenterClient()
            .updateProfile<
              BirdCoderUserCenterProfileSummary,
              BirdCoderRuntimeUserProfileSnapshot
            >(profileSnapshot),
        );
      },
    }),
    requireAuthenticatedMessage:
      'BirdCoder user-center surface requires an authenticated user session.',
    user,
  });
}

export interface CreateBirdCoderUserCenterControllerOptions
  extends Omit<
    CreateSdkworkCanonicalUserControllerOptions<
      User,
      BirdCoderRuntimeUserProfileSnapshot
    >,
    'messageDefaults' | 'service'
  > {
  locale?: string | null;
  messages?: SdkworkUserMessagesOverrides;
  user: User | null;
}

export function createBirdCoderUserCenterController(
  options: CreateBirdCoderUserCenterControllerOptions,
): SdkworkUserController {
  return createSdkworkCanonicalUserController({
    locale: options.locale,
    messageDefaults: createBirdCoderUserMessagesOverrides(options.locale),
    messages: options.messages,
    registry: options.registry,
    service: createBirdCoderUserCenterService(options.user),
  });
}
