import type {
  IamRuntime,
  IamSession,
} from '@sdkwork/iam-runtime';
import type { IamUser } from '@sdkwork/iam-service';
import { hydrateAppSessionPersistence } from '@sdkwork/birdcoder-pc-core/appSessionPersistence';
import {
  APP_SESSION_CHANGE_EVENT_NAME,
  loadStoredAppSessionToken,
  storeAppSessionFromResult,
} from './appSessionToken.ts';
import {
  adoptBirdCoderCurrentSession,
  retrieveBirdCoderCurrentSession,
} from './iamCurrentSession.ts';

const AUTHORITY_VERSION = 2;
const KEY_SEPARATOR = '\u0001';
const FAILED_PROFILE_COOLDOWN_MS = 10_000;
const CURRENT_USER_RETRIEVER_WRAPPER = Symbol.for(
  'sdkwork.birdcoder.current-user-retriever-wrapper',
);

interface CachedCurrentUser {
  error?: unknown;
  expiresAt: number;
  key: string;
  tokenKey: string;
  user: IamUser | null;
}

interface InFlightCurrentUser {
  id: number;
  key: string;
  promise: Promise<IamUser | null>;
  tokenKey: string;
}

interface CurrentUserAuthorityState {
  cache: CachedCurrentUser | null;
  inFlight: InFlightCurrentUser | null;
  listenerBound: boolean;
  requestId: number;
  retrievers: WeakMap<IamRuntime, CurrentUserRetrieve>;
  version: number;
}

type CurrentUserRetrieve = () => Promise<unknown>;
type MarkedCurrentUserRetrieve = CurrentUserRetrieve & {
  [CURRENT_USER_RETRIEVER_WRAPPER]?: true;
};

type CurrentUserAuthorityHost = typeof globalThis & {
  __SDKWORK_BIRDCODER_CURRENT_USER_AUTHORITY__?: CurrentUserAuthorityState;
  __SDKWORK_BIRDCODER_CURRENT_USER_AUTHORITY_LISTENER__?: EventListener;
  __SDKWORK_BIRDCODER_CURRENT_USER_RETRIEVE_DELEGATE__?: (
    runtime: IamRuntime,
    knownSession?: IamSession | null,
  ) => Promise<IamUser | null>;
};

let listenerInitialized = false;
let runtimeInstanceSequence = 0;
const runtimeInstanceKeys = new WeakMap<IamRuntime, string>();

(globalThis as CurrentUserAuthorityHost)
  .__SDKWORK_BIRDCODER_CURRENT_USER_RETRIEVE_DELEGATE__ = retrieveBirdCoderCurrentUser;

export function bindBirdCoderCurrentUserRetriever(
  runtime: IamRuntime,
  retrieve: CurrentUserRetrieve,
): void {
  if (isAuthorityWrapper(retrieve)) {
    throw new Error('BirdCoder current-user authority must bind the raw SDK retrieve method.');
  }
  getAuthorityState().retrievers.set(runtime, retrieve);
}

export function createBirdCoderCurrentUserRetriever(
  runtime: IamRuntime,
): () => Promise<IamUser> {
  const wrapper = (async () => {
    const host = globalThis as CurrentUserAuthorityHost;
    const retrieve = host.__SDKWORK_BIRDCODER_CURRENT_USER_RETRIEVE_DELEGATE__
      ?? retrieveBirdCoderCurrentUser;
    const user = await retrieve(runtime);
    if (!user) {
      throw new Error('current IAM user is required');
    }
    return user;
  }) as MarkedCurrentUserRetrieve;
  Object.defineProperty(wrapper, CURRENT_USER_RETRIEVER_WRAPPER, {
    configurable: false,
    enumerable: false,
    value: true,
  });
  return wrapper as () => Promise<IamUser>;
}

