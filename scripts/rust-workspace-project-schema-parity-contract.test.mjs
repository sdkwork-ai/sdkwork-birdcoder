import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sources = [
  {
    label: 'desktop',
    path: new URL('../packages/sdkwork-birdcoder-desktop/src-tauri/src/lib.rs', import.meta.url),
  },
  {
    label: 'server',
    path: new URL('../packages/sdkwork-birdcoder-server/src-host/src/lib.rs', import.meta.url),
  },
];

const requiredWorkspaceColumns = [
  'id',
  'uuid',
  'created_at',
  'updated_at',
  'data_scope',
  'code',
  'title',
  'owner_id',
  'leader_id',
  'created_by_user_id',
  'icon',
  'color',
  'type',
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
  'status',
];

const requiredProjectColumns = [
  'id',
  'uuid',
  'created_at',
  'updated_at',
  'v',
  'tenant_id',
  'organization_id',
  'data_scope',
  'parent_id',
  'parent_uuid',
  'parent_metadata',
  'user_id',
  'name',
  'title',
  'cover_image',
  'author',
  'file_id',
  'code',
  'type',
  'site_path',
  'domain_prefix',
  'description',
  'status',
  'conversation_id',
  'workspace_id',
  'workspace_uuid',
  'leader_id',
  'start_time',
  'end_time',
  'budget_amount',
  'is_deleted',
  'is_template',
];

const forbiddenProjectColumns = [
  'version',
  'root_path',
  'cover_image_json',
  'owner_id',
  'created_by_user_id',
];

const requiredProjectContentColumns = [
  'id',
  'uuid',
  'created_at',
  'updated_at',
  'v',
  'tenant_id',
  'organization_id',
  'data_scope',
  'user_id',
  'parent_id',
  'project_id',
  'project_uuid',
  'config_data',
  'content_data',
  'metadata',
  'content_version',
  'content_hash',
];

const requiredCodingSessionColumns = [
  'id',
  'uuid',
  'created_at',
  'updated_at',
  'version',
  'is_deleted',
  'workspace_id',
  'project_id',
  'title',
  'status',
  'entry_surface',
  'host_mode',
  'engine_id',
  'model_id',
  'last_turn_at',
  'native_session_id',
  'sort_timestamp',
  'transcript_updated_at',
  'pinned',
  'archived',
  'unread',
];

const requiredCodingSessionMessageColumns = [
  'id',
  'uuid',
  'created_at',
  'updated_at',
  'version',
  'is_deleted',
  'coding_session_id',
  'turn_id',
  'role',
  'content',
  'metadata_json',
  'timestamp_ms',
  'name',
  'tool_calls_json',
  'tool_call_id',
  'file_changes_json',
  'commands_json',
  'task_progress_json',
];

