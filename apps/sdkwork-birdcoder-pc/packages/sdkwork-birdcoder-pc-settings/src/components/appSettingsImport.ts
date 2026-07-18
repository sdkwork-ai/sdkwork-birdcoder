import {
  DEFAULT_APP_SETTINGS,
  parseAppSettingValue,
  type AppSettings,
} from '@sdkwork/birdcoder-pc-workbench/settings/appSettings';

const MAX_APP_SETTINGS_IMPORT_BYTES = 256 * 1024;
const APP_SETTINGS_KEYS = new Set(
  Object.keys(DEFAULT_APP_SETTINGS) as Array<keyof AppSettings>,
);
const IMPORT_METADATA_KEYS = new Set(['$schema', 'version', 'name']);

export type AppSettingsImportErrorCode =
  | 'too-large'
  | 'invalid-json'
  | 'invalid-shape'
  | 'invalid-value'
  | 'empty';

export class AppSettingsImportError extends Error {
  readonly code: AppSettingsImportErrorCode;

  constructor(code: AppSettingsImportErrorCode) {
    super(code);
    this.name = 'AppSettingsImportError';
    this.code = code;
  }
}

export interface AppSettingsImportResult {
  settings: Partial<AppSettings>;
  importedKeys: Array<keyof AppSettings>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeServerBaseUrl(value: unknown): string | null {
  return parseAppSettingValue('serverBaseUrl', value) as string | null;
}

function normalizeImportedValue<K extends keyof AppSettings>(
  key: K,
  value: unknown,
): AppSettings[K] | null {
  return parseAppSettingValue(key, value);
}

export async function parseAppSettingsImport(
  file: Pick<File, 'size' | 'text'>,
): Promise<AppSettingsImportResult> {
  if (file.size > MAX_APP_SETTINGS_IMPORT_BYTES) {
    throw new AppSettingsImportError('too-large');
  }

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(await file.text()) as unknown;
  } catch {
    throw new AppSettingsImportError('invalid-json');
  }

  if (!isRecord(parsedValue)) {
    throw new AppSettingsImportError('invalid-shape');
  }

  const source = isRecord(parsedValue.settings) ? parsedValue.settings : parsedValue;
  const importedSettings: Partial<AppSettings> = {};
  const writableImportedSettings = importedSettings as Record<
    keyof AppSettings,
    AppSettings[keyof AppSettings]
  >;
  const importedKeys: Array<keyof AppSettings> = [];

  for (const [rawKey, rawValue] of Object.entries(source)) {
    if (IMPORT_METADATA_KEYS.has(rawKey)) {
      continue;
    }

    if (!APP_SETTINGS_KEYS.has(rawKey as keyof AppSettings)) {
      continue;
    }

    const key = rawKey as keyof AppSettings;
    const normalizedValue = normalizeImportedValue(key, rawValue);
    if (normalizedValue === null) {
      throw new AppSettingsImportError('invalid-value');
    }

    writableImportedSettings[key] = normalizedValue;
    importedKeys.push(key);
  }

  if (importedKeys.length === 0) {
    throw new AppSettingsImportError('empty');
  }

  return {
    settings: importedSettings,
    importedKeys,
  };
}
