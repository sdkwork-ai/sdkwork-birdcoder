import {
  getBirdCoderEntityDefinition,
  type BirdCoderDatabaseProviderId,
  type BirdCoderEntityDefinition,
  type BirdCoderEntityStorageBinding,
  type BirdCoderSchemaColumnDefinition,
  type BirdCoderSchemaMigrationDefinition,
  stringifyBirdCoderApiJson,
  stringifyBirdCoderLongInteger,
} from '@sdkwork/birdcoder-types';
import { createBirdCoderStorageDialect } from './providers.ts';

export type BirdCoderSqlPlanIntent = 'read' | 'write';

export interface BirdCoderSqlPlanStatement {
  params: readonly unknown[];
  sql: string;
}

export interface BirdCoderSqlPlanOrderBy {
  column: string;
  direction: 'asc' | 'desc';
}

export type BirdCoderSqlPlanMeta =
  | {
      kind: 'migration';
      migrationIds: readonly string[];
      tableNames: readonly string[];
    }
  | {
      kind: 'migration-history-upsert';
      row: BirdCoderSqlRow;
      tableName: string;
    }
  | {
      excludeDeleted: boolean;
      kind: 'table-list';
      orderBy: readonly BirdCoderSqlPlanOrderBy[];
      tableName: string;
    }
  | {
      excludeDeleted: boolean;
      kind: 'table-count';
      tableName: string;
    }
  | {
      excludeDeleted: boolean;
      id: string;
      kind: 'table-find-by-id';
      tableName: string;
    }
  | {
      kind: 'table-upsert';
      rows: readonly BirdCoderSqlRow[];
      tableName: string;
    }
  | {
      id: string;
      kind: 'table-delete';
      tableName: string;
    }
  | {
      kind: 'table-clear';
      tableName: string;
    };

export interface BirdCoderSqlPlan {
  intent: BirdCoderSqlPlanIntent;
  meta?: BirdCoderSqlPlanMeta;
  providerId: BirdCoderDatabaseProviderId;
  statements: readonly BirdCoderSqlPlanStatement[];
  transactional: boolean;
}

export type BirdCoderSqlRow = Record<string, unknown>;

export interface CreateBirdCoderTableSqlPlannerOptions {
  binding: BirdCoderEntityStorageBinding;
  definition: BirdCoderEntityDefinition;
  providerId: BirdCoderDatabaseProviderId;
}

export interface BirdCoderTableSqlPlanner {
  buildClearPlan(): BirdCoderSqlPlan;
  buildCountPlan(): BirdCoderSqlPlan;
  buildDeletePlan(id: string): BirdCoderSqlPlan;
  buildFindByIdPlan(id: string): BirdCoderSqlPlan;
  buildListPlan(): BirdCoderSqlPlan;
  buildUpsertPlan(rows: readonly BirdCoderSqlRow[]): BirdCoderSqlPlan;
}

export interface BirdCoderSchemaMigrationHistoryPlanInput {
  appliedAt: string;
  description: string;
  entityNames: readonly string[];
  migrationId: string;
  providerId: BirdCoderDatabaseProviderId;
}

function buildPlan(
  providerId: BirdCoderDatabaseProviderId,
  intent: BirdCoderSqlPlanIntent,
  statements: readonly BirdCoderSqlPlanStatement[],
  meta?: BirdCoderSqlPlanMeta,
): BirdCoderSqlPlan {
  return {
    intent,
    meta,
    providerId,
    statements,
    transactional: intent === 'write' && statements.length > 0,
  };
}

function normalizeBooleanValue(
  providerId: BirdCoderDatabaseProviderId,
  value: unknown,
): boolean | number {
  const normalizedValue = Boolean(value);
  return providerId === 'sqlite' ? (normalizedValue ? 1 : 0) : normalizedValue;
}

function normalizeJsonValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  return stringifyBirdCoderApiJson(value ?? {});
}

function normalizeIdSqlParamValue(columnName: string, value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new Error(`BirdCoder SQL id field ${columnName} must be an integer.`);
    }
    if (!Number.isSafeInteger(value)) {
      throw new Error(
        `BirdCoder SQL id field ${columnName} received an unsafe JavaScript number; pass the exact decimal string instead.`,
      );
    }
    return String(value);
  }

  throw new Error(
    `BirdCoder SQL id field ${columnName} must be a string, bigint, or safe integer.`,
  );
}

