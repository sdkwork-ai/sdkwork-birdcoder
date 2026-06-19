import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  readCanonicalServerRustSource,
  CANONICAL_DOMAIN_RUST_PATHS,
} from './birdcoder-canonical-server-rust-sources.mjs';

const workspaceRustSource = readCanonicalServerRustSource(CANONICAL_DOMAIN_RUST_PATHS.workspaceDomainResults);
const projectRustSource = readCanonicalServerRustSource(CANONICAL_DOMAIN_RUST_PATHS.projectDomainResults);
const openApiPath = new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/index.ts', import.meta.url);

const openApiSource = await readFile(openApiPath, 'utf8');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function captureBlock(source, startPattern) {
  const startIndex = source.indexOf(startPattern);
  assert.notEqual(startIndex, -1, `Missing source block: ${startPattern}`);
  const sliced = source.slice(startIndex);
  return sliced.slice(0, 6000);
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

const workspaceExtraFieldsCamel = [
  'dataScope',
  'icon',
  'color',
  'startTime',
  'endTime',
  'maxMembers',
  'currentMembers',
  'memberCount',
  'maxStorage',
  'usedStorage',
  'settings',
  'isPublic',
  'isTemplate',
];

const projectExtraFieldsCamel = [
  'dataScope',
  'userId',
  'parentId',
  'parentUuid',
  'parentMetadata',
  'sitePath',
  'domainPrefix',
  'fileId',
  'conversationId',
  'startTime',
  'endTime',
  'budgetAmount',
  'coverImage',
  'isTemplate',
];

assertFields(
  openApiSource,
  'BirdCoderWorkspaceSummary: createOpenApiObjectSchema(',
  workspaceExtraFieldsCamel,
  'BirdCoderWorkspaceSummary openapi schema',
);
assertFields(
  openApiSource,
  'BirdCoderCreateWorkspaceRequest: createOpenApiObjectSchema(',
  workspaceExtraFieldsCamel,
  'BirdCoderCreateWorkspaceRequest openapi schema',
);
assertFields(
  openApiSource,
  'BirdCoderUpdateWorkspaceRequest: createOpenApiObjectSchema(',
  workspaceExtraFieldsCamel,
  'BirdCoderUpdateWorkspaceRequest openapi schema',
);
assertFields(
  openApiSource,
  'BirdCoderProjectSummary: createOpenApiObjectSchema(',
  projectExtraFieldsCamel,
  'BirdCoderProjectSummary openapi schema',
);
assertFields(
  openApiSource,
  'BirdCoderCreateProjectRequest: createOpenApiObjectSchema(',
  projectExtraFieldsCamel,
  'BirdCoderCreateProjectRequest openapi schema',
);
assertFields(
  openApiSource,
  'BirdCoderUpdateProjectRequest: createOpenApiObjectSchema(',
  projectExtraFieldsCamel,
  'BirdCoderUpdateProjectRequest openapi schema',
);

const workspaceStructFields = [
  'id',
  'uuid',
  'tenant_id',
  'organization_id',
  'data_scope',
  'code',
  'title',
  'name',
  'description',
  'icon',
  'color',
  'owner_id',
  'leader_id',
  'created_by_user_id',
  'entity_type',
  'start_time',
  'end_time',
  'max_members',
  'current_members',
  'member_count',
  'max_storage',
  'used_storage',
  'settings',
  'is_public',
  'is_template',
  'status',
  'viewer_role',
];

const projectStructFields = [
  'id',
  'uuid',
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
  'entity_type',
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
  'is_template',
];

assertFields(workspaceRustSource, 'pub struct WorkspacePayload {', workspaceStructFields, 'WorkspacePayload');
assertFields(
  workspaceRustSource,
  'pub struct WorkspaceMemberPayload {',
  ['workspace_id', 'user_id', 'team_id', 'role', 'status', 'created_by_user_id'],
  'WorkspaceMemberPayload',
);
assertFields(
  projectRustSource,
  'pub struct ProjectPayload {',
  projectStructFields,
  'ProjectPayload',
);
assertFields(
  projectRustSource,
  'pub struct ProjectCollaboratorPayload {',
  ['project_id', 'workspace_id', 'user_id', 'role', 'status', 'created_by_user_id'],
  'ProjectCollaboratorPayload',
);

console.log('server workspace/project API standard contract passed.');
