import {
  APP_SESSION_STORAGE_KEY,
  bindAppSessionPersistencePort,
  hydrateAppSessionPersistence,
  type AsyncAppSessionPersistencePort,
} from '@sdkwork/birdcoder-pc-core/appSessionPersistence';
import { resetAppSessionTokenStorageCache } from '@sdkwork/birdcoder-pc-core/appSessionToken';

import {
  getStoredRawValue,
  removeStoredValue,
  setStoredRawValue,
} from '../storage/runtime.ts';

const DESKTOP_APP_SESSION_SCOPE = 'secure-app-session';

let desktopPersistenceBound = false;

export function bindBirdCoderDesktopAppSessionPersistence(): void {
  if (desktopPersistenceBound) {
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
      void setStoredRawValue(DESKTOP_APP_SESSION_SCOPE, APP_SESSION_STORAGE_KEY, raw);
    },
    remove() {
      cache = null;
      hydrated = true;
      void removeStoredValue(DESKTOP_APP_SESSION_SCOPE, APP_SESSION_STORAGE_KEY);
    },
    async hydrate() {
      if (hydrated) {
        return;
      }

      cache = await getStoredRawValue(DESKTOP_APP_SESSION_SCOPE, APP_SESSION_STORAGE_KEY);
      hydrated = true;
      // A runtime may have synchronously read the empty adapter cache while
      // this host read was pending. Force the next session read to consume the
      // hydrated durable value.
      resetAppSessionTokenStorageCache();
    },
  };

  resetAppSessionTokenStorageCache();
  bindAppSessionPersistencePort(port);
  desktopPersistenceBound = true;
}

export async function hydrateBirdCoderDesktopAppSessionPersistence(): Promise<void> {
  bindBirdCoderDesktopAppSessionPersistence();
  await hydrateAppSessionPersistence();
}

export function resetBirdCoderDesktopAppSessionPersistenceBinding(): void {
  desktopPersistenceBound = false;
}