function normalizeLongIntegerSqlParamValue(columnName: string, value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    return null;
  }

  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    return stringifyBirdCoderLongInteger(String(value));
  }

  try {
    return stringifyBirdCoderLongInteger(value);
  } catch (error) {
    throw new Error(
      `BirdCoder SQL bigint field ${columnName} must be an exact decimal string.`,
      { cause: error },
    );
  }
}

function normalizeIntegerSqlParamValue(columnName: string, value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new Error(`BirdCoder SQL int field ${columnName} must be an integer.`);
    }
    if (!Number.isSafeInteger(value)) {
      throw new Error(
        `BirdCoder SQL int field ${columnName} received an unsafe JavaScript number; pass a safe integer instead.`,
      );
    }
    return value;
  }

  if (typeof value === 'bigint') {
    const min = BigInt(Number.MIN_SAFE_INTEGER);
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    if (value < min || value > max) {
      throw new Error(`BirdCoder SQL int field ${columnName} must be a safe integer.`);
    }
    return Number(value);
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return null;
    }
    if (!/^[+-]?\d+$/u.test(normalizedValue)) {
      throw new Error(`BirdCoder SQL int field ${columnName} must be an integer.`);
    }

    const integerValue = BigInt(normalizedValue);
    const min = BigInt(Number.MIN_SAFE_INTEGER);
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    if (integerValue < min || integerValue > max) {
      throw new Error(`BirdCoder SQL int field ${columnName} must be a safe integer.`);
    }
    return Number(integerValue);
  }

  throw new Error(`BirdCoder SQL int field ${columnName} must be a safe integer.`);
}

function normalizeDefaultedLongScopeValue(columnName: string, value: unknown): string {
  if (value === undefined || value === null) {
    return '0';
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    return '0';
  }

  return normalizeLongIntegerSqlParamValue(columnName, value) ?? '0';
}

function normalizeDataScopeStorageValue(value: unknown): number {
  if (value === undefined || value === null) {
    return 1;
  }

  const resolveNumericScope = (numericValue: number): number => {
    if (numericValue >= 0 && numericValue <= 3) {
      return numericValue;
    }
    throw new Error(`Unsupported BirdCoder data_scope value: ${String(value)}`);
  };

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value) || !Number.isSafeInteger(value)) {
      throw new Error(`Unsupported BirdCoder data_scope value: ${String(value)}`);
    }
    return resolveNumericScope(value);
  }

  if (typeof value === 'bigint') {
    if (value >= 0n && value <= 3n) {
      return Number(value);
    }
    throw new Error(`Unsupported BirdCoder data_scope value: ${String(value)}`);
  }

  const normalizedValue = String(value).trim().toUpperCase();
  if (!normalizedValue) {
    return 1;
  }

  switch (normalizedValue) {
    case 'DEFAULT':
      return 0;
    case 'PRIVATE':
      return 1;
    case 'SHARED':
      return 2;
    case 'PUBLIC':
      return 3;
    default: {
      if (/^[+-]?\d+$/u.test(normalizedValue)) {
        const numericValue = BigInt(normalizedValue);
        if (numericValue >= 0n && numericValue <= 3n) {
          return Number(numericValue);
        }
      }
      throw new Error(`Unsupported BirdCoder data_scope value: ${String(value)}`);
    }
  }
}

function normalizeColumnValue(
  providerId: BirdCoderDatabaseProviderId,
  column: BirdCoderSchemaColumnDefinition,
  row: BirdCoderSqlRow,
): unknown {
  const value = row[column.name];

  if (column.name === 'tenant_id' || column.name === 'organization_id') {
    return normalizeDefaultedLongScopeValue(column.name, value);
  }

  if (column.name === 'data_scope') {
    return normalizeDataScopeStorageValue(value);
  }

  if (value === undefined) {
    if (column.name === 'version' || column.name === 'v') {
      return '0';
    }

    if (column.name === 'is_deleted') {
      return normalizeBooleanValue(providerId, false);
    }

    if (column.logicalType === 'json') {
      return normalizeJsonValue({});
    }

    return null;
  }

  if (column.logicalType === 'bool') {
    return normalizeBooleanValue(providerId, value);
  }

  if (column.logicalType === 'id') {
    return normalizeIdSqlParamValue(column.name, value);
  }

  if (column.logicalType === 'bigint') {
    return normalizeLongIntegerSqlParamValue(column.name, value);
  }

  if (column.logicalType === 'int') {
    return normalizeIntegerSqlParamValue(column.name, value);
  }

  if (column.logicalType === 'json') {
    return normalizeJsonValue(value);
  }

  return value;
}

