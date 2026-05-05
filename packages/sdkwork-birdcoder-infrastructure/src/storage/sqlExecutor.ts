import type { BirdCoderDatabaseProviderId } from '@sdkwork/birdcoder-types';
import type { BirdCoderSqlPlan, BirdCoderSqlPlanOrderBy, BirdCoderSqlRow } from './sqlPlans.ts';

export interface BirdCoderSqlExecutionResult {
  affectedRowCount?: number;
  rows?: readonly BirdCoderSqlRow[];
}

export interface BirdCoderSqlExecutor {
  readonly providerId: BirdCoderDatabaseProviderId;
  execute(plan: BirdCoderSqlPlan): Promise<BirdCoderSqlExecutionResult>;
}

export interface BirdCoderForkableSqlExecutor extends BirdCoderSqlExecutor {
  fork(): Promise<BirdCoderSqlExecutorTransaction>;
}

export interface BirdCoderSqlExecutorTransaction extends BirdCoderSqlExecutor {
  commit(): Promise<void>;
  readonly history: BirdCoderSqlPlan[];
  rollback(): Promise<void>;
}

export interface BirdCoderRecordingSqlExecutor extends BirdCoderSqlExecutor {
  readonly history: BirdCoderSqlPlan[];
}

export interface BirdCoderInMemorySqlExecutor extends BirdCoderForkableSqlExecutor {
  readonly history: BirdCoderSqlPlan[];
}

type BirdCoderInMemoryTableState = Map<string, BirdCoderSqlRow>;

function cloneRow(row: BirdCoderSqlRow): BirdCoderSqlRow {
  return structuredClone(row);
}

function cloneTables(
  tables: Map<string, BirdCoderInMemoryTableState>,
): Map<string, BirdCoderInMemoryTableState> {
  return new Map(
    Array.from(tables.entries(), ([tableName, rows]) => [
      tableName,
      new Map(Array.from(rows.entries(), ([id, row]) => [id, cloneRow(row)])),
    ]),
  );
}

function compareValues(left: unknown, right: unknown): number {
  const normalizedLeft = left ?? '';
  const normalizedRight = right ?? '';

  if (normalizedLeft === normalizedRight) {
    return 0;
  }

  return normalizedLeft > normalizedRight ? 1 : -1;
}

function sortRows(
  rows: readonly BirdCoderSqlRow[],
  orderBy: readonly BirdCoderSqlPlanOrderBy[],
): BirdCoderSqlRow[] {
  return [...rows].sort((left, right) => {
    for (const rule of orderBy) {
      const comparison = compareValues(left[rule.column], right[rule.column]);
      if (comparison !== 0) {
        return rule.direction === 'desc' ? comparison * -1 : comparison;
      }
    }

    return 0;
  });
}

function isRowSoftDeleted(row: BirdCoderSqlRow): boolean {
  return row.is_deleted === true || row.is_deleted === 1 || row.is_deleted === '1';
}

function normalizeNullableTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  return Number.isNaN(Date.parse(value)) ? null : value;
}

function compareTimestamps(left: string | null, right: string | null): number {
  const leftValue = left ? Date.parse(left) : Number.NEGATIVE_INFINITY;
  const rightValue = right ? Date.parse(right) : Number.NEGATIVE_INFINITY;
  return leftValue - rightValue;
}

class InMemorySqlExecutorImpl implements BirdCoderInMemorySqlExecutor, BirdCoderSqlExecutorTransaction {
  readonly history: BirdCoderSqlPlan[] = [];
  readonly providerId: BirdCoderDatabaseProviderId;

  #committed = false;
  #parent?: InMemorySqlExecutorImpl;
  #rolledBack = false;
  #tables: Map<string, BirdCoderInMemoryTableState>;

  constructor(
    providerId: BirdCoderDatabaseProviderId,
    tables: Map<string, BirdCoderInMemoryTableState> = new Map(),
    parent?: InMemorySqlExecutorImpl,
  ) {
    this.providerId = providerId;
    this.#parent = parent;
    this.#tables = tables;
  }

