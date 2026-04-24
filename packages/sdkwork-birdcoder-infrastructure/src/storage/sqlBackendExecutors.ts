import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

import type { BirdCoderDatabaseProviderId } from '@sdkwork/birdcoder-types';
import type { BirdCoderSqlPlan, BirdCoderSqlRow } from './sqlPlans.ts';
import type {
  BirdCoderForkableSqlExecutor,
  BirdCoderSqlExecutionResult,
  BirdCoderSqlExecutorTransaction,
} from './sqlExecutor.ts';

export interface BirdCoderClosableSqlExecutor {
  close(): Promise<void>;
}

export interface CreateBirdCoderSqliteFileSqlExecutorOptions {
  busyTimeoutMs?: number;
  databaseFile: string;
  enableWal?: boolean;
}

export interface BirdCoderPostgresqlSqlQueryResult {
  rowCount?: number | null;
  rows?: readonly BirdCoderSqlRow[];
}

export interface BirdCoderPostgresqlSqlConnection {
  close(): Promise<void>;
  query(sql: string, params?: readonly unknown[]): Promise<BirdCoderPostgresqlSqlQueryResult>;
}

export interface CreateBirdCoderPostgresqlClientSqlExecutorOptions {
  openConnection: () => Promise<BirdCoderPostgresqlSqlConnection>;
}

interface NodeSqliteModule {
  DatabaseSync: new (databaseFile: string) => DatabaseSync;
}

const SQLITE_EXPERIMENTAL_WARNING_MESSAGE =
  'SQLite is an experimental feature and might change at any time';

const nodeRequire = createRequire(import.meta.url);

let cachedNodeSqliteModule: NodeSqliteModule | null = null;

function isSqliteExperimentalWarning(
  warning: unknown,
  rest: readonly unknown[],
) {
  const warningMessage =
    typeof warning === 'string'
      ? warning
      : warning instanceof Error
        ? warning.message
        : '';
  const warningType =
    typeof warning === 'string'
      ? (typeof rest[0] === 'string' ? rest[0] : '')
      : warning instanceof Error
        ? warning.name
        : '';

  return (
    warningType === 'ExperimentalWarning' &&
    warningMessage === SQLITE_EXPERIMENTAL_WARNING_MESSAGE
  );
}

function loadNodeSqliteModule(): NodeSqliteModule {
  if (cachedNodeSqliteModule) {
    return cachedNodeSqliteModule;
  }

  const originalEmitWarning = process.emitWarning;

  // BirdCoder intentionally uses Node's sqlite backend; keep this one experimental marker
  // from polluting test and runtime output while preserving all other process warnings.
  process.emitWarning = ((warning: unknown, ...rest: unknown[]) => {
    if (isSqliteExperimentalWarning(warning, rest)) {
      return;
    }

    Reflect.apply(
      originalEmitWarning as unknown as (...args: unknown[]) => void,
      process,
      [warning, ...rest],
    );
  }) as typeof process.emitWarning;

  try {
    cachedNodeSqliteModule = nodeRequire('node:sqlite') as NodeSqliteModule;
    return cachedNodeSqliteModule;
  } finally {
    process.emitWarning = originalEmitWarning;
  }
}

function cloneSqlRows(rows: readonly BirdCoderSqlRow[] | undefined): readonly BirdCoderSqlRow[] {
  if (!rows) {
    return [];
  }

  return rows.map((row) => structuredClone(row));
}

function isReadStatement(sql: string): boolean {
  return /^\s*(select|with)\b/i.test(sql);
}

function assertPlanProvider(
  expectedProviderId: BirdCoderDatabaseProviderId,
  plan: BirdCoderSqlPlan,
): void {
  if (plan.providerId !== expectedProviderId) {
    throw new Error(
      `BirdCoder SQL executor for ${expectedProviderId} cannot execute ${plan.providerId} plans.`,
    );
  }
}