export async function retrieveBirdCoderCurrentUser(
  runtime: IamRuntime,
  knownSession?: IamSession | null,
): Promise<IamUser | null> {
  await hydrateAppSessionPersistence();
  const session = knownSession === undefined
    ? await retrieveBirdCoderCurrentSession(runtime)
    : knownSession;
  if (!session) {
    return null;
  }

  const sessionKey = serializeSessionTokens(session.authToken, session.accessToken);
  if (!sessionKey) {
    return null;
  }

  const state = getAuthorityState();
  const key = createAuthorityKey(runtime, sessionKey);
  if (session.user) {
    adoptBirdCoderCurrentUser(runtime, session.user, session);
    return session.user;
  }

  const cached = state.cache;
  if (cached?.key === key) {
    if (cached.user) {
      return cached.user;
    }
    if (cached.expiresAt > Date.now()) {
      if (cached.error !== undefined) {
        throw cached.error;
      }
      return null;
    }
  }
  if (state.inFlight?.key === key) {
    return state.inFlight.promise;
  }

  const requestId = ++state.requestId;
  const retrieve = getCurrentUserRetriever(runtime, state);
  const promise = Promise.resolve()
    .then(() => retrieve())
    .then(async (user) => {
      if (!isCurrentRequest(state, requestId, key)) {
        return null;
      }
      const currentTokenKey = await readCurrentTokenKey(runtime);
      if (!isCurrentRequest(state, requestId, key) || currentTokenKey !== sessionKey) {
        return null;
      }

      const normalizedUser = normalizeIamUser(user);
      const storedSession = loadStoredAppSessionToken();
      if (storedSession
        && serializeSessionTokens(storedSession.authToken, storedSession.accessToken) === sessionKey) {
        const stored = storeAppSessionFromResult({
          ...storedSession,
          user: normalizedUser,
        }, { preserveSessionMetadata: true });
        adoptBirdCoderCurrentSession(runtime, {
          ...session,
          ...stored,
          user: normalizedUser,
        });
      }
      state.cache = {
        expiresAt: Number.POSITIVE_INFINITY,
        key,
        tokenKey: sessionKey,
        user: normalizedUser,
      };
      return normalizedUser;
    })
    .catch(async (error: unknown) => {
      const currentTokenKey = await readCurrentTokenKey(runtime);
      if (isCurrentRequest(state, requestId, key) && currentTokenKey === sessionKey) {
        state.cache = {
          error,
          expiresAt: Date.now() + FAILED_PROFILE_COOLDOWN_MS,
          key,
          tokenKey: sessionKey,
          user: null,
        };
      }
      throw error;
    })
    .finally(() => {
      if (state.inFlight?.id === requestId) {
        state.inFlight = null;
      }
    });

  state.inFlight = {
    id: requestId,
    key,
    promise,
    tokenKey: sessionKey,
  };
  return promise;
}

export function invalidateBirdCoderCurrentUser(): void {
  const state = getAuthorityState();
  state.requestId += 1;
  state.cache = null;
  state.inFlight = null;
}

export function adoptBirdCoderCurrentUser(
  runtime: IamRuntime,
  user: IamUser,
  session?: Pick<IamSession, 'accessToken' | 'authToken'>,
): void {
  const stored = loadStoredAppSessionToken();
  const tokenKey = serializeSessionTokens(
    session?.authToken ?? stored?.authToken,
    session?.accessToken ?? stored?.accessToken,
  );
  if (!tokenKey) {
    return;
  }
  const state = getAuthorityState();
  adoptCurrentUser(
    state,
    createAuthorityKey(runtime, tokenKey),
    tokenKey,
    user,
  );
}

function adoptCurrentUser(
  state: CurrentUserAuthorityState,
  key: string,
  tokenKey: string,
  user: IamUser,
): void {
  if (state.cache?.key === key && state.cache.user === user) {
    return;
  }
  state.requestId += 1;
  state.inFlight = null;
  state.cache = {
    expiresAt: Number.POSITIVE_INFINITY,
    key,
    tokenKey,
    user,
  };
}

function normalizeIamUser(value: unknown): IamUser {
  if (!isRecord(value)) {
    throw new Error('Current IAM user response is invalid.');
  }
  const payload = value;

  const email = optionalToken(payload.email);
  const username = optionalToken(payload.username);
  const displayName = optionalToken(payload.displayName)
    ?? optionalToken(payload.nickname)
    ?? optionalToken(payload.name)
    ?? username
    ?? email
    ?? 'SDKWork User';
  const id = optionalToken(payload.userId) ?? optionalToken(payload.id);
  return {
    ...payload,
    displayName,
    ...(isRecord(payload.avatar)
      ? { avatar: payload.avatar as unknown as IamUser['avatar'] }
      : {}),
    ...(email ? { email } : {}),
    ...(id ? { id } : {}),
    ...(username ? { username } : {}),
  } as unknown as IamUser;
}

function getCurrentUserRetriever(
  runtime: IamRuntime,
  state: CurrentUserAuthorityState,
): CurrentUserRetrieve {
  const bound = state.retrievers.get(runtime);
  if (bound) {
    return bound;
  }
  const candidate = runtime.service.iam.users.current.retrieve as CurrentUserRetrieve;
  if (isAuthorityWrapper(candidate)) {
    throw new Error('BirdCoder current-user runtime was not bound to a raw SDK retriever.');
  }
  const fallback = candidate.bind(
    runtime.service.iam.users.current,
  );
  state.retrievers.set(runtime, fallback);
  return fallback;
}

