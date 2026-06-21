import { createTokenManager, type AuthTokenManager } from '@sdkwork/sdk-common';
import { loadStoredAppSessionToken } from './appSessionToken.ts';

let globalTokenManager: AuthTokenManager | undefined;

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
  if (!globalTokenManager) {
    globalTokenManager = createTokenManager();
    hydrateTokenManagerFromStoredSession(globalTokenManager);
  }
  return globalTokenManager;
}

export function setBirdCoderGlobalTokenManager(tokenManager: AuthTokenManager): void {
  hydrateTokenManagerFromStoredSession(tokenManager);
  globalTokenManager = tokenManager;
}

export function resetBirdCoderGlobalTokenManager(): void {
  globalTokenManager = undefined;
}

export function syncBirdCoderGlobalTokenManagerFromStorage(): void {
  if (!globalTokenManager) {
    return;
  }
  hydrateTokenManagerFromStoredSession(globalTokenManager);
}
