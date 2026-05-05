import type {
  BirdCoderEntityDefinition,
  BirdCoderEntityName,
  BirdCoderEntityStorageBinding,
} from '@sdkwork/birdcoder-types';
import {
  parseBirdCoderApiJson,
  stringifyBirdCoderApiJson,
} from '@sdkwork/birdcoder-types';
import type { BirdCoderSqlExecutionResult } from './sqlExecutor.ts';
import type { BirdCoderSqlPlan } from './sqlPlans.ts';

const LOCAL_STORE_NAMESPACE = 'sdkwork-birdcoder';
const LOCAL_STORE_INDEX_NAMESPACE = `${LOCAL_STORE_NAMESPACE}.index`;
const inMemoryStorageFallback = new Map<string, string>();
const inflightReadSqlPlanExecutions = new Map<string, Promise<BirdCoderSqlExecutionResult>>();

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

function buildLocalStoreIndexKey(scope: string): string {
  return `${LOCAL_STORE_INDEX_NAMESPACE}:${encodeURIComponent(scope)}`;
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

function isReservedAuthorityLocalStoreKey(key: string): boolean {
  return key.startsWith('table.');
}

function readBrowserLocalStoreKeyIndex(scope: string): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(buildLocalStoreIndexKey(scope));
    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    const indexedKeys = new Set<string>();
    for (const value of parsedValue) {
      if (typeof value === 'string' && value.trim()) {
        indexedKeys.add(value);
      }
    }

    return [...indexedKeys].sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

function writeBrowserLocalStoreKeyIndex(scope: string, keys: readonly string[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const normalizedKeys = [...new Set(keys.filter((key) => key.trim()))].sort((left, right) =>
      left.localeCompare(right),
    );
    const indexKey = buildLocalStoreIndexKey(scope);
    if (normalizedKeys.length === 0) {
      window.localStorage.removeItem(indexKey);
      return;
    }

    window.localStorage.setItem(indexKey, JSON.stringify(normalizedKeys));
  } catch {
    // Ignore browser storage failures and keep callers non-fatal.
  }
}

function addBrowserLocalStoreKeyIndexEntry(scope: string, key: string): void {
  const indexedKeys = readBrowserLocalStoreKeyIndex(scope);
  if (indexedKeys.includes(key)) {
    return;
  }

  writeBrowserLocalStoreKeyIndex(scope, [...indexedKeys, key]);
}

function removeBrowserLocalStoreKeyIndexEntry(scope: string, key: string): void {
  const indexedKeys = readBrowserLocalStoreKeyIndex(scope);
  if (!indexedKeys.includes(key)) {
    return;
  }

  writeBrowserLocalStoreKeyIndex(
    scope,
    indexedKeys.filter((indexedKey) => indexedKey !== key),
  );
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

function resolveTauriInvokeFromWindow(): TauriInvoke | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const tauriWindow = window as TauriWindow;
  const bridgedInvoke =
    tauriWindow.__TAURI__?.core?.invoke ?? tauriWindow.__TAURI_INTERNALS__?.invoke ?? null;
  return typeof bridgedInvoke === 'function' ? bridgedInvoke : null;
}

async function resolveTauriInvoke(): Promise<TauriInvoke | null> {
  return resolveTauriInvokeFromWindow();
}

export function hasStoredSqlPlanExecution(): boolean {
  return Boolean(resolveTauriInvokeFromWindow());
}

function normalizeStoredSqlExecutionResult(
  result: Partial<BirdCoderSqlExecutionResult>,
): BirdCoderSqlExecutionResult {
  return {
    affectedRowCount: Number(result?.affectedRowCount ?? 0),
    rows: Array.isArray(result?.rows)
      ? (result.rows as NonNullable<BirdCoderSqlExecutionResult['rows']>)
      : undefined,
  };
}

function buildInflightReadSqlPlanKey(plan: BirdCoderSqlPlan): string | null {
  if (plan.intent !== 'read') {
    return null;
  }

  try {
    return stringifyBirdCoderApiJson(plan);
  } catch {
    return null;
  }
}

export async function executeStoredSqlPlan(
  plan: BirdCoderSqlPlan,
): Promise<BirdCoderSqlExecutionResult> {
  const invoke = await resolveTauriInvoke();
  if (!invoke) {
    throw new Error('BirdCoder SQL plan storage bridge is unavailable outside Tauri.');
  }

  const executePlan = async () =>
    normalizeStoredSqlExecutionResult(
      await invoke<Partial<BirdCoderSqlExecutionResult>>(
        'local_sql_execute_plan',
        { plan },
      ),
    );
  const inflightReadPlanKey = buildInflightReadSqlPlanKey(plan);
  if (!inflightReadPlanKey) {
    return executePlan();
  }

  const inflightExecution = inflightReadSqlPlanExecutions.get(inflightReadPlanKey);
  if (inflightExecution) {
    return inflightExecution;
  }

  const nextExecution = executePlan().finally(() => {
    if (inflightReadSqlPlanExecutions.get(inflightReadPlanKey) === nextExecution) {
      inflightReadSqlPlanExecutions.delete(inflightReadPlanKey);
    }
  });
  inflightReadSqlPlanExecutions.set(inflightReadPlanKey, nextExecution);
  return nextExecution;
}

export async function getStoredRawValue(scope: string, key: string): Promise<string | null> {
  const invoke = await resolveTauriInvoke();
  if (invoke) {
    try {
      return await invoke<string | null>('local_store_get', { scope, key });
    } catch {
      return isReservedAuthorityLocalStoreKey(key)
        ? null
        : getBrowserStoredRawValue(scope, key);
    }
  }

  return getBrowserStoredRawValue(scope, key);
}

function getBrowserStoredRawValue(scope: string, key: string): string | null {
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

function listBrowserStoredRawValues(
  scope: string,
  options: {
    excludeReservedAuthorityKeys?: boolean;
  } = {},
): BirdCoderStoredRawValueEntry[] {
  const entries: BirdCoderStoredRawValueEntry[] = [];

  const appendEntry = (key: string, value: string) => {
    if (options.excludeReservedAuthorityKeys && isReservedAuthorityLocalStoreKey(key)) {
      return;
    }

    entries.push({
      scope,
      key,
      value,
      updatedAt: null,
    });
  };

  if (typeof window === 'undefined') {
    for (const [storedKey, value] of inMemoryStorageFallback.entries()) {
      const parsedKey = parseLocalStoreKey(storedKey);
      if (!parsedKey || parsedKey.scope !== scope) {
        continue;
      }

      appendEntry(parsedKey.key, value);
    }

    return entries.sort((left, right) => left.key.localeCompare(right.key));
  }

  try {
    for (const key of readBrowserLocalStoreKeyIndex(scope)) {
      const value = window.localStorage.getItem(buildLocalStoreKey(scope, key));
      if (typeof value !== 'string') {
        continue;
      }

      appendEntry(key, value);
    }
  } catch {
    return [];
  }

  return entries.sort((left, right) => left.key.localeCompare(right.key));
}

export async function listStoredRawValues(scope: string): Promise<BirdCoderStoredRawValueEntry[]> {
  const invoke = await resolveTauriInvoke();
  if (invoke) {
    try {
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
    } catch {
      return listBrowserStoredRawValues(scope, {
        excludeReservedAuthorityKeys: true,
      });
    }
  }

  return listBrowserStoredRawValues(scope);
}

export async function setStoredRawValue(scope: string, key: string, value: string): Promise<void> {
  const invoke = await resolveTauriInvoke();
  if (invoke) {
    try {
      await invoke('local_store_set', { scope, key, value });
    } catch {
      if (!isReservedAuthorityLocalStoreKey(key)) {
        setBrowserStoredRawValue(scope, key, value);
      }
    }
    return;
  }

  setBrowserStoredRawValue(scope, key, value);
}

function setBrowserStoredRawValue(scope: string, key: string, value: string): void {
  if (typeof window === 'undefined') {
    inMemoryStorageFallback.set(buildLocalStoreKey(scope, key), value);
    return;
  }

  try {
    window.localStorage.setItem(buildLocalStoreKey(scope, key), value);
    addBrowserLocalStoreKeyIndexEntry(scope, key);
  } catch {
    // Ignore browser storage failures and keep callers non-fatal.
  }
}

export async function removeStoredValue(scope: string, key: string): Promise<void> {
  const invoke = await resolveTauriInvoke();
  if (invoke) {
    try {
      await invoke('local_store_delete', { scope, key });
    } catch {
      if (!isReservedAuthorityLocalStoreKey(key)) {
        removeBrowserStoredValue(scope, key);
      }
    }
    return;
  }

  removeBrowserStoredValue(scope, key);
}

function removeBrowserStoredValue(scope: string, key: string): void {
  if (typeof window === 'undefined') {
    inMemoryStorageFallback.delete(buildLocalStoreKey(scope, key));
    return;
  }

  try {
    window.localStorage.removeItem(buildLocalStoreKey(scope, key));
    removeBrowserLocalStoreKeyIndexEntry(scope, key);
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

export async function readUserHomeTextFile(relativePath: string): Promise<string | null> {
  const normalizedRelativePath = relativePath.trim();
  if (!normalizedRelativePath) {
    return null;
  }

  const invoke = await resolveTauriInvoke();
  if (invoke) {
    try {
      return await invoke<string | null>('user_home_config_read', {
        relativePath: normalizedRelativePath,
      });
    } catch {
      return getStoredRawValue('user-home-config', normalizedRelativePath);
    }
  }

  return getStoredRawValue('user-home-config', normalizedRelativePath);
}

export async function writeUserHomeTextFile(
  relativePath: string,
  content: string,
): Promise<void> {
  const normalizedRelativePath = relativePath.trim();
  if (!normalizedRelativePath) {
    return;
  }

  const invoke = await resolveTauriInvoke();
  if (invoke) {
    try {
      await invoke('user_home_config_write', {
        relativePath: normalizedRelativePath,
        content,
      });
    } catch {
      await setStoredRawValue('user-home-config', normalizedRelativePath, content);
    }
    return;
  }

  await setStoredRawValue('user-home-config', normalizedRelativePath, content);
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
