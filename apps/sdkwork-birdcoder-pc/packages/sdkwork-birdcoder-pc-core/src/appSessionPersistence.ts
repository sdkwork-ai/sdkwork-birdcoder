export const APP_SESSION_STORAGE_KEY = 'sdkwork.birdcoder.appSession.v1';

export interface AppSessionPersistencePort {
  read(): string | null;
  write(raw: string): void;
  remove(): void;
  /**
   * True when the backing store is an OS-level secure credential store
   * (desktop keyring). Long-lived rotating credentials such as the refresh
   * token MUST be persisted only through secure ports; browser-local storage
   * keeps such credentials in memory only and fails closed across reloads.
   */
  readonly secureTokenStorage?: boolean;
}

export interface AsyncAppSessionPersistencePort extends AppSessionPersistencePort {
  hydrate(): Promise<void>;
}

let boundPort: AppSessionPersistencePort | null = null;
let hydratePromise: Promise<void> | null = null;

function createBrowserSessionStoragePort(): AppSessionPersistencePort {
  return {
    secureTokenStorage: false,
    read() {
      try {
        return globalThis.localStorage?.getItem(APP_SESSION_STORAGE_KEY) ?? null;
      } catch {
        return null;
      }
    },
    write(raw) {
      try {
        globalThis.localStorage?.setItem(APP_SESSION_STORAGE_KEY, raw);
      } catch {
        // Memory storage remains available for restrictive browser contexts.
      }
    },
    remove() {
      try {
        globalThis.localStorage?.removeItem(APP_SESSION_STORAGE_KEY);
      } catch {
        // Nothing to clear when storage is unavailable.
      }
    },
  };
}

export function isSecureTokenPersistencePort(port: AppSessionPersistencePort): boolean {
  return port.secureTokenStorage === true;
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
