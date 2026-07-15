import type {
  IamRuntime,
  IamSession,
} from '@sdkwork/iam-runtime';
import {
  hydrateAppSessionPersistence,
} from '@sdkwork/birdcoder-pc-core/appSessionPersistence';
import {
  getBirdCoderGlobalTokenManager,
  syncBirdCoderGlobalTokenManagerFromStorage,
} from '@sdkwork/birdcoder-pc-core/appSessionTokenManager';
import {
  APP_SESSION_CHANGE_EVENT_NAME,
  clearStoredAppSessionToken,
  loadStoredAppSessionToken,
  storeAppSessionFromResult,
  type StoredAppSessionToken,
} from './appSessionToken.ts';

/**
 * This is deliberately the generated app SDK method, not the IAM service
 * method. The IAM service commits a response before returning it; putting that
 * method behind a shared promise lets an obsolete response resurrect a
 * session after logout or a newer login.
 */
type CurrentSessionRetrieve = () => Promise<unknown>;
type MarkedCurrentSessionRetrieve = CurrentSessionRetrieve & {
  [CURRENT_SESSION_RETRIEVER_WRAPPER]?: true;
};

const CURRENT_SESSION_RETRIEVER_WRAPPER = Symbol.for(
  'sdkwork.birdcoder.current-session-retriever-wrapper',
);
const CURRENT_SESSION_AUTHORITY_VERSION = 2;
const KEY_SEPARATOR = '\u0001';

interface RetrieverBinding {
  directSdkRetrieve: boolean;
  retrieve: CurrentSessionRetrieve;
  scope: string;
}

interface CachedCurrentSession {
  fingerprint: string;
  key: string;
  tokenKey: string;
  value: IamSession;
}

interface InFlightCurrentSession {
  id: number;
  key: string;
  promise: Promise<IamSession | null>;
  tokenKey: string;
}

interface BirdCoderCurrentSessionAuthorityState {
  cache: CachedCurrentSession | null;
  inFlight: InFlightCurrentSession | null;
  listenerBound: boolean;
  requestId: number;
  retrievers: WeakMap<IamRuntime, RetrieverBinding>;
  version: number;
}

type BirdCoderCurrentSessionAuthorityHost = typeof globalThis & {
  __SDKWORK_BIRDCODER_CURRENT_SESSION_AUTHORITY__?: BirdCoderCurrentSessionAuthorityState;
  __SDKWORK_BIRDCODER_CURRENT_SESSION_AUTHORITY_LISTENER__?: EventListener;
  __SDKWORK_BIRDCODER_CURRENT_SESSION_RETRIEVE_DELEGATE__?: (
    runtime: IamRuntime,
  ) => Promise<IamSession | null>;
};

let authoritySessionChangeListenerInitialized = false;

(globalThis as BirdCoderCurrentSessionAuthorityHost)
  .__SDKWORK_BIRDCODER_CURRENT_SESSION_RETRIEVE_DELEGATE__ = retrieveBirdCoderCurrentSession;

export function bindBirdCoderCurrentSessionRetriever(
  runtime: IamRuntime,
  retrieve: CurrentSessionRetrieve,
): void {
  if (isAuthorityWrapper(retrieve)) {
    throw new Error('BirdCoder current-session authority must bind the raw SDK retrieve method.');
  }

  const state = getAuthorityState();
  state.retrievers.set(runtime, {
    directSdkRetrieve: true,
    retrieve,
    scope: resolveRuntimeScope(runtime),
  });
}

