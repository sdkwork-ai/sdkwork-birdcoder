import {
  bindAppSessionPersistencePort,
  hydrateAppSessionPersistence,
  type AsyncAppSessionPersistencePort,
} from '@sdkwork/birdcoder-pc-core/appSessionPersistence';
import { resetAppSessionTokenStorageCache } from '@sdkwork/birdcoder-pc-core/appSessionToken';

import {
  deleteSecureAppSession,
  readSecureAppSession,
  writeSecureAppSession,
} from '../platform/secureAppSessionStore.ts';

export const DESKTOP_APP_SESSION_PERSISTENCE_ERROR_EVENT =
  'sdkwork:desktop-app-session-persistence-error';

let desktopPersistenceBound = false;

export function bindBirdCoderDesktopAppSessionPersistence(): void {
  if (desktopPersistenceBound) {
    return;
  }

  let cache: string | null = null;
  let hydrated = false;
  let persistenceQueue = Promise.resolve();

  const reportPersistenceFailure = (
    operation: 'delete' | 'read' | 'write',
  ): void => {
    globalThis.console?.error(
      `Desktop IAM session ${operation} failed in the operating-system credential store.`,
    );
    globalThis.dispatchEvent?.(
      new CustomEvent(DESKTOP_APP_SESSION_PERSISTENCE_ERROR_EVENT, {
        detail: { operation },
      }),
    );
  };

  const enqueuePersistence = (
    operation: 'delete' | 'write',
    task: () => Promise<void>,
  ): void => {
    persistenceQueue = persistenceQueue
      .then(task)
      .catch(() => {
        reportPersistenceFailure(operation);
      });
  };

  const port: AsyncAppSessionPersistencePort = {
    read() {
      return cache;
    },
    write(raw) {
      cache = raw;
      hydrated = true;
      enqueuePersistence('write', () => writeSecureAppSession(raw));
    },
    remove() {
      cache = null;
      hydrated = true;
      enqueuePersistence('delete', deleteSecureAppSession);
    },
    async hydrate() {
      if (hydrated) {
        return;
      }

      await persistenceQueue;
      try {
        cache = await readSecureAppSession();
      } catch {
        cache = null;
        reportPersistenceFailure('read');
      }
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
