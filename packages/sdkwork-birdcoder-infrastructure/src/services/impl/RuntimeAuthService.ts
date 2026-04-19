import type {
  BirdCoderAuthenticatedUserSummary,
  BirdCoderUserCenterApiClient,
  BirdCoderUserCenterMetadataSummary,
  BirdCoderUserCenterSessionExchangeRequest,
  BirdCoderUserCenterSessionSummary,
  User,
} from '@sdkwork/birdcoder-types';
import type { IAuthService } from '../interfaces/IAuthService.ts';
import {
  clearRuntimeServerSessionId,
  readRuntimeServerSessionId,
  writeRuntimeServerSessionId,
} from '../runtimeServerSession.ts';
import {
  isBirdCoderTransientApiError,
  retryBirdCoderTransientApiTask,
} from '../runtimeApiRetry.ts';

export interface RuntimeAuthServiceOptions {
  client?: BirdCoderUserCenterApiClient;
}

const AUTH_CONFIG_CACHE_TTL_MS = 60_000;
const CURRENT_USER_CACHE_TTL_MS = 10_000;

function createUnavailableError(): Error {
  return new Error('Auth service requires a bound coding-server runtime with user-center APIs.');
}

function isUserCenterRouteUnavailable(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes(' -> 404') ||
      error.message.includes('requires a bound coding-server runtime'))
  );
}

function isUserCenterSessionRejected(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes(' -> 401') || error.message.includes(' -> 403'))
  );
}

function mapAuthenticatedUser(user: BirdCoderAuthenticatedUserSummary): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
  };
}

export class RuntimeAuthService implements IAuthService {
  private readonly client?: BirdCoderUserCenterApiClient;
  private authConfig: BirdCoderUserCenterMetadataSummary | null = null;
  private authConfigExpiresAt = 0;
  private authConfigInflight: Promise<BirdCoderUserCenterMetadataSummary | null> | null = null;
  private currentUser: User | null = null;
  private currentUserExpiresAt = 0;
  private currentUserInflight: Promise<User | null> | null = null;

  constructor(options: RuntimeAuthServiceOptions = {}) {
    this.client = options.client;
  }

  async getUserCenterConfig(): Promise<BirdCoderUserCenterMetadataSummary | null> {
    if (!this.client) {
      return null;
    }

    const now = Date.now();
    if (this.authConfigInflight) {
      return this.authConfigInflight;
    }

    if (this.authConfigExpiresAt > now) {
      return this.authConfig;
    }

    const request = (async () => {
      try {
        const config = await retryBirdCoderTransientApiTask(() => this.client!.getConfig());
        this.authConfig = config;
        this.authConfigExpiresAt = Date.now() + AUTH_CONFIG_CACHE_TTL_MS;
        return config;
      } catch (error) {
        if (isUserCenterRouteUnavailable(error)) {
          this.authConfig = null;
          this.authConfigExpiresAt = Date.now() + AUTH_CONFIG_CACHE_TTL_MS;
          return null;
        }

        throw error;
      }
    })().finally(() => {
      if (this.authConfigInflight === request) {
        this.authConfigInflight = null;
      }
    });

    this.authConfigInflight = request;
    return request;
  }

  private requireClient(): BirdCoderUserCenterApiClient {
    if (!this.client) {
      throw createUnavailableError();
    }

    return this.client;
  }

  private async assertLocalCredentialsAvailable(): Promise<void> {
    const config = await this.getUserCenterConfig();
    if (config && !config.supportsLocalCredentials) {
      throw new Error(
        `User center provider "${config.providerKey}" requires third-party session exchange and does not accept local credentials.`,
      );
    }
  }

  private applySession(session: BirdCoderUserCenterSessionSummary): User {
    writeRuntimeServerSessionId(session.sessionId);
    this.currentUser = mapAuthenticatedUser(session.user);
    this.currentUserExpiresAt = Date.now() + CURRENT_USER_CACHE_TTL_MS;
    return this.currentUser;
  }

  async exchangeUserCenterSession(
    request: BirdCoderUserCenterSessionExchangeRequest,
  ): Promise<User> {
    const session = await this.requireClient().exchangeSession(request);
    return this.applySession(session);
  }

  async login(email: string, password?: string): Promise<User> {
    await this.assertLocalCredentialsAvailable();
    const session = await this.requireClient().login({ email, password });
    return this.applySession(session);
  }

  async register(email: string, password?: string, name?: string): Promise<User> {
    await this.assertLocalCredentialsAvailable();
    const session = await this.requireClient().register({ email, name, password });
    return this.applySession(session);
  }

  async logout(): Promise<void> {
    try {
      if (this.client) {
        try {
          await this.client.logout();
        } catch (error) {
          if (!isUserCenterRouteUnavailable(error)) {
            throw error;
          }
        }
      }
    } finally {
      clearRuntimeServerSessionId();
      this.currentUser = null;
      this.currentUserExpiresAt = 0;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.client) {
      this.currentUser = null;
      this.currentUserExpiresAt = 0;
      return null;
    }

    if (!readRuntimeServerSessionId()) {
      this.currentUser = null;
      this.currentUserExpiresAt = 0;
      return null;
    }

    const now = Date.now();
    if (this.currentUser && this.currentUserExpiresAt > now) {
      return this.currentUser;
    }

    if (this.currentUserInflight) {
      return this.currentUserInflight;
    }

    const request = (async () => {
      let session: BirdCoderUserCenterSessionSummary | null = null;
      try {
        session = await retryBirdCoderTransientApiTask(
          () => this.client!.getCurrentSession(),
          {
            shouldRetry: (error) =>
              isBirdCoderTransientApiError(error) && !isUserCenterSessionRejected(error),
          },
        );
      } catch (error) {
        if (isUserCenterRouteUnavailable(error) || isUserCenterSessionRejected(error)) {
          clearRuntimeServerSessionId();
          this.currentUser = null;
          this.currentUserExpiresAt = 0;
          return null;
        }

        if (isBirdCoderTransientApiError(error)) {
          return this.currentUser;
        }
      }

      if (!session) {
        clearRuntimeServerSessionId();
        this.currentUser = null;
        this.currentUserExpiresAt = 0;
        return null;
      }

      return this.applySession(session);
    })().finally(() => {
      if (this.currentUserInflight === request) {
        this.currentUserInflight = null;
      }
    });

    this.currentUserInflight = request;
    return request;
  }
}
