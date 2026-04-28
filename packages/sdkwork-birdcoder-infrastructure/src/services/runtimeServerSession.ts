import {
  BIRDCODER_USER_CENTER_SESSION_HEADER_NAME,
  BIRDCODER_USER_CENTER_STORAGE_PLAN,
  resolveBirdCoderProtectedToken,
} from "@sdkwork/birdcoder-core";
import {
  createUserCenterStandardTokenHeaders,
  type UserCenterStorageLike,
  type UserCenterTokenBundle,
  type UserCenterTokenStore,
} from "@sdkwork/user-center-core-pc-react";

const runtimeServerTokenHeaders = createUserCenterStandardTokenHeaders(
  BIRDCODER_USER_CENTER_STORAGE_PLAN,
);
const RUNTIME_SERVER_SESSION_STORAGE_KEY =
  BIRDCODER_USER_CENTER_STORAGE_PLAN.sessionTokenKey;
const RUNTIME_SERVER_SESSION_HEADER_NAME =
  BIRDCODER_USER_CENTER_SESSION_HEADER_NAME;
const RUNTIME_SERVER_DEFAULT_TOKEN_TYPE = "Bearer";
const RUNTIME_SERVER_TOKEN_STORAGE_KEYS = Object.freeze([
  BIRDCODER_USER_CENTER_STORAGE_PLAN.sessionTokenKey,
  BIRDCODER_USER_CENTER_STORAGE_PLAN.authTokenKey,
  BIRDCODER_USER_CENTER_STORAGE_PLAN.accessTokenKey,
  BIRDCODER_USER_CENTER_STORAGE_PLAN.refreshTokenKey,
  BIRDCODER_USER_CENTER_STORAGE_PLAN.tokenTypeKey,
]);

function isRuntimeServerStorageLike(
  storage: unknown,
): storage is UserCenterStorageLike {
  return Boolean(
    storage
      && typeof storage === "object"
      && "getItem" in storage
      && "removeItem" in storage
      && "setItem" in storage,
  );
}

function resolveRuntimeServerLocalStorage(): UserCenterStorageLike | null {
  if (typeof globalThis === "undefined") {
    return null;
  }

  try {
    const storage = (globalThis as Record<string, unknown>).localStorage;
    if (isRuntimeServerStorageLike(storage)) {
      return storage;
    }
  } catch {
    // Continue with the browser-style window lookup below.
  }

  try {
    const windowObject = (globalThis as Record<string, unknown>).window;
    if (!windowObject || typeof windowObject !== "object") {
      return null;
    }

    const storage = (windowObject as Record<string, unknown>).localStorage;
    return isRuntimeServerStorageLike(storage) ? storage : null;
  } catch {
    return null;
  }
}

function normalizeOptionalTokenValue(value: unknown): string | undefined {
  const normalizedValue = typeof value === "string" ? value.trim() : "";
  return normalizedValue || undefined;
}

function createRuntimeServerSyntheticTokenBundle(
  sessionId: string,
): UserCenterTokenBundle {
  return {
    accessToken: sessionId,
    authToken: sessionId,
    sessionToken: sessionId,
    tokenType: RUNTIME_SERVER_DEFAULT_TOKEN_TYPE,
  };
}

function normalizeRuntimeServerTokenBundle(
  bundle: UserCenterTokenBundle | undefined,
): UserCenterTokenBundle {
  if (!bundle) {
    return {};
  }

  return {
    ...(normalizeOptionalTokenValue(bundle.accessToken)
      ? { accessToken: normalizeOptionalTokenValue(bundle.accessToken) }
      : {}),
    ...(normalizeOptionalTokenValue(bundle.authToken)
      ? { authToken: normalizeOptionalTokenValue(bundle.authToken) }
      : {}),
    ...(normalizeOptionalTokenValue(bundle.refreshToken)
      ? { refreshToken: normalizeOptionalTokenValue(bundle.refreshToken) }
      : {}),
    ...(normalizeOptionalTokenValue(bundle.sessionToken)
      ? { sessionToken: normalizeOptionalTokenValue(bundle.sessionToken) }
      : {}),
    ...(normalizeOptionalTokenValue(bundle.tokenType)
      ? { tokenType: normalizeOptionalTokenValue(bundle.tokenType) }
      : {}),
  };
}

function mergeRuntimeServerTokenBundles(
  previousBundle: UserCenterTokenBundle,
  nextBundle: UserCenterTokenBundle,
): UserCenterTokenBundle {
  return normalizeRuntimeServerTokenBundle({
    ...previousBundle,
    ...nextBundle,
  });
}

function hasRuntimeServerTokenBundleValues(
  bundle: UserCenterTokenBundle,
): boolean {
  return Boolean(
    bundle.accessToken
      || bundle.authToken
      || bundle.refreshToken
      || bundle.sessionToken
      || bundle.tokenType,
  );
}

