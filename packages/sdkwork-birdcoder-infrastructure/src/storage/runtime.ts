import type {
  BirdCoderEntityDefinition,
  BirdCoderEntityName,
  BirdCoderEntityStorageBinding,
} from '@sdkwork/birdcoder-types';
import {
  parseBirdCoderApiJson,
  stringifyBirdCoderApiJson,
} from '@sdkwork/birdcoder-types';

const LOCAL_STORE_NAMESPACE = 'sdkwork-birdcoder';
const inMemoryStorageFallback = new Map<string, string>();

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

export interface BirdCoderStorageAccess {
  readRawValue(scope: string, key: string): Promise<string | null>;
  removeRawValue(scope: string, key: string): Promise<void>;
  setRawValue(scope: string, key: string, value: string): Promise<void>;
}

export interface BirdCoderStoredRawValueEntry {
  key: string;
  scope: string;
  updatedAt: string | null;
  value: string;
}

export interface BirdCoderJsonRecordDefinition {
  entityName: BirdCoderEntityName;
}

export interface BirdCoderJsonRecordRepository<TRecord> {
  binding: BirdCoderEntityStorageBinding;
  clear(): Promise<void>;
  definition: BirdCoderJsonRecordDefinition;
  read(): Promise<TRecord>;
  write(value: TRecord): Promise<TRecord>;
}

export interface CreateBirdCoderJsonRecordRepositoryOptions<TRecord> {
  binding: BirdCoderEntityStorageBinding;
  definition?: BirdCoderJsonRecordDefinition | BirdCoderEntityDefinition;
  fallback: TRecord;
  normalize?: (value: unknown, fallback: TRecord) => TRecord;
  storage?: BirdCoderStorageAccess;
}

export function buildLocalStoreKey(scope: string, key: string): string {
  return `${LOCAL_STORE_NAMESPACE}:${scope}:${key}`;
}

function parseLocalStoreKey(value: string): { key: string; scope: string } | null {
  const prefix = `${LOCAL_STORE_NAMESPACE}:`;
  if (!value.startsWith(prefix)) {
    return null;
  }

  const remainder = value.slice(prefix.length);
  const separatorIndex = remainder.indexOf(':');
  if (separatorIndex < 0) {
    return null;
  }

  return {
    scope: remainder.slice(0, separatorIndex),
    key: remainder.slice(separatorIndex + 1),
  };
}

export function serializeStoredValue<T>(value: T): string {
  return stringifyBirdCoderApiJson(value);
}

export function deserializeStoredValue<T>(rawValue: string | null, fallback: T): T {
  if (!rawValue) {
    return fallback;
  }

  try {
    return parseBirdCoderApiJson<T>(rawValue);
  } catch {
    return fallback;
  }
}

async function resolveTauriInvoke(): Promise<TauriInvoke | null> {
  if (typeof window === 'undefined' || !window.__TAURI__) {
    return null;
  }

  const tauriWindow = window as TauriWindow;
  const bridgedInvoke =
    tauriWindow.__TAURI__?.core?.invoke ?? tauriWindow.__TAURI_INTERNALS__?.invoke ?? null;
  return typeof bridgedInvoke === 'function' ? bridgedInvoke : null;
}

export async function getStoredRawValue(scope: string, key: string): Promise<string | null> {
  const invoke = await resolveTauriInvoke();
  if (invoke) {
    return await invoke<string | null>('local_store_get', { scope, key });
  }

  if (typeof window === 'undefined') {
    return inMemoryStorageFallback.has(buildLocalStoreKey(scope, key))
      ? inMemoryStorageFallback.get(buildLocalStoreKey(scope, key))!
      : null;
  }

  try {
    return window.localStorage.getItem(buildLocalStoreKey(scope, key));
  } catch {
    return null;
  }
}