  async execute(plan: BirdCoderSqlPlan): Promise<BirdCoderSqlExecutionResult> {
    if (plan.providerId !== this.providerId) {
      throw new Error(
        `BirdCoder in-memory SQL executor for ${this.providerId} cannot execute ${plan.providerId} plans.`,
      );
    }

    if (this.#rolledBack) {
      throw new Error('BirdCoder in-memory SQL executor transaction has been rolled back.');
    }

    if (this.#committed) {
      throw new Error('BirdCoder in-memory SQL executor transaction has already been committed.');
    }

    this.history.push(plan);
    const meta = plan.meta;
    if (!meta) {
      return {
        affectedRowCount: plan.statements.length,
      };
    }

    switch (meta.kind) {
      case 'migration':
        for (const tableName of meta.tableNames) {
          this.ensureTable(tableName);
        }
        return {
          affectedRowCount: meta.tableNames.length,
        };
      case 'migration-history-upsert': {
        const table = this.ensureTable(meta.tableName);
        const rowId = String(meta.row.id);
        if (!table.has(rowId)) {
          table.set(rowId, cloneRow(meta.row));
          return { affectedRowCount: 1 };
        }

        return { affectedRowCount: 0 };
      }
      case 'table-upsert': {
        const table = this.ensureTable(meta.tableName);
        for (const row of meta.rows) {
          table.set(String(row.id), cloneRow(row));
        }
        return {
          affectedRowCount: meta.rows.length,
        };
      }
      case 'table-list': {
        const table = this.ensureTable(meta.tableName);
        const rows = Array.from(table.values()).filter((row) =>
          meta.excludeDeleted ? !isRowSoftDeleted(row) : true,
        );
        return {
          rows: sortRows(rows, meta.orderBy),
        };
      }
      case 'coding-session-list-by-project-ids': {
        const table = this.ensureTable(meta.tableName);
        const projectIdSet = new Set(meta.projectIds);
        const rows = Array.from(table.values()).filter((row) =>
          projectIdSet.has(String(row.project_id)) &&
          (meta.excludeDeleted ? !isRowSoftDeleted(row) : true),
        );
        return {
          rows: sortRows(rows, meta.orderBy),
        };
      }
      case 'project-content-list-by-project-ids': {
        const table = this.ensureTable(meta.tableName);
        const projectIdSet = new Set(meta.projectIds);
        const rows = Array.from(table.values()).filter((row) =>
          projectIdSet.has(String(row.project_id)) &&
          (meta.excludeDeleted ? !isRowSoftDeleted(row) : true),
        );
        return {
          rows: sortRows(rows, meta.orderBy),
        };
      }
      case 'project-list-by-workspace-ids': {
        const table = this.ensureTable(meta.tableName);
        const workspaceIdSet = new Set(meta.workspaceIds);
        const rows = Array.from(table.values()).filter((row) =>
          workspaceIdSet.has(String(row.workspace_id)) &&
          (meta.excludeDeleted ? !isRowSoftDeleted(row) : true),
        );
        return {
          rows: sortRows(rows, meta.orderBy),
        };
      }
      case 'coding-session-messages-by-session-ids': {
        const table = this.ensureTable(meta.tableName);
        const codingSessionIdSet = new Set(meta.codingSessionIds);
        const rows = Array.from(table.values()).filter((row) =>
          codingSessionIdSet.has(String(row.coding_session_id)) &&
          (meta.excludeDeleted ? !isRowSoftDeleted(row) : true),
        );
        return {
          rows: sortRows(rows, meta.orderBy),
        };
      }
      case 'coding-session-message-metadata-by-session-ids': {
        const table = this.ensureTable(meta.tableName);
        const codingSessionIdSet = new Set(meta.codingSessionIds);
        const metadataByCodingSessionId = new Map<
          string,
          {
            coding_session_id: string;
            latest_transcript_updated_at: string | null;
            message_count: number;
            native_transcript_updated_at: string | null;
          }
        >();

        for (const row of table.values()) {
          const codingSessionId = String(row.coding_session_id ?? '');
          if (
            !codingSessionIdSet.has(codingSessionId) ||
            (meta.excludeDeleted && isRowSoftDeleted(row))
          ) {
            continue;
          }

          const currentMetadata = metadataByCodingSessionId.get(codingSessionId) ?? {
            coding_session_id: codingSessionId,
            latest_transcript_updated_at: null,
            message_count: 0,
            native_transcript_updated_at: null,
          };
          const createdAt = normalizeNullableTimestamp(row.created_at);
          currentMetadata.message_count += 1;
          if (compareTimestamps(createdAt, currentMetadata.latest_transcript_updated_at) > 0) {
            currentMetadata.latest_transcript_updated_at = createdAt;
          }
          if (
            String(row.id ?? '').includes(meta.nativeMessageIdSegment) &&
            compareTimestamps(createdAt, currentMetadata.native_transcript_updated_at) > 0
          ) {
            currentMetadata.native_transcript_updated_at = createdAt;
          }
          metadataByCodingSessionId.set(codingSessionId, currentMetadata);
        }

        return {
          rows: Array.from(metadataByCodingSessionId.values()).sort((left, right) =>
            left.coding_session_id.localeCompare(right.coding_session_id),
          ),
        };
      }
      case 'coding-session-messages-delete-by-project-ids': {
        const sessionTable = this.ensureTable(meta.sessionTableName);
        const projectIdSet = new Set(meta.projectIds);
        const deletedSessionIds = new Set<string>();
        for (const row of sessionTable.values()) {
          if (projectIdSet.has(String(row.project_id))) {
            deletedSessionIds.add(String(row.id));
          }
        }

        const table = this.ensureTable(meta.tableName);
        let affectedRowCount = 0;
        for (const [rowId, row] of [...table.entries()]) {
          if (deletedSessionIds.has(String(row.coding_session_id))) {
            table.delete(rowId);
            affectedRowCount += 1;
          }
        }
        return {
          affectedRowCount,
        };
      }
      case 'coding-session-messages-delete-by-session-ids': {
        const table = this.ensureTable(meta.tableName);
        const codingSessionIdSet = new Set(meta.codingSessionIds);
        let affectedRowCount = 0;
        for (const [rowId, row] of [...table.entries()]) {
          if (codingSessionIdSet.has(String(row.coding_session_id))) {
            table.delete(rowId);
            affectedRowCount += 1;
          }
        }
        return {
          affectedRowCount,
        };
      }
      case 'coding-session-delete-by-project-ids': {
        const table = this.ensureTable(meta.tableName);
        const projectIdSet = new Set(meta.projectIds);
        let affectedRowCount = 0;
        for (const [rowId, row] of [...table.entries()]) {
          if (projectIdSet.has(String(row.project_id))) {
            table.delete(rowId);
            affectedRowCount += 1;
          }
        }
        return {
          affectedRowCount,
        };
      }
      case 'table-count': {
        const table = this.ensureTable(meta.tableName);
        const total = Array.from(table.values()).filter((row) =>
          meta.excludeDeleted ? !isRowSoftDeleted(row) : true,
        ).length;
        return {
          rows: [{ total }],
        };
      }
      case 'table-find-by-id': {
        const table = this.ensureTable(meta.tableName);
        const row = table.get(meta.id);
        if (!row) {
          return {
            rows: [],
          };
        }

        if (meta.excludeDeleted && isRowSoftDeleted(row)) {
          return {
            rows: [],
          };
        }

        return {
          rows: [cloneRow(row)],
        };
      }
      case 'table-delete': {
        const table = this.ensureTable(meta.tableName);
        const deleted = table.delete(meta.id);
        return {
          affectedRowCount: deleted ? 1 : 0,
        };
      }
      case 'table-clear': {
        const table = this.ensureTable(meta.tableName);
        const affectedRowCount = table.size;
        table.clear();
        return {
          affectedRowCount,
        };
      }
      default:
        return {
          affectedRowCount: plan.statements.length,
        };
    }
  }

