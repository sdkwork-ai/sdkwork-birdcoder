import assert from 'node:assert/strict';
import {
  BIRDCODER_DATA_ENTITY_DEFINITIONS,
  getBirdCoderEntityDefinition,
} from '@sdkwork/birdcoder-types';

function collectColumnNames(entityName: Parameters<typeof getBirdCoderEntityDefinition>[0]) {
  return new Set(
    getBirdCoderEntityDefinition(entityName).columns.map((column) => column.name),
  );
}

for (const definition of BIRDCODER_DATA_ENTITY_DEFINITIONS) {
  const columnNames = new Set(definition.columns.map((column) => column.name));
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
  'cover_image_json',
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
