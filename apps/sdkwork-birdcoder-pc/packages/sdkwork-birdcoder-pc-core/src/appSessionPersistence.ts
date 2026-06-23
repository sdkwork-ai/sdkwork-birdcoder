export const APP_SESSION_STORAGE_KEY = 'sdkwork.birdcoder.appSession.v1';

export interface AppSessionPersistencePort {
  read(): string | null;
  write(raw: string): void;
  remove(): void;
}

export interface AsyncAppSessionPersistencePort extends AppSessionPersistencePort {
  hydrate(): Promise<void>;
}

let boundPort: AppSessionPersistencePort | null = null;
let hydratePromise: Promise<void> | null = null;

function createBrowserSessionStoragePort(): AppSessionPersistencePort {
  return {
    read() {
      try {
        return globalThis.sessionStorage?.getItem(APP_SESSION_STORAGE_KEY) ?? null;
      } catch {
        return null;
      }
    },
    write(raw) {
      try {
        globalThis.sessionStorage?.setItem(APP_SESSION_STORAGE_KEY, raw);
      } catch {
        // Memory storage remains available for restrictive browser contexts.
      }
    },
    remove() {
      try {
        globalThis.sessionStorage?.removeItem(APP_SESSION_STORAGE_KEY);
      } catch {
        // Nothing to clear when storage is unavailable.
      }
    },
  };
}

export function bindAppSessionPersistencePort(port: AppSessionPersistencePort): void {
  boundPort = port;
  hydratePromise = null;
}

export function resetAppSessionPersistencePort(): void {
  boundPort = null;
  hydratePromise = null;
}

export function getAppSessionPersistencePort(): AppSessionPersistencePort {
  return boundPort ?? createBrowserSessionStoragePort();
}

export async function hydrateAppSessionPersistence(): Promise<void> {
  const port = getAppSessionPersistencePort();
  if (!isAsyncAppSessionPersistencePort(port)) {
    return;
  }

  if (hydratePromise) {
    await hydratePromise;
    return;
  }

  hydratePromise = port.hydrate();
  await hydratePromise;
}

function isAsyncAppSessionPersistencePort(
  port: AppSessionPersistencePort,
): port is AsyncAppSessionPersistencePort {
  return typeof (port as AsyncAppSessionPersistencePort).hydrate === 'function';
}
