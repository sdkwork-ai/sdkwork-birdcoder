export const BIRDCODER_APP_SETTINGS_STORAGE_SCOPE = 'settings';
export const BIRDCODER_APP_SETTINGS_STORAGE_KEY = 'app';
const BIRDCODER_LOCAL_STORE_NAMESPACE = 'sdkwork-birdcoder';

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
    return await invoke<string | null>('local_store_get', { scope, key });
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
    normalizeBirdCoderServerBaseUrl(storedApiBaseUrl) ??
    normalizeBirdCoderServerBaseUrl(runtimeApiBaseUrl) ??
    normalizeBirdCoderServerBaseUrl(configuredApiBaseUrl)
  );
}
