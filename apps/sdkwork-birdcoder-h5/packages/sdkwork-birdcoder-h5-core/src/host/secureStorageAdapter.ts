export const APP_SESSION_STORAGE_KEY = 'sdkwork.birdcoder.appSession.v1';

export type SecureStorageErrorCode =
  | 'unsupported'
  | 'permission-denied'
  | 'unavailable'
  | 'cancelled'
  | 'invalid-state'
  | 'timeout';

export class SecureStorageHostError extends Error {
  readonly code: SecureStorageErrorCode;

  constructor(code: SecureStorageErrorCode, message: string) {
    super(message);
    this.name = 'SecureStorageHostError';
    this.code = code;
  }
}

export interface SecureStorageHostAdapter {
  readonly available: boolean;
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

function assertBrowserSessionStorage(): Storage {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    throw new SecureStorageHostError(
      'unavailable',
      'Browser session storage is unavailable.',
    );
  }

  return window.sessionStorage;
}

export function createBrowserSecureStorageAdapter(): SecureStorageHostAdapter {
  return {
    available: typeof window !== 'undefined' && !!window.sessionStorage,
    async read(key) {
      return assertBrowserSessionStorage().getItem(key);
    },
    async write(key, value) {
      assertBrowserSessionStorage().setItem(key, value);
    },
    async remove(key) {
      assertBrowserSessionStorage().removeItem(key);
    },
  };
}

let boundSecureStorageAdapter: SecureStorageHostAdapter | null = null;

export function bindBirdCoderSecureStorageAdapter(adapter: SecureStorageHostAdapter): void {
  boundSecureStorageAdapter = adapter;
}

export function getBirdCoderSecureStorageAdapter(): SecureStorageHostAdapter {
  return boundSecureStorageAdapter ?? createBrowserSecureStorageAdapter();
}

export function resetBirdCoderSecureStorageAdapter(): void {
  boundSecureStorageAdapter = null;
}
