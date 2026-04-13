import assert from 'node:assert/strict';
const dataModulePath = new URL(
  '../packages/sdkwork-birdcoder-types/src/data.ts',
  import.meta.url,
);

const dataModule = await import(`${dataModulePath.href}?t=${Date.now()}`);

assert.deepEqual(dataModule.BIRDCODER_DATABASE_PROVIDER_IDS, ['sqlite', 'postgresql']);
assert.equal(dataModule.BIRDCODER_SCHEMA_MIGRATION_HISTORY_TABLE, 'schema_migration_history');

const requiredEntityNames = [
  'identity',
  'user_profile',
  'vip_subscription',
  'workspace',
  'project',
  'file_asset',
  'coding_session',
  'coding_session_runtime',
  'coding_session_turn',
  'coding_session_message',
  'coding_session_event',
  'coding_session_artifact',
  'coding_session_checkpoint',
  'prompt_asset',
  'skill_package',
  'app_template',
  'team',
  'project_document',
  'deployment_target',
  'deployment_record',
  'workbench_preference',
  'engine_registry',
  'model_catalog',
  'engine_binding',
  'run_configuration',
  'terminal_session',
  'terminal_execution',
  'build_execution',
  'preview_session',
  'simulator_session',
  'test_execution',
  'audit_event',
  'release_record',
  'schema_migration_history',
];

for (const entityName of requiredEntityNames) {
  const definition = dataModule.getBirdCoderEntityDefinition(entityName);
  assert.ok(definition, `Missing entity definition for ${entityName}`);

  const columnNames = definition.columns.map((column) => column.name);
  for (const requiredColumnName of ['id', 'created_at', 'updated_at', 'version', 'is_deleted']) {
    assert.ok(
      columnNames.includes(requiredColumnName),
      `Entity ${entityName} is missing shared column ${requiredColumnName}`,
    );
  }
}

const terminalExecution = dataModule.getBirdCoderEntityDefinition('terminal_execution');
assert.equal(terminalExecution.tableName, 'terminal_executions');
assert.ok(
  terminalExecution.indexes.some((index) => index.name === 'idx_terminal_executions_session_started'),
  'terminal_execution should define a session/timestamp index',
);

const codingSession = dataModule.getBirdCoderEntityDefinition('coding_session');
assert.equal(codingSession.tableName, 'coding_sessions');
assert.ok(
  codingSession.indexes.some((index) => index.name === 'idx_coding_sessions_project_updated'),
  'coding_session should define a project/updated index',
);

const fileAsset = dataModule.getBirdCoderEntityDefinition('file_asset');
assert.equal(fileAsset.aggregate, 'coding_session');
assert.ok(
  fileAsset.columns.some((column) => column.name === 'coding_session_id'),
  'file_asset should stay attached to the coding_session aggregate',
);

const providerCatalog = dataModule.BIRDCODER_DATABASE_PROVIDERS;
assert.equal(providerCatalog.sqlite.capabilities.offlineFirst, true);
assert.equal(providerCatalog.postgresql.capabilities.jsonb, true);

const modelCatalog = dataModule.getBirdCoderEntityDefinition('model_catalog');
assert.ok(
  modelCatalog.indexes.some((index) => index.name === 'uk_model_catalog_engine_model'),
  'model_catalog should define a unique engine/model index',
);

assert.equal(dataModule.BIRDCODER_CODING_SESSION_STORAGE_BINDING.storageMode, 'table');

console.log('data kernel contract passed.');
