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
  'data_scope',
  'user_id',
  'parent_id',
  'parent_uuid',
  'parent_metadata',
  'workspace_id',
  'workspace_uuid',
  'code',
  'title',
  'root_path',
  'owner_id',
  'leader_id',
  'created_by_user_id',
  'author',
  'file_id',
  'type',
  'site_path',
  'domain_prefix',
  'conversation_id',
  'start_time',
  'end_time',
  'budget_amount',
  'cover_image_json',
  'is_template',
  'status',
];

const physicalSchemaTargets = [
  {
    tableName: 'workspaces',
    requiredColumns: {
      id: 'INTEGER PRIMARY KEY',
    },
  },
  {
    tableName: 'projects',
    requiredColumns: {
      id: 'INTEGER PRIMARY KEY',
      workspace_id: 'INTEGER NOT NULL',
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
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function bodyMatchesColumnType(body, columnName, columnDefinition) {
  return new RegExp(
    `\\b${escapeRegExp(columnName)}\\s+${escapeRegExp(columnDefinition)}\\b`,
    'i',
  ).test(body);
}

for (const { label, path } of sources) {
  const rustSource = await readFile(path, 'utf8');

  const workspaceBodies = collectCreateTableBodies(rustSource, 'workspaces');
  assert(
    workspaceBodies.length > 0,
    `${label} rust source must declare at least one workspaces table.`,
  );
  for (const workspaceBody of workspaceBodies) {
    for (const columnName of requiredWorkspaceColumns) {
      assert.match(
        workspaceBody,
        new RegExp(`\\b${escapeRegExp(columnName)}\\b`),
        `${label} workspaces schema must include "${columnName}".`,
      );
    }
  }

  const projectBodies = collectCreateTableBodies(rustSource, 'projects');
  assert(
    projectBodies.length > 0,
    `${label} rust source must declare at least one projects table.`,
  );
  for (const projectBody of projectBodies) {
    for (const columnName of requiredProjectColumns) {
      assert.match(
        projectBody,
        new RegExp(`\\b${escapeRegExp(columnName)}\\b`),
        `${label} projects schema must include "${columnName}".`,
      );
    }
  }

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
  }
}

console.log('rust workspace/project schema parity contract passed.');
