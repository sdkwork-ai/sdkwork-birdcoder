import {
  APP_SESSION_STORAGE_KEY,
  getBirdCoderSecureStorageAdapter,
  type SecureStorageHostAdapter,
} from '../host/secureStorageAdapter.ts';

export { APP_SESSION_STORAGE_KEY as BIRDCODER_AUTH_SESSION_KEY };

export interface BirdCoderSessionRecord {
  accessToken: string;
  authToken: string;
  refreshToken?: string;
  sessionId?: string;
  expiresAt?: number;
  storedAt: number;
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
      expiresAt: typeof record.expiresAt === 'number' ? record.expiresAt : undefined,
      storedAt: typeof record.storedAt === 'number' ? record.storedAt : 0,
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
  await secureStorage.write(APP_SESSION_STORAGE_KEY, JSON.stringify(record));
}

export async function clearBirdCoderSessionRecord(
  secureStorage: SecureStorageHostAdapter = getBirdCoderSecureStorageAdapter(),
): Promise<void> {
  await secureStorage.remove(APP_SESSION_STORAGE_KEY);
}
