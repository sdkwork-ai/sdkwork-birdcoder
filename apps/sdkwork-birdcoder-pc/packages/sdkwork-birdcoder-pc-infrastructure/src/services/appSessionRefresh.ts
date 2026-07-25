import { createAppbaseAppSdkClient } from '@sdkwork/birdcoder-pc-core/sdk';
import {
  getBirdCoderGlobalTokenManager,
  syncBirdCoderGlobalTokenManagerFromStorage,
} from '@sdkwork/birdcoder-pc-core/appSessionTokenManager';
import {
  APP_SESSION_CHANGE_EVENT_NAME,
  loadStoredAppSessionToken,
  storeAppSessionFromResult,
  type StoredAppSessionToken,
} from './appSessionToken.ts';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { resetBirdCoderAppClient } from './birdCoderSdkClient.ts';
import { terminateBirdCoderAppSessionAfterRefreshFailure } from './sdkSession.ts';
import { resolveBirdCoderDependencySdkBaseUrl } from './sdkBaseUrls.ts';

const REFRESH_SKEW_SECONDS = 30;
const MIN_REFRESH_DELAY_MS = 5_000;
const MAX_REFRESH_DELAY_MS = 24 * 60 * 60 * 1000;

let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let refreshInFlight: Promise<boolean> | null = null;
let refreshLoopRegistered = false;
let lastRefreshCompletedAt = 0;
let suppressSessionChangeRefresh = false;

export function startBirdCoderAppSessionRefreshLoop(): void {
  if (refreshLoopRegistered) {
    scheduleBirdCoderAppSessionRefresh();
    return;
  }

  const host = globalThis as typeof globalThis & {
    __SDKWORK_BIRDCODER_APP_SESSION_REFRESH_LOOP__?: {
      dispose: () => void;
    };
  };
  host.__SDKWORK_BIRDCODER_APP_SESSION_REFRESH_LOOP__?.dispose();

  refreshLoopRegistered = true;
  scheduleBirdCoderAppSessionRefresh();
  try {
    const listener: EventListener = handleBirdCoderAppSessionChanged;
    globalThis.addEventListener?.(APP_SESSION_CHANGE_EVENT_NAME, listener);
    host.__SDKWORK_BIRDCODER_APP_SESSION_REFRESH_LOOP__ = {
      dispose: () => {
        globalThis.removeEventListener?.(APP_SESSION_CHANGE_EVENT_NAME, listener);
        stopBirdCoderAppSessionRefreshLoop();
        refreshLoopRegistered = false;
      },
    };
  } catch {
    // Non-browser hosts refresh opportunistically through explicit calls.
  }
}

export function stopBirdCoderAppSessionRefreshLoop(): void {
  if (refreshTimer !== undefined) {
    clearTimeout(refreshTimer);
    refreshTimer = undefined;
  }
}

export async function refreshBirdCoderAppSessionNow(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = refreshBirdCoderAppSession().finally(() => {
    refreshInFlight = null;
    lastRefreshCompletedAt = Date.now();
    scheduleBirdCoderAppSessionRefresh();
  });
  return refreshInFlight;
}

function handleBirdCoderAppSessionChanged(): void {
  if (suppressSessionChangeRefresh) {
    return;
  }
  scheduleBirdCoderAppSessionRefresh();
}

function scheduleBirdCoderAppSessionRefresh(): void {
  stopBirdCoderAppSessionRefreshLoop();

  const token = loadStoredAppSessionToken();
  if (!token?.refreshToken) {
    return;
  }

  const delayMs = resolveRefreshDelayMs(token.expiresAt);
  if (delayMs === undefined) {
    return;
  }
  if (delayMs === null) {
    const cooldownMs = resolveRefreshCooldownMs();
    if (cooldownMs === 0) {
      void refreshBirdCoderAppSessionNow();
      return;
    }
    refreshTimer = setTimeout(() => {
      refreshTimer = undefined;
      void refreshBirdCoderAppSessionNow();
    }, cooldownMs);
    return;
  }

  refreshTimer = setTimeout(() => {
    refreshTimer = undefined;
    void refreshBirdCoderAppSessionNow();
  }, delayMs);
}

function resolveRefreshCooldownMs(): number {
  if (lastRefreshCompletedAt === 0) {
    return 0;
  }
  const elapsed = Date.now() - lastRefreshCompletedAt;
  return Math.max(0, MIN_REFRESH_DELAY_MS - elapsed);
}

function resolveRefreshDelayMs(expiresAt: number | undefined): number | null | undefined {
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
    // Without an authoritative expiry, a timer would refresh forever on a
    // fixed cadence. Let protected requests and the unauthorized boundary
    // drive re-authentication instead.
    return undefined;
  }

  const refreshAtMs = (expiresAt - REFRESH_SKEW_SECONDS) * 1000;
  const delayMs = refreshAtMs - Date.now();
  if (delayMs <= 0) {
    return null;
  }

  return Math.min(Math.max(delayMs, MIN_REFRESH_DELAY_MS), MAX_REFRESH_DELAY_MS);
}

export function isBirdCoderSessionRefreshRequestCurrent(
  requestToken: StoredAppSessionToken,
  currentToken: StoredAppSessionToken | null,
): boolean {
  return Boolean(
    currentToken
      && currentToken.accessToken === requestToken.accessToken
      && currentToken.authToken === requestToken.authToken
      && currentToken.refreshToken === requestToken.refreshToken
      && currentToken.sessionId === requestToken.sessionId
      && currentToken.storedAt === requestToken.storedAt,
  );
}

async function refreshBirdCoderAppSession(): Promise<boolean> {
  const token = loadStoredAppSessionToken();
  const refreshToken = token?.refreshToken?.trim();
  if (!token || !refreshToken) {
    return false;
  }

  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  const baseUrl = resolveBirdCoderDependencySdkBaseUrl('IAM', {
    overrideEnvNames: [
      'VITE_SDKWORK_APPBASE_APP_API_BASE_URL',
      'VITE_SDKWORK_IAM_APP_API_BASE_URL',
    ],
    platformApiGatewayBaseUrl: runtimeConfig.platformApiGatewayBaseUrl,
  });

  const tokenManager = getBirdCoderGlobalTokenManager();
  const client = createAppbaseAppSdkClient({
    authMode: 'dual-token',
    baseUrl,
    platform: 'pc',
    tokenManager,
  });

  try {
    const refreshedSession = await client.auth.sessions.refresh({ refreshToken });
    if (!isBirdCoderSessionRefreshRequestCurrent(token, loadStoredAppSessionToken())) {
      return false;
    }

    suppressSessionChangeRefresh = true;
    try {
      storeAppSessionFromResult(refreshedSession, {
        preserveSessionMetadata: true,
      });
    } finally {
      suppressSessionChangeRefresh = false;
    }
    syncBirdCoderGlobalTokenManagerFromStorage();
    resetBirdCoderAppClient();
    return true;
  } catch {
    terminateBirdCoderAppSessionAfterRefreshFailure();
    return false;
  }
}
