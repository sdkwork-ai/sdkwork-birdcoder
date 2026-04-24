import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rustPath = new URL(
  '../packages/sdkwork-birdcoder-server/src-host/src/lib.rs',
  import.meta.url,
);
const openApiPath = new URL('../packages/sdkwork-birdcoder-server/src/index.ts', import.meta.url);

const rustSource = await readFile(rustPath, 'utf8');
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
  'icon',
  'color',
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
];

const projectStructFields = [
  'site_path',
  'domain_prefix',
  'file_id',
  'conversation_id',
  'start_time',
  'end_time',
  'budget_amount',
  'cover_image',
  'is_template',
];

assertFields(rustSource, 'struct WorkspacePayload {', workspaceStructFields, 'WorkspacePayload');
assertFields(
  rustSource,
  'struct CreateWorkspaceRequest {',
  workspaceStructFields,
  'CreateWorkspaceRequest',
);
assertFields(
  rustSource,
  'struct UpdateWorkspaceRequest {',
  workspaceStructFields,
  'UpdateWorkspaceRequest',
);
assertFields(rustSource, 'struct ProjectPayload {', projectStructFields, 'ProjectPayload');
assertFields(
  rustSource,
  'struct CreateProjectRequest {',
  projectStructFields,
  'CreateProjectRequest',
);
assertFields(
  rustSource,
  'struct UpdateProjectRequest {',
  projectStructFields,
  'UpdateProjectRequest',
);

const workspaceExtraFieldsSnake = [
  'icon',
  'color',
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
];

const projectExtraFieldsSnake = [
  'site_path',
  'domain_prefix',
  'file_id',
  'conversation_id',
  'start_time',
  'end_time',
  'budget_amount',
  'cover_image_json',
  'is_template',
];

assertFields(
  rustSource,
  'INSERT INTO workspaces (',
  workspaceExtraFieldsSnake,
  'workspace insert/update SQL lane',
);
assertFields(
  rustSource,
  'UPDATE workspaces',
  workspaceExtraFieldsSnake,
  'workspace update SQL lane',
);
assertFields(
  rustSource,
  'INSERT INTO projects (',
  projectExtraFieldsSnake,
  'project insert/update SQL lane',
);
assertFields(
  rustSource,
  'UPDATE projects',
  projectExtraFieldsSnake,
  'project update SQL lane',
);

console.log('server workspace/project api standard contract passed.');
