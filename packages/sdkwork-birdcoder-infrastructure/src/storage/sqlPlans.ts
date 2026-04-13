import {
  getBirdCoderEntityDefinition,
  type BirdCoderDatabaseProviderId,
  type BirdCoderEntityDefinition,
  type BirdCoderEntityStorageBinding,
  type BirdCoderLogicalColumnType,
  type BirdCoderSchemaColumnDefinition,
  type BirdCoderSchemaMigrationDefinition,
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

  return JSON.stringify(value ?? {});
}

function normalizeColumnValue(
  providerId: BirdCoderDatabaseProviderId,
  column: BirdCoderSchemaColumnDefinition,
  row: BirdCoderSqlRow,
): unknown {
  const value = row[column.name];

  if (value === undefined) {
    if (column.name === 'version') {
      return 0;
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
  const updateColumns = buildConflictUpdateColumns(definition);
  const defaultOrdering: readonly BirdCoderSqlPlanOrderBy[] = [
    { column: 'updated_at', direction: 'desc' },
    { column: 'id', direction: 'asc' },
  ];

  return {
    buildListPlan() {
      return buildPlan(
        providerId,
        'read',
        [
          {
            params: [defaultSoftDeleteValue(providerId)],
            sql: `SELECT * FROM ${tableName} WHERE is_deleted = ${createBirdCoderStorageDialect(providerId).buildPlaceholder(1)} ORDER BY updated_at DESC, id ASC;`,
          },
        ],
        {
          excludeDeleted: true,
          kind: 'table-list',
          orderBy: defaultOrdering,
          tableName,
        },
      );
    },
    buildCountPlan() {
      return buildPlan(
        providerId,
        'read',
        [
          {
            params: [defaultSoftDeleteValue(providerId)],
            sql: `SELECT COUNT(*) AS total FROM ${tableName} WHERE is_deleted = ${createBirdCoderStorageDialect(providerId).buildPlaceholder(1)};`,
          },
        ],
        {
          excludeDeleted: true,
          kind: 'table-count',
          tableName,
        },
      );
    },
    buildFindByIdPlan(id) {
      return buildPlan(
        providerId,
        'read',
        [
          {
            params: [id, defaultSoftDeleteValue(providerId)],
            sql: `SELECT * FROM ${tableName} WHERE id = ${createBirdCoderStorageDialect(providerId).buildPlaceholder(1)} AND is_deleted = ${createBirdCoderStorageDialect(providerId).buildPlaceholder(2)} LIMIT 1;`,
          },
        ],
        {
          excludeDeleted: true,
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
  return JSON.stringify({
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
