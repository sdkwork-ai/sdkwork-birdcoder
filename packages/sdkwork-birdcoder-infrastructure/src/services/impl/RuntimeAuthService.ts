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

export interface RuntimeAuthServiceOptions {
  client?: BirdCoderUserCenterApiClient;
}

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
  private currentUser: User | null = null;

  constructor(options: RuntimeAuthServiceOptions = {}) {
    this.client = options.client;
  }

  async getUserCenterConfig(): Promise<BirdCoderUserCenterMetadataSummary | null> {
    if (!this.client) {
      return null;
    }

    try {
      return await this.client.getConfig();
    } catch (error) {
      if (isUserCenterRouteUnavailable(error)) {
        return null;
      }

      throw error;
    }
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
    }
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.client) {
      this.currentUser = null;
      return null;
    }

    if (!readRuntimeServerSessionId()) {
      this.currentUser = null;
      return null;
    }

    let session: BirdCoderUserCenterSessionSummary | null = null;
    try {
      session = await this.client.getCurrentSession();
    } catch (error) {
      if (!isUserCenterRouteUnavailable(error)) {
        throw error;
      }
    }

    if (!session) {
      clearRuntimeServerSessionId();
      this.currentUser = null;
      return null;
    }

    return this.applySession(session);
  }
}
