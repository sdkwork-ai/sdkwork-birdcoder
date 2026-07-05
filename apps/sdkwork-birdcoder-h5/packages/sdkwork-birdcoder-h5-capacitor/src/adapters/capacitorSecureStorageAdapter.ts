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
 * Android).
 *
 * SECURITY MITIGATION (in effect): The caller (`storeAppSessionFromResult`
 * in `@sdkwork/birdcoder-pc-core`) strips `refreshToken` before persistence
 * via `serializeForPersistence`. Only short-lived `accessToken`/`authToken`
 * (plus `expiresAt`/`sessionId`/`storedAt` for SSO bootstrap) are written
 * through this adapter. Long-lived `refreshToken` is held only in memory
 * and is never persisted to disk. As a result, an attacker who extracts the
 * persisted JSON from device storage cannot mint new access tokens after
 * the short-lived `accessToken` expires; the user must re-authenticate.
 *
 * Until a Keychain/Keystore-backed adapter (e.g. `@capacitor-community/
 * secure-storage` or `cordova-plugin-secure-storage-echo`) is wired in,
 * this adapter remains unsuitable for persisting long-lived credentials.
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
        'Long-lived refreshToken is stripped before persistence; only short-lived accessToken/authToken are written. ' +
        'Migrate to a Keychain/Keystore-backed adapter before persisting any long-lived credentials.',
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
