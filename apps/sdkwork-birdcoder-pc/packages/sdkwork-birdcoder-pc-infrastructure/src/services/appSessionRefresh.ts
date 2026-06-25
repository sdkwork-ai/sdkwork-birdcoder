import { createBirdcoderAppSdkClient } from '@sdkwork/birdcoder-app-sdk';
import { syncBirdCoderGlobalTokenManagerFromStorage } from '@sdkwork/birdcoder-pc-core/appSessionTokenManager';
import {
  APP_SESSION_CHANGE_EVENT_NAME,
  loadStoredAppSessionToken,
  storeAppSessionFromResult,
} from './appSessionToken.ts';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from './defaultIdeServicesRuntime.ts';
import { getBirdCoderGlobalTokenManager, resetBirdCoderSdkClients } from './sdkClients.ts';
import { createBirdCoderHttpApiTransport } from './sdkTransportShared.ts';

const REFRESH_SKEW_SECONDS = 30;
const MIN_REFRESH_DELAY_MS = 5_000;
const MAX_REFRESH_DELAY_MS = 24 * 60 * 60 * 1000;

let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let refreshInFlight: Promise<boolean> | null = null;
let refreshLoopRegistered = false;

export function startBirdCoderAppSessionRefreshLoop(): void {
  if (refreshLoopRegistered) {
    scheduleBirdCoderAppSessionRefresh();
    return;
  }

  refreshLoopRegistered = true;
  scheduleBirdCoderAppSessionRefresh();
  try {
    globalThis.addEventListener?.(APP_SESSION_CHANGE_EVENT_NAME, handleBirdCoderAppSessionChanged);
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
    scheduleBirdCoderAppSessionRefresh();
  });
  return refreshInFlight;
}

function handleBirdCoderAppSessionChanged(): void {
  scheduleBirdCoderAppSessionRefresh();
}

function scheduleBirdCoderAppSessionRefresh(): void {
  stopBirdCoderAppSessionRefreshLoop();

  const token = loadStoredAppSessionToken();
  if (!token?.refreshToken) {
    return;
  }

  const delayMs = resolveRefreshDelayMs(token.expiresAt);
  if (delayMs === null) {
    void refreshBirdCoderAppSessionNow();
    return;
  }

  refreshTimer = setTimeout(() => {
    refreshTimer = undefined;
    void refreshBirdCoderAppSessionNow();
  }, delayMs);
}

function resolveRefreshDelayMs(expiresAt: number | undefined): number | null {
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
    return null;
  }

  const refreshAtMs = (expiresAt - REFRESH_SKEW_SECONDS) * 1000;
  const delayMs = refreshAtMs - Date.now();
  if (delayMs <= 0) {
    return null;
  }

  return Math.min(Math.max(delayMs, MIN_REFRESH_DELAY_MS), MAX_REFRESH_DELAY_MS);
}

async function refreshBirdCoderAppSession(): Promise<boolean> {
  const token = loadStoredAppSessionToken();
  const refreshToken = token?.refreshToken?.trim();
  if (!refreshToken) {
    return false;
  }

  const runtimeConfig = getDefaultBirdCoderIdeServicesRuntimeConfig();
  const baseUrl = runtimeConfig.apiBaseUrl?.trim();
  if (!baseUrl) {
    return false;
  }

  const tokenManager = getBirdCoderGlobalTokenManager();
  const client = createBirdcoderAppSdkClient({
    transport: createBirdCoderHttpApiTransport({
      baseUrl,
      resolveHeaders: () => {
        const tokens = tokenManager.getTokens();
        return {
          Authorization: tokens.authToken ? `Bearer ${tokens.authToken}` : undefined,
          'Access-Token': tokens.accessToken,
          'Refresh-Token': tokens.refreshToken ?? refreshToken,
        };
      },
    }),
  });

  try {
    const envelope = await client.auth.sessions.refresh({ refreshToken });
    storeAppSessionFromResult(envelope);
    syncBirdCoderGlobalTokenManagerFromStorage();
    resetBirdCoderSdkClients();
    return true;
  } catch {
    return false;
  }
}
