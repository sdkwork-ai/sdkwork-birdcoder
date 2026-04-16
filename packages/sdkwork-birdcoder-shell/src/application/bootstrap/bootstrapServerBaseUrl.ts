import { getStoredJson } from '@sdkwork/birdcoder-commons/storage/localStore';

export const BIRDCODER_APP_SETTINGS_STORAGE_SCOPE = 'settings';
export const BIRDCODER_APP_SETTINGS_STORAGE_KEY = 'app';

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

export async function readStoredBirdCoderServerBaseUrl(): Promise<string | undefined> {
  const settingsRecord = await getStoredJson<BirdCoderAppSettingsRecord>(
    BIRDCODER_APP_SETTINGS_STORAGE_SCOPE,
    BIRDCODER_APP_SETTINGS_STORAGE_KEY,
    {},
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
