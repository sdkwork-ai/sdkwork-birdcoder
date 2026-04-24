import assert from 'node:assert/strict';

import { buildBirdCoderCodingServerOpenApiDocumentSeed } from '../packages/sdkwork-birdcoder-server/src/index.ts';

const documentSeed = buildBirdCoderCodingServerOpenApiDocumentSeed();

assert.equal(documentSeed.openapi, '3.1.0');
assert.equal(documentSeed.info.title, 'SDKWork BirdCoder Coding Server API');
assert.equal(documentSeed.info.version, 'v1');
assert.match(documentSeed.info.description, /unified same-port API gateway/i);
assert.equal(documentSeed.servers[0]?.url, '/');
assert.deepEqual(documentSeed.tags.map((tag) => tag.name), ['core', 'app', 'admin']);
assert.equal(documentSeed.components.securitySchemes.bearerAuth.type, 'http');
assert.equal(documentSeed['x-sdkwork-api-gateway'].liveOpenApiPath, '/openapi.json');
assert.equal(documentSeed['x-sdkwork-api-gateway'].docsPath, '/docs');
assert.equal(documentSeed['x-sdkwork-api-gateway'].routeCatalogPath, '/api/core/v1/routes');
assert.equal(
  documentSeed['x-sdkwork-api-gateway'].routeCount,
  Object.values(documentSeed['x-sdkwork-api-gateway'].routesBySurface).reduce(
    (total, routeCount) => total + routeCount,
    0,
  ),
);
assert.deepEqual(
  documentSeed['x-sdkwork-api-gateway'].surfaces.map((surface) => surface.name),
  ['core', 'app', 'admin'],
);
assert.deepEqual(
  documentSeed['x-sdkwork-api-gateway'].surfaces.map((surface) => surface.routeCount),
  [
    documentSeed['x-sdkwork-api-gateway'].routesBySurface.core,
    documentSeed['x-sdkwork-api-gateway'].routesBySurface.app,
    documentSeed['x-sdkwork-api-gateway'].routesBySurface.admin,
  ],
);
const operationsWithoutSuccessSchema = Object.entries(documentSeed.paths).flatMap(([pathKey, methods]) =>
  Object.entries(methods ?? {}).flatMap(([methodKey, operation]) => {
    if (operation['x-sdkwork-stream-kind'] === 'websocket') {
      return operation.responses['101']
        ? []
        : [{ method: methodKey.toUpperCase(), operationId: operation.operationId, path: pathKey }];
    }

    const successResponse = operation.responses['200'] ?? operation.responses['201'];
    return successResponse?.content?.['application/json']?.schema
      ? []
      : [{ method: methodKey.toUpperCase(), operationId: operation.operationId, path: pathKey }];
  }),
);
assert.deepEqual(operationsWithoutSuccessSchema, []);
assert.equal(documentSeed.paths['/api/core/v1/routes']?.get?.operationId, 'core.listRoutes');
assert.equal(documentSeed.paths['/api/core/v1/routes']?.get?.['x-sdkwork-auth-mode'], 'host');
assert.equal(documentSeed.paths['/api/core/v1/native-sessions']?.get?.operationId, 'core.listNativeSessions');
assert.equal(documentSeed.paths['/api/core/v1/native-sessions/{id}']?.get?.operationId, 'core.getNativeSession');
assert.equal(documentSeed.paths['/api/core/v1/coding-sessions']?.post?.operationId, 'core.createCodingSession');
assert.equal(documentSeed.paths['/api/core/v1/coding-sessions/{id}']?.patch?.operationId, 'core.updateCodingSession');
assert.equal(documentSeed.paths['/api/core/v1/coding-sessions/{id}']?.delete?.operationId, 'core.deleteCodingSession');
assert.equal(
  documentSeed.paths['/api/core/v1/coding-sessions/{id}/messages/{messageId}']?.delete?.operationId,
  'core.deleteCodingSessionMessage',
);
assert.equal(
  documentSeed.paths['/api/core/v1/coding-sessions/{id}/fork']?.post?.operationId,
  'core.forkCodingSession',
);
assert.equal(documentSeed.paths['/api/core/v1/coding-sessions/{id}/events']?.get?.operationId, 'core.listCodingSessionEvents');
assert.equal(documentSeed.paths['/api/core/v1/operations/{operationId}']?.get?.operationId, 'core.getOperation');
assert.equal(documentSeed.paths['/api/app/v1/auth/config']?.get?.operationId, 'app.getUserCenterConfig');
assert.equal(documentSeed.paths['/api/app/v1/auth/session']?.get?.operationId, 'app.getCurrentUserSession');
assert.equal(documentSeed.paths['/api/app/v1/auth/login']?.post?.operationId, 'app.login');
assert.equal(
  documentSeed.paths['/api/app/v1/auth/email/login']?.post?.operationId,
  'app.loginWithEmailCode',
);
assert.equal(
  documentSeed.paths['/api/app/v1/auth/phone/login']?.post?.operationId,
  'app.loginWithPhoneCode',
);
assert.equal(documentSeed.paths['/api/app/v1/auth/register']?.post?.operationId, 'app.register');
assert.equal(
  documentSeed.paths['/api/app/v1/auth/verify/send']?.post?.operationId,
  'app.sendVerifyCode',
);
assert.equal(
  documentSeed.paths['/api/app/v1/auth/password/reset/request']?.post?.operationId,
  'app.requestPasswordReset',
);
assert.equal(
  documentSeed.paths['/api/app/v1/auth/password/reset']?.post?.operationId,
  'app.resetPassword',
);
assert.equal(documentSeed.paths['/api/app/v1/auth/logout']?.post?.operationId, 'app.logout');
assert.equal(documentSeed.paths['/api/app/v1/auth/session/exchange']?.post?.operationId, 'app.exchangeUserCenterSession');
assert.equal(documentSeed.paths['/api/app/v1/user/profile']?.get?.operationId, 'app.getCurrentUserProfile');
assert.equal(documentSeed.paths['/api/app/v1/user/profile']?.patch?.operationId, 'app.updateCurrentUserProfile');
assert.equal(documentSeed.paths['/api/app/v1/vip/info']?.get?.operationId, 'app.getCurrentUserMembership');
assert.equal(documentSeed.paths['/api/app/v1/vip/info']?.patch?.operationId, 'app.updateCurrentUserMembership');
assert.equal(documentSeed.paths['/api/app/v1/projects']?.get?.operationId, 'app.listProjects');
assert.equal(documentSeed.paths['/api/app/v1/projects']?.post?.operationId, 'app.createProject');
assert.equal(
  documentSeed.paths['/api/app/v1/projects/{projectId}/git/overview']?.get?.operationId,
  'app.getProjectGitOverview',
);
assert.equal(
  documentSeed.paths['/api/app/v1/projects/{projectId}/git/branches']?.post?.operationId,
  'app.createProjectGitBranch',
);
assert.equal(
  documentSeed.paths['/api/app/v1/projects/{projectId}/git/branch-switch']?.post?.operationId,
  'app.switchProjectGitBranch',
);
assert.equal(
  documentSeed.paths['/api/app/v1/projects/{projectId}/git/commits']?.post?.operationId,
  'app.commitProjectGitChanges',
);
assert.equal(
  documentSeed.paths['/api/app/v1/projects/{projectId}/git/pushes']?.post?.operationId,
  'app.pushProjectGitBranch',
);
assert.equal(
  documentSeed.paths['/api/app/v1/projects/{projectId}/git/worktrees']?.post?.operationId,
  'app.createProjectGitWorktree',
);
assert.equal(
  documentSeed.paths['/api/app/v1/projects/{projectId}/git/worktree-removals']?.post?.operationId,
  'app.removeProjectGitWorktree',
);
assert.equal(
  documentSeed.paths['/api/app/v1/projects/{projectId}/git/worktree-prune']?.post?.operationId,
  'app.pruneProjectGitWorktrees',
);
assert.equal(documentSeed.paths['/api/app/v1/projects/{projectId}']?.patch?.operationId, 'app.updateProject');
assert.equal(documentSeed.paths['/api/app/v1/projects/{projectId}']?.delete?.operationId, 'app.deleteProject');
assert.equal(
  documentSeed.paths['/api/app/v1/projects/{projectId}/publish']?.post?.operationId,
  'app.publishProject',
);
assert.equal(documentSeed.paths['/api/app/v1/workspaces']?.post?.operationId, 'app.createWorkspace');
assert.equal(documentSeed.paths['/api/app/v1/workspaces/{workspaceId}']?.patch?.operationId, 'app.updateWorkspace');
assert.equal(documentSeed.paths['/api/app/v1/workspaces/{workspaceId}']?.delete?.operationId, 'app.deleteWorkspace');
assert.equal(
  documentSeed.paths['/api/app/v1/workspaces/{workspaceId}/realtime']?.get?.operationId,
  'app.subscribeWorkspaceRealtime',
);
assert.equal(
  documentSeed.paths['/api/app/v1/workspaces/{workspaceId}/realtime']?.get?.['x-sdkwork-stream-kind'],
  'websocket',
);
assert.equal(documentSeed.paths['/api/admin/v1/releases']?.get?.operationId, 'admin.listReleases');
assert.ok(documentSeed.components.schemas?.BirdCoderCodingSessionSummary);
const codingSessionSummaryRequired = Array.isArray(
  documentSeed.components.schemas?.BirdCoderCodingSessionSummary?.required,
)
  ? documentSeed.components.schemas.BirdCoderCodingSessionSummary.required
  : [];