  async fork(): Promise<BirdCoderSqlExecutorTransaction> {
    return new InMemorySqlExecutorImpl(this.providerId, cloneTables(this.#tables), this);
  }

  async commit(): Promise<void> {
    if (!this.#parent) {
      this.#committed = true;
      return;
    }

    if (this.#rolledBack) {
      throw new Error('Cannot commit a rolled back BirdCoder SQL executor transaction.');
    }

    this.#parent.#tables = cloneTables(this.#tables);
    this.#parent.history.push(...this.history);
    this.#committed = true;
  }

  async rollback(): Promise<void> {
    this.#rolledBack = true;
  }

  private ensureTable(tableName: string): BirdCoderInMemoryTableState {
    const currentTable = this.#tables.get(tableName);
    if (currentTable) {
      return currentTable;
    }

    const nextTable = new Map<string, BirdCoderSqlRow>();
    this.#tables.set(tableName, nextTable);
    return nextTable;
  }
}

export function createBirdCoderRecordingSqlExecutor(
  providerId: BirdCoderDatabaseProviderId,
): BirdCoderRecordingSqlExecutor {
  const history: BirdCoderSqlPlan[] = [];

  return {
    history,
    providerId,
    async execute(plan) {
      if (plan.providerId !== providerId) {
        throw new Error(
          `BirdCoder SQL executor for ${providerId} cannot execute ${plan.providerId} plans.`,
        );
      }

      history.push(plan);
      return {
        affectedRowCount: plan.statements.length,
      };
    },
  };
}

export function createBirdCoderInMemorySqlExecutor(
  providerId: BirdCoderDatabaseProviderId,
): BirdCoderInMemorySqlExecutor {
  return new InMemorySqlExecutorImpl(providerId);
}
