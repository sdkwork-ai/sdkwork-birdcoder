import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  readCanonicalServerRustSource,
  CANONICAL_DOMAIN_RUST_PATHS,
} from './birdcoder-canonical-server-rust-sources.mjs';

const workspaceRustSource = readCanonicalServerRustSource(CANONICAL_DOMAIN_RUST_PATHS.workspaceDomainResults);
const projectRustSource = readCanonicalServerRustSource(CANONICAL_DOMAIN_RUST_PATHS.projectDomainResults);
const openApiPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/openApiSchemas.ts',
  import.meta.url,
);
const openApiOperationDefinitionsPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/openApiOperationDefinitions.ts',
  import.meta.url,
);

const openApiSource = await readFile(openApiPath, 'utf8');
const openApiOperationDefinitionsSource = await readFile(openApiOperationDefinitionsPath, 'utf8');

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

function captureDelimited(source, startIndex, openingCharacter, closingCharacter, label) {
  assert.equal(
    source[startIndex],
    openingCharacter,
    `${label} must begin with "${openingCharacter}".`,
  );

  let depth = 0;
  let escaped = false;
  let quote = '';
  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = '';
      }
      continue;
    }

    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === openingCharacter) {
      depth += 1;
      continue;
    }
    if (character === closingCharacter) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }

  throw new Error(`${label} is missing its closing "${closingCharacter}".`);
}

function captureOpenApiObjectSchemaCall(source, anchor) {
  const anchorIndex = source.indexOf(anchor);
  assert.notEqual(anchorIndex, -1, `Missing source block: ${anchor}`);
  const factory = 'createOpenApiObjectSchema(';
  const callIndex = source.indexOf(factory, anchorIndex);
  assert.notEqual(callIndex, -1, `${anchor} must use ${factory}.`);
  const openingParenthesisIndex = callIndex + factory.length - 1;
  return captureDelimited(
    source,
    openingParenthesisIndex,
    '(',
    ')',
    `${anchor} OpenAPI schema call`,
  );
}

function getOpenApiObjectSchemaFields(source, anchor) {
  const schemaCall = captureOpenApiObjectSchemaCall(source, anchor);
  const propertiesStart = schemaCall.indexOf('{');
  assert.notEqual(propertiesStart, -1, `${anchor} must declare an object schema.`);
  const properties = captureDelimited(
    schemaCall,
    propertiesStart,
    '{',
    '}',
    `${anchor} OpenAPI schema properties`,
  );
  return Array.from(
    properties.matchAll(/^\s+([A-Za-z][A-Za-z0-9]*):/gmu),
    (match) => match[1],
  );
}

function getOpenApiObjectSchemaRequiredFields(source, anchor) {
  const schemaCall = captureOpenApiObjectSchemaCall(source, anchor);
  const requiredMatch = /\brequired:\s*\[([\s\S]*?)\]/u.exec(schemaCall);
  if (!requiredMatch) {
    return [];
  }
  return Array.from(requiredMatch[1].matchAll(/'([^']+)'/gu), (match) => match[1]);
}

function assertOpenApiObjectSchemaFields(source, anchor, expectedFields, label) {
  assert.deepEqual(
    [...getOpenApiObjectSchemaFields(source, anchor)].sort(),
    [...expectedFields].sort(),
    `${label} must expose exactly the approved public fields.`,
  );
}

function assertOpenApiObjectSchemaRequiredFields(source, anchor, expectedFields, label) {
  assert.deepEqual(
    [...getOpenApiObjectSchemaRequiredFields(source, anchor)].sort(),
    [...expectedFields].sort(),
    `${label} must declare exactly the approved required fields.`,
  );
}

