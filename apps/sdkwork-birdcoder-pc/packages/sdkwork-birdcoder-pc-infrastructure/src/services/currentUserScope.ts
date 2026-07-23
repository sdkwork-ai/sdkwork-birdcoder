import { APP_SESSION_CHANGE_EVENT_NAME } from './appSessionEvents.ts';
import type { IAuthService } from './interfaces/IAuthService.ts';

export interface CurrentUserScope {
  cacheable: boolean;
  userId: string;
}

export interface CurrentUserScopeResolverOptions {
  cacheTtlMs?: number;
  currentUserProvider?: Pick<IAuthService, 'getCurrentUser'>;
  now?: () => number;
}

interface CachedCurrentUserScope {
  expiresAt: number;
  scope: CurrentUserScope;
}

const ANONYMOUS_USER_SCOPE: CurrentUserScope = {
  cacheable: true,
  userId: 'anonymous',
};
const UNRESOLVED_USER_SCOPE: CurrentUserScope = {
  cacheable: false,
  userId: 'anonymous',
};
const DEFAULT_CURRENT_USER_SCOPE_CACHE_TTL_MS = 10_000;

export function isOptionalCurrentUserScopeResolutionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('/app/v3/api/iam/users/current')
    || error.message.includes('/app/v3/api/auth/sessions/current')
    || error.message.includes('Failed to resolve BirdCoder desktop runtime API base URL')
    || error.message.includes(' -> 401')
    || error.message.includes(' -> 403')
    || error.message.includes(' -> 404')
  );
}

export class CurrentUserScopeResolver {
  private cachedScope: CachedCurrentUserScope | null = null;
  private readonly cacheTtlMs: number;
  private readonly currentUserProvider?: Pick<IAuthService, 'getCurrentUser'>;
  private inflight: Promise<CurrentUserScope> | null = null;
  private readonly now: () => number;
  private requestGeneration = 0;
  private readonly onSessionChange = () => {
    this.clear();
  };

  constructor({
    cacheTtlMs = DEFAULT_CURRENT_USER_SCOPE_CACHE_TTL_MS,
    currentUserProvider,
    now = Date.now,
  }: CurrentUserScopeResolverOptions = {}) {
    this.cacheTtlMs = Math.max(0, Math.floor(cacheTtlMs));
    this.currentUserProvider = currentUserProvider;
    this.now = now;
    this.registerSessionChangeListener();
  }

  clear(): void {
    this.requestGeneration += 1;
    this.cachedScope = null;
    this.inflight = null;
  }

    async resolve(): Promise<CurrentUserScope> {
    const now = this.now();
    if (this.cachedScope && this.cachedScope.expiresAt > now) {
      return this.cachedScope.scope;
    }

    // Check if there's an inflight request for the current generation
    if (this.inflight) {
      const requestGeneration = this.requestGeneration;
      return this.inflight.then((scope) => {
        // If generation changed while waiting, treat as unresolved
        if (this.requestGeneration !== requestGeneration) {
          return UNRESOLVED_USER_SCOPE;
        }
        return scope;
      });
    }

    const requestGeneration = this.requestGeneration;
    const request = this.load()
      .then((scope) => {
        if (this.requestGeneration !== requestGeneration) {
          return UNRESOLVED_USER_SCOPE;
        }

        if (scope.cacheable && this.cacheTtlMs > 0) {
          this.cachedScope = {
            expiresAt: this.now() + this.cacheTtlMs,
            scope,
          };
        } else {
          this.cachedScope = null;
        }
        return scope;
      })
      .finally(() => {
        if (this.inflight === request) {
          this.inflight = null;
        }
      });
    this.inflight = request;
    return request;
  }

  private async load(): Promise<CurrentUserScope> {
    if (!this.currentUserProvider) {
      return ANONYMOUS_USER_SCOPE;
    }

    try {
      const user = await this.currentUserProvider.getCurrentUser();
      const userId = user?.id?.trim();
      return userId && userId.length > 0
        ? {
            cacheable: true,
            userId,
          }
        : UNRESOLVED_USER_SCOPE;
    } catch (error) {
      if (isOptionalCurrentUserScopeResolutionError(error)) {
        return UNRESOLVED_USER_SCOPE;
      }

      throw error;
    }
  }

  private registerSessionChangeListener(): void {
    try {
      globalThis.addEventListener?.(
        APP_SESSION_CHANGE_EVENT_NAME,
        this.onSessionChange,
      );
    } catch {
      // Non-browser runtimes still rely on the short TTL and token store state.
    }
  }
}
