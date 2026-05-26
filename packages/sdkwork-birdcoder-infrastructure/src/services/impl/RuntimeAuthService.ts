import type {
  IamRuntime,
} from '@sdkwork/iam-runtime';
import type {
  IamUser,
} from '@sdkwork/iam-service';
import type {
  User,
} from '@sdkwork/birdcoder-types';
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

  return {
    ...(normalizeText(user.avatarUrl) ? { avatarUrl: normalizeText(user.avatarUrl) } : {}),
    email,
    id,
    name: displayName,
  };
}

async function hasStoredIamSession(runtime: IamRuntime): Promise<boolean> {
  const storedSession = await runtime.tokenStore.get();
  return Boolean(
    normalizeText(storedSession.authToken)
      || normalizeText(storedSession.accessToken),
  );
}

export function createBirdCoderRuntimeAuthService(
  options: RuntimeAuthServiceOptions = {},
): IAuthService {
  const readRuntime = options.getRuntime ?? getBirdCoderIamRuntime;

  return {
    async getCurrentUser() {
      const runtime = readRuntime();
      if (!(await hasStoredIamSession(runtime))) {
        return null;
      }

      return mapIamUser(await runtime.service.iam.users.current.retrieve());
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

  logout(): Promise<void> {
    return this.authority.logout();
  }
}