/** Wrap the one runtime-facing current-session method with the authority. */
export function createBirdCoderCurrentSessionRetriever(
  runtime: IamRuntime,
): () => Promise<IamSession> {
  const wrapper = (async () => {
    const host = globalThis as BirdCoderCurrentSessionAuthorityHost;
    const retrieve = host.__SDKWORK_BIRDCODER_CURRENT_SESSION_RETRIEVE_DELEGATE__
      ?? retrieveBirdCoderCurrentSession;
    const session = await retrieve(runtime);
    if (!session) {
      throw new Error('current IAM session is required');
    }
    return session;
  }) as MarkedCurrentSessionRetrieve;
  Object.defineProperty(wrapper, CURRENT_SESSION_RETRIEVER_WRAPPER, {
    configurable: false,
    enumerable: false,
    value: true,
  });
  return wrapper as () => Promise<IamSession>;
}

export async function retrieveBirdCoderCurrentSession(
  runtime: IamRuntime,
): Promise<IamSession | null> {
  await hydrateAppSessionPersistence();

  const state = getAuthorityState();
  const snapshot = await restoreBirdCoderStoredSession(runtime);
  if (!snapshot) {
    await clearStaleRuntimeCredentials(runtime);
    return null;
  }

  const binding = getRetrieverBinding(runtime, state);
  if (state.cache?.key === snapshot.key) {
    syncBirdCoderGlobalTokenManagerFromStorage();
    return state.cache.value;
  }
  if (state.inFlight?.key === snapshot.key) {
    return state.inFlight.promise;
  }

  const requestId = ++state.requestId;
  const requestKey = snapshot.key;
  const requestTokenKey = snapshot.tokenKey;
  const promise = Promise.resolve()
    .then(() => binding.retrieve())
    .then(async (rawSession) => {
      const session = normalizeIamSession(rawSession);

      // Logout/new-login may have happened while the network request was in
      // flight. Do not commit or return an obsolete response.
      if (!isCurrentRequest(state, requestId, requestKey)) {
        return null;
      }
      if ((await readCurrentTokenKey(runtime)) !== requestTokenKey) {
        return null;
      }

      let effectiveSession = session;
      if (binding.directSdkRetrieve) {
        storeAppSessionFromResult(session, { preserveSessionMetadata: true });
        syncBirdCoderGlobalTokenManagerFromStorage();
        const committed = loadStoredAppSessionToken();
        if (!committed || serializeSessionTokens(committed.authToken, committed.accessToken) !== serializeSessionTokens(session.authToken, session.accessToken)) {
          return null;
        }
        effectiveSession = mergeSessionWithStoredSession(session, committed);
      } else {
        // Test/custom runtimes may bind their already-committing service
        // method. Keep the fallback side-effect-free from this module.
        syncBirdCoderGlobalTokenManagerFromStorage();
      }

      const responseTokenKey = serializeSessionTokens(
        effectiveSession.authToken,
        effectiveSession.accessToken,
      );
      if (!responseTokenKey || !isCurrentRequest(state, requestId, requestKey)) {
        return null;
      }

      const cacheKey = createAuthorityKey(binding.scope, responseTokenKey);
      const committed = loadStoredAppSessionToken();
      state.cache = {
        fingerprint: sessionFingerprint(committed, effectiveSession),
        key: cacheKey,
        tokenKey: responseTokenKey,
        value: effectiveSession,
      };
      return effectiveSession;
    })
    .catch(async () => {
      // Only the request that still owns the same token generation may clear
      // credentials. All callers waiting on this promise observe the same
      // null result and cannot each trigger another clear/request cycle.
      if (isCurrentRequest(state, requestId, requestKey)
        && (await readCurrentTokenKey(runtime)) === requestTokenKey) {
        await clearAuthoritySession(runtime, state, requestId);
      }
      return null;
    })
    .finally(() => {
      if (state.inFlight?.id === requestId) {
        state.inFlight = null;
      }
    });

  state.inFlight = {
    id: requestId,
    key: requestKey,
    promise,
    tokenKey: requestTokenKey,
  };
  return promise;
}

