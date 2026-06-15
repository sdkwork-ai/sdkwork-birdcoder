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
  User,
} from '@sdkwork/birdcoder-pc-types';

const BIRDCODER_USER_PREFERENCES_STORAGE_KEY = 'sdkwork.birdcoder.iam.user.preferences.v1';

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

interface BirdCoderIamUserProfileSnapshot {
  avatarUrl?: string;
  displayName?: string;
  email?: string;
}

function readUserPreferences(): Partial<SdkworkUserPreferences> {
  try {
    const raw = globalThis.localStorage?.getItem(BIRDCODER_USER_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Partial<SdkworkUserPreferences>
      : {};
  } catch {
    return {};
  }
}

function writeUserPreferences(
  preferences: Partial<SdkworkUserPreferences>,
): SdkworkUserPreferences {
  const nextPreferences = {
    ...DEFAULT_BIRDCODER_USER_PREFERENCES,
    ...preferences,
  };
  try {
    globalThis.localStorage?.setItem(
      BIRDCODER_USER_PREFERENCES_STORAGE_KEY,
      JSON.stringify(nextPreferences),
    );
  } catch {
    // Preferences remain non-authoritative UI state.
  }
  return nextPreferences;
}

function createBirdCoderUserMessagesOverrides(
  locale?: string | null,
): SdkworkUserMessagesOverrides {
  const normalizedLocale = String(locale || '').trim().toLowerCase();
  if (normalizedLocale.startsWith('zh')) {
    return {
      page: {
        description: 'BirdCoder 账户信息来自标准 SDKWork IAM 当前用户会话。',
      },
    };
  }

  return {
    page: {
      description: 'BirdCoder account details come from the standard SDKWork IAM current-user session.',
    },
  };
}

function createSnapshotFromUser(user: User | null): BirdCoderIamUserProfileSnapshot {
  return {
    avatarUrl: user?.avatarUrl,
    displayName: user?.name,
    email: user?.email,
  };
}

export function createBirdCoderUserService(user: User | null): SdkworkUserService {
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
      key: BIRDCODER_USER_PREFERENCES_STORAGE_KEY,
      read: async () => readUserPreferences(),
      write: async (preferences) => writeUserPreferences(preferences),
    },
    profile: createSdkworkCanonicalUserProfileAdapter({
      async mapUserProfileToSnapshot(
        profile: SdkworkUserProfile,
        currentSnapshot: BirdCoderIamUserProfileSnapshot,
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
        return createSnapshotFromUser(user);
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
        return profileSnapshot;
      },
    }),
    requireAuthenticatedMessage:
      'BirdCoder account details require an authenticated SDKWork IAM session.',
    user,
  });
}

export interface CreateBirdCoderUserControllerOptions
  extends Omit<
    CreateSdkworkCanonicalUserControllerOptions<
      User,
      BirdCoderIamUserProfileSnapshot
    >,
    'messageDefaults' | 'service'
  > {
  locale?: string | null;
  messages?: SdkworkUserMessagesOverrides;
  user: User | null;
}

export function createBirdCoderUserController(
  options: CreateBirdCoderUserControllerOptions,
): SdkworkUserController {
  return createSdkworkCanonicalUserController({
    locale: options.locale,
    messageDefaults: createBirdCoderUserMessagesOverrides(options.locale),
    messages: options.messages,
    registry: options.registry,
    service: createBirdCoderUserService(options.user),
    user: options.user,
  });
}
