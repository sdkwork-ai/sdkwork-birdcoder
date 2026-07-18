import type {
  IamRuntime,
} from '@sdkwork/iam-runtime';
import type {
  IamUser,
} from '@sdkwork/iam-service';
import type {
  User,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  getBirdCoderIamRuntime,
} from '../iamRuntime.ts';
import {
  invalidateBirdCoderCurrentSession,
  retrieveBirdCoderCurrentSession,
} from '../iamCurrentSession.ts';
import {
  invalidateBirdCoderCurrentUser,
  retrieveBirdCoderCurrentUser,
} from '../iamCurrentUser.ts';
import type { IAuthService } from '../interfaces/IAuthService.ts';

export interface RuntimeAuthServiceOptions {
  getRuntime?: () => IamRuntime;
}

function normalizeText(value: unknown): string | undefined {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
}

function readIamUserAvatarUrl(user: IamUser): string | undefined {
  return (
    normalizeText(user.avatar?.publicUrl)
    ?? normalizeText(user.avatar?.url)
  );
}

function mapIamUser(user: IamUser): User {
  const email = normalizeText(user.email) ?? '';
  const displayName = (
    normalizeText(user.displayName)
    ?? normalizeText(user.username)
    ?? email
  ) || 'SDKWork User';
  const id = (
    normalizeText(user.id)
    ?? normalizeText(user.username)
    ?? email
  ) || 'sdkwork-user';
  const avatarUrl = readIamUserAvatarUrl(user);

  return {
    ...(avatarUrl ? { avatarUrl } : {}),
    email,
    id,
    name: displayName,
  };
}

export function createBirdCoderRuntimeAuthService(
  options: RuntimeAuthServiceOptions = {},
): IAuthService {
  const readRuntime = options.getRuntime ?? getBirdCoderIamRuntime;

  return {
    async getCurrentUser() {
      const runtime = readRuntime();
      const session = await retrieveBirdCoderCurrentSession(runtime);
      if (!session) {
        return null;
      }

      if (session.user) {
        return mapIamUser(session.user);
      }

      const currentIamUser = await retrieveBirdCoderCurrentUser(runtime, session);
      return currentIamUser ? mapIamUser(currentIamUser) : null;
    },

    async hasStoredSession() {
      return Boolean(await retrieveBirdCoderCurrentSession(readRuntime()));
    },

    async logout() {
      const runtime = readRuntime();
      invalidateBirdCoderCurrentSession();
      invalidateBirdCoderCurrentUser();
      try {
        await runtime.service.auth.sessions.current.delete();
      } finally {
        await runtime.tokenStore.clear();
        await runtime.contextStore.clear();
      }
    },
  };
}

export class RuntimeAuthService implements IAuthService {
  private readonly authority: IAuthService;

  constructor(options: RuntimeAuthServiceOptions = {}) {
    this.authority = createBirdCoderRuntimeAuthService(options);
  }

  getCurrentUser(): Promise<User | null> {
    return this.authority.getCurrentUser();
  }

  hasStoredSession(): Promise<boolean> {
    return this.authority.hasStoredSession();
  }

  logout(): Promise<void> {
    return this.authority.logout();
  }
}
