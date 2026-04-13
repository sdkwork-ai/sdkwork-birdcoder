import type {
  BirdCoderDatabaseProviderId,
  BirdCoderEntityDefinition,
  BirdCoderEntityStorageBinding,
  BirdCoderSchemaMigrationDefinition,
  BirdCoderStorageProvider,
  BirdCoderUnitOfWork,
} from '@sdkwork/birdcoder-types';
import {
  createBirdCoderStorageDialect,
  getBirdCoderSchemaMigrationDefinition,
} from './providers.ts';
import {
  type BirdCoderForkableSqlExecutor,
  type BirdCoderSqlExecutionResult,
  type BirdCoderSqlExecutor,
  type BirdCoderSqlExecutorTransaction,
} from './sqlExecutor.ts';
import {
  buildBirdCoderSchemaMigrationHistoryUpsertPlan,
  buildBirdCoderSchemaMigrationPlan,
  createBirdCoderTableSqlPlanner,
  type BirdCoderSqlPlan,
  type BirdCoderSqlRow,
} from './sqlPlans.ts';

const LOCAL_STORE_NAMESPACE = 'sdkwork-birdcoder';
const MIGRATION_HISTORY_SCOPE = 'governance';
const inMemoryStorageFallback = new Map<string, string>();

type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

type BirdCoderUnitOfWorkMutation =
  | {
      type: 'delete';
    }
  | {
      type: 'set';
      value: string;
    };

export interface BirdCoderStorageAccess {
  readRawValue(scope: string, key: string): Promise<string | null>;
  removeRawValue(scope: string, key: string): Promise<void>;
  setRawValue(scope: string, key: string, value: string): Promise<void>;
}

export interface BirdCoderSqlPlanStorageAccess {
  readonly sqlPlanExecutionEnabled: boolean;
  executeSqlPlan(plan: BirdCoderSqlPlan): Promise<BirdCoderSqlExecutionResult>;
}

export interface BirdCoderTransactionalStorageProvider
  extends BirdCoderStorageProvider,
    BirdCoderStorageAccess,
    BirdCoderSqlPlanStorageAccess {
  beginUnitOfWork(): Promise<BirdCoderTransactionalUnitOfWork>;
}

export interface BirdCoderTransactionalUnitOfWork
  extends BirdCoderUnitOfWork,
    BirdCoderStorageAccess,
    BirdCoderSqlPlanStorageAccess {}

interface BirdCoderSchemaMigrationHistoryRecord {
  appliedAt: string;
  description: string;
  entityNames: readonly string[];
  migrationId: string;
  providerId: BirdCoderDatabaseProviderId;
}

export interface CreateBirdCoderStorageProviderOptions {
  sqlExecutor?: BirdCoderSqlExecutor;
}

export interface BirdCoderJsonRecordRepository<TRecord> {
  binding: BirdCoderEntityStorageBinding;
  clear(): Promise<void>;
  definition: BirdCoderEntityDefinition;
  read(): Promise<TRecord>;
  write(value: TRecord): Promise<TRecord>;
}

export interface CreateBirdCoderJsonRecordRepositoryOptions<TRecord> {
  binding: BirdCoderEntityStorageBinding;
  definition: BirdCoderEntityDefinition;
  fallback: TRecord;
  normalize?: (value: unknown, fallback: TRecord) => TRecord;
  storage?: BirdCoderStorageAccess;
}

export interface BirdCoderTableRecordRepository<TRecord, TId extends string = string> {
  binding: BirdCoderEntityStorageBinding;
  clear(): Promise<void>;
  count(): Promise<number>;
  delete(id: TId): Promise<void>;
  definition: BirdCoderEntityDefinition;
  findById(id: TId): Promise<TRecord | null>;
  list(): Promise<TRecord[]>;
  providerId: BirdCoderDatabaseProviderId;
  save(value: TRecord): Promise<TRecord>;
  saveMany(values: readonly TRecord[]): Promise<TRecord[]>;
}

export interface CreateBirdCoderTableRecordRepositoryOptions<
  TRecord,
  TId extends string = string,
> {
  binding: BirdCoderEntityStorageBinding;
  definition: BirdCoderEntityDefinition;
  identify: (value: TRecord) => TId;
  normalize?: (value: unknown) => TRecord | null;
  providerId?: BirdCoderDatabaseProviderId;
  sort?: (left: TRecord, right: TRecord) => number;
  storage?: BirdCoderStorageAccess;
  toRow?: (value: TRecord) => BirdCoderSqlRow;
}