/** Cache the session returned by login before any bootstrap listener runs. */
export function adoptBirdCoderCurrentSession(
  runtime: IamRuntime,
  session: unknown,
): void {
  let normalized: IamSession;
  try {
    normalized = normalizeIamSession(session);
  } catch {
    return;
  }

  const tokenKey = serializeSessionTokens(normalized.authToken, normalized.accessToken);
  if (!tokenKey) {
    return;
  }

  const state = getAuthorityState();
  const scope = resolveRuntimeScope(runtime);
  const stored = loadStoredAppSessionToken();
  state.requestId += 1;
  state.inFlight = null;
  state.cache = {
    fingerprint: sessionFingerprint(stored, normalized),
    key: createAuthorityKey(scope, tokenKey),
    tokenKey,
    value: normalized,
  };
}

export function invalidateBirdCoderCurrentSession(): void {
  const state = getAuthorityState();
  state.requestId += 1;
  state.cache = null;
  state.inFlight = null;
}

async function restoreBirdCoderStoredSession(
  runtime: IamRuntime,
): Promise<{ key: string; tokenKey: string } | null> {
  const persistedSession = loadStoredAppSessionToken();
  if (persistedSession && isExpired(persistedSession)) {
    clearStoredAppSessionToken();
    return null;
  }

  const runtimeSession = await runtime.tokenStore.get();
  const hasPersistedSession = Boolean(persistedSession);
  const authToken = persistedSession
    ? optionalToken(persistedSession.authToken)
    : optionalToken(runtimeSession.authToken);
  const accessToken = persistedSession
    ? optionalToken(persistedSession.accessToken)
    : optionalToken(runtimeSession.accessToken);
  const tokenKey = serializeSessionTokens(authToken, accessToken);
  if (!tokenKey || (hasPersistedSession && (!authToken || !accessToken))) {
    return null;
  }

  const storedSession = persistedSession ?? runtimeSession;
  const managerTokens = runtime.tokenManager?.getTokens();
  if (
    runtime.tokenManager
    && (
      managerTokens?.authToken !== authToken
      || managerTokens?.accessToken !== accessToken
    )
  ) {
    runtime.tokenManager.setTokens({
      authToken,
      accessToken,
      ...(storedSession.refreshToken
        ? { refreshToken: storedSession.refreshToken }
        : {}),
      ...(typeof storedSession.expiresAt === 'number'
        ? { expiresAt: normalizeExpiryMilliseconds(storedSession.expiresAt) }
        : {}),
    });
  }
  syncBirdCoderGlobalTokenManagerFromStorage();

  return {
    key: createAuthorityKey(resolveRuntimeScope(runtime), tokenKey),
    tokenKey,
  };
}

function getRetrieverBinding(
  runtime: IamRuntime,
  state: BirdCoderCurrentSessionAuthorityState,
): RetrieverBinding {
  const existing = state.retrievers.get(runtime);
  if (existing) {
    return existing;
  }

  const candidate = runtime.service.auth.sessions.current.retrieve as CurrentSessionRetrieve;
  if (isAuthorityWrapper(candidate)) {
    throw new Error('BirdCoder current-session runtime was not bound to a raw SDK retriever.');
  }

  // Keep custom/test runtimes usable. Production BirdCoder runtimes always
  // bind a pure generated SDK method before installing the wrapper.
  const fallback: RetrieverBinding = {
    directSdkRetrieve: false,
    retrieve: candidate.bind(runtime.service.auth.sessions.current),
    scope: resolveRuntimeScope(runtime),
  };
  state.retrievers.set(runtime, fallback);
  return fallback;
}

