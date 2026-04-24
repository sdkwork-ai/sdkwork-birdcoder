import {
  BIRDCODER_DATABASE_PROVIDERS,
  getBirdCoderEntityDefinition,
  type BirdCoderDatabaseProviderId,
  type BirdCoderEntityDefinition,
  type BirdCoderEntityName,
  type BirdCoderLogicalColumnType,
  type BirdCoderSchemaColumnDefinition,
  type BirdCoderSchemaMigrationDefinition,
  type BirdCoderStorageDialect,
} from '@sdkwork/birdcoder-types';

type SupportedBirdCoderProviderId = keyof typeof BIRDCODER_DATABASE_PROVIDERS;

const DIALECTS: Record<SupportedBirdCoderProviderId, BirdCoderStorageDialect> = {
  sqlite: {
    providerId: 'sqlite',
    buildPlaceholder(index) {
      return `?${index}`;
    },
    mapLogicalType(type) {
      return mapLogicalType('sqlite', type);
    },
    supportsJsonb: false,
  },
  postgresql: {
    providerId: 'postgresql',
    buildPlaceholder(index) {
      return `$${index}`;
    },
    mapLogicalType(type) {
      return mapLogicalType('postgresql', type);
    },
    supportsJsonb: true,
  },
};

const RUNTIME_DATA_KERNEL_ENTITY_NAMES = [
  'workbench_preference',
  'engine_registry',
  'model_catalog',
  'engine_binding',
  'run_configuration',
  'terminal_execution',
  'build_execution',
  'preview_session',
  'simulator_session',
  'test_execution',
  'schema_migration_history',
] as const satisfies readonly BirdCoderEntityName[];

const CODING_SERVER_KERNEL_ENTITY_NAMES = [
  'project',
  'coding_session',
  'coding_session_runtime',
  'coding_session_turn',
  'coding_session_message',
  'coding_session_prompt_entry',
  'coding_session_event',
  'coding_session_artifact',
  'coding_session_checkpoint',
  'coding_session_operation',
  'saved_prompt_entry',
  'prompt_asset',
  'prompt_asset_version',
  'prompt_bundle',
  'prompt_bundle_item',
  'prompt_run',
  'prompt_evaluation',
  'skill_package',
  'skill_version',
  'skill_capability',
  'skill_installation',
  'skill_binding',
  'skill_runtime_config',
  'app_template',
  'app_template_version',
  'app_template_target_profile',
  'app_template_preset',
  'app_template_instantiation',
  'team',
  'team_member',
  'project_document',
  'audit_event',
  'governance_policy',
  'release_record',
  'deployment_target',
  'deployment_record',
] as const satisfies readonly BirdCoderEntityName[];

function assertSupportedProviderId(
  providerId: BirdCoderDatabaseProviderId,
): SupportedBirdCoderProviderId {
  if (providerId === 'sqlite' || providerId === 'postgresql') {
    return providerId as SupportedBirdCoderProviderId;
  }

  throw new Error(`Unsupported BirdCoder storage provider: ${providerId}`);
}

function mapLogicalType(
  providerId: SupportedBirdCoderProviderId,
  logicalType: BirdCoderLogicalColumnType,
): string {
  switch (logicalType) {
    case 'bool':
      return providerId === 'sqlite' ? 'INTEGER' : 'BOOLEAN';
    case 'int':
      return 'INTEGER';
    case 'bigint':
      return providerId === 'sqlite' ? 'INTEGER' : 'BIGINT';
    case 'json':
      return providerId === 'sqlite' ? 'TEXT' : 'JSONB';
    case 'timestamp':
      return providerId === 'sqlite' ? 'TEXT' : 'TIMESTAMPTZ';
    case 'id':
    case 'text':
    case 'enum':
    default:
      return 'TEXT';
  }
}

function buildColumnSql(
  column: BirdCoderSchemaColumnDefinition,
  dialect: BirdCoderStorageDialect,
): string {
  const parts = [column.name, dialect.mapLogicalType(column.logicalType)];

  if (column.name === 'id') {
    parts.push('PRIMARY KEY');
  } else if (!column.nullable) {
    parts.push('NOT NULL');
  }

  return parts.join(' ');
}

function buildCreateTableSql(
  definition: BirdCoderEntityDefinition,
  dialect: BirdCoderStorageDialect,
): string {
  const columnSql = definition.columns.map((column) => buildColumnSql(column, dialect)).join(', ');
  return `CREATE TABLE IF NOT EXISTS ${definition.tableName} (${columnSql});`;
}

function buildCreateIndexSql(definition: BirdCoderEntityDefinition): string[] {
  return definition.indexes.map((indexDefinition) => {
    const uniquePrefix = indexDefinition.unique ? 'UNIQUE ' : '';
    return `CREATE ${uniquePrefix}INDEX IF NOT EXISTS ${indexDefinition.name} ON ${definition.tableName} (${indexDefinition.columns.join(', ')});`;
  });
}

function buildMigrationStatements(
  providerId: SupportedBirdCoderProviderId,
  entityNames: readonly BirdCoderEntityName[],
): string[] {
  const dialect = createBirdCoderStorageDialect(providerId);

  return entityNames.flatMap((entityName) => {
    const definition = getBirdCoderEntityDefinition(entityName);
    return [buildCreateTableSql(definition, dialect), ...buildCreateIndexSql(definition)];
  });
}

export function createBirdCoderStorageDialect(
  providerId: BirdCoderDatabaseProviderId,
): BirdCoderStorageDialect {
  return DIALECTS[assertSupportedProviderId(providerId)];
}

export const BIRDCODER_SCHEMA_MIGRATIONS: readonly BirdCoderSchemaMigrationDefinition[] = [
  {
    migrationId: 'runtime-data-kernel-v1',
    description:
      'Bootstrap runtime/workbench schema, migration history, and provider-compatible SQL.',
    entityNames: RUNTIME_DATA_KERNEL_ENTITY_NAMES,
    sqlByProvider: {
      sqlite: buildMigrationStatements('sqlite', RUNTIME_DATA_KERNEL_ENTITY_NAMES),
      postgresql: buildMigrationStatements('postgresql', RUNTIME_DATA_KERNEL_ENTITY_NAMES),
    },
  },
  {
    migrationId: 'coding-server-kernel-v2',
    description:
      'Bootstrap coding session, prompt, skillhub, template, collaboration, and deployment schema.',
    entityNames: CODING_SERVER_KERNEL_ENTITY_NAMES,
    sqlByProvider: {
      sqlite: buildMigrationStatements('sqlite', CODING_SERVER_KERNEL_ENTITY_NAMES),
      postgresql: buildMigrationStatements('postgresql', CODING_SERVER_KERNEL_ENTITY_NAMES),
    },
  },
] as const;

export function getBirdCoderSchemaMigrationDefinition(
  migrationId: string,
): BirdCoderSchemaMigrationDefinition {
  const definition = BIRDCODER_SCHEMA_MIGRATIONS.find(
    (candidate) => candidate.migrationId === migrationId,
  );

  if (!definition) {
    throw new Error(`Unknown BirdCoder schema migration: ${migrationId}`);
  }

  return definition;
}
