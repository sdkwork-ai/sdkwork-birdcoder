import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { readCanonicalSqliteSchemaBundle } from './birdcoder-canonical-server-rust-sources.mjs';

const dataModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/data.ts',
  import.meta.url,
);

const dataModule = await import(`${dataModulePath.href}?t=${Date.now()}`);
const dataModuleSource = await readFile(dataModulePath, 'utf8');
const canonicalSqliteSchemaSource = readCanonicalSqliteSchemaBundle();

assert.deepEqual(dataModule.BIRDCODER_DATABASE_PROVIDER_IDS, ['sqlite', 'postgresql']);
assert.equal(dataModule.BIRDCODER_SCHEMA_MIGRATION_HISTORY_TABLE, 'ops_schema_migration_history');

assert.deepEqual(
  new Set(dataModule.BIRDCODER_DATA_ENTITY_DEFINITIONS.map((definition) => definition.aggregate)),
  new Set([
    'ai',
    'commerce',
    'comms',
    'content',
    'data',
    'integration',
    'media',
    'ops',
    'studio',
  ]),
  'BirdCoder data kernel must use DATABASE_SPEC controlled module prefixes and must not re-own appbase IAM aggregates.',
);

const duplicateEntityNames = dataModule.BIRDCODER_DATA_ENTITY_DEFINITIONS
  .map((definition) => definition.entityName)
  .filter((entityName, index, entityNames) => entityNames.indexOf(entityName) !== index);
assert.deepEqual(
  duplicateEntityNames,
  [],
  'BirdCoder data kernel must not define duplicate entity names; duplicate definitions hide schema drift.',
);

for (const [entityName, expectedAggregate] of [
  ['card', 'commerce'],
  ['datasource', 'data'],
  ['channel_account', 'integration'],
  ['app', 'studio'],
  ['category', 'content'],
  ['file', 'media'],
  ['conversation', 'comms'],
  ['notification', 'ops'],
  ['order', 'commerce'],
  ['workspace', 'studio'],
  ['project_content', 'studio'],
  ['file_asset', 'media'],
  ['coding_session', 'ai'],
  ['prompt_asset', 'ai'],
  ['app_template', 'studio'],
  ['team', 'studio'],
  ['deployment_target', 'studio'],
  ['workbench_preference', 'studio'],
  ['engine_registry', 'ai'],
  ['run_configuration', 'ops'],
  ['audit_event', 'ops'],
  ['schema_migration_history', 'ops'],
]) {
  assert.equal(
    dataModule.getBirdCoderEntityDefinition(entityName).aggregate,
    expectedAggregate,
    `${entityName} must use DATABASE_SPEC standard aggregate ${expectedAggregate}.`,
  );
}

for (const externalSkillsEntityName of [
  'agent_skill_package',
  'agent_skill',
  'user_agent_skill',
  'skill_package',
  'skill_version',
  'skill_capability',
  'skill_installation',
  'skill_binding',
  'skill_runtime_config',
]) {
  assert.equal(
    dataModule.BIRDCODER_DATA_ENTITY_DEFINITIONS.some(
      (definition) => definition.entityName === externalSkillsEntityName,
    ),
    false,
    `${externalSkillsEntityName} is owned by sdkwork-skills and must not exist in BirdCoder's data kernel.`,
  );
}

for (const definition of dataModule.BIRDCODER_DATA_ENTITY_DEFINITIONS) {
  if (definition.tableName.startsWith('plus_')) {
    continue;
  }

  assert.equal(
    definition.tableName,
    `${definition.aggregate}_${definition.entityName}`,
    `${definition.entityName} must use <module_prefix>_<entity_name> physical table naming.`,
  );
}

for (const [entityName, expectedTableName] of [
  ['workspace', 'studio_workspace'],
  ['project', 'studio_project'],
  ['project_content', 'studio_project_content'],
]) {
  assert.equal(
    dataModule.getBirdCoderEntityDefinition(entityName).tableName,
    expectedTableName,
    `${entityName} must not keep the legacy plus_* project/workspace physical table name.`,
  );
}

const requiredEntityNames = [
  'account_history',
  'account_exchange_config',
  'ledger_bridge',
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
const appbaseOwnedIamEntityNames = [
  'department',
  'position',
  'user_address',
  'tenant',
  'organization',
  'organization_member',
  'member_relation',
  'role',
  'permission',
  'role_permission',
  'user_role',
  'user_account',
  'oauth_account',
  'user_profile',
  'vip_user',
  'account',
  'api_key',
  'api_security_policy',
  'invitation_code',
  'invitation_relation',
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

for (const entityName of appbaseOwnedIamEntityNames) {
  assert.throws(
    () => dataModule.getBirdCoderEntityDefinition(entityName),
    /Unknown BirdCoder entity definition/u,
    `BirdCoder data kernel must not own appbase IAM entity ${entityName}.`,
  );
}

assert.doesNotMatch(
  dataModuleSource,
  /\bplus_user\b/u,
  'BirdCoder data-kernel descriptions must reference appbase IAM users instead of the retired plus_user core table.',
);

const terminalExecution = dataModule.getBirdCoderEntityDefinition('terminal_execution');
assert.equal(terminalExecution.tableName, 'ops_terminal_execution');
assert.ok(
  terminalExecution.indexes.some((index) => index.name === 'idx_ops_terminal_execution_session_started'),
  'terminal_execution should define a session/timestamp index',
);

const codingSession = dataModule.getBirdCoderEntityDefinition('coding_session');
assert.equal(codingSession.tableName, 'ai_coding_session');
assert.ok(
  codingSession.columns.some((column) => column.name === 'native_session_id' && column.nullable === true),
  'coding_session must denormalize native_session_id so local session mirrors can preserve provider-native resume ids.',
);
assert.ok(
  codingSession.indexes.some((index) => index.name === 'idx_ai_coding_session_project_updated'),
  'coding_session should define a project/updated index',
);

const fileAsset = dataModule.getBirdCoderEntityDefinition('file_asset');
assert.equal(fileAsset.aggregate, 'media');
assert.ok(
  fileAsset.columns.some((column) => column.name === 'coding_session_id'),
  'file_asset should stay attached to coding_session through a stable foreign key while media owns the asset table.',
);

const providerCatalog = dataModule.BIRDCODER_DATABASE_PROVIDERS;
assert.equal(providerCatalog.sqlite.capabilities.offlineFirst, true);
assert.equal(providerCatalog.postgresql.capabilities.jsonb, true);

const modelCatalog = dataModule.getBirdCoderEntityDefinition('model_catalog');
assert.ok(
  modelCatalog.indexes.some((index) => index.name === 'uk_ai_model_catalog_engine_model'),
  'model_catalog should define a unique engine/model index',
);

assert.equal(dataModule.BIRDCODER_CODING_SESSION_STORAGE_BINDING.storageMode, 'table');

for (const [label, source] of [
  ['canonical sqlx sqlite schema', canonicalSqliteSchemaSource],
  ['canonical sqlx sqlite schema (desktop parity)', canonicalSqliteSchemaSource],
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
