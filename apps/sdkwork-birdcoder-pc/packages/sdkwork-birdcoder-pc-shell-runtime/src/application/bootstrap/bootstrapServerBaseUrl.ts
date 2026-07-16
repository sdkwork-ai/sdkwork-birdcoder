export const BIRDCODER_APP_SETTINGS_STORAGE_SCOPE = 'settings';
export const BIRDCODER_APP_SETTINGS_STORAGE_KEY = 'app';
const BIRDCODER_LOCAL_STORE_NAMESPACE = 'sdkwork-birdcoder';
const BIRDCODER_BROWSER_LOCAL_API_HOSTNAMES = new Set([
  'localhost',
  'tauri.localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  '::',
]);

type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
type TauriWindow = Window &
  typeof globalThis & {
    __TAURI__?: {
      core?: {
        invoke?: TauriInvoke;
      };
    };
    __TAURI_INTERNALS__?: {
      invoke?: TauriInvoke;
    };
  };

interface BirdCoderAppSettingsRecord {
  serverBaseUrl?: string;
}

export interface ResolveBirdCoderBootstrapServerBaseUrlOptions {
  configuredApiBaseUrl?: string;
  runtimeApiBaseUrl?: string;
  storedApiBaseUrl?: string;
}

export interface ResolveBirdCoderBrowserServerBaseUrlOptions {
  browserLocationUrl?: string;
  preferSameOrigin?: boolean;
}

export function normalizeBirdCoderServerBaseUrl(value?: string | null): string | undefined {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(trimmedValue);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return undefined;
    }

    const normalizedPathname = parsedUrl.pathname.replace(/\/+$/, '');
    const pathname = normalizedPathname === '/' ? '' : normalizedPathname;
    return `${parsedUrl.origin}${pathname}`;
  } catch {
    return undefined;
  }
}

function buildBootstrapLocalStoreKey(scope: string, key: string): string {
  return `${BIRDCODER_LOCAL_STORE_NAMESPACE}:${scope}:${key}`;
}

function deserializeBootstrapSettingsRecord(rawValue: string | null): BirdCoderAppSettingsRecord {
  if (!rawValue) {
    return {};
  }

  try {
    const value = JSON.parse(rawValue) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as BirdCoderAppSettingsRecord;
  } catch {
    return {};
  }
}

function resolveBootstrapTauriInvoke(): TauriInvoke | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const tauriWindow = window as TauriWindow;
  const invoke =
    tauriWindow.__TAURI__?.core?.invoke ?? tauriWindow.__TAURI_INTERNALS__?.invoke ?? null;
  return typeof invoke === 'function' ? invoke : null;
}

async function readBootstrapStoredRawValue(scope: string, key: string): Promise<string | null> {
  const invoke = resolveBootstrapTauriInvoke();
  if (invoke) {
    try {
      return await invoke<string | null>('local_store_get', { scope, key });
    } catch {
      // Keep the earliest bootstrap path local-first when the desktop bridge is not ready yet.
    }
  }

  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(buildBootstrapLocalStoreKey(scope, key));
  } catch {
    return null;
  }
}

export async function readStoredBirdCoderServerBaseUrl(): Promise<string | undefined> {
  const settingsRecord = deserializeBootstrapSettingsRecord(
    await readBootstrapStoredRawValue(
      BIRDCODER_APP_SETTINGS_STORAGE_SCOPE,
      BIRDCODER_APP_SETTINGS_STORAGE_KEY,
    ),
  );
  return normalizeBirdCoderServerBaseUrl(settingsRecord.serverBaseUrl);
}

export function resolveBirdCoderBootstrapServerBaseUrl({
  configuredApiBaseUrl,
  runtimeApiBaseUrl,
  storedApiBaseUrl,
}: ResolveBirdCoderBootstrapServerBaseUrlOptions): string | undefined {
  return (
    normalizeBirdCoderServerBaseUrl(runtimeApiBaseUrl) ??
    normalizeBirdCoderServerBaseUrl(storedApiBaseUrl) ??
    normalizeBirdCoderServerBaseUrl(configuredApiBaseUrl)
  );
}

function isBrowserLocalApiHostname(hostname: string): boolean {
  const normalizedHostname = hostname.trim().toLowerCase();
  return (
    BIRDCODER_BROWSER_LOCAL_API_HOSTNAMES.has(normalizedHostname) ||
    /^127(?:\.\d{1,3}){3}$/u.test(normalizedHostname)
  );
}

/**
 * Makes a loopback API URL reachable from the computer that opened the web UI.
 * Desktop runtimes do not call this resolver and keep their embedded loopback URL.
 */
export function resolveBirdCoderBrowserServerBaseUrl(
  apiBaseUrl?: string,
  options: ResolveBirdCoderBrowserServerBaseUrlOptions = {},
): string | undefined {
  const normalizedApiBaseUrl = normalizeBirdCoderServerBaseUrl(apiBaseUrl);
  const normalizedBrowserLocationUrl = normalizeBirdCoderServerBaseUrl(
    options.browserLocationUrl,
  );
  if (!normalizedBrowserLocationUrl) {
    return normalizedApiBaseUrl;
  }

  const browserUrl = new URL(normalizedBrowserLocationUrl);
  if (options.preferSameOrigin && !normalizedApiBaseUrl) {
    return browserUrl.origin;
  }
  if (!normalizedApiBaseUrl) {
    return undefined;
  }

  const apiUrl = new URL(normalizedApiBaseUrl);
  if (!isBrowserLocalApiHostname(apiUrl.hostname)) {
    return normalizedApiBaseUrl;
  }

  if (options.preferSameOrigin) {
    return browserUrl.origin;
  }
  if (isBrowserLocalApiHostname(browserUrl.hostname)) {
    return normalizedApiBaseUrl;
  }

  apiUrl.hostname = browserUrl.hostname;
  return normalizeBirdCoderServerBaseUrl(apiUrl.toString());
}