assert.ok(
  codingSessionSummaryRequired.includes('modelId'),
  'coding session summary schema must require modelId so server contracts match immutable session engine/model selection.',
);
assert.ok(documentSeed.components.schemas?.BirdCoderCreateCodingSessionRequest);
const createCodingSessionRequestRequired = Array.isArray(
  documentSeed.components.schemas?.BirdCoderCreateCodingSessionRequest?.required,
)
  ? documentSeed.components.schemas.BirdCoderCreateCodingSessionRequest.required
  : [];
assert.ok(
  createCodingSessionRequestRequired.includes('engineId') &&
    createCodingSessionRequestRequired.includes('modelId'),
  'create coding session request schema must require explicit engineId and modelId.',
);
assert.ok(documentSeed.components.schemas?.BirdCoderUpdateCodingSessionRequest);
assert.ok(documentSeed.components.schemas?.BirdCoderForkCodingSessionRequest);
assert.ok(documentSeed.components.schemas?.BirdCoderDeleteCodingSessionMessageResult);
assert.ok(documentSeed.components.schemas?.BirdCoderCreateCodingSessionTurnRequest);
assert.ok(documentSeed.components.schemas?.BirdCoderWorkspaceSummary);
assert.ok(documentSeed.components.schemas?.BirdCoderProjectSummary);
assert.ok(documentSeed.components.schemas?.BirdCoderProjectGitOverview);
assert.ok(documentSeed.components.schemas?.BirdCoderCreateProjectGitBranchRequest);
assert.ok(documentSeed.components.schemas?.BirdCoderSwitchProjectGitBranchRequest);
assert.ok(documentSeed.components.schemas?.BirdCoderCommitProjectGitChangesRequest);
assert.ok(documentSeed.components.schemas?.BirdCoderPushProjectGitBranchRequest);
assert.ok(documentSeed.components.schemas?.BirdCoderCreateProjectGitWorktreeRequest);
assert.ok(documentSeed.components.schemas?.BirdCoderRemoveProjectGitWorktreeRequest);
assert.ok(documentSeed.components.schemas?.BirdCoderUserCenterSessionSummary);
const userCenterMetadataProperties = documentSeed.components.schemas
  ?.BirdCoderUserCenterMetadataSummary?.properties as
  | Record<string, { enum?: unknown }>
  | undefined;
