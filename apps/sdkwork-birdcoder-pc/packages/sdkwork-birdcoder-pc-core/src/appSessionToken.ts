import { APP_SESSION_CHANGE_EVENT_NAME } from './appSessionEvents.ts';
import {
  APP_SESSION_STORAGE_KEY,
  getAppSessionPersistencePort,
} from './appSessionPersistence.ts';
import type { IamSession } from '@sdkwork/iam-service';

type IamAppContext = NonNullable<IamSession['context']>;
type IamUser = NonNullable<IamSession['user']>;

export { APP_SESSION_CHANGE_EVENT_NAME } from './appSessionEvents.ts';
export { APP_SESSION_STORAGE_KEY } from './appSessionPersistence.ts';

const EXPIRY_SKEW_SECONDS = 30;

export interface StoredAppSessionToken {
  accessToken: string;
  authToken: string;
  context?: IamAppContext;
  expiresAt?: number;
  refreshToken?: string;
  sessionId?: string;
  storedAt: number;
  user?: IamUser;
}

/**
 * Shape persisted to disk. Sensitive long-lived credentials (refreshToken)
 * are stripped before persistence so that plaintext storage backends
 * (Capacitor `@capacitor/preferences` on iOS NSUserDefaults / Android
 * SharedPreferences) cannot leak long-lived refresh tokens at rest.
 *
 * The in-memory `memoryToken` retains the full token including
 * `refreshToken`; only the persisted representation omits it. On restart,
 * `loadStoredAppSessionToken()` returns a token without `refreshToken`,
 * causing the app-session refresh loop to skip scheduling until the user
 * re-authenticates and a fresh `refreshToken` is obtained in memory.
 */
export interface PersistedAppSessionToken {
  accessToken: string;
  authToken: string;
  context?: IamAppContext;
  expiresAt?: number;
  sessionId?: string;
  storedAt: number;
  user?: IamUser;
}

export interface StoreAppSessionOptions {
  preserveSessionMetadata?: boolean;
}

let memoryToken: StoredAppSessionToken | null = null;
let storageLoaded = false;
let sessionChangeNotificationPending = false;
let sessionChangeNotificationTimer: ReturnType<typeof setTimeout> | null = null;

export function storeAppSessionFromResult(
  result: unknown,
  options: StoreAppSessionOptions = {},
): StoredAppSessionToken {
  const previousToken = loadStoredAppSessionToken();
  const data = readAppSessionPayload(result);
  const accessToken = readString(data, 'accessToken');
  const authToken = readString(data, 'authToken');
  const responseExpiresAt = readOptionalExpiry(data, 'expiresAt');
  const responseRefreshToken = readString(data, 'refreshToken');
  const responseSessionId = readString(data, 'sessionId');
  const preserveSessionMetadata = options.preserveSessionMetadata
    ?? Boolean(
      previousToken
      && (
        (
          previousToken.authToken === authToken
          && previousToken.accessToken === accessToken
        )
        || (
          responseSessionId
          && previousToken.sessionId === responseSessionId
        )
      ),
    );
  const refreshToken = responseRefreshToken
    || (preserveSessionMetadata ? previousToken?.refreshToken ?? '' : '');
  const sessionId = responseSessionId
    || (preserveSessionMetadata ? previousToken?.sessionId ?? '' : '');
  const context = readOptionalSessionContext(
    data,
    preserveSessionMetadata ? previousToken?.context : undefined,
  );
  const user = readOptionalSessionUser(
    data,
    preserveSessionMetadata ? previousToken?.user : undefined,
  );
  const expiresAt = responseExpiresAt
    ?? (preserveSessionMetadata ? previousToken?.expiresAt : undefined);

  if (!accessToken || !authToken) {
    throw new Error('App session response is missing valid SDKWork IAM token data.');
  }

  const stored: StoredAppSessionToken = {
    accessToken,
    authToken,
    ...(context ? { context } : {}),
    ...(Number.isFinite(expiresAt) ? { expiresAt } : {}),
    ...(refreshToken ? { refreshToken } : {}),
    ...(sessionId ? { sessionId } : {}),
    storedAt: currentUnixSeconds(),
    ...(user ? { user } : {}),
  };

  const unchanged = isSameSessionToken(previousToken, stored);

  memoryToken = stored;
  storageLoaded = true;

  if (!unchanged) {
    writeSessionStorage(stored);
    // The IAM runtime synchronizes its shared TokenManager immediately after
    // tokenStore.set() resolves. Defer the event until that commit continuation
    // has run so listeners never validate a newly stored session without auth
    // headers.
    scheduleAppSessionChange();
  }
  return stored;
}

