import { APP_SESSION_CHANGE_EVENT_NAME } from './appSessionEvents.ts';

export { APP_SESSION_CHANGE_EVENT_NAME } from './appSessionEvents.ts';

const APP_SESSION_STORAGE_KEY = 'sdkwork.birdcoder.appSession.v1';
const EXPIRY_SKEW_SECONDS = 30;

export interface StoredAppSessionToken {
  accessToken: string;
  authToken: string;
  expiresAt?: number;
  refreshToken?: string;
  sessionId?: string;
  storedAt: number;
}

let memoryToken: StoredAppSessionToken | null = null;
let storageLoaded = false;

export function storeAppSessionFromResult(result: unknown): StoredAppSessionToken {
  const previousToken = loadStoredAppSessionToken();
  const data = readAppSessionPayload(result);
  const accessToken = readString(data, 'accessToken');
  const authToken = readString(data, 'authToken');
  const expiresAt = readOptionalExpiry(data, 'expiresAt');
  const responseRefreshToken = readString(data, 'refreshToken');
  const responseSessionId = readString(data, 'sessionId');
  const sameSession =
    Boolean(previousToken) &&
    (!responseSessionId || previousToken?.sessionId === responseSessionId);
  const refreshToken = responseRefreshToken || (sameSession ? previousToken?.refreshToken ?? '' : '');
  const sessionId = responseSessionId || (sameSession ? previousToken?.sessionId ?? '' : '');

  if (!accessToken || !authToken) {
    throw new Error('App session response is missing valid SDKWork IAM token data.');
  }

  const stored: StoredAppSessionToken = {
    accessToken,
    authToken,
    ...(Number.isFinite(expiresAt) ? { expiresAt } : {}),
    ...(refreshToken ? { refreshToken } : {}),
    ...(sessionId ? { sessionId } : {}),
    storedAt: currentUnixSeconds(),
  };

  memoryToken = stored;
  storageLoaded = true;
  writeSessionStorage(stored);
  dispatchAppSessionChange();
  return stored;
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
    memoryToken = parsed;
    return parsed;
  } catch {
    clearStoredAppSessionToken();
    return null;
  }
}

export function clearStoredAppSessionToken(): void {
  memoryToken = null;
  storageLoaded = true;
  removeSessionStorage();
  dispatchAppSessionChange();
}

function readAppSessionPayload(result: unknown): Record<string, unknown> {
  if (!isRecord(result)) {
    return {};
  }

  const data = result.data;
  if (isRecord(data)) {
    return data;
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
      (typeof value.sessionId === 'string' && value.sessionId.trim().length > 0))
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
    return parsedNumber;
  }

  if (typeof value === 'string') {
    const parsedTime = Date.parse(value);
    if (Number.isFinite(parsedTime)) {
      return Math.floor(parsedTime / 1000);
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function currentUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function readSessionStorage(): string | null {
  try {
    return globalThis.sessionStorage?.getItem(APP_SESSION_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeSessionStorage(token: StoredAppSessionToken): void {
  try {
    globalThis.sessionStorage?.setItem(APP_SESSION_STORAGE_KEY, JSON.stringify(token));
  } catch {
    // Memory storage remains available for restrictive browser contexts.
  }
}

function removeSessionStorage(): void {
  try {
    globalThis.sessionStorage?.removeItem(APP_SESSION_STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

function dispatchAppSessionChange(): void {
  try {
    globalThis.dispatchEvent?.(new Event(APP_SESSION_CHANGE_EVENT_NAME));
  } catch {
    // Session listeners are optional; storage state is already authoritative.
  }
}
