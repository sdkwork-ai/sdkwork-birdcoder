import {
  createBrowserSecureStorageAdapter,
  type SecureStorageHostAdapter,
} from '@sdkwork/birdcoder-h5-core';

import {
  isCapacitorNativePlatform,
} from '../runtime/capacitorRuntime.ts';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

export interface CapacitorSecureStoragePort {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Manifest-honest storage adapter for Capacitor native platforms.
 *
 * Native sessions are stored in iOS Keychain / Android Keystore-backed
 * storage so the rotating refresh token can survive application restarts.
 */
export function createCapacitorSecureStorageAdapter(options: {
  isNative?: boolean;
  secureStorage?: CapacitorSecureStoragePort;
} = {}): SecureStorageHostAdapter {
  const isNative = options.isNative ?? isCapacitorNativePlatform();
  const secureStorage = options.secureStorage ?? SecureStorage;

  if (!isNative) {
    return createBrowserSecureStorageAdapter();
  }

  return {
    available: true,
    async read(key) {
      return secureStorage.getItem(key);
    },
    async write(key, value) {
      await secureStorage.setItem(key, value);
    },
    async remove(key) {
      await secureStorage.removeItem(key);
    },
  };
}