function isSameSessionToken(
  previous: StoredAppSessionToken | null,
  next: StoredAppSessionToken,
): boolean {
  if (!previous) {
    return false;
  }
  return (
    previous.authToken === next.authToken
    && previous.accessToken === next.accessToken
    && previous.expiresAt === next.expiresAt
    && previous.refreshToken === next.refreshToken
    && previous.sessionId === next.sessionId
    && areJsonValuesEqual(previous.context, next.context)
    && areJsonValuesEqual(previous.user, next.user)
  );
}

export function getStoredAppSessionToken(now = currentUnixSeconds()): string | undefined {
  return getStoredAppSessionAuthToken(now);
}

export function getStoredAppSessionAuthToken(now = currentUnixSeconds()): string | undefined {
  const token = loadStoredAppSessionToken();
  if (!token) {
    return undefined;
  }
  if (isExpired(token, now)) {
    clearStoredAppSessionToken();
    return undefined;
  }
  return token.authToken;
}

export function getStoredAppSessionAccessToken(now = currentUnixSeconds()): string | undefined {
  const token = loadStoredAppSessionToken();
  if (!token) {
    return undefined;
  }
  if (isExpired(token, now)) {
    clearStoredAppSessionToken();
    return undefined;
  }
  return token.accessToken;
}

export function getStoredAppSessionRefreshToken(now = currentUnixSeconds()): string | undefined {
  const token = loadStoredAppSessionToken();
  if (!token) {
    return undefined;
  }
  if (isExpired(token, now)) {
    clearStoredAppSessionToken();
    return undefined;
  }
  return token.refreshToken;
}

export function getStoredAppSessionId(now = currentUnixSeconds()): string | undefined {
  const token = loadStoredAppSessionToken();
  if (!token) {
    return undefined;
  }
  if (isExpired(token, now)) {
    clearStoredAppSessionToken();
    return undefined;
  }
  return token.sessionId;
}

export function loadStoredAppSessionToken(): StoredAppSessionToken | null {
  // Capture the in-memory refreshToken BEFORE any control-flow narrowing
  // of `memoryToken`. TypeScript narrows `memoryToken` to `null` after the
  // early return below (if it were truthy we would have returned), which
  // would otherwise make any subsequent `memoryToken?.refreshToken` access
  // a compile error. Reading the value first into a `const` local at the
  // top of the function preserves the in-memory refreshToken across storage
  // reloads within the same process.
  const preservedRefreshToken = memoryToken?.refreshToken;
  if (memoryToken || storageLoaded) {
    return memoryToken;
  }

  storageLoaded = true;
  const raw = readSessionStorage();
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isStoredAppSessionToken(parsed)) {
      clearStoredAppSessionToken();
      return null;
    }
    // Persisted shape never contains refreshToken (stripped on write).
    // If we already have a refreshToken in memory (e.g. still in the same
    // process lifetime), preserve it so refresh loops keep working.
    const merged: StoredAppSessionToken = {
      accessToken: parsed.accessToken,
      authToken: parsed.authToken,
      storedAt: parsed.storedAt,
      ...(parsed.context ? { context: parsed.context } : {}),
      ...(typeof parsed.expiresAt === 'number'
        ? { expiresAt: normalizeEpochSeconds(parsed.expiresAt) }
        : {}),
      ...(typeof parsed.sessionId === 'string' ? { sessionId: parsed.sessionId } : {}),
      ...(preservedRefreshToken ? { refreshToken: preservedRefreshToken } : {}),
      ...(parsed.user ? { user: parsed.user } : {}),
    };
    memoryToken = merged;
    return merged;
  } catch {
    clearStoredAppSessionToken();
    return null;
  }
}

export function clearStoredAppSessionToken(): void {
  const hadSession = memoryToken !== null
    || (!storageLoaded && readSessionStorage() !== null);
  if (sessionChangeNotificationTimer !== null) {
    globalThis.clearTimeout?.(sessionChangeNotificationTimer);
    sessionChangeNotificationTimer = null;
  }
  sessionChangeNotificationPending = false;
  memoryToken = null;
  storageLoaded = true;
  removeSessionStorage();
  if (hadSession) {
    dispatchAppSessionChange();
  }
}

export function resetAppSessionTokenStorageCache(): void {
  memoryToken = null;
  storageLoaded = false;
}

function readAppSessionPayload(result: unknown): Record<string, unknown> {
  if (!isRecord(result)) {
    return {};
  }

  const data = result.data;
  if (isRecord(data)) {
    if (isRecord(data.item)) {
      return data.item;
    }
    return data;
  }

  if (isRecord(result.item)) {
    return result.item;
  }

  return result;
}

