import {
  APP_SESSION_STORAGE_KEY,
  bindAppSessionPersistencePort,
  hydrateAppSessionPersistence,
  type AsyncAppSessionPersistencePort,
} from '@sdkwork/birdcoder-pc-core/appSessionPersistence';
import { resetAppSessionTokenStorageCache } from '@sdkwork/birdcoder-pc-core/appSessionToken';

import { getBirdCoderSecureStorageAdapter } from '../host/secureStorageAdapter.ts';

let h5PersistenceBound = false;

export function bindBirdCoderH5AppSessionPersistence(): void {
  if (h5PersistenceBound) {
    return;
  }

  let cache: string | null = null;
  let hydrated = false;

  const port: AsyncAppSessionPersistencePort = {
    read() {
      return cache;
    },
    write(raw) {
      cache = raw;
      hydrated = true;
      void getBirdCoderSecureStorageAdapter().write(APP_SESSION_STORAGE_KEY, raw);
    },
    remove() {
      cache = null;
      hydrated = true;
      void getBirdCoderSecureStorageAdapter().remove(APP_SESSION_STORAGE_KEY);
    },
    async hydrate() {
      if (hydrated) {
        return;
      }

      cache = await getBirdCoderSecureStorageAdapter().read(APP_SESSION_STORAGE_KEY);
      hydrated = true;
      resetAppSessionTokenStorageCache();
    },
  };

  resetAppSessionTokenStorageCache();
  bindAppSessionPersistencePort(port);
  h5PersistenceBound = true;
}

export async function hydrateBirdCoderH5AppSessionPersistence(): Promise<void> {
  bindBirdCoderH5AppSessionPersistence();
  await hydrateAppSessionPersistence();
}

export function resetBirdCoderH5AppSessionPersistenceBinding(): void {
  h5PersistenceBound = false;
}
