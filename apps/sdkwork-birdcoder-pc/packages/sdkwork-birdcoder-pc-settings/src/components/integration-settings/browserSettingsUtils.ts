import {
  normalizeIntegrationPreferences,
  type IntegrationPreferences,
} from '@sdkwork/birdcoder-pc-workbench';

const BROWSER_STORAGE_PREFIXES = [
  'sdkwork-birdcoder.browser.',
  'sdkwork-birdcoder.ui.v1:browser:',
] as const;

const BROWSER_IMPORT_KEYS = [
  'browserAllowedSites',
  'browserApprovalPolicy',
  'browserAskDownloadLocation',
  'browserDownloadLocation',
  'browserEnabled',
  'browserLocalLinkOpenTarget',
  'browserScreenshotPolicy',
  'browserWebLinkOpenTarget',
] as const satisfies readonly (keyof IntegrationPreferences)[];

export function clearBirdCoderBrowserData(storages: readonly Storage[]): number {
  let removedCount = 0;
  for (const storage of storages) {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && BROWSER_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      storage.removeItem(key);
      removedCount += 1;
    }
  }
  return removedCount;
}

export function parseBrowserSettingsImport(
  value: unknown,
  currentPreferences: IntegrationPreferences,
): Partial<IntegrationPreferences> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Browser settings import must be a JSON object.');
  }
  const rawValue = value as Record<string, unknown>;
  const browserInput: Partial<IntegrationPreferences> = {};
  for (const key of BROWSER_IMPORT_KEYS) {
    if (key in rawValue) {
      (browserInput as Record<string, unknown>)[key] = rawValue[key];
    }
  }
  if (Object.keys(browserInput).length === 0) {
    throw new Error('Browser settings import does not contain supported settings.');
  }
  const normalized = normalizeIntegrationPreferences({
    ...currentPreferences,
    ...browserInput,
  });
  return Object.fromEntries(
    BROWSER_IMPORT_KEYS.map((key) => [key, normalized[key]]),
  ) as Partial<IntegrationPreferences>;
}