function assertOpenApiObjectSchemaExcludesFields(source, anchor, forbiddenFields, label) {
  const fields = new Set(getOpenApiObjectSchemaFields(source, anchor));
  for (const fieldName of forbiddenFields) {
    assert.equal(fields.has(fieldName), false, `${label} must not expose "${fieldName}".`);
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

const projectSummaryFieldsCamel = [
  'dataScope',
  'userId',
  'parentId',
  'parentUuid',
  'parentMetadata',
  'domainPrefix',
  'fileId',
  'conversationId',
  'startTime',
  'endTime',
  'budgetAmount',
  'coverImage',
  'isTemplate',
];

const projectCreateFieldsCamel = ['description', 'name', 'workspaceId'];
const projectUpdateFieldsCamel = ['description', 'name', 'status'];
const projectClientAuthorityFieldsCamel = [
  'tenantId',
  'organizationId',
  'dataScope',
  'userId',
  'parentId',
  'parentUuid',
  'parentMetadata',
  'code',
  'title',
  'ownerId',
  'leaderId',
  'createdByUserId',
  'author',
  'type',
  'rootPath',
  'sitePath',
  'domainPrefix',
  'fileId',
  'conversationId',
  'startTime',
  'endTime',
  'budgetAmount',
  'coverImage',
  'isTemplate',
  'appTemplateVersionId',
  'templatePresetKey',
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
assertOpenApiObjectSchemaFields(
  openApiSource,
  'BirdCoderProjectSummary: createOpenApiObjectSchema(',
  [
    'createdAt',
    'id',
    'uuid',
    'tenantId',
    'organizationId',
    ...projectSummaryFieldsCamel,
    'workspaceId',
    'workspaceUuid',
    'code',
    'title',
    'name',
    'description',
    'ownerId',
    'leaderId',
    'createdByUserId',
    'author',
    'type',
    'collaboratorCount',
    'status',
    'updatedAt',
    'viewerRole',
  ],
  'BirdCoderProjectSummary openapi schema',
);
assertOpenApiObjectSchemaRequiredFields(
  openApiSource,
  'BirdCoderProjectSummary: createOpenApiObjectSchema(',
  ['createdAt', 'id', 'workspaceId', 'name', 'status', 'updatedAt'],
  'BirdCoderProjectSummary openapi schema',
);
assertOpenApiObjectSchemaExcludesFields(
  openApiSource,
  'BirdCoderProjectSummary: createOpenApiObjectSchema(',
  ['rootPath', 'sitePath'],
  'BirdCoderProjectSummary openapi schema',
);
assertOpenApiObjectSchemaFields(
  openApiSource,
  'BirdCoderCreateProjectRequest: createOpenApiObjectSchema(',
  projectCreateFieldsCamel,
  'BirdCoderCreateProjectRequest openapi schema',
);
assertOpenApiObjectSchemaRequiredFields(
  openApiSource,
  'BirdCoderCreateProjectRequest: createOpenApiObjectSchema(',
  ['name', 'workspaceId'],
  'BirdCoderCreateProjectRequest openapi schema',
);
assertOpenApiObjectSchemaExcludesFields(
  openApiSource,
  'BirdCoderCreateProjectRequest: createOpenApiObjectSchema(',
  projectClientAuthorityFieldsCamel,
  'BirdCoderCreateProjectRequest openapi schema',
);
assertOpenApiObjectSchemaFields(
  openApiSource,
  'BirdCoderUpdateProjectRequest: createOpenApiObjectSchema(',
  projectUpdateFieldsCamel,
  'BirdCoderUpdateProjectRequest openapi schema',
);
assertOpenApiObjectSchemaRequiredFields(
  openApiSource,
  'BirdCoderUpdateProjectRequest: createOpenApiObjectSchema(',
  [],
  'BirdCoderUpdateProjectRequest openapi schema',
);
assertOpenApiObjectSchemaExcludesFields(
  openApiSource,
  'BirdCoderUpdateProjectRequest: createOpenApiObjectSchema(',
  [...projectClientAuthorityFieldsCamel, 'workspaceId'],
  'BirdCoderUpdateProjectRequest openapi schema',
);
assertOpenApiObjectSchemaFields(
  openApiSource,
  'BirdCoderGitStatusCounts: createOpenApiObjectSchema(',
  ['staged', 'unstaged', 'untracked'],
  'BirdCoderGitStatusCounts openapi schema',
);
assertOpenApiObjectSchemaRequiredFields(
  openApiSource,
  'BirdCoderGitStatusCounts: createOpenApiObjectSchema(',
  ['staged', 'unstaged', 'untracked'],
  'BirdCoderGitStatusCounts openapi schema',
);
assertOpenApiObjectSchemaFields(
  openApiSource,
  'BirdCoderGitBranchSummary: createOpenApiObjectSchema(',
  ['name', 'isCurrent', 'isRemote'],
  'BirdCoderGitBranchSummary openapi schema',
);
assertOpenApiObjectSchemaRequiredFields(
  openApiSource,
  'BirdCoderGitBranchSummary: createOpenApiObjectSchema(',
  ['name', 'isCurrent', 'isRemote'],
  'BirdCoderGitBranchSummary openapi schema',
);
assertOpenApiObjectSchemaFields(
  openApiSource,
  'BirdCoderGitWorktreeSummary: createOpenApiObjectSchema(',
  ['worktreeKey', 'branch', 'head', 'isCurrent', 'prunableReason'],
  'BirdCoderGitWorktreeSummary openapi schema',
);
assertOpenApiObjectSchemaRequiredFields(
  openApiSource,
  'BirdCoderGitWorktreeSummary: createOpenApiObjectSchema(',
  ['isCurrent'],
  'BirdCoderGitWorktreeSummary openapi schema',
);
assertOpenApiObjectSchemaExcludesFields(
  openApiSource,
  'BirdCoderGitWorktreeSummary: createOpenApiObjectSchema(',
  ['path', 'id', 'label', 'isDetached', 'isLocked', 'isPrunable', 'lockedReason'],
  'BirdCoderGitWorktreeSummary openapi schema',
);
assertOpenApiObjectSchemaFields(
  openApiSource,
  'BirdCoderProjectGitOverview: createOpenApiObjectSchema(',
  ['branches', 'currentBranch', 'currentRevision', 'detachedHead', 'status', 'statusCounts', 'worktrees'],
  'BirdCoderProjectGitOverview openapi schema',
);
assertOpenApiObjectSchemaExcludesFields(
  openApiSource,
  'BirdCoderProjectGitOverview: createOpenApiObjectSchema(',
  ['currentWorktreePath', 'repositoryRootPath'],
  'BirdCoderProjectGitOverview openapi schema',
);
assertOpenApiObjectSchemaFields(
  openApiSource,
  'BirdCoderCreateProjectGitWorktreeRequest: createOpenApiObjectSchema(',
  ['branchName'],
  'BirdCoderCreateProjectGitWorktreeRequest openapi schema',
);
assertOpenApiObjectSchemaRequiredFields(
  openApiSource,
  'BirdCoderCreateProjectGitWorktreeRequest: createOpenApiObjectSchema(',
  ['branchName'],
  'BirdCoderCreateProjectGitWorktreeRequest openapi schema',
);
assertOpenApiObjectSchemaFields(
  openApiSource,
  'BirdCoderRemoveProjectGitWorktreeRequest: createOpenApiObjectSchema(',
  ['worktreeKey', 'force'],
  'BirdCoderRemoveProjectGitWorktreeRequest openapi schema',
);
assertOpenApiObjectSchemaRequiredFields(
  openApiSource,
  'BirdCoderRemoveProjectGitWorktreeRequest: createOpenApiObjectSchema(',
  ['worktreeKey'],
  'BirdCoderRemoveProjectGitWorktreeRequest openapi schema',
);
assertOpenApiObjectSchemaExcludesFields(
  openApiSource,
  'BirdCoderRemoveProjectGitWorktreeRequest: createOpenApiObjectSchema(',
  ['path'],
  'BirdCoderRemoveProjectGitWorktreeRequest openapi schema',
);
assertOpenApiObjectSchemaFields(
  openApiSource,
  'BirdCoderUpsertProjectCollaboratorRequest: createOpenApiObjectSchema(',
  ['userId', 'role', 'status'],
  'BirdCoderUpsertProjectCollaboratorRequest openapi schema',
);
assertOpenApiObjectSchemaRequiredFields(
  openApiSource,
  'BirdCoderUpsertProjectCollaboratorRequest: createOpenApiObjectSchema(',
  ['userId'],
  'BirdCoderUpsertProjectCollaboratorRequest openapi schema',
);
assertOpenApiObjectSchemaExcludesFields(
  openApiSource,
  'BirdCoderUpsertProjectCollaboratorRequest: createOpenApiObjectSchema(',
  ['email', 'teamId', 'createdByUserId', 'grantedByUserId'],
  'BirdCoderUpsertProjectCollaboratorRequest openapi schema',
);
const projectCollaboratorRequestSchema = captureOpenApiObjectSchemaCall(
  openApiSource,
  'BirdCoderUpsertProjectCollaboratorRequest: createOpenApiObjectSchema(',
);
assert.match(
  projectCollaboratorRequestSchema,
  /status:\s*createOpenApiStringEnumSchema\(BIRDCODER_PROJECT_COLLABORATOR_MUTATION_STATUSES\)/u,
  'BirdCoderUpsertProjectCollaboratorRequest must use the project collaborator mutation status enum.',
);
assert.match(
  openApiSource,
  /const BIRDCODER_PROJECT_COLLABORATOR_MUTATION_STATUSES = \[\s*'invited',\s*'active',\s*'suspended',\s*\] as const;/u,
  'Project collaborator mutation status must match the Rust repository whitelist.',
);
assert.doesNotMatch(
  openApiOperationDefinitionsSource,
  /\brootPathParameter\b/u,
  'projects.list OpenAPI operation must not expose an absolute rootPath query parameter.',
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