const physicalSchemaTargets = [
  {
    tableName: 'plus_workspace',
    requiredColumns: {
      id: 'INTEGER PRIMARY KEY',
      owner_id: 'INTEGER NOT NULL',
    },
  },
  {
    tableName: 'plus_project',
    requiredColumns: {
      id: 'INTEGER PRIMARY KEY',
      workspace_id: 'INTEGER NULL',
      type: 'INTEGER NOT NULL',
      status: 'INTEGER NOT NULL',
    },
  },
  {
    tableName: 'plus_project_content',
    requiredColumns: {
      id: 'INTEGER PRIMARY KEY',
      project_id: 'INTEGER NOT NULL',
    },
  },
  {
    tableName: 'teams',
    requiredColumns: {
      id: 'INTEGER PRIMARY KEY',
      workspace_id: 'INTEGER NOT NULL',
    },
  },
  {
    tableName: 'team_members',
    requiredColumns: {
      id: 'INTEGER PRIMARY KEY',
      team_id: 'INTEGER NOT NULL',
    },
  },
  {
    tableName: 'workspace_members',
    requiredColumns: {
      id: 'INTEGER PRIMARY KEY',
      workspace_id: 'INTEGER NOT NULL',
    },
  },
  {
    tableName: 'project_collaborators',
    requiredColumns: {
      id: 'INTEGER PRIMARY KEY',
      project_id: 'INTEGER NOT NULL',
      workspace_id: 'INTEGER NOT NULL',
    },
  },
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectCreateTableBodies(source, tableName) {
  const pattern = new RegExp(
    `CREATE TABLE(?: IF NOT EXISTS)? ${escapeRegExp(tableName)} \\(([\\s\\S]*?)\\);`,
    'g',
  );
  return [...source.matchAll(pattern)]
    .map((match) => match[1])
    .filter((body) => body.includes('\n'));
}

function bodyMatchesColumnType(body, columnName, columnDefinition) {
  return new RegExp(
    `\\b${escapeRegExp(columnName)}\\s+${escapeRegExp(columnDefinition)}\\b`,
    'i',
  ).test(body);
}

for (const { label, path } of sources) {
  const rustSource = await readFile(path, 'utf8');

  const workspaceBodies = collectCreateTableBodies(rustSource, 'plus_workspace');
  assert(
    workspaceBodies.length > 0,
    `${label} rust source must declare at least one plus_workspace table.`,
  );
  for (const workspaceBody of workspaceBodies) {
    for (const columnName of requiredWorkspaceColumns) {
      assert.match(
        workspaceBody,
        new RegExp(`\\b${escapeRegExp(columnName)}\\b`),
        `${label} plus_workspace schema must include "${columnName}".`,
      );
    }
  }

  const projectBodies = collectCreateTableBodies(rustSource, 'plus_project');
  assert(
    projectBodies.length > 0,
    `${label} rust source must declare at least one plus_project table.`,
  );
  for (const projectBody of projectBodies) {
    for (const columnName of requiredProjectColumns) {
      assert.match(
        projectBody,
        new RegExp(`\\b${escapeRegExp(columnName)}\\b`),
        `${label} plus_project schema must include "${columnName}".`,
      );
    }
    for (const columnName of forbiddenProjectColumns) {
      assert.doesNotMatch(
        projectBody,
        new RegExp(`\\b${escapeRegExp(columnName)}\\b`),
        `${label} plus_project schema must not retain non-Java column "${columnName}".`,
      );
    }
  }

  const projectContentBodies = collectCreateTableBodies(rustSource, 'plus_project_content');
  assert(
    projectContentBodies.length > 0,
    `${label} rust source must declare at least one plus_project_content table.`,
  );
  for (const projectContentBody of projectContentBodies) {
    for (const columnName of requiredProjectContentColumns) {
      assert.match(
        projectContentBody,
        new RegExp(`\\b${escapeRegExp(columnName)}\\b`),
        `${label} plus_project_content schema must include "${columnName}".`,
      );
    }
  }

  const codingSessionBodies = collectCreateTableBodies(rustSource, 'coding_sessions');
  assert(
    codingSessionBodies.length > 0,
    `${label} rust source must declare at least one coding_sessions table.`,
  );
  assert(
    codingSessionBodies.some((codingSessionBody) =>
      requiredCodingSessionColumns.every((columnName) =>
        new RegExp(`\\b${escapeRegExp(columnName)}\\b`).test(codingSessionBody),
      ),
    ),
    `${label} coding_sessions schema must include ${requiredCodingSessionColumns.join(', ')}.`,
  );

  const codingSessionMessageBodies = collectCreateTableBodies(rustSource, 'coding_session_messages');
  assert(
    codingSessionMessageBodies.length > 0,
    `${label} rust source must declare at least one coding_session_messages table.`,
  );
  assert(
    codingSessionMessageBodies.some((codingSessionMessageBody) =>
      requiredCodingSessionMessageColumns.every((columnName) =>
        new RegExp(`\\b${escapeRegExp(columnName)}\\b`).test(codingSessionMessageBody),
      ),
    ),
    `${label} coding_session_messages schema must include ${requiredCodingSessionMessageColumns.join(', ')}.`,
  );

  assert.equal(
    collectCreateTableBodies(rustSource, 'workspaces').length,
    0,
    `${label} rust source must not declare the legacy workspaces physical table.`,
  );
  assert.equal(
    collectCreateTableBodies(rustSource, 'projects').length,
    0,
    `${label} rust source must not declare the legacy projects physical table.`,
  );

  for (const { tableName, requiredColumns } of physicalSchemaTargets) {
    const tableBodies = collectCreateTableBodies(rustSource, tableName);
    assert(
      tableBodies.length > 0,
      `${label} rust source must declare at least one ${tableName} table.`,
    );
    assert(
      tableBodies.some((tableBody) =>
        Object.entries(requiredColumns).every(([columnName, columnDefinition]) =>
          bodyMatchesColumnType(tableBody, columnName, columnDefinition),
        ),
      ),
      `${label} ${tableName} schema must expose INTEGER-based identifier storage for ${Object.keys(requiredColumns).join(', ')}.`,
    );
  }

  if (label === 'server') {
    assert.match(
      rustSource,
      /ensure_sqlite_provider_authority_integer_identifier_upgrade\(connection\)\?/,
      'server sqlite provider authority upgrade must invoke integer identifier schema migration.',
    );
    assert.doesNotMatch(
      rustSource,
      /const SQLITE_INTEGER_IDENTIFIER_TABLE_RULES:\s*\[\(&str,\s*&\[\(&str,\s*bool\)\]\);\s*\d+\]/,
      'server sqlite provider authority integer identifier rules must not require a manually maintained array length.',
    );
    assert.match(
      rustSource,
      /const SQLITE_INTEGER_IDENTIFIER_TABLE_RULES:\s*&\[\(&str,\s*&\[\(&str,\s*bool\)\]\)\]\s*=\s*&\[/,
      'server sqlite provider authority integer identifier rules must be a static slice so adding tables does not require length bookkeeping.',
    );
  }
}

console.log('rust workspace/project schema parity contract passed.');