export function buildLocalStoreKey(scope: string, key: string): string {
  return `${LOCAL_STORE_NAMESPACE}:${scope}:${key}`;
}

export function buildProviderScopedStorageKey(
  providerId: BirdCoderDatabaseProviderId,
  binding: BirdCoderEntityStorageBinding,
): string {
  return `${binding.storageMode}.${providerId}.${binding.storageKey}`;
}

export function serializeStoredValue<T>(value: T): string {
  return JSON.stringify(value);
}

export function deserializeStoredValue<T>(rawValue: string | null, fallback: T): T {
  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

async function resolveTauriInvoke(): Promise<TauriInvoke | null> {
  if (typeof window === 'undefined' || !window.__TAURI__) {
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke;
  } catch {
    return null;
  }
}

export async function getStoredRawValue(scope: string, key: string): Promise<string | null> {
  const invoke = await resolveTauriInvoke();
  if (invoke) {
    try {
      return await invoke<string | null>('local_store_get', { scope, key });
    } catch {
      // Fall through to browser storage when the desktop bridge is unavailable.
    }
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

function buildStorageAccessEntryKey(scope: string, key: string): string {
  return `${scope}::${key}`;
}

function buildProviderMigrationHistoryKey(providerId: BirdCoderDatabaseProviderId): string {
  return `schema-migration-history.${providerId}.v1`;
}

function createDefaultStorageAccess(
): BirdCoderStorageAccess {
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

class LocalBirdCoderTransactionalUnitOfWork implements BirdCoderTransactionalUnitOfWork {
  readonly providerId: BirdCoderDatabaseProviderId;
  readonly sqlPlanExecutionEnabled: boolean;

  #state: 'active' | 'committed' | 'rolled_back' = 'active';
  #stagedMutations = new Map<string, BirdCoderUnitOfWorkMutation>();
  private readonly sqlExecutorTransaction?: BirdCoderSqlExecutorTransaction;
  private readonly storageProvider: LocalBirdCoderStorageProvider;

  constructor(
    storageProvider: LocalBirdCoderStorageProvider,
    sqlExecutorTransaction?: BirdCoderSqlExecutorTransaction,
  ) {
    this.storageProvider = storageProvider;
    this.providerId = storageProvider.providerId;
    this.sqlExecutorTransaction = sqlExecutorTransaction;
    this.sqlPlanExecutionEnabled = Boolean(sqlExecutorTransaction);
  }

  async commit(): Promise<void> {
    if (this.#state !== 'active') {
      return;
    }

    if (this.sqlExecutorTransaction) {
      await this.sqlExecutorTransaction.commit();
    }

    for (const [entryKey, mutation] of this.#stagedMutations) {
      const separatorIndex = entryKey.indexOf('::');
      const scope = entryKey.slice(0, separatorIndex);
      const key = entryKey.slice(separatorIndex + 2);

      if (mutation.type === 'delete') {
        await this.storageProvider.removeRawValue(scope, key);
      } else {
        await this.storageProvider.setRawValue(scope, key, mutation.value);
      }
    }

    this.#stagedMutations.clear();
    this.#state = 'committed';
  }

  async rollback(): Promise<void> {
    if (this.#state !== 'active') {
      return;
    }

    if (this.sqlExecutorTransaction) {
      await this.sqlExecutorTransaction.rollback();
    }

    this.#stagedMutations.clear();
    this.#state = 'rolled_back';
  }

  async withinTransaction<T>(operation: () => Promise<T>): Promise<T> {
    try {
      const result = await operation();
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  async readRawValue(scope: string, key: string): Promise<string | null> {
    this.assertActive('read');

    const stagedMutation = this.#stagedMutations.get(buildStorageAccessEntryKey(scope, key));
    if (stagedMutation?.type === 'delete') {
      return null;
    }

    if (stagedMutation?.type === 'set') {
      return stagedMutation.value;
    }

    return this.storageProvider.readRawValue(scope, key);
  }

  async removeRawValue(scope: string, key: string): Promise<void> {
    this.assertActive('delete');
    this.#stagedMutations.set(buildStorageAccessEntryKey(scope, key), {
      type: 'delete',
    });
  }

  async setRawValue(scope: string, key: string, value: string): Promise<void> {
    this.assertActive('write');
    this.#stagedMutations.set(buildStorageAccessEntryKey(scope, key), {
      type: 'set',
      value,
    });
  }

  async executeSqlPlan(plan: BirdCoderSqlPlan): Promise<BirdCoderSqlExecutionResult> {
    this.assertActive('execute SQL plans against');

    if (!this.sqlExecutorTransaction) {
      throw new Error(
        `BirdCoder unit of work for ${this.providerId} does not have SQL executor transaction support.`,
      );
    }

    return this.sqlExecutorTransaction.execute(plan);
  }

  private assertActive(action: string): void {
    if (this.#state !== 'active') {
      throw new Error(
        `BirdCoder unit of work is ${this.#state} and can no longer ${action} data.`,
      );
    }
  }
}

class LocalBirdCoderStorageProvider implements BirdCoderTransactionalStorageProvider {
  readonly dialect;
  readonly providerId: BirdCoderDatabaseProviderId;
  readonly sqlPlanExecutionEnabled: boolean;

  #isClosed = false;
  #isOpen = false;
  private readonly sqlExecutor?: BirdCoderSqlExecutor;

  constructor(
    providerId: BirdCoderDatabaseProviderId,
    options: CreateBirdCoderStorageProviderOptions = {},
  ) {
    this.providerId = providerId;
    this.dialect = createBirdCoderStorageDialect(providerId);
    this.sqlExecutor = options.sqlExecutor;
    this.sqlPlanExecutionEnabled = Boolean(options.sqlExecutor);

    if (this.sqlExecutor && this.sqlExecutor.providerId !== providerId) {
      throw new Error(
        `BirdCoder storage provider ${providerId} cannot bind SQL executor ${this.sqlExecutor.providerId}.`,
      );
    }
  }

  async beginUnitOfWork(): Promise<BirdCoderTransactionalUnitOfWork> {
    await this.open();
    const sqlExecutorTransaction = this.isForkableSqlExecutor(this.sqlExecutor)
      ? await this.sqlExecutor.fork()
      : undefined;
    return new LocalBirdCoderTransactionalUnitOfWork(this, sqlExecutorTransaction);
  }

  async close(): Promise<void> {
    if (this.sqlExecutor && 'close' in this.sqlExecutor && typeof this.sqlExecutor.close === 'function') {
      await this.sqlExecutor.close();
    }

    this.#isOpen = false;
    this.#isClosed = true;
  }

  async healthCheck(): Promise<{ detail?: string; status: 'healthy' | 'degraded' | 'unavailable' }> {
    if (this.#isClosed) {
      return {
        detail: 'Provider is closed and must be recreated before reuse.',
        status: 'degraded',
      };
    }

    return {
      detail: this.#isOpen ? 'Provider is ready.' : 'Provider is idle and can auto-open on demand.',
      status: 'healthy',
    };
  }

  async open(): Promise<void> {
    if (this.#isClosed) {
      throw new Error(`BirdCoder storage provider ${this.providerId} has been closed.`);
    }

    this.#isOpen = true;
  }

  async readRawValue(scope: string, key: string): Promise<string | null> {
    await this.ensureOpen();
    return getStoredRawValue(scope, key);
  }

  async executeSqlPlan(plan: BirdCoderSqlPlan): Promise<BirdCoderSqlExecutionResult> {
    await this.ensureOpen();

    if (!this.sqlExecutor) {
      throw new Error(
        `BirdCoder storage provider ${this.providerId} does not have a bound SQL executor.`,
      );
    }

    return this.sqlExecutor.execute(plan);
  }

  async removeRawValue(scope: string, key: string): Promise<void> {
    await this.ensureOpen();
    await removeStoredValue(scope, key);
  }

  async runMigrations(definitions: readonly BirdCoderSchemaMigrationDefinition[]): Promise<void> {
    await this.ensureOpen();

    const historyKey = buildProviderMigrationHistoryKey(this.providerId);
    const history = deserializeStoredValue<BirdCoderSchemaMigrationHistoryRecord[]>(
      await this.readRawValue(MIGRATION_HISTORY_SCOPE, historyKey),
      [],
    );
    const appliedMigrationIds = new Set(history.map((entry) => entry.migrationId));
    const nextHistory = [...history];
    const runtimeKernelDefinition = getBirdCoderSchemaMigrationDefinition('runtime-data-kernel-v1');
    const resolvedDefinitions =
      this.sqlExecutor &&
      definitions.length > 0 &&
      !definitions.some(
        (definition) => definition.migrationId === runtimeKernelDefinition.migrationId,
      ) &&
      !appliedMigrationIds.has(runtimeKernelDefinition.migrationId)
        ? [runtimeKernelDefinition, ...definitions]
        : definitions;
    const pendingDefinitions = resolvedDefinitions.filter(
      (definition) => !appliedMigrationIds.has(definition.migrationId),
    );

    if (pendingDefinitions.length === 0) {
      return;
    }

    if (this.sqlExecutor) {
      await this.sqlExecutor.execute(
        buildBirdCoderSchemaMigrationPlan(this.providerId, pendingDefinitions),
      );
    }

    for (const definition of pendingDefinitions) {
      const appliedAt = new Date().toISOString();

      nextHistory.push({
        appliedAt,
        description: definition.description,
        entityNames: definition.entityNames,
        migrationId: definition.migrationId,
        providerId: this.providerId,
      });
      appliedMigrationIds.add(definition.migrationId);

      if (this.sqlExecutor) {
        await this.sqlExecutor.execute(
          buildBirdCoderSchemaMigrationHistoryUpsertPlan(this.providerId, {
            appliedAt,
            description: definition.description,
            entityNames: definition.entityNames,
            migrationId: definition.migrationId,
            providerId: this.providerId,
          }),
        );
      }
    }

    await this.setRawValue(
      MIGRATION_HISTORY_SCOPE,
      historyKey,
      serializeStoredValue(nextHistory),
    );
  }

  async setRawValue(scope: string, key: string, value: string): Promise<void> {
    await this.ensureOpen();
    await setStoredRawValue(scope, key, value);
  }

  private isForkableSqlExecutor(
    sqlExecutor?: BirdCoderSqlExecutor,
  ): sqlExecutor is BirdCoderForkableSqlExecutor {
    return Boolean(sqlExecutor && 'fork' in sqlExecutor && typeof sqlExecutor.fork === 'function');
  }

  private async ensureOpen(): Promise<void> {
    if (!this.#isOpen) {
      await this.open();
    }
  }
}

export function createBirdCoderStorageProvider(
  providerId: BirdCoderDatabaseProviderId,
  options: CreateBirdCoderStorageProviderOptions = {},
): BirdCoderTransactionalStorageProvider {
  return new LocalBirdCoderStorageProvider(providerId, options);
}

export async function setStoredRawValue(scope: string, key: string, value: string): Promise<void> {
  const invoke = await resolveTauriInvoke();
  if (invoke) {
    try {
      await invoke('local_store_set', { scope, key, value });
      return;
    } catch {
      // Fall through to browser storage when the desktop bridge is unavailable.
    }
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
    try {
      await invoke('local_store_delete', { scope, key });
      return;
    } catch {
      // Fall through to browser storage when the desktop bridge is unavailable.
    }
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

export function createJsonRecordRepository<TRecord>({
  binding,
  definition,
  fallback,
  normalize,
  storage,
}: CreateBirdCoderJsonRecordRepositoryOptions<TRecord>): BirdCoderJsonRecordRepository<TRecord> {
  const storageAccess = storage ?? createDefaultStorageAccess();
  const normalizeValue =
    normalize ??
    ((value: unknown, repositoryFallback: TRecord) =>
      deserializeStoredValue(
        typeof value === 'string' ? value : serializeStoredValue(value),
        repositoryFallback,
      ));

  return {
    binding,
    definition,
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

function defaultNormalizeTableRecord<TRecord>(value: unknown): TRecord | null {
  if (value === null || value === undefined) {
    return null;
  }

  return value as TRecord;
}

function normalizeStoredTableRecords<TRecord>(
  value: unknown,
  normalizeRecord: (value: unknown) => TRecord | null,
  sortRecords?: (left: TRecord, right: TRecord) => number,
): TRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedRecords = value.flatMap((entry) => {
    const normalizedEntry = normalizeRecord(entry);
    return normalizedEntry ? [normalizedEntry] : [];
  });

  if (sortRecords) {
    normalizedRecords.sort(sortRecords);
  }

  return normalizedRecords;
}

function supportsSqlPlanExecution(
  storage: BirdCoderStorageAccess | BirdCoderSqlPlanStorageAccess,
): storage is BirdCoderSqlPlanStorageAccess {
  return (
    'sqlPlanExecutionEnabled' in storage &&
    storage.sqlPlanExecutionEnabled === true &&
    'executeSqlPlan' in storage &&
    typeof storage.executeSqlPlan === 'function'
  );
}

export function createBirdCoderTableRecordRepository<TRecord, TId extends string = string>({
  binding,
  definition,
  identify,
  normalize = defaultNormalizeTableRecord<TRecord>,
  providerId = binding.preferredProvider,
  sort,
  storage,
  toRow,
}: CreateBirdCoderTableRecordRepositoryOptions<
  TRecord,
  TId
>): BirdCoderTableRecordRepository<TRecord, TId> {
  if (binding.storageMode !== 'table') {
    throw new Error(
      `Table repositories require table storage mode. Received ${binding.storageMode} for ${binding.entityName}.`,
    );
  }

  const storageKey = buildProviderScopedStorageKey(providerId, binding);
  const storageAccess = storage ?? createDefaultStorageAccess();
  const sqlPlanner = createBirdCoderTableSqlPlanner({
    binding,
    definition,
    providerId,
  });
  const useSqlExecutorPath = supportsSqlPlanExecution(storageAccess) && typeof toRow === 'function';

  async function readRecords(): Promise<TRecord[]> {
    if (useSqlExecutorPath) {
      const result = await storageAccess.executeSqlPlan(sqlPlanner.buildListPlan());
      return normalizeStoredTableRecords(result.rows ?? [], normalize, sort);
    }

    const rawRecords = deserializeStoredValue<unknown[]>(
      await storageAccess.readRawValue(binding.storageScope, storageKey),
      [],
    );
    return normalizeStoredTableRecords(rawRecords, normalize, sort);
  }

  async function writeRecords(records: readonly TRecord[]): Promise<TRecord[]> {
    const normalizedRecords = normalizeStoredTableRecords(records, normalize, sort);

    if (useSqlExecutorPath) {
      await storageAccess.executeSqlPlan(
        sqlPlanner.buildUpsertPlan(normalizedRecords.map((record) => toRow(record))),
      );
      return normalizedRecords;
    }

    await storageAccess.setRawValue(
      binding.storageScope,
      storageKey,
      serializeStoredValue(normalizedRecords),
    );
    return normalizedRecords;
  }

  return {
    binding,
    definition,
    providerId,
    async list() {
      return readRecords();
    },
    async count() {
      if (useSqlExecutorPath) {
        const result = await storageAccess.executeSqlPlan(sqlPlanner.buildCountPlan());
        return Number(result.rows?.[0]?.total ?? 0);
      }

      const records = await readRecords();
      return records.length;
    },
    async findById(id) {
      if (useSqlExecutorPath) {
        const result = await storageAccess.executeSqlPlan(sqlPlanner.buildFindByIdPlan(id));
        return normalizeStoredTableRecords(result.rows ?? [], normalize, sort)[0] ?? null;
      }

      const records = await readRecords();
      return records.find((record) => identify(record) === id) ?? null;
    },
    async delete(id) {
      if (useSqlExecutorPath) {
        await storageAccess.executeSqlPlan(sqlPlanner.buildDeletePlan(id));
        return;
      }

      const records = await readRecords();
      const nextRecords = records.filter((record) => identify(record) !== id);
      await writeRecords(nextRecords);
    },
    async save(value) {
      const [savedValue] = await this.saveMany([value]);
      return savedValue;
    },
    async saveMany(values) {
      const currentRecords = await readRecords();
      const nextRecords = [...currentRecords];
      const indexesById = new Map<TId, number>();

      nextRecords.forEach((record, index) => {
        indexesById.set(identify(record), index);
      });

      for (const value of values) {
        const normalizedValue = normalize(value);
        if (!normalizedValue) {
          continue;
        }

        const recordId = identify(normalizedValue);
        const currentIndex = indexesById.get(recordId);
        if (currentIndex === undefined) {
          indexesById.set(recordId, nextRecords.length as number);
          nextRecords.push(normalizedValue);
        } else {
          nextRecords[currentIndex] = normalizedValue;
        }
      }

      await writeRecords(nextRecords);
      return normalizeStoredTableRecords(values, normalize, sort);
    },
    async clear() {
      if (useSqlExecutorPath) {
        await storageAccess.executeSqlPlan(sqlPlanner.buildClearPlan());
        return;
      }

      await storageAccess.removeRawValue(binding.storageScope, storageKey);
    },
  };
}