function normalizeIamSession(value: unknown): IamSession {
  const payload = readCurrentSessionPayload(value);
  const accessToken = optionalToken(payload.accessToken);
  const authToken = optionalToken(payload.authToken);
  if (!accessToken || !authToken) {
    throw new Error('Current IAM session response is missing dual-token credentials.');
  }

  const session: IamSession = { accessToken, authToken };
  const refreshToken = optionalToken(payload.refreshToken);
  const sessionId = optionalToken(payload.sessionId);
  if (refreshToken) {
    session.refreshToken = refreshToken;
  }
  if (sessionId) {
    session.sessionId = sessionId;
  }
  if (payload.expiresAt !== undefined && payload.expiresAt !== null) {
    session.expiresAt = typeof payload.expiresAt === 'number'
      ? normalizeExpirySeconds(payload.expiresAt)
      : payload.expiresAt as string;
  }
  if (isRecord(payload.context)) {
    session.context = payload.context as unknown as IamSession['context'];
  }
  if (isRecord(payload.user)) {
    session.user = payload.user as unknown as IamSession['user'];
  }
  return session;
}

function readCurrentSessionPayload(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {};
  }
  const data = value.data;
  if (isRecord(data)) {
    return isRecord(data.item) ? data.item : data;
  }
  return isRecord(value.item) ? value.item : value;
}

function mergeSessionWithStoredSession(
  session: IamSession,
  stored: StoredAppSessionToken,
): IamSession {
  return {
    ...session,
    ...(session.context ? {} : stored.context ? { context: stored.context } : {}),
    ...(session.user ? {} : stored.user ? { user: stored.user } : {}),
    ...(session.sessionId ? {} : stored.sessionId ? { sessionId: stored.sessionId } : {}),
  };
}

async function readCurrentTokenKey(runtime: IamRuntime): Promise<string | null> {
  const persisted = loadStoredAppSessionToken();
  if (persisted && !isExpired(persisted)) {
    return serializeSessionTokens(persisted.authToken, persisted.accessToken);
  }
  if (persisted) {
    return null;
  }
  const runtimeSession = await runtime.tokenStore.get();
  return serializeSessionTokens(runtimeSession.authToken, runtimeSession.accessToken);
}

async function clearAuthoritySession(
  runtime: IamRuntime,
  state: BirdCoderCurrentSessionAuthorityState,
  requestId: number,
): Promise<void> {
  if (state.requestId !== requestId) {
    return;
  }
  state.requestId += 1;
  state.cache = null;
  state.inFlight = null;
  runtime.tokenManager?.clearTokens();
  getBirdCoderGlobalTokenManager().clearTokens();
  try {
    await runtime.tokenStore.clear();
  } catch {
    // The durable app-session clear below remains authoritative.
  }
  try {
    await runtime.contextStore.clear();
  } catch {
    // A missing context must not prevent credential cleanup.
  }
  if (loadStoredAppSessionToken()) {
    clearStoredAppSessionToken();
  }
}

async function clearStaleRuntimeCredentials(runtime: IamRuntime): Promise<void> {
  runtime.tokenManager?.clearTokens();
  getBirdCoderGlobalTokenManager().clearTokens();
}

function isCurrentRequest(
  state: BirdCoderCurrentSessionAuthorityState,
  requestId: number,
  requestKey: string,
): boolean {
  return state.requestId === requestId && state.inFlight?.id === requestId && state.inFlight.key === requestKey;
}

function resolveRuntimeScope(runtime: IamRuntime): string {
  return [
    runtime.config?.appId ?? '',
    runtime.config?.environment ?? '',
    runtime.config?.deploymentMode ?? '',
    normalizeScopeUrl(runtime.config?.appApiBaseUrl),
  ].join(KEY_SEPARATOR);
}

function normalizeScopeUrl(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/u, '').toLowerCase();
}

function createAuthorityKey(scope: string, tokenKey: string): string {
  return `${scope}${KEY_SEPARATOR}${tokenKey}`;
}

function sessionFingerprint(
  stored: StoredAppSessionToken | null,
  session: IamSession,
): string {
  const source = stored ?? session;
  try {
    return JSON.stringify({
      accessToken: source.accessToken,
      authToken: source.authToken,
      context: source.context,
      expiresAt: source.expiresAt,
      refreshToken: source.refreshToken,
      sessionId: source.sessionId,
      user: source.user,
    });
  } catch {
    return `${source.authToken}:${source.accessToken}`;
  }
}

