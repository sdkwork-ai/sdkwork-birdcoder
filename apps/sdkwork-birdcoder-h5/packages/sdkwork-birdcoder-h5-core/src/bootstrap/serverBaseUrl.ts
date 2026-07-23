const SETTINGS_STORAGE_KEY = 'sdkwork-birdcoder:settings:app';

export interface ResolveBirdCoderBootstrapServerBaseUrlOptions {
  configuredApiBaseUrl?: string;
  runtimeApiBaseUrl?: string;
  storedApiBaseUrl?: string;
}

export function normalizeBirdCoderServerBaseUrl(
  value?: string | null,
): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined;
    }
    const path = url.pathname.replace(/\/+$/u, '');
    return `${url.origin}${path === '/' ? '' : path}`;
  } catch {
    return undefined;
  }
}

export async function readStoredBirdCoderServerBaseUrl(): Promise<string | undefined> {
  if (typeof window === 'undefined') {
    return undefined;
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return undefined;
    }
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    const serverBaseUrl = (value as { serverBaseUrl?: unknown }).serverBaseUrl;
    return typeof serverBaseUrl === 'string'
      ? normalizeBirdCoderServerBaseUrl(serverBaseUrl)
      : undefined;
  } catch {
    return undefined;
  }
}

export function resolveBirdCoderBootstrapServerBaseUrl({
  configuredApiBaseUrl,
  runtimeApiBaseUrl,
  storedApiBaseUrl,
}: ResolveBirdCoderBootstrapServerBaseUrlOptions): string | undefined {
  return normalizeBirdCoderServerBaseUrl(runtimeApiBaseUrl)
    ?? normalizeBirdCoderServerBaseUrl(storedApiBaseUrl)
    ?? normalizeBirdCoderServerBaseUrl(configuredApiBaseUrl);
}