const userCenterSessionProperties = documentSeed.components.schemas
  ?.BirdCoderUserCenterSessionSummary?.properties as
  | Record<string, { enum?: unknown }>
  | undefined;
assert.deepEqual(
  userCenterMetadataProperties?.mode?.enum,
  ['builtin-local', 'sdkwork-cloud-app-api', 'external-user-center'],
  'user-center metadata schema must expose the canonical unified deployment selectors.',
);
assert.deepEqual(
  userCenterSessionProperties?.providerMode?.enum,
  ['builtin-local', 'sdkwork-cloud-app-api', 'external-user-center'],
  'user-center session schema must expose the canonical unified deployment selectors.',
);
assert.ok(documentSeed.components.schemas?.BirdCoderAdminPolicySummary);
assert.ok(documentSeed.components.schemas?.BirdCoderEngineDescriptor);
const engineDescriptorRequired = Array.isArray(
  documentSeed.components.schemas?.BirdCoderEngineDescriptor?.required,
)
  ? documentSeed.components.schemas.BirdCoderEngineDescriptor.required
  : [];
assert.ok(
  engineDescriptorRequired.includes('defaultModelId'),
  'engine descriptor schema must require defaultModelId so every engine catalog consumer sees an explicit default model contract.',
);
assert.equal(
  documentSeed.paths['/api/core/v1/coding-sessions']?.post?.requestBody?.content['application/json']
    ?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCreateCodingSessionRequest',
);
assert.equal(
  documentSeed.paths['/api/core/v1/coding-sessions/{id}']?.patch?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderUpdateCodingSessionRequest',
);
assert.equal(
  documentSeed.paths['/api/core/v1/coding-sessions/{id}/fork']?.post?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderForkCodingSessionRequest',
);
assert.equal(
  documentSeed.paths['/api/core/v1/coding-sessions/{id}']?.delete?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderDeletedResourceEnvelope',
);
assert.equal(
  documentSeed.paths['/api/core/v1/coding-sessions/{id}/messages/{messageId}']?.delete?.responses[
    '200'
  ]?.content['application/json']?.schema?.['$ref'],
  '#/components/schemas/BirdCoderDeleteCodingSessionMessageResultEnvelope',
);
assert.equal(
  documentSeed.paths['/api/core/v1/coding-sessions/{id}/fork']?.post?.responses['201']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCodingSessionSummaryEnvelope',
);
assert.equal(
  documentSeed.paths['/api/core/v1/coding-sessions/{id}/turns']?.post?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCreateCodingSessionTurnRequest',
);
assert.equal(
  documentSeed.paths['/api/core/v1/coding-sessions']?.get?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCodingSessionSummaryListEnvelope',
);
assert.equal(
  documentSeed.paths['/api/core/v1/native-sessions/{id}']?.get?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderNativeSessionDetailEnvelope',
);
assert.equal(
  documentSeed.paths['/api/app/v1/auth/login']?.post?.requestBody?.content['application/json']
    ?.schema?.['$ref'],
  '#/components/schemas/BirdCoderUserCenterLoginRequest',
);
assert.equal(
  documentSeed.paths['/api/app/v1/auth/session']?.get?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderNullableUserCenterSessionEnvelope',
);
assert.equal(
  documentSeed.paths['/api/app/v1/workspaces']?.get?.responses['200']?.content['application/json']
    ?.schema?.['$ref'],
  '#/components/schemas/BirdCoderWorkspaceSummaryListEnvelope',
);
assert.equal(
  documentSeed.paths['/api/app/v1/workspaces']?.post?.requestBody?.content['application/json']
    ?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCreateWorkspaceRequest',
);
assert.equal(
  documentSeed.paths['/api/app/v1/projects']?.post?.requestBody?.content['application/json']
    ?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCreateProjectRequest',
);
assert.equal(
  documentSeed.paths['/api/app/v1/projects/{projectId}/git/overview']?.get?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  documentSeed.paths['/api/app/v1/projects/{projectId}/git/branches']?.post?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCreateProjectGitBranchRequest',
);
assert.equal(
  documentSeed.paths['/api/app/v1/projects/{projectId}/git/branch-switch']?.post?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderSwitchProjectGitBranchRequest',
);
assert.equal(
  documentSeed.paths['/api/app/v1/projects/{projectId}/git/commits']?.post?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCommitProjectGitChangesRequest',
);
assert.equal(
  documentSeed.paths['/api/app/v1/projects/{projectId}/git/pushes']?.post?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderPushProjectGitBranchRequest',
);
assert.equal(
  documentSeed.paths['/api/app/v1/projects/{projectId}/git/worktrees']?.post?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCreateProjectGitWorktreeRequest',
);
assert.equal(
  documentSeed.paths[
    '/api/app/v1/projects/{projectId}/git/worktree-removals'
  ]?.post?.requestBody?.content['application/json']?.schema?.['$ref'],
  '#/components/schemas/BirdCoderRemoveProjectGitWorktreeRequest',
);
assert.equal(
  documentSeed.paths['/api/app/v1/projects/{projectId}/git/branches']?.post?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  documentSeed.paths['/api/app/v1/projects/{projectId}/git/branch-switch']?.post?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  documentSeed.paths['/api/app/v1/projects/{projectId}/git/commits']?.post?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  documentSeed.paths['/api/app/v1/projects/{projectId}/git/pushes']?.post?.responses['200']?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  documentSeed.paths['/api/app/v1/projects/{projectId}/git/worktrees']?.post?.responses['200']
    ?.content['application/json']?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  documentSeed.paths[
    '/api/app/v1/projects/{projectId}/git/worktree-removals'
  ]?.post?.responses['200']?.content['application/json']?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  documentSeed.paths[
    '/api/app/v1/projects/{projectId}/git/worktree-prune'
  ]?.post?.responses['200']?.content['application/json']?.schema?.['$ref'],
  '#/components/schemas/BirdCoderProjectGitOverviewEnvelope',
);
assert.equal(
  documentSeed.paths['/api/app/v1/projects/{projectId}/collaborators']?.post?.requestBody?.content[
    'application/json'
  ]?.schema?.['$ref'],
  '#/components/schemas/BirdCoderUpsertProjectCollaboratorRequest',
);
assert.equal(
  documentSeed.paths['/api/admin/v1/policies']?.get?.responses['200']?.content['application/json']
    ?.schema?.['$ref'],
  '#/components/schemas/BirdCoderAdminPolicySummaryListEnvelope',
);
assert.equal(
  documentSeed.paths['/api/admin/v1/projects/{projectId}/deployment-targets']?.get?.responses[
    '200'
  ]?.content['application/json']?.schema?.['$ref'],
  '#/components/schemas/BirdCoderDeploymentTargetSummaryListEnvelope',
);

console.log('coding server openapi contract passed.');
