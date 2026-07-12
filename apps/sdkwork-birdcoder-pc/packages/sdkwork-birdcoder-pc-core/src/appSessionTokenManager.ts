import { createTokenManager, type AuthTokenManager } from '@sdkwork/sdk-common';
import { loadStoredAppSessionToken } from './appSessionToken.ts';

type BirdCoderTokenManagerHost = typeof globalThis & {
  __SDKWORK_BIRDCODER_GLOBAL_TOKEN_MANAGER__?: AuthTokenManager;
};

function getTokenManagerHost(): BirdCoderTokenManagerHost {
  return globalThis as BirdCoderTokenManagerHost;
}

function hydrateTokenManagerFromStoredSession(tokenManager: AuthTokenManager): void {
  const stored = loadStoredAppSessionToken();
  if (!stored?.authToken || !stored.accessToken) {
    return;
  }

  tokenManager.setTokens({
    authToken: stored.authToken,
    accessToken: stored.accessToken,
    ...(stored.refreshToken ? { refreshToken: stored.refreshToken } : {}),
    ...(typeof stored.expiresAt === 'number'
      ? { expiresAt: stored.expiresAt * 1000 }
      : {}),
  });
}

export function getBirdCoderGlobalTokenManager(): AuthTokenManager {
  const host = getTokenManagerHost();
  if (!host.__SDKWORK_BIRDCODER_GLOBAL_TOKEN_MANAGER__) {
    host.__SDKWORK_BIRDCODER_GLOBAL_TOKEN_MANAGER__ = createTokenManager();
    hydrateTokenManagerFromStoredSession(host.__SDKWORK_BIRDCODER_GLOBAL_TOKEN_MANAGER__);
  }
  return host.__SDKWORK_BIRDCODER_GLOBAL_TOKEN_MANAGER__;
}

export function setBirdCoderGlobalTokenManager(tokenManager: AuthTokenManager): void {
  hydrateTokenManagerFromStoredSession(tokenManager);
  getTokenManagerHost().__SDKWORK_BIRDCODER_GLOBAL_TOKEN_MANAGER__ = tokenManager;
}

export function resetBirdCoderGlobalTokenManager(): void {
  delete getTokenManagerHost().__SDKWORK_BIRDCODER_GLOBAL_TOKEN_MANAGER__;
}

export function syncBirdCoderGlobalTokenManagerFromStorage(): void {
  const tokenManager = getTokenManagerHost().__SDKWORK_BIRDCODER_GLOBAL_TOKEN_MANAGER__;
  if (!tokenManager) {
    return;
  }
  hydrateTokenManagerFromStoredSession(tokenManager);
}
