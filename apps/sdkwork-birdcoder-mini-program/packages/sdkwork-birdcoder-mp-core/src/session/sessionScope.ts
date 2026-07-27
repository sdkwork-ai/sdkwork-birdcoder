export type BirdCoderSessionClearReason =
  | 'logout'
  | 'refresh-failure'
  | 'account-switch'
  | 'tenant-switch'
  | 'organization-switch';

export interface BirdCoderTokenManagerPort {
  clearTokens(): void;
}

export interface BirdCoderContextStorePort {
  clear(): void;
}

export interface BirdCoderCachePort {
  clear(): void;
}

export interface BirdCoderSensitiveStatePort {
  clear(reason: BirdCoderSessionClearReason): void;
}

export interface BirdCoderSessionStoragePort {
  remove(key: string): void;
}

export interface BirdCoderSessionScopeDependencies {
  readonly storage: BirdCoderSessionStoragePort;
  readonly tokenManager: BirdCoderTokenManagerPort;
  readonly contextStore: BirdCoderContextStorePort;
  readonly caches: readonly BirdCoderCachePort[];
  readonly sensitiveState: readonly BirdCoderSensitiveStatePort[];
}

export const BIRDCODER_SESSION_STORAGE_KEYS = [
  'sdkwork.birdcoder.appSession.v1',
  'sdkwork.birdcoder.tenantContext.v1',
  'sdkwork.birdcoder.organizationContext.v1',
] as const;

export class BirdCoderSessionScope {
  public constructor(private readonly dependencies: BirdCoderSessionScopeDependencies) {}

  public clear(reason: BirdCoderSessionClearReason): void {
    for (const key of BIRDCODER_SESSION_STORAGE_KEYS) {
      this.dependencies.storage.remove(key);
    }
    this.dependencies.tokenManager.clearTokens();
    this.dependencies.contextStore.clear();
    for (const cache of this.dependencies.caches) {
      cache.clear();
    }
    for (const state of this.dependencies.sensitiveState) {
      state.clear(reason);
    }
  }
}
