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

/**
 * Manifest-honest storage adapter for Capacitor native platforms.
 *
 * IMPORTANT: The `SecureStorageHostAdapter` interface name describes the
 * semantic contract (sensitive session/token storage), NOT the underlying
 * implementation. On Capacitor native platforms this adapter is backed by
 * `@capacitor/preferences`, which stores values in platform-default
 * non-encrypted storage (NSUserDefaults on iOS, SharedPreferences on
 * Android). Any token, refresh token, or PII written through this adapter
 * is therefore stored in plaintext at rest on the device.
 *
 * Until a Keychain/Keystore-backed adapter (e.g. `@capacitor-community/
 * secure-storage` or `cordova-plugin-secure-storage-echo`) is wired in,
 * this adapter MUST NOT be used to persist long-lived credentials. Use it
 * only for short-lived in-memory bootstrapping values that the secure
 * browser session already tolerates, and prefer `createBrowserSecureStorage
 * Adapter` whenever a real secure session storage is available.
 *
 * A `console.warn` is emitted on first native-mode use so that any token
 * leakage through this path surfaces during development and governance
 * checks.
 */
export function createCapacitorSecureStorageAdapter(options: {
  isNative?: boolean;
  preferences?: CapacitorPreferencesPort;
} = {}): SecureStorageHostAdapter {
  const isNative = options.isNative ?? isCapacitorNativePlatform();
  const preferences = options.preferences ?? Preferences;

  if (!isNative) {
    return createBrowserSecureStorageAdapter();
  }

  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(
      '[BirdCoder] capacitorSecureStorageAdapter is backed by @capacitor/preferences (plaintext storage). ' +
        'Do not persist long-lived credentials through this adapter on native platforms; ' +
        'migrate to a Keychain/Keystore-backed secure storage adapter before public release.',
    );
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