async function readCurrentTokenKey(runtime: IamRuntime): Promise<string | null> {
  const stored = loadStoredAppSessionToken();
  if (stored) {
    return serializeSessionTokens(stored.authToken, stored.accessToken);
  }
  const runtimeSession = await runtime.tokenStore.get();
  return serializeSessionTokens(runtimeSession.authToken, runtimeSession.accessToken);
}

function isCurrentRequest(
  state: CurrentUserAuthorityState,
  requestId: number,
  key: string,
): boolean {
  return state.requestId === requestId
    && state.inFlight?.id === requestId
    && state.inFlight.key === key;
}

function createAuthorityKey(runtime: IamRuntime, sessionKey: string): string {
  const runtimeConfig = runtime.config;
  if (!runtimeConfig) {
    let runtimeInstanceKey = runtimeInstanceKeys.get(runtime);
    if (!runtimeInstanceKey) {
      runtimeInstanceSequence += 1;
      runtimeInstanceKey = `runtime-${runtimeInstanceSequence}`;
      runtimeInstanceKeys.set(runtime, runtimeInstanceKey);
    }
    return `${runtimeInstanceKey}${KEY_SEPARATOR}${sessionKey}`;
  }

  return [
    runtimeConfig.appId,
    runtimeConfig.environment,
    runtimeConfig.deploymentMode,
    (runtimeConfig.appApiBaseUrl ?? '').trim().replace(/\/+$/u, '').toLowerCase(),
    sessionKey,
  ].join(KEY_SEPARATOR);
}

function serializeSessionTokens(authToken: unknown, accessToken: unknown): string | null {
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

function getAuthorityState(): CurrentUserAuthorityState {
  const host = globalThis as CurrentUserAuthorityHost;
  const existing = host.__SDKWORK_BIRDCODER_CURRENT_USER_AUTHORITY__;
  if (
    !existing
    || existing.version !== AUTHORITY_VERSION
    || !(existing.retrievers instanceof WeakMap)
  ) {
    host.__SDKWORK_BIRDCODER_CURRENT_USER_AUTHORITY__ = {
      cache: null,
      inFlight: null,
      listenerBound: false,
      requestId: 0,
      retrievers: new WeakMap<IamRuntime, CurrentUserRetrieve>(),
      version: AUTHORITY_VERSION,
    };
  }

  const state = host.__SDKWORK_BIRDCODER_CURRENT_USER_AUTHORITY__ as CurrentUserAuthorityState;
  ensureSessionChangeListener(state);
  return state;
}

function ensureSessionChangeListener(state: CurrentUserAuthorityState): void {
  if (listenerInitialized) {
    return;
  }
  listenerInitialized = true;
  state.listenerBound = true;
  try {
    const host = globalThis as CurrentUserAuthorityHost;
    const previous = host.__SDKWORK_BIRDCODER_CURRENT_USER_AUTHORITY_LISTENER__;
    if (previous) {
      globalThis.removeEventListener?.(APP_SESSION_CHANGE_EVENT_NAME, previous);
    }
    const listener: EventListener = () => {
      const stored = loadStoredAppSessionToken();
      const tokenKey = stored
        ? serializeSessionTokens(stored.authToken, stored.accessToken)
        : null;
      const tokenChanged = !tokenKey
        || (state.cache !== null && state.cache.tokenKey !== tokenKey)
        || (state.inFlight !== null && state.inFlight.tokenKey !== tokenKey);
      if (tokenChanged) {
        state.requestId += 1;
        state.cache = null;
        state.inFlight = null;
        return;
      }
      if (stored?.user && state.cache?.tokenKey === tokenKey) {
        state.cache = {
          expiresAt: Number.POSITIVE_INFINITY,
          key: state.cache.key,
          tokenKey,
          user: stored.user,
        };
      }
    };
    globalThis.addEventListener?.(APP_SESSION_CHANGE_EVENT_NAME, listener);
    host.__SDKWORK_BIRDCODER_CURRENT_USER_AUTHORITY_LISTENER__ = listener;
  } catch {
    // Non-browser hosts do not expose a global event target.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAuthorityWrapper(value: unknown): value is MarkedCurrentUserRetrieve {
  return typeof value === 'function' && Boolean(
    (value as MarkedCurrentUserRetrieve)[CURRENT_USER_RETRIEVER_WRAPPER],
  );
}
