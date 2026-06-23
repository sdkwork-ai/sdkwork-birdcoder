import type {
  IamRuntime,
} from '@sdkwork/iam-runtime';
import type {
  IamUser,
} from '@sdkwork/iam-service';
import type {
  User,
} from '@sdkwork/birdcoder-pc-types';
import {
  getBirdCoderIamRuntime,
  resetBirdCoderIamRuntime,
} from '../iamRuntime.ts';
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

async function readStoredIamSessionTokens(runtime: IamRuntime): Promise<boolean> {
  const storedSession = await runtime.tokenStore.get();
  return Boolean(
    normalizeText(storedSession.authToken)
      || normalizeText(storedSession.accessToken),
  );
}

async function clearInvalidIamSession(runtime: IamRuntime): Promise<void> {
  await runtime.tokenStore.clear();
  await runtime.contextStore.clear();
}

async function validateStoredIamSession(runtime: IamRuntime): Promise<boolean> {
  if (!(await readStoredIamSessionTokens(runtime))) {
    return false;
  }

  try {
    await runtime.service.auth.sessions.current.retrieve();
    return true;
  } catch {
    await clearInvalidIamSession(runtime);
    return false;
  }
}

export function createBirdCoderRuntimeAuthService(
  options: RuntimeAuthServiceOptions = {},
): IAuthService {
  const readRuntime = options.getRuntime ?? getBirdCoderIamRuntime;

  return {
    async getCurrentUser() {
      const runtime = readRuntime();
      if (!(await validateStoredIamSession(runtime))) {
        return null;
      }

      return mapIamUser(await runtime.service.iam.users.current.retrieve());
    },

    async hasStoredSession() {
      return validateStoredIamSession(readRuntime());
    },

    async logout() {
      const runtime = readRuntime();
      try {
        await runtime.service.auth.sessions.current.delete();
      } finally {
        await runtime.tokenStore.clear();
        await runtime.contextStore.clear();
        resetBirdCoderIamRuntime();
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
