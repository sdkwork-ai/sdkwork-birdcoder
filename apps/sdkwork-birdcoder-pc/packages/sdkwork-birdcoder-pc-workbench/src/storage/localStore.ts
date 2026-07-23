import {
  parseBirdCoderApiJson,
  stringifyBirdCoderApiJson,
} from '@sdkwork/birdcoder-pc-contracts-commons';

const LOCAL_SETTINGS_NAMESPACE = 'sdkwork-birdcoder.ui.v1';
const MAX_LOCAL_SETTINGS_SEGMENT_LENGTH = 1_024;
const MAX_LOCAL_SETTINGS_VALUE_LENGTH = 256 * 1_024;

function normalizeStorageSegment(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} must not be empty.`);
  }
  if (normalized.length > MAX_LOCAL_SETTINGS_SEGMENT_LENGTH) {
    throw new Error(
      `${label} must not exceed ${MAX_LOCAL_SETTINGS_SEGMENT_LENGTH} characters.`,
    );
  }
  return encodeURIComponent(normalized);
}

function resolveLocalSettingsStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function buildLocalStoreKey(scope: string, key: string): string {
  return [
    LOCAL_SETTINGS_NAMESPACE,
    normalizeStorageSegment(scope, 'Local settings scope'),
    normalizeStorageSegment(key, 'Local settings key'),
  ].join(':');
}

export function serializeStoredValue<T>(value: T): string {
  const serialized = stringifyBirdCoderApiJson(value);
  if (serialized === undefined) {
    throw new Error('Workbench local settings must be JSON-serializable.');
  }
  return serialized;
}

export function deserializeStoredValue<T>(rawValue: string | null, fallback: T): T {
  if (!rawValue || rawValue.length > MAX_LOCAL_SETTINGS_VALUE_LENGTH) {
    return fallback;
  }
  try {
    return parseBirdCoderApiJson<T>(rawValue);
  } catch {
    return fallback;
  }
}

export async function getStoredRawValue(scope: string, key: string): Promise<string | null> {
  const storage = resolveLocalSettingsStorage();
  if (!storage) {
    return null;
  }
  try {
    const value = storage.getItem(buildLocalStoreKey(scope, key));
    return value !== null && value.length <= MAX_LOCAL_SETTINGS_VALUE_LENGTH
      ? value
      : null;
  } catch {
    return null;
  }
}

export async function trySetStoredRawValue(
  scope: string,
  key: string,
  value: string,
): Promise<boolean> {
  const storage = resolveLocalSettingsStorage();
  if (!storage || value.length > MAX_LOCAL_SETTINGS_VALUE_LENGTH) {
    return false;
  }
  try {
    storage.setItem(buildLocalStoreKey(scope, key), value);
    return true;
  } catch {
    return false;
  }
}

export async function setStoredRawValue(
  scope: string,
  key: string,
  value: string,
): Promise<void> {
  if (value.length > MAX_LOCAL_SETTINGS_VALUE_LENGTH) {
    throw new Error(
      `Workbench local settings values must not exceed ${MAX_LOCAL_SETTINGS_VALUE_LENGTH} characters.`,
    );
  }
  if (!(await trySetStoredRawValue(scope, key, value))) {
    throw new Error('Workbench local settings storage is unavailable.');
  }
}

export async function removeStoredValue(scope: string, key: string): Promise<void> {
  const storage = resolveLocalSettingsStorage();
  if (!storage) {
    return;
  }
  storage.removeItem(buildLocalStoreKey(scope, key));
}

export async function getStoredJson<T>(scope: string, key: string, fallback: T): Promise<T> {
  return deserializeStoredValue(await getStoredRawValue(scope, key), fallback);
}

export async function setStoredJson<T>(scope: string, key: string, value: T): Promise<void> {
  await setStoredRawValue(scope, key, serializeStoredValue(value));
}