function buildConflictUpdateColumns(definition: BirdCoderEntityDefinition): readonly string[] {
  return definition.columns
    .map((column) => column.name)
    .filter((columnName) => columnName !== 'id' && columnName !== 'created_at');
}

function buildMutationPlaceholderList(
  providerId: BirdCoderDatabaseProviderId,
  count: number,
): string {
  const dialect = createBirdCoderStorageDialect(providerId);
  return Array.from({ length: count }, (_, index) => dialect.buildPlaceholder(index + 1)).join(', ');
}

function defaultSoftDeleteValue(providerId: BirdCoderDatabaseProviderId): boolean | number {
  return providerId === 'sqlite' ? 0 : false;
}

export function createBirdCoderTableSqlPlanner({
  definition,
  providerId,
}: CreateBirdCoderTableSqlPlannerOptions): BirdCoderTableSqlPlanner {
  const tableName = definition.tableName;
  const hasSoftDeleteColumn = definition.columns.some((column) => column.name === 'is_deleted');
  const updateColumns = buildConflictUpdateColumns(definition);
  const defaultOrdering: readonly BirdCoderSqlPlanOrderBy[] = [
    { column: 'updated_at', direction: 'desc' },
    { column: 'id', direction: 'asc' },
  ];

  return {
    buildListPlan() {
      const dialect = createBirdCoderStorageDialect(providerId);
      return buildPlan(
        providerId,
        'read',
        [
          hasSoftDeleteColumn
            ? {
                params: [defaultSoftDeleteValue(providerId)],
                sql: `SELECT * FROM ${tableName} WHERE is_deleted = ${dialect.buildPlaceholder(1)} ORDER BY updated_at DESC, id ASC;`,
              }
            : {
                params: [],
                sql: `SELECT * FROM ${tableName} ORDER BY updated_at DESC, id ASC;`,
              },
        ],
        {
          excludeDeleted: hasSoftDeleteColumn,
          kind: 'table-list',
          orderBy: defaultOrdering,
          tableName,
        },
      );
    },
    buildCountPlan() {
      const dialect = createBirdCoderStorageDialect(providerId);
      return buildPlan(
        providerId,
        'read',
        [
          hasSoftDeleteColumn
            ? {
                params: [defaultSoftDeleteValue(providerId)],
                sql: `SELECT COUNT(*) AS total FROM ${tableName} WHERE is_deleted = ${dialect.buildPlaceholder(1)};`,
              }
            : {
                params: [],
                sql: `SELECT COUNT(*) AS total FROM ${tableName};`,
              },
        ],
        {
          excludeDeleted: hasSoftDeleteColumn,
          kind: 'table-count',
          tableName,
        },
      );
    },
    buildFindByIdPlan(id) {
      const dialect = createBirdCoderStorageDialect(providerId);
      return buildPlan(
        providerId,
        'read',
        [
          hasSoftDeleteColumn
            ? {
                params: [id, defaultSoftDeleteValue(providerId)],
                sql: `SELECT * FROM ${tableName} WHERE id = ${dialect.buildPlaceholder(1)} AND is_deleted = ${dialect.buildPlaceholder(2)} LIMIT 1;`,
              }
            : {
                params: [id],
                sql: `SELECT * FROM ${tableName} WHERE id = ${dialect.buildPlaceholder(1)} LIMIT 1;`,
              },
        ],
        {
          excludeDeleted: hasSoftDeleteColumn,
          id,
          kind: 'table-find-by-id',
          tableName,
        },
      );
    },
    buildUpsertPlan(rows) {
      if (rows.length === 0) {
        return buildPlan(providerId, 'write', [], {
          kind: 'table-upsert',
          rows: [],
          tableName,
        });
      }

      const columnNames = definition.columns.map((column) => column.name);
      const statements = rows.map((row) => {
        const params = definition.columns.map((column) =>
          normalizeColumnValue(providerId, column, row),
        );
        const updateClause =
          updateColumns.length === 0
            ? 'NOTHING'
            : `UPDATE SET ${updateColumns
                .map((columnName) => `${columnName} = excluded.${columnName}`)
                .join(', ')}`;

        return {
          params,
          sql: `INSERT INTO ${tableName} (${columnNames.join(', ')}) VALUES (${buildMutationPlaceholderList(providerId, columnNames.length)}) ON CONFLICT(id) DO ${updateClause};`,
        };
      });
      return buildPlan(providerId, 'write', statements, {
        kind: 'table-upsert',
        rows,
        tableName,
      });
    },
    buildDeletePlan(id) {
      return buildPlan(
        providerId,
        'write',
        [
          {
            params: [id],
            sql: `DELETE FROM ${tableName} WHERE id = ${createBirdCoderStorageDialect(providerId).buildPlaceholder(1)};`,
          },
        ],
        {
          id,
          kind: 'table-delete',
          tableName,
        },
      );
    },
    buildClearPlan() {
      return buildPlan(
        providerId,
        'write',
        [
          {
            params: [],
            sql: `DELETE FROM ${tableName};`,
          },
        ],
        {
          kind: 'table-clear',
          tableName,
        },
      );
    },
  };
}

