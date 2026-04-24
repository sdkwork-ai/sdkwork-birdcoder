import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const serverTypesPath = new URL(
  '../packages/sdkwork-birdcoder-types/src/server-api.ts',
  import.meta.url,
);
const openApiPath = new URL('../packages/sdkwork-birdcoder-server/src/index.ts', import.meta.url);
const rustSources = [
  {
    label: 'desktop',
    path: new URL('../packages/sdkwork-birdcoder-desktop/src-tauri/src/lib.rs', import.meta.url),
  },
  {
    label: 'server',
    path: new URL('../packages/sdkwork-birdcoder-server/src-host/src/lib.rs', import.meta.url),
  },
];

const serverTypesSource = await readFile(serverTypesPath, 'utf8');
const openApiSource = await readFile(openApiPath, 'utf8');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function captureBlock(source, startPattern) {
  const startIndex = source.indexOf(startPattern);
  assert.notEqual(startIndex, -1, `Missing source block: ${startPattern}`);
  return source.slice(startIndex, startIndex + 7000);
}

function assertFields(source, anchor, fieldNames, label) {
  const block = captureBlock(source, anchor);
  for (const fieldName of fieldNames) {
    assert.match(
      block,
      new RegExp(`\\b${escapeRegExp(fieldName)}\\b`),
      `${label} must include "${fieldName}".`,
    );
  }
}

function collectCreateTableBodies(source, tableName) {
  const pattern = new RegExp(
    `CREATE TABLE(?: IF NOT EXISTS)? ${escapeRegExp(tableName)} \\(([\\s\\S]*?)\\);`,
    'g',
  );
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

const teamFieldsCamel = [
  'uuid',
  'tenantId',
  'organizationId',
  'createdAt',
  'updatedAt',
  'workspaceId',
  'code',
  'title',
  'ownerId',
  'leaderId',
  'createdByUserId',
  'metadata',
  'status',
];

const memberFieldsCamel = [
  'uuid',
  'tenantId',
  'organizationId',
  'createdAt',
  'updatedAt',
  'createdByUserId',
  'grantedByUserId',
  'status',
];

assertFields(
  serverTypesSource,
  'export interface BirdCoderTeamSummary {',
  teamFieldsCamel,
  'BirdCoderTeamSummary types',
);
assertFields(
  serverTypesSource,
  'export interface BirdCoderTeamMemberSummary {',
  memberFieldsCamel,
  'BirdCoderTeamMemberSummary types',
);
assertFields(
  serverTypesSource,
  'export interface BirdCoderWorkspaceMemberSummary {',
  memberFieldsCamel,
  'BirdCoderWorkspaceMemberSummary types',
);
assertFields(
  serverTypesSource,
  'export interface BirdCoderProjectCollaboratorSummary {',
  memberFieldsCamel,
  'BirdCoderProjectCollaboratorSummary types',
);

assertFields(
  openApiSource,
  'BirdCoderTeamSummary: createOpenApiObjectSchema(',
  teamFieldsCamel,
  'BirdCoderTeamSummary openapi schema',
);
assertFields(
  openApiSource,
  'BirdCoderTeamMemberSummary: createOpenApiObjectSchema(',
  memberFieldsCamel,
  'BirdCoderTeamMemberSummary openapi schema',
);
assertFields(
  openApiSource,
  'BirdCoderWorkspaceMemberSummary: createOpenApiObjectSchema(',
  memberFieldsCamel,
  'BirdCoderWorkspaceMemberSummary openapi schema',
);
assertFields(
  openApiSource,
  'BirdCoderProjectCollaboratorSummary: createOpenApiObjectSchema(',
  memberFieldsCamel,
  'BirdCoderProjectCollaboratorSummary openapi schema',
);

const rustTeamFieldsSnake = [
  'uuid',
  'tenant_id',
  'organization_id',
  'created_at',
  'updated_at',
  'workspace_id',
  'code',
  'title',
  'owner_id',
  'leader_id',
  'created_by_user_id',
  'metadata',
  'status',
];

const rustMemberFieldsSnake = [
  'uuid',
  'tenant_id',
  'organization_id',
  'created_at',
  'updated_at',
  'created_by_user_id',
  'granted_by_user_id',
  'status',
];

for (const { label, path } of rustSources) {
  const rustSource = await readFile(path, 'utf8');

  if (label === 'server') {
    assertFields(rustSource, 'struct TeamPayload {', rustTeamFieldsSnake, 'TeamPayload');
    assertFields(
      rustSource,
      'struct TeamMemberPayload {',
      rustMemberFieldsSnake,
      'TeamMemberPayload',
    );
    assertFields(
      rustSource,
      'struct WorkspaceMemberPayload {',
      rustMemberFieldsSnake,
      'WorkspaceMemberPayload',
    );
    assertFields(
      rustSource,
      'struct ProjectCollaboratorPayload {',
      rustMemberFieldsSnake,
      'ProjectCollaboratorPayload',
    );
  }

  const teamBodies = collectCreateTableBodies(rustSource, 'teams');
  assert(teamBodies.length > 0, `${label} rust source must declare teams table.`);
  for (const body of teamBodies) {
    for (const fieldName of [
      'id',
      'uuid',
      'tenant_id',
      'organization_id',
      'created_at',
      'updated_at',
      'workspace_id',
      'code',
      'title',
      'owner_id',
      'leader_id',
      'created_by_user_id',
      'metadata_json',
      'status',
    ]) {
      assert.match(
        body,
        new RegExp(`\\b${escapeRegExp(fieldName)}\\b`),
        `${label} teams schema must include "${fieldName}".`,
      );
    }
  }

  for (const tableName of ['team_members', 'workspace_members', 'project_collaborators']) {
    const bodies = collectCreateTableBodies(rustSource, tableName);
    assert(bodies.length > 0, `${label} rust source must declare ${tableName} table.`);
    for (const body of bodies) {
      for (const fieldName of [
        'id',
        'uuid',
        'tenant_id',
        'organization_id',
        'created_at',
        'updated_at',
        'created_by_user_id',
        'granted_by_user_id',
        'status',
      ]) {
        assert.match(
          body,
          new RegExp(`\\b${escapeRegExp(fieldName)}\\b`),
          `${label} ${tableName} schema must include "${fieldName}".`,
        );
      }
    }
  }
}

console.log('collaboration plus entity standard contract passed.');