function openSqliteDatabase({
  busyTimeoutMs = 5000,
  databaseFile,
  enableWal = true,
}: CreateBirdCoderSqliteFileSqlExecutorOptions): DatabaseSync {
  mkdirSync(path.dirname(databaseFile), { recursive: true });

  const { DatabaseSync } = loadNodeSqliteModule();
  const database = new DatabaseSync(databaseFile);
  database.exec(`PRAGMA busy_timeout = ${Math.max(busyTimeoutMs, 0)};`);
  database.exec('PRAGMA foreign_keys = ON;');
  if (enableWal) {
    database.exec('PRAGMA journal_mode = WAL;');
  }

  return database;
}

function executeSqlitePlan(
  database: DatabaseSync,
  plan: BirdCoderSqlPlan,
): BirdCoderSqlExecutionResult {
  let affectedRowCount = 0;
  let rows: readonly BirdCoderSqlRow[] | undefined;

  for (const statement of plan.statements) {
    const preparedStatement = database.prepare(statement.sql);
    const params = statement.params as any[];

    if (isReadStatement(statement.sql)) {
      rows = cloneSqlRows(preparedStatement.all(...params) as BirdCoderSqlRow[]);
      continue;
    }

    const result = preparedStatement.run(...params);
    affectedRowCount += Number(result.changes ?? 0);
  }

  return {
    affectedRowCount,
    rows,
  };
}