function readRuntimeServerStorageToken(
  storage: UserCenterStorageLike,
  key: string,
): string | undefined {
  try {
    const value = storage.getItem(key);
    const normalizedValue = normalizeOptionalTokenValue(value);
    if (!normalizedValue && value !== null) {
      storage.removeItem(key);
    }

    return normalizedValue;
  } catch {
    return undefined;
  }
}

function removeRuntimeServerStorageToken(
  storage: UserCenterStorageLike,
  key: string,
): boolean {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function writeRuntimeServerStorageToken(
  storage: UserCenterStorageLike,
  key: string,
  token: string | undefined,
): boolean {
  if (!token) {
    return removeRuntimeServerStorageToken(storage, key);
  }

  try {
    storage.setItem(key, token);
    return true;
  } catch {
    return false;
  }
}

function readRuntimeServerTokenBundleFromStorage(
  storage: UserCenterStorageLike,
): UserCenterTokenBundle {
  return normalizeRuntimeServerTokenBundle({
    accessToken: readRuntimeServerStorageToken(
      storage,
      BIRDCODER_USER_CENTER_STORAGE_PLAN.accessTokenKey,
    ),
    authToken: readRuntimeServerStorageToken(
      storage,
      BIRDCODER_USER_CENTER_STORAGE_PLAN.authTokenKey,
    ),
    refreshToken: readRuntimeServerStorageToken(
      storage,
      BIRDCODER_USER_CENTER_STORAGE_PLAN.refreshTokenKey,
    ),
    sessionToken: readRuntimeServerStorageToken(
      storage,
      RUNTIME_SERVER_SESSION_STORAGE_KEY,
    ),
    tokenType: readRuntimeServerStorageToken(
      storage,
      BIRDCODER_USER_CENTER_STORAGE_PLAN.tokenTypeKey,
    ),
  });
}

function persistRuntimeServerTokenBundleToStorage(
  storage: UserCenterStorageLike,
  bundle: UserCenterTokenBundle,
): boolean {
  const operations = [
    writeRuntimeServerStorageToken(
      storage,
      RUNTIME_SERVER_SESSION_STORAGE_KEY,
      bundle.sessionToken,
    ),
    writeRuntimeServerStorageToken(
      storage,
      BIRDCODER_USER_CENTER_STORAGE_PLAN.authTokenKey,
      bundle.authToken,
    ),
    writeRuntimeServerStorageToken(
      storage,
      BIRDCODER_USER_CENTER_STORAGE_PLAN.accessTokenKey,
      bundle.accessToken,
    ),
    writeRuntimeServerStorageToken(
      storage,
      BIRDCODER_USER_CENTER_STORAGE_PLAN.refreshTokenKey,
      bundle.refreshToken,
    ),
    writeRuntimeServerStorageToken(
      storage,
      BIRDCODER_USER_CENTER_STORAGE_PLAN.tokenTypeKey,
      bundle.tokenType,
    ),
  ];

  return operations.every(Boolean);
}

export function createRuntimeServerTokenStore(): UserCenterTokenStore {
  let memoryBundle: UserCenterTokenBundle = {};
  let shouldPreserveMemoryBundleWhenStorageIsEmpty = false;
  let shouldIgnoreStorageBundleAfterFailedClear = false;

  function readCurrentBundle(): UserCenterTokenBundle {
    const localStorage = resolveRuntimeServerLocalStorage();
    if (!localStorage || shouldIgnoreStorageBundleAfterFailedClear) {
      return {
        ...memoryBundle,
      };
    }

    const storageBundle = readRuntimeServerTokenBundleFromStorage(localStorage);
    if (!hasRuntimeServerTokenBundleValues(storageBundle)) {
      if (!shouldPreserveMemoryBundleWhenStorageIsEmpty) {
        memoryBundle = {};
      }

      return {
        ...memoryBundle,
      };
    }

    memoryBundle = shouldPreserveMemoryBundleWhenStorageIsEmpty
      ? mergeRuntimeServerTokenBundles(memoryBundle, storageBundle)
      : storageBundle;
    return {
      ...memoryBundle,
    };
  }

  return {
    clearTokenBundle() {
      const localStorage = resolveRuntimeServerLocalStorage();
      let didClearStorage = true;
      if (localStorage) {
        for (const key of RUNTIME_SERVER_TOKEN_STORAGE_KEYS) {
          didClearStorage = removeRuntimeServerStorageToken(localStorage, key)
            && didClearStorage;
        }
      }

      memoryBundle = {};
      shouldPreserveMemoryBundleWhenStorageIsEmpty = false;
      shouldIgnoreStorageBundleAfterFailedClear = localStorage ? !didClearStorage : false;
    },

    persistTokenBundle(bundle) {
      const normalizedBundle = normalizeRuntimeServerTokenBundle(bundle);
      if (!hasRuntimeServerTokenBundleValues(normalizedBundle)) {
        return false;
      }

      const mergedBundle = mergeRuntimeServerTokenBundles(
        readCurrentBundle(),
        normalizedBundle,
      );
      memoryBundle = mergedBundle;

      const localStorage = resolveRuntimeServerLocalStorage();
      if (!localStorage) {
        shouldPreserveMemoryBundleWhenStorageIsEmpty = false;
        return false;
      }

      const didPersistToStorage = persistRuntimeServerTokenBundleToStorage(
        localStorage,
        mergedBundle,
      );
      if (didPersistToStorage) {
        shouldPreserveMemoryBundleWhenStorageIsEmpty = false;
        shouldIgnoreStorageBundleAfterFailedClear = false;
      } else {
        shouldPreserveMemoryBundleWhenStorageIsEmpty = true;
      }

      return didPersistToStorage;
    },

    readTokenBundle() {
      return readCurrentBundle();
    },
  };
}

const runtimeServerTokenStore = createRuntimeServerTokenStore();

export function getRuntimeServerSessionHeaderName(): string {
  return RUNTIME_SERVER_SESSION_HEADER_NAME;
}

export function readRuntimeServerSessionId(): string | null {
  return runtimeServerTokenStore.readTokenBundle().sessionToken ?? null;
}

export function readRuntimeServerTokenBundle(): UserCenterTokenBundle {
  return runtimeServerTokenStore.readTokenBundle();
}

export function writeRuntimeServerSessionId(sessionId: string): string {
  const normalizedSessionId = normalizeOptionalTokenValue(sessionId);
  if (!normalizedSessionId) {
    throw new Error("Runtime server session token must not be empty.");
  }

  runtimeServerTokenStore.clearTokenBundle();
  runtimeServerTokenStore.persistTokenBundle(
    createRuntimeServerSyntheticTokenBundle(normalizedSessionId),
  );
  return normalizedSessionId;
}

export function writeRuntimeServerTokenBundle(
  bundle: UserCenterTokenBundle,
): UserCenterTokenBundle {
  const sessionToken =
    normalizeOptionalTokenValue(bundle.sessionToken)
    ?? normalizeOptionalTokenValue(bundle.authToken)
    ?? normalizeOptionalTokenValue(bundle.accessToken);
  const authToken = normalizeOptionalTokenValue(bundle.authToken) ?? sessionToken;
  const accessToken = normalizeOptionalTokenValue(bundle.accessToken) ?? sessionToken;
  const refreshToken = normalizeOptionalTokenValue(bundle.refreshToken);
  const tokenType =
    normalizeOptionalTokenValue(bundle.tokenType)
    ?? (authToken || accessToken || sessionToken
      ? RUNTIME_SERVER_DEFAULT_TOKEN_TYPE
      : undefined);

  runtimeServerTokenStore.persistTokenBundle({
    ...(accessToken ? { accessToken } : {}),
    ...(authToken ? { authToken } : {}),
    ...(refreshToken ? { refreshToken } : {}),
    ...(sessionToken ? { sessionToken } : {}),
    ...(tokenType ? { tokenType } : {}),
  });
  return runtimeServerTokenStore.readTokenBundle();
}

export function clearRuntimeServerSessionId(): void {
  runtimeServerTokenStore.clearTokenBundle();
}

export function resolveRuntimeServerSessionHeaders(): Record<string, string | undefined> {
  const tokenBundle = runtimeServerTokenStore.readTokenBundle();
  const sessionToken =
    normalizeOptionalTokenValue(tokenBundle.sessionToken)
    ?? resolveBirdCoderProtectedToken({
      tokenBundle,
    })
    ?? undefined;
  const authToken =
    normalizeOptionalTokenValue(tokenBundle.authToken)
    ?? normalizeOptionalTokenValue(tokenBundle.accessToken)
    ?? sessionToken
    ?? undefined;
  const accessToken =
    normalizeOptionalTokenValue(tokenBundle.accessToken)
    ?? normalizeOptionalTokenValue(tokenBundle.authToken)
    ?? sessionToken
    ?? undefined;
  const refreshToken = normalizeOptionalTokenValue(tokenBundle.refreshToken);
  const tokenType =
    normalizeOptionalTokenValue(tokenBundle.tokenType)
    ?? RUNTIME_SERVER_DEFAULT_TOKEN_TYPE;

  return {
    [RUNTIME_SERVER_SESSION_HEADER_NAME]: sessionToken,
    [runtimeServerTokenHeaders.accessTokenHeaderName]: accessToken,
    [runtimeServerTokenHeaders.authorizationHeaderName]:
      authToken ? `${tokenType} ${authToken}` : undefined,
    [runtimeServerTokenHeaders.refreshTokenHeaderName]: refreshToken,
  };
}