export function buildBirdCoderSchemaMigrationPlan(
  providerId: BirdCoderDatabaseProviderId,
  definitions: readonly BirdCoderSchemaMigrationDefinition[],
): BirdCoderSqlPlan {
  const statements = definitions.flatMap((definition) =>
    (definition.sqlByProvider[providerId] ?? []).map((sql) => ({
      params: [],
      sql,
    })),
  );
  return buildPlan(providerId, 'write', statements, {
    kind: 'migration',
    migrationIds: definitions.map((definition) => definition.migrationId),
    tableNames: definitions.flatMap((definition) =>
      definition.entityNames.map((entityName) => getBirdCoderEntityDefinition(entityName).tableName),
    ),
  });
}

function buildMigrationHistoryDetailsJson(
  input: BirdCoderSchemaMigrationHistoryPlanInput,
): string {
  return stringifyBirdCoderApiJson({
    description: input.description,
    entityNames: input.entityNames,
  });
}

function mapMigrationHistoryColumns(
  providerId: BirdCoderDatabaseProviderId,
  input: BirdCoderSchemaMigrationHistoryPlanInput,
): readonly unknown[] {
  return [
    `${input.providerId}:${input.migrationId}`,
    null,
    input.appliedAt,
    input.appliedAt,
    0,
    defaultSoftDeleteValue(providerId),
    input.migrationId,
    input.providerId,
    'applied',
    input.appliedAt,
    buildMigrationHistoryDetailsJson(input),
  ];
}

export function buildBirdCoderSchemaMigrationHistoryUpsertPlan(
  providerId: BirdCoderDatabaseProviderId,
  input: BirdCoderSchemaMigrationHistoryPlanInput,
): BirdCoderSqlPlan {
  const definition = getBirdCoderEntityDefinition('schema_migration_history');
  const dialect = createBirdCoderStorageDialect(providerId);
  const params = mapMigrationHistoryColumns(providerId, input);
  const columnNames = definition.columns.map((column) => column.name);
  const placeholders = params.map((_, index) => dialect.buildPlaceholder(index + 1)).join(', ');

  return buildPlan(
    providerId,
    'write',
    [
      {
        params,
        sql:
          `INSERT INTO ${definition.tableName} (${columnNames.join(', ')}) VALUES (${placeholders}) ` +
          'ON CONFLICT(provider_id, migration_id) DO NOTHING;',
      },
    ],
    {
      kind: 'migration-history-upsert',
      row: {
        id: `${input.providerId}:${input.migrationId}`,
        uuid: null,
        created_at: input.appliedAt,
        updated_at: input.appliedAt,
        version: 0,
        is_deleted: defaultSoftDeleteValue(providerId),
        migration_id: input.migrationId,
        provider_id: input.providerId,
        status: 'applied',
        applied_at: input.appliedAt,
        details_json: buildMigrationHistoryDetailsJson(input),
      },
      tableName: definition.tableName,
    },
  );
}

export function combineBirdCoderSqlPlans(
  ...plans: readonly BirdCoderSqlPlan[]
): BirdCoderSqlPlan {
  if (plans.length === 0) {
    throw new Error('combineBirdCoderSqlPlans requires at least one plan.');
  }

  const providerId = plans[0].providerId;
  if (!plans.every((plan) => plan.providerId === providerId)) {
    throw new Error('Cannot combine BirdCoder SQL plans from different providers.');
  }

  const intent = plans.some((plan) => plan.intent === 'write') ? 'write' : 'read';
  const statements = plans.flatMap((plan) => plan.statements);

  return {
    intent,
    providerId,
    statements,
    transactional: intent === 'write' && statements.length > 0,
  };
}