function ensureAuthoritySessionChangeListener(
  state: BirdCoderCurrentSessionAuthorityState,
): void {
  if (authoritySessionChangeListenerInitialized) {
    return;
  }
  authoritySessionChangeListenerInitialized = true;
  state.listenerBound = true;
  try {
    const host = globalThis as BirdCoderCurrentSessionAuthorityHost;
    if (host.__SDKWORK_BIRDCODER_CURRENT_SESSION_AUTHORITY_LISTENER__) {
      globalThis.removeEventListener?.(
        APP_SESSION_CHANGE_EVENT_NAME,
        host.__SDKWORK_BIRDCODER_CURRENT_SESSION_AUTHORITY_LISTENER__,
      );
    }
    const listener: EventListener = () => {
      const stored = loadStoredAppSessionToken();
      const tokenKey = stored
        ? serializeSessionTokens(stored.authToken, stored.accessToken)
        : null;
      if (!tokenKey) {
        state.requestId += 1;
        state.cache = null;
        state.inFlight = null;
        return;
      }
      if (state.cache
        && (state.cache.tokenKey !== tokenKey
          || state.cache.fingerprint !== sessionFingerprint(stored, state.cache.value))) {
        state.requestId += 1;
        state.cache = null;
        state.inFlight = null;
      }
    };
    globalThis.addEventListener?.(APP_SESSION_CHANGE_EVENT_NAME, listener);
    host.__SDKWORK_BIRDCODER_CURRENT_SESSION_AUTHORITY_LISTENER__ = listener;
  } catch {
    // Non-browser runtimes do not expose an event target.
  }
}

function getAuthorityState(): BirdCoderCurrentSessionAuthorityState {
  const host = globalThis as BirdCoderCurrentSessionAuthorityHost;
  const existing = host.__SDKWORK_BIRDCODER_CURRENT_SESSION_AUTHORITY__;
  if (
    !existing
    || existing.version !== CURRENT_SESSION_AUTHORITY_VERSION
    || !(existing.retrievers instanceof WeakMap)
  ) {
    host.__SDKWORK_BIRDCODER_CURRENT_SESSION_AUTHORITY__ = {
      cache: null,
      inFlight: null,
      listenerBound: false,
      requestId: 0,
      retrievers: new WeakMap<IamRuntime, RetrieverBinding>(),
      version: CURRENT_SESSION_AUTHORITY_VERSION,
    };
  }
  const state = host.__SDKWORK_BIRDCODER_CURRENT_SESSION_AUTHORITY__ as BirdCoderCurrentSessionAuthorityState;
  ensureAuthoritySessionChangeListener(state);
  return state;
}

function serializeSessionTokens(
  authToken: unknown,
  accessToken: unknown,
): string | null {
  const normalizedAuthToken = optionalToken(authToken);
  const normalizedAccessToken = optionalToken(accessToken);
  if (!normalizedAuthToken || !normalizedAccessToken) {
    return null;
  }
  return `${normalizedAuthToken}${KEY_SEPARATOR}${normalizedAccessToken}`;
}

function optionalToken(value: unknown): string | undefined {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
}

function normalizeExpirySeconds(value: number): number {
  return Math.floor(value >= 10_000_000_000 ? value / 1_000 : value);
}

function normalizeExpiryMilliseconds(value: number): number {
  return value < 10_000_000_000 ? value * 1_000 : value;
}

function isExpired(token: StoredAppSessionToken): boolean {
  return typeof token.expiresAt === 'number'
    && token.expiresAt <= Math.floor(Date.now() / 1_000) + 30;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAuthorityWrapper(value: unknown): value is MarkedCurrentSessionRetrieve {
  return typeof value === 'function' && Boolean(
    (value as MarkedCurrentSessionRetrieve)[CURRENT_SESSION_RETRIEVER_WRAPPER],
  );
}
