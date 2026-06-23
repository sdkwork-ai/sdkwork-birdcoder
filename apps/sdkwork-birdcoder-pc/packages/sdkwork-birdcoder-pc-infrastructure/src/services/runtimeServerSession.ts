import {
  clearStoredAppSessionToken,
  getStoredAppSessionAuthToken,
  getStoredAppSessionId,
  loadStoredAppSessionToken,
  storeAppSessionFromResult,
} from './appSessionToken.ts';
import {
  getBirdCoderGlobalTokenManager,
  syncBirdCoderGlobalTokenManagerFromStorage,
} from '@sdkwork/birdcoder-pc-core/appSessionTokenManager';

export interface RuntimeServerTokenBundle {
  accessToken?: string;
  authToken?: string;
  refreshToken?: string;
  sessionToken?: string;
  tokenType?: string;
}

export interface RuntimeServerTokenStore {
  clearTokenBundle(): void;
  persistTokenBundle(bundle: RuntimeServerTokenBundle): boolean;
  readTokenBundle(): RuntimeServerTokenBundle;
}

export const RUNTIME_SERVER_ACCESS_TOKEN_HEADER_NAME = 'Access-Token';
export const RUNTIME_SERVER_AUTHORIZATION_HEADER_NAME = 'Authorization';
export const RUNTIME_SERVER_SESSION_HEADER_NAME = 'X-SDKWork-Session-Id';
const RUNTIME_SERVER_DEFAULT_TOKEN_TYPE = 'Bearer';

function normalizeOptionalTokenValue(value: unknown): string | undefined {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  return normalizedValue || undefined;
}

function readCurrentTokenBundle(): RuntimeServerTokenBundle {
  const stored = loadStoredAppSessionToken();
  if (!stored) {
    return {};
  }

  return {
    accessToken: stored.accessToken,
    authToken: stored.authToken,
    ...(stored.refreshToken ? { refreshToken: stored.refreshToken } : {}),
    ...(stored.sessionId ? { sessionToken: stored.sessionId } : {}),
    tokenType: RUNTIME_SERVER_DEFAULT_TOKEN_TYPE,
  };
}

function normalizeRuntimeServerTokenBundle(
  bundle: RuntimeServerTokenBundle,
): RuntimeServerTokenBundle {
  const sessionToken =
    normalizeOptionalTokenValue(bundle.sessionToken)
    ?? normalizeOptionalTokenValue(bundle.authToken)
    ?? normalizeOptionalTokenValue(bundle.accessToken);
  const authToken = normalizeOptionalTokenValue(bundle.authToken) ?? sessionToken;
  const accessToken = normalizeOptionalTokenValue(bundle.accessToken) ?? sessionToken;
  const refreshToken = normalizeOptionalTokenValue(bundle.refreshToken);
  const tokenType =
    normalizeOptionalTokenValue(bundle.tokenType)
    ?? (authToken || accessToken || sessionToken ? RUNTIME_SERVER_DEFAULT_TOKEN_TYPE : undefined);

  return {
    ...(accessToken ? { accessToken } : {}),
    ...(authToken ? { authToken } : {}),
    ...(refreshToken ? { refreshToken } : {}),
    ...(sessionToken ? { sessionToken } : {}),
    ...(tokenType ? { tokenType } : {}),
  };
}

function hasRuntimeServerTokenBundleValues(bundle: RuntimeServerTokenBundle): boolean {
  return Boolean(
    bundle.accessToken
      || bundle.authToken
      || bundle.refreshToken
      || bundle.sessionToken,
  );
}

export function createRuntimeServerTokenStore(): RuntimeServerTokenStore {
  return {
    clearTokenBundle() {
      clearStoredAppSessionToken();
    },

    persistTokenBundle(bundle) {
      const normalizedBundle = normalizeRuntimeServerTokenBundle(bundle);
      if (!hasRuntimeServerTokenBundleValues(normalizedBundle)) {
        return false;
      }

      storeAppSessionFromResult({
        accessToken: normalizedBundle.accessToken,
        authToken: normalizedBundle.authToken,
        refreshToken: normalizedBundle.refreshToken,
        sessionId: normalizedBundle.sessionToken,
      });
      return true;
    },

    readTokenBundle() {
      return readCurrentTokenBundle();
    },
  };
}

const runtimeServerTokenStore = createRuntimeServerTokenStore();

export function getRuntimeServerSessionHeaderName(): string {
  return RUNTIME_SERVER_SESSION_HEADER_NAME;
}

export function readRuntimeServerSessionId(): string | null {
  return getStoredAppSessionId() ?? getStoredAppSessionAuthToken() ?? null;
}

export function readRuntimeServerTokenBundle(): RuntimeServerTokenBundle {
  return runtimeServerTokenStore.readTokenBundle();
}

export function writeRuntimeServerSessionId(sessionId: string): string {
  const normalizedSessionId = normalizeOptionalTokenValue(sessionId);
  if (!normalizedSessionId) {
    throw new Error('Runtime server session token must not be empty.');
  }

  const currentBundle = readCurrentTokenBundle();
  runtimeServerTokenStore.persistTokenBundle({
    ...currentBundle,
    sessionToken: normalizedSessionId,
  });
  return normalizedSessionId;
}

export function writeRuntimeServerTokenBundle(
  bundle: RuntimeServerTokenBundle,
): RuntimeServerTokenBundle {
  runtimeServerTokenStore.persistTokenBundle(bundle);
  return runtimeServerTokenStore.readTokenBundle();
}

export function clearRuntimeServerSessionId(): void {
  runtimeServerTokenStore.clearTokenBundle();
}

export function resolveRuntimeServerSessionHeaders(): Record<string, string | undefined> {
  syncBirdCoderGlobalTokenManagerFromStorage();
  const tokens = getBirdCoderGlobalTokenManager().getTokens();
  const sessionId = getStoredAppSessionId();

  return {
    [RUNTIME_SERVER_ACCESS_TOKEN_HEADER_NAME]: tokens?.accessToken,
    [RUNTIME_SERVER_AUTHORIZATION_HEADER_NAME]:
      tokens?.authToken ? `${RUNTIME_SERVER_DEFAULT_TOKEN_TYPE} ${tokens.authToken}` : undefined,
    [RUNTIME_SERVER_SESSION_HEADER_NAME]: sessionId,
    'Refresh-Token': tokens?.refreshToken,
  };
}
