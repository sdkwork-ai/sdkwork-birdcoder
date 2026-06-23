import {
  createBrowserSecureStorageAdapter,
  type SecureStorageHostAdapter,
} from '@sdkwork/birdcoder-h5-core';

import {
  isCapacitorNativePlatform,
  Preferences,
} from '../runtime/capacitorRuntime.ts';

export interface CapacitorPreferencesPort {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}

export function createCapacitorSecureStorageAdapter(options: {
  isNative?: boolean;
  preferences?: CapacitorPreferencesPort;
} = {}): SecureStorageHostAdapter {
  const isNative = options.isNative ?? isCapacitorNativePlatform();
  const preferences = options.preferences ?? Preferences;

  if (!isNative) {
    return createBrowserSecureStorageAdapter();
  }

  return {
    available: true,
    async read(key) {
      const result = await preferences.get({ key });
      return result.value;
    },
    async write(key, value) {
      await preferences.set({ key, value });
    },
    async remove(key) {
      await preferences.remove({ key });
    },
  };
}
