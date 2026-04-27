import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dataModulePath = new URL(
  '../packages/sdkwork-birdcoder-types/src/data.ts',
  import.meta.url,
);
const serverHostSourcePath = new URL(
  '../packages/sdkwork-birdcoder-server/src-host/src/lib.rs',
  import.meta.url,
);
const desktopHostSourcePath = new URL(
  '../packages/sdkwork-birdcoder-desktop/src-tauri/src/lib.rs',
  import.meta.url,
);

const dataModule = await import(`${dataModulePath.href}?t=${Date.now()}`);
const serverHostSource = await readFile(serverHostSourcePath, 'utf8');
const desktopHostSource = await readFile(desktopHostSourcePath, 'utf8');

assert.deepEqual(dataModule.BIRDCODER_DATABASE_PROVIDER_IDS, ['sqlite', 'postgresql']);
assert.equal(dataModule.BIRDCODER_SCHEMA_MIGRATION_HISTORY_TABLE, 'schema_migration_history');

const requiredEntityNames = [
  'tenant',
  'user_account',
  'user_profile',
  'account',
  'account_history',
  'account_exchange_config',
  'ledger_bridge',
  'vip_user',
  'vip_level',
  'vip_benefit',
  'vip_level_benefit',
  'vip_pack_group',
  'vip_pack',
  'vip_recharge_method',
  'vip_recharge_pack',
  'vip_recharge',
  'vip_point_change',
  'vip_benefit_usage',
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
  for (const requiredColumnName of ['id', 'created_at', 'updated_at', 'is_deleted']) {
    assert.ok(
      columnNames.includes(requiredColumnName),
      `Entity ${entityName} is missing shared column ${requiredColumnName}`,
    );
  }
  assert.ok(
    columnNames.includes('version') || columnNames.includes('v'),
    `Entity ${entityName} is missing shared optimistic-lock column version/v`,
  );

  for (const scopedColumnName of ['tenant_id', 'organization_id', 'data_scope']) {
    const column = definition.columns.find((candidate) => candidate.name === scopedColumnName);
    if (!column) {
      continue;
    }
    assert.notEqual(
      column.nullable,
      true,
      `Entity ${entityName}.${scopedColumnName} must follow PlusTenantSupportEntity non-null scope semantics.`,
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
  codingSession.columns.some((column) => column.name === 'native_session_id' && column.nullable === true),
  'coding_session must denormalize native_session_id so local session mirrors can preserve provider-native resume ids.',
);
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

for (const [label, source] of [
  ['server host sqlite schema', serverHostSource],
  ['desktop host sqlite schema', desktopHostSource],
]) {
  assert.doesNotMatch(
    source,
    /\btenant_id\s+TEXT\s+NULL\b/,
    `${label} must store tenant_id as a non-null Long-compatible column.`,
  );
  assert.doesNotMatch(
    source,
    /\borganization_id\s+TEXT\s+NULL\b/,
    `${label} must store organization_id as a non-null Long-compatible column.`,
  );
  assert.doesNotMatch(
    source,
    /\bdata_scope\s+TEXT\s+NULL\b/,
    `${label} must store data_scope as a non-null PlusDataScope column.`,
  );
  assert.doesNotMatch(
    source,
    /\bdata_scope\s+TEXT\s+NOT\s+NULL\b/,
    `${label} must not store PlusDataScope as a text enum; Java PlusDataScopeConverter stores integer values.`,
  );
  assert.match(
    source,
    /\bdata_scope\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+1\b/,
    `${label} must store PlusDataScope.PRIVATE as integer value 1 by default.`,
  );
}

console.log('data kernel contract passed.');
