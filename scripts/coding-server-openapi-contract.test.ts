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
assert.equal(documentSeed.paths['/api/core/v1/coding-sessions/{id}/events']?.get?.operationId, 'core.listCodingSessionEvents');
assert.equal(documentSeed.paths['/api/core/v1/operations/{operationId}']?.get?.operationId, 'core.getOperation');
assert.equal(documentSeed.paths['/api/app/v1/auth/config']?.get?.operationId, 'app.getUserCenterConfig');
assert.equal(documentSeed.paths['/api/app/v1/auth/session']?.get?.operationId, 'app.getCurrentUserSession');
assert.equal(documentSeed.paths['/api/app/v1/auth/login']?.post?.operationId, 'app.login');
assert.equal(documentSeed.paths['/api/app/v1/auth/register']?.post?.operationId, 'app.register');
assert.equal(documentSeed.paths['/api/app/v1/auth/logout']?.post?.operationId, 'app.logout');
assert.equal(documentSeed.paths['/api/app/v1/auth/session/exchange']?.post?.operationId, 'app.exchangeUserCenterSession');
assert.equal(documentSeed.paths['/api/app/v1/user-center/profile']?.get?.operationId, 'app.getCurrentUserProfile');
assert.equal(documentSeed.paths['/api/app/v1/user-center/profile']?.patch?.operationId, 'app.updateCurrentUserProfile');
assert.equal(documentSeed.paths['/api/app/v1/user-center/membership']?.get?.operationId, 'app.getCurrentUserMembership');
assert.equal(documentSeed.paths['/api/app/v1/user-center/membership']?.patch?.operationId, 'app.updateCurrentUserMembership');
assert.equal(documentSeed.paths['/api/app/v1/projects']?.get?.operationId, 'app.listProjects');
assert.equal(documentSeed.paths['/api/app/v1/projects']?.post?.operationId, 'app.createProject');
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
assert.ok(documentSeed.components.schemas?.BirdCoderCreateCodingSessionRequest);
assert.ok(documentSeed.components.schemas?.BirdCoderCreateCodingSessionTurnRequest);
assert.ok(documentSeed.components.schemas?.BirdCoderWorkspaceSummary);
assert.ok(documentSeed.components.schemas?.BirdCoderProjectSummary);
assert.ok(documentSeed.components.schemas?.BirdCoderUserCenterSessionSummary);
assert.ok(documentSeed.components.schemas?.BirdCoderAdminPolicySummary);
assert.equal(
  documentSeed.paths['/api/core/v1/coding-sessions']?.post?.requestBody?.content['application/json']
    ?.schema?.['$ref'],
  '#/components/schemas/BirdCoderCreateCodingSessionRequest',
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