function isExpired(token: StoredAppSessionToken, now: number): boolean {
  if (typeof token.expiresAt !== 'number') {
    return false;
  }
  return token.expiresAt <= now + EXPIRY_SKEW_SECONDS;
}

function isStoredAppSessionToken(value: unknown): value is StoredAppSessionToken {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.accessToken === 'string' &&
    value.accessToken.trim().length > 0 &&
    typeof value.authToken === 'string' &&
    value.authToken.trim().length > 0 &&
    typeof value.storedAt === 'number' &&
    Number.isFinite(value.storedAt) &&
    (value.expiresAt === undefined ||
      (typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt))) &&
    (value.refreshToken === undefined ||
      (typeof value.refreshToken === 'string' && value.refreshToken.trim().length > 0)) &&
    (value.sessionId === undefined ||
      (typeof value.sessionId === 'string' && value.sessionId.trim().length > 0)) &&
    (value.context === undefined || isRecord(value.context)) &&
    (value.user === undefined || isRecord(value.user))
  );
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value.trim() : '';
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    return Number(value);
  }
  return Number.NaN;
}

function readOptionalExpiry(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsedNumber = readNumber(record, key);
  if (Number.isFinite(parsedNumber)) {
    return normalizeEpochSeconds(parsedNumber);
  }

  if (typeof value === 'string') {
    const parsedTime = Date.parse(value);
    if (Number.isFinite(parsedTime)) {
      return Math.floor(parsedTime / 1000);
    }
  }

  return undefined;
}

function readOptionalSessionContext(
  record: Record<string, unknown>,
  fallback: IamAppContext | undefined,
): IamAppContext | undefined {
  if (Object.prototype.hasOwnProperty.call(record, 'context')) {
    return isRecord(record.context) ? record.context as unknown as IamAppContext : undefined;
  }
  return fallback;
}

function readOptionalSessionUser(
  record: Record<string, unknown>,
  fallback: IamUser | undefined,
): IamUser | undefined {
  if (Object.prototype.hasOwnProperty.call(record, 'user')) {
    return isRecord(record.user) ? record.user as unknown as IamUser : undefined;
  }
  return fallback;
}

function normalizeEpochSeconds(value: number): number {
  if (!Number.isFinite(value)) {
    return Number.NaN;
  }
  return Math.floor(value >= 10_000_000_000 ? value / 1_000 : value);
}

function areJsonValuesEqual(first: unknown, second: unknown): boolean {
  if (first === second) {
    return true;
  }
  try {
    return JSON.stringify(first) === JSON.stringify(second);
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function currentUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function readSessionStorage(): string | null {
  return getAppSessionPersistencePort().read();
}

function writeSessionStorage(token: StoredAppSessionToken): void {
  const persisted = serializeForPersistence(token);
  getAppSessionPersistencePort().write(JSON.stringify(persisted));
}

/**
 * Strip sensitive long-lived credentials (refreshToken) before persistence.
 *
 * accessToken/authToken are short-lived and required for session continuity
 * across restarts; refreshToken is long-lived and must never be written to
 * disk because Capacitor `@capacitor/preferences` and similar plaintext
 * backends cannot protect it at rest.
 */
function serializeForPersistence(token: StoredAppSessionToken): PersistedAppSessionToken {
  const persisted: PersistedAppSessionToken = {
    accessToken: token.accessToken,
    authToken: token.authToken,
    storedAt: token.storedAt,
  };
  if (typeof token.expiresAt === 'number' && Number.isFinite(token.expiresAt)) {
    persisted.expiresAt = token.expiresAt;
  }
  if (typeof token.sessionId === 'string' && token.sessionId.trim().length > 0) {
    persisted.sessionId = token.sessionId;
  }
  if (token.context) {
    persisted.context = token.context;
  }
  if (token.user) {
    persisted.user = token.user;
  }
  return persisted;
}

function removeSessionStorage(): void {
  getAppSessionPersistencePort().remove();
}

function dispatchAppSessionChange(): void {
  try {
    globalThis.dispatchEvent?.(new Event(APP_SESSION_CHANGE_EVENT_NAME));
  } catch {
    // Session listeners are optional; storage state is already authoritative.
  }
}

function scheduleAppSessionChange(): void {
  if (sessionChangeNotificationPending) {
    return;
  }

  sessionChangeNotificationPending = true;
  sessionChangeNotificationTimer = globalThis.setTimeout?.(() => {
    sessionChangeNotificationPending = false;
    sessionChangeNotificationTimer = null;
    dispatchAppSessionChange();
  }, 0);
}
