import type { IamAppContext } from '@sdkwork/iam-contracts';
import {
  APP_SESSION_STORAGE_KEY,
  getBirdCoderSecureStorageAdapter,
  type SecureStorageHostAdapter,
} from '../host/secureStorageAdapter.ts';

export { APP_SESSION_STORAGE_KEY as BIRDCODER_AUTH_SESSION_KEY };

export interface BirdCoderSessionRecord {
  accessToken: string;
  authToken: string;
  context?: IamAppContext;
  refreshToken?: string;
  sessionId?: string;
  expiresAt?: number | string;
  storedAt: number;
  user?: unknown;
}

function parseBirdCoderSessionRecord(raw: string): BirdCoderSessionRecord | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const record = value as Partial<BirdCoderSessionRecord>;
    if (typeof record.accessToken !== 'string' || record.accessToken.length === 0) {
      return null;
    }
    if (typeof record.authToken !== 'string' || record.authToken.length === 0) {
      return null;
    }

    return {
      accessToken: record.accessToken,
      authToken: record.authToken,
      refreshToken: typeof record.refreshToken === 'string' ? record.refreshToken : undefined,
      sessionId: typeof record.sessionId === 'string' ? record.sessionId : undefined,
      expiresAt:
        typeof record.expiresAt === 'number' || typeof record.expiresAt === 'string'
          ? record.expiresAt
          : undefined,
      context:
        record.context && typeof record.context === 'object' && !Array.isArray(record.context)
          ? record.context as unknown as IamAppContext
          : undefined,
      storedAt: typeof record.storedAt === 'number' ? record.storedAt : 0,
      user: record.user,
    };
  } catch {
    return null;
  }
}

export async function readBirdCoderSessionRecord(
  secureStorage: SecureStorageHostAdapter = getBirdCoderSecureStorageAdapter(),
): Promise<BirdCoderSessionRecord | null> {
  const raw = await secureStorage.read(APP_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  const record = parseBirdCoderSessionRecord(raw);
  if (!record) {
    await secureStorage.remove(APP_SESSION_STORAGE_KEY);
    return null;
  }

  return record;
}

export async function writeBirdCoderSessionRecord(
  record: BirdCoderSessionRecord,
  secureStorage: SecureStorageHostAdapter = getBirdCoderSecureStorageAdapter(),
): Promise<void> {
  const persisted = secureStorage.supportsLongLivedCredentials
    ? record
    : {
        ...record,
        // The rotating refresh token never leaves memory on a web host;
        // session storage is readable by any script in the page. Reload
        // falls back to re-authentication instead of exposing the token.
        refreshToken: undefined,
      };
  await secureStorage.write(APP_SESSION_STORAGE_KEY, JSON.stringify(persisted));
}

export async function clearBirdCoderSessionRecord(
  secureStorage: SecureStorageHostAdapter = getBirdCoderSecureStorageAdapter(),
): Promise<void> {
  await secureStorage.remove(APP_SESSION_STORAGE_KEY);
}