class BirdCoderSqliteFileSqlExecutor
  implements BirdCoderForkableSqlExecutor, BirdCoderClosableSqlExecutor
{
  readonly providerId = 'sqlite';

  #closed = false;
  #database: DatabaseSync;
  #options: CreateBirdCoderSqliteFileSqlExecutorOptions;

  constructor(options: CreateBirdCoderSqliteFileSqlExecutorOptions) {
    this.#options = options;
    this.#database = openSqliteDatabase(options);
  }

  async execute(plan: BirdCoderSqlPlan): Promise<BirdCoderSqlExecutionResult> {
    this.assertOpen();
    assertPlanProvider(this.providerId, plan);
    return executeSqlitePlan(this.#database, plan);
  }

  async fork(): Promise<BirdCoderSqlExecutorTransaction> {
    this.assertOpen();
    return new BirdCoderSqliteFileSqlTransaction(this.#options);
  }

  async close(): Promise<void> {
    if (this.#closed) {
      return;
    }

    this.#database.close();
    this.#closed = true;
  }

  private assertOpen(): void {
    if (this.#closed) {
      throw new Error('BirdCoder sqlite SQL executor has already been closed.');
    }
  }
}

class BirdCoderSqliteFileSqlTransaction
  implements BirdCoderSqlExecutorTransaction, BirdCoderClosableSqlExecutor
{
  readonly history: BirdCoderSqlPlan[] = [];
  readonly providerId = 'sqlite';

  #closed = false;
  #database: DatabaseSync;
  #state: 'active' | 'committed' | 'rolled_back' = 'active';

  constructor(options: CreateBirdCoderSqliteFileSqlExecutorOptions) {
    this.#database = openSqliteDatabase(options);
    this.#database.exec('BEGIN IMMEDIATE;');
  }

  async execute(plan: BirdCoderSqlPlan): Promise<BirdCoderSqlExecutionResult> {
    this.assertActive();
    assertPlanProvider(this.providerId, plan);
    this.history.push(plan);
    return executeSqlitePlan(this.#database, plan);
  }

  async commit(): Promise<void> {
    if (this.#state !== 'active') {
      return;
    }

    this.#database.exec('COMMIT;');
    this.#state = 'committed';
    await this.close();
  }

  async rollback(): Promise<void> {
    if (this.#state !== 'active') {
      return;
    }

    this.#database.exec('ROLLBACK;');
    this.#state = 'rolled_back';
    await this.close();
  }

  async close(): Promise<void> {
    if (this.#closed) {
      return;
    }

    this.#database.close();
    this.#closed = true;
  }

  private assertActive(): void {
    if (this.#state !== 'active') {
      throw new Error(
        `BirdCoder sqlite SQL executor transaction is ${this.#state} and cannot execute more plans.`,
      );
    }
  }
}

class BirdCoderPostgresqlClientSqlExecutor
  implements BirdCoderForkableSqlExecutor, BirdCoderSqlExecutorTransaction, BirdCoderClosableSqlExecutor
{
  readonly history: BirdCoderSqlPlan[] = [];
  readonly providerId = 'postgresql';

  #connectionPromise: Promise<BirdCoderPostgresqlSqlConnection> | null = null;
  #closed = false;
  #committed = false;
  #openConnection: () => Promise<BirdCoderPostgresqlSqlConnection>;
  #rolledBack = false;
  #transactional: boolean;

  constructor(
    openConnection: () => Promise<BirdCoderPostgresqlSqlConnection>,
    transactional = false,
  ) {
    this.#openConnection = openConnection;
    this.#transactional = transactional;
  }

  async execute(plan: BirdCoderSqlPlan): Promise<BirdCoderSqlExecutionResult> {
    this.assertActive();
    assertPlanProvider(this.providerId, plan);

    const connection = await this.getConnection();
    this.history.push(plan);

    let affectedRowCount = 0;
    let rows: readonly BirdCoderSqlRow[] | undefined;

    for (const statement of plan.statements) {
      const result = await connection.query(statement.sql, statement.params);
      affectedRowCount += Number(result.rowCount ?? 0);
      if (isReadStatement(statement.sql)) {
        rows = cloneSqlRows(result.rows);
      }
    }

    return {
      affectedRowCount,
      rows,
    };
  }

  async fork(): Promise<BirdCoderSqlExecutorTransaction> {
    this.assertActive();
    const transaction = new BirdCoderPostgresqlClientSqlExecutor(this.#openConnection, true);
    await transaction.getConnection();
    return transaction;
  }

  async commit(): Promise<void> {
    if (!this.#transactional || this.#committed || this.#rolledBack) {
      return;
    }

    const connection = await this.getConnection();
    await connection.query('COMMIT');
    this.#committed = true;
    await this.close();
  }

  async rollback(): Promise<void> {
    if (!this.#transactional || this.#committed || this.#rolledBack) {
      return;
    }

    const connection = await this.getConnection();
    await connection.query('ROLLBACK');
    this.#rolledBack = true;
    await this.close();
  }

  async close(): Promise<void> {
    if (this.#closed) {
      return;
    }

    this.#closed = true;

    if (!this.#connectionPromise) {
      return;
    }

    try {
      const connection = await this.#connectionPromise;
      await connection.close();
    } catch {
      // Connection establishment already failed, so there is no live handle left to close here.
    }
  }

  private assertActive(): void {
    if (this.#closed || this.#rolledBack) {
      throw new Error('BirdCoder postgresql SQL executor is no longer active.');
    }

    if (this.#transactional && this.#committed) {
      throw new Error('BirdCoder postgresql SQL executor transaction has already been committed.');
    }
  }

  private async getConnection(): Promise<BirdCoderPostgresqlSqlConnection> {
    this.#connectionPromise ??= (async () => {
      const connection = await this.#openConnection();

      try {
        if (this.#transactional) {
          await connection.query('BEGIN');
        }
      } catch (error) {
        await connection.close().catch(() => undefined);
        throw error;
      }

      return connection;
    })();

    return this.#connectionPromise;
  }
}

export function createBirdCoderSqliteFileSqlExecutor(
  options: CreateBirdCoderSqliteFileSqlExecutorOptions,
): BirdCoderForkableSqlExecutor & BirdCoderClosableSqlExecutor {
  return new BirdCoderSqliteFileSqlExecutor(options);
}

export function createBirdCoderPostgresqlClientSqlExecutor(
  options: CreateBirdCoderPostgresqlClientSqlExecutorOptions,
): BirdCoderForkableSqlExecutor & BirdCoderClosableSqlExecutor {
  return new BirdCoderPostgresqlClientSqlExecutor(options.openConnection);
}
