import assert from 'node:assert/strict';
import {
  BIRDCODER_DATA_ENTITY_DEFINITIONS,
  BIRDCODER_DATA_SCOPES,
  getBirdCoderEntityDefinition,
} from '@sdkwork/birdcoder-pc-types';

const lowerSnakeCasePattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;
const standardDataScopes = ['DEFAULT', 'PRIVATE', 'ORGANIZATION', 'TENANT', 'PUBLIC'] as const;

assert.deepEqual(
  BIRDCODER_DATA_SCOPES,
  standardDataScopes,
  'BirdCoder data_scope enum must follow DATABASE_SPEC.md DEFAULT/PRIVATE/ORGANIZATION/TENANT/PUBLIC values.',
);

function collectColumnNames(entityName: Parameters<typeof getBirdCoderEntityDefinition>[0]) {
  return new Set(
    getBirdCoderEntityDefinition(entityName).columns.map((column) => column.name),
  );
}

for (const definition of BIRDCODER_DATA_ENTITY_DEFINITIONS) {
  const columnNames = new Set(definition.columns.map((column) => column.name));
  assert.match(
    definition.tableName,
    lowerSnakeCasePattern,
    `${definition.entityName} table name must use lower_snake_case.`,
  );
  assert(
    columnNames.has('id'),
    `${definition.entityName} must expose canonical id column.`,
  );
  assert(
    columnNames.has('uuid'),
    `${definition.entityName} must expose canonical uuid column.`,
  );
  assert(
    columnNames.has('created_at'),
    `${definition.entityName} must expose canonical created_at column.`,
  );
  assert(
    columnNames.has('updated_at'),
    `${definition.entityName} must expose canonical updated_at column.`,
  );

  for (const column of definition.columns) {
    assert.match(
      column.name,
      lowerSnakeCasePattern,
      `${definition.entityName}.${column.name} column name must use lower_snake_case.`,
    );
  }

  for (const index of definition.indexes) {
    assert.match(
      index.name,
      lowerSnakeCasePattern,
      `${definition.entityName}.${index.name} index name must use lower_snake_case.`,
    );
    assert(
      index.name.startsWith('uk_') || index.name.startsWith('idx_'),
      `${definition.entityName}.${index.name} index name must use uk_ or idx_ prefix.`,
    );
    if (index.unique) {
      assert(
        index.name.startsWith('uk_'),
        `${definition.entityName}.${index.name} unique index name must use uk_ prefix.`,
      );
    }
    if (index.name.startsWith('uk_')) {
      assert.equal(
        index.unique,
        true,
        `${definition.entityName}.${index.name} uk_ index must declare unique: true.`,
      );
    }
    assert(
      index.columns.length > 0,
      `${definition.entityName}.${index.name} index must reference at least one column.`,
    );
    for (const indexColumn of index.columns) {
      assert(
        columnNames.has(indexColumn),
        `${definition.entityName}.${index.name} index references unknown column "${indexColumn}".`,
      );
    }
  }
}

const workspaceColumnNames = collectColumnNames('workspace');
for (const requiredColumn of [
  'data_scope',
  'code',
  'title',
  'icon',
  'color',
  'owner_id',
  'leader_id',
  'created_by_user_id',
  'type',
  'status',
  'start_time',
  'end_time',
  'max_members',
  'current_members',
  'member_count',
  'max_storage',
  'used_storage',
  'settings_json',
  'is_public',
  'is_template',
]) {
  assert(
    workspaceColumnNames.has(requiredColumn),
    `workspace must expose plus-standard column "${requiredColumn}".`,
  );
}

const projectColumnNames = collectColumnNames('project');
for (const requiredColumn of [
  'data_scope',
  'user_id',
  'parent_id',
  'parent_uuid',
  'parent_metadata',
  'workspace_id',
  'workspace_uuid',
  'title',
  'code',
  'type',
  'site_path',
  'domain_prefix',
  'description',
  'status',
  'conversation_id',
  'leader_id',
  'author',
  'file_id',
  'cover_image',
  'start_time',
  'end_time',
  'budget_amount',
  'is_template',
]) {
  assert(
    projectColumnNames.has(requiredColumn),
    `project must expose plus-standard column "${requiredColumn}".`,
  );
}

console.log('birdcoder plus entity standard contract passed.');