export async function listStoredRawValues(scope: string): Promise<BirdCoderStoredRawValueEntry[]> {
  const invoke = await resolveTauriInvoke();
  if (invoke) {
    const entries = await invoke<Array<Partial<BirdCoderStoredRawValueEntry>>>('local_store_list', {
      scope,
    });
    return entries
      .filter(
        (entry): entry is Partial<BirdCoderStoredRawValueEntry> & { key: string; scope: string; value: string } =>
          !!entry &&
          typeof entry.key === 'string' &&
          typeof entry.scope === 'string' &&
          typeof entry.value === 'string',
      )
      .map((entry) => ({
        key: entry.key,
        scope: entry.scope,
        updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : null,
        value: entry.value,
      }));
  }

  const entries: BirdCoderStoredRawValueEntry[] = [];

  if (typeof window === 'undefined') {
    for (const [storedKey, value] of inMemoryStorageFallback.entries()) {
      const parsedKey = parseLocalStoreKey(storedKey);
      if (!parsedKey || parsedKey.scope !== scope) {
        continue;
      }

      entries.push({
        scope,
        key: parsedKey.key,
        value,
        updatedAt: null,
      });
    }

    return entries.sort((left, right) => left.key.localeCompare(right.key));
  }

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const storedKey = window.localStorage.key(index);
      if (typeof storedKey !== 'string') {
        continue;
      }

      const parsedKey = parseLocalStoreKey(storedKey);
      if (!parsedKey || parsedKey.scope !== scope) {
        continue;
      }

      const value = window.localStorage.getItem(storedKey);
      if (typeof value !== 'string') {
        continue;
      }

      entries.push({
        scope,
        key: parsedKey.key,
        value,
        updatedAt: null,
      });
    }
  } catch {
    return [];
  }

  return entries.sort((left, right) => left.key.localeCompare(right.key));
}

export async function setStoredRawValue(scope: string, key: string, value: string): Promise<void> {
  const invoke = await resolveTauriInvoke();
  if (invoke) {
    await invoke('local_store_set', { scope, key, value });
    return;
  }

  if (typeof window === 'undefined') {
    inMemoryStorageFallback.set(buildLocalStoreKey(scope, key), value);
    return;
  }

  try {
    window.localStorage.setItem(buildLocalStoreKey(scope, key), value);
  } catch {
    // Ignore browser storage failures and keep callers non-fatal.
  }
}

export async function removeStoredValue(scope: string, key: string): Promise<void> {
  const invoke = await resolveTauriInvoke();
  if (invoke) {
    await invoke('local_store_delete', { scope, key });
    return;
  }

  if (typeof window === 'undefined') {
    inMemoryStorageFallback.delete(buildLocalStoreKey(scope, key));
    return;
  }

  try {
    window.localStorage.removeItem(buildLocalStoreKey(scope, key));
  } catch {
    // Ignore browser storage failures and keep callers non-fatal.
  }
}

export async function getStoredJson<T>(scope: string, key: string, fallback: T): Promise<T> {
  const rawValue = await getStoredRawValue(scope, key);
  return deserializeStoredValue(rawValue, fallback);
}

export async function setStoredJson<T>(scope: string, key: string, value: T): Promise<void> {
  await setStoredRawValue(scope, key, serializeStoredValue(value));
}

function createDefaultStorageAccess(): BirdCoderStorageAccess {
  return {
    async readRawValue(scope, key) {
      return getStoredRawValue(scope, key);
    },
    async setRawValue(scope, key, value) {
      await setStoredRawValue(scope, key, value);
    },
    async removeRawValue(scope, key) {
      await removeStoredValue(scope, key);
    },
  };
}

export function createJsonRecordRepository<TRecord>({
  binding,
  definition,
  fallback,
  normalize,
  storage,
}: CreateBirdCoderJsonRecordRepositoryOptions<TRecord>): BirdCoderJsonRecordRepository<TRecord> {
  const storageAccess = storage ?? createDefaultStorageAccess();
  const repositoryDefinition = definition ?? { entityName: binding.entityName };
  const normalizeValue =
    normalize ??
    ((value: unknown, repositoryFallback: TRecord) =>
      deserializeStoredValue(
        typeof value === 'string' ? value : serializeStoredValue(value),
        repositoryFallback,
      ));

  return {
    binding,
    definition: repositoryDefinition,
    async read() {
      const value = deserializeStoredValue(
        await storageAccess.readRawValue(binding.storageScope, binding.storageKey),
        fallback,
      );
      return normalizeValue(value, fallback);
    },
    async write(value) {
      const normalizedValue = normalizeValue(value, fallback);
      await storageAccess.setRawValue(
        binding.storageScope,
        binding.storageKey,
        serializeStoredValue(normalizedValue),
      );
      return normalizedValue;
    },
    async clear() {
      await storageAccess.removeRawValue(binding.storageScope, binding.storageKey);
    },
  };
}
