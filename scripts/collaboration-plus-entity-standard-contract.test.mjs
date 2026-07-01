import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  CANONICAL_DOMAIN_RUST_PATHS,
  readCanonicalServerRustSource,
  readCanonicalSqliteSchemaBundle,
} from './birdcoder-canonical-server-rust-sources.mjs';

const serverTypesPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/server-api.ts',
  import.meta.url,
);
const openApiPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/openApiSchemas.ts',
  import.meta.url,
);

const canonicalSqliteSchemaSource = readCanonicalSqliteSchemaBundle();
const workspaceDomainResultsSource = readCanonicalServerRustSource(
  CANONICAL_DOMAIN_RUST_PATHS.workspaceDomainResults,
);
const projectDomainResultsSource = readCanonicalServerRustSource(
  CANONICAL_DOMAIN_RUST_PATHS.projectDomainResults,
);
const rustSources = [
  {
    label: 'desktop',
    source: canonicalSqliteSchemaSource,
  },
  {
    label: 'server',
    source: `${workspaceDomainResultsSource}\n${projectDomainResultsSource}\n${canonicalSqliteSchemaSource}`,
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

for (const { label, source: rustSource } of rustSources) {

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

  assert.doesNotMatch(
    rustSource,
    /CREATE TABLE(?: IF NOT EXISTS)? (?:teams|team_members|workspace_members|project_collaborators)\b/u,
    `${label} rust source must not declare retired non-standard collaboration table names.`,
  );

  const teamBodies = collectCreateTableBodies(rustSource, 'studio_team');
  assert(teamBodies.length > 0, `${label} rust source must declare studio_team table.`);
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
        `${label} studio_team schema must include "${fieldName}".`,
      );
    }
  }

  for (const tableName of [
    'studio_team_member',
    'studio_workspace_member',
    'studio_project_collaborator',
  ]) {
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
