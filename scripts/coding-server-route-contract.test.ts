import assert from 'node:assert/strict';

import {
  getBirdCoderAdminApiContract,
  getBirdCoderAppApiContract,
  getBirdCoderCodingServerDescriptor,
  getBirdCoderCoreApiContract,
  listBirdCoderCodingServerRouteCatalogEntries,
  listBirdCoderCodingServerRoutes,
} from '../packages/sdkwork-birdcoder-server/src/index.ts';

const descriptor = getBirdCoderCodingServerDescriptor();
assert.deepEqual(descriptor, {
  apiVersion: 'v1',
  gateway: {
    basePath: '/api',
    docsPath: '/docs',
    liveOpenApiPath: '/openapi.json',
    openApiPath: '/openapi/coding-server-v1.json',
    routeCatalogPath: '/api/core/v1/routes',
    routeCount: 57,
    routesBySurface: {
      core: 19,
      app: 31,
      admin: 7,
    },
    surfaces: [
      {
        authMode: 'host',
        basePath: '/api/core/v1',
        description: 'Core coding runtime, engine catalog, session execution, and operation control.',
        name: 'core',
        routeCount: 19,
      },
      {
        authMode: 'user',
        basePath: '/api/app/v1',
        description: 'Application-facing workspace, project, collaboration, and user-center routes.',
        name: 'app',
        routeCount: 31,
      },
      {
        authMode: 'admin',
        basePath: '/api/admin/v1',
        description: 'Administrative governance, audit, release, deployment, and team-management routes.',
        name: 'admin',
        routeCount: 7,
      },
    ],
  },
  hostMode: 'server',
  moduleId: 'coding-server',
  openApiPath: '/openapi/coding-server-v1.json',
  surfaces: ['core', 'app', 'admin'],
});

const core = getBirdCoderCoreApiContract();
assert.equal(core.engines.method, 'GET');
assert.equal(core.engines.path, '/api/core/v1/engines');
assert.equal(core.engineCapabilities.path, '/api/core/v1/engines/:engineKey/capabilities');
assert.equal(core.nativeSessionProviders.path, '/api/core/v1/native-session-providers');
assert.equal(core.nativeSessions.path, '/api/core/v1/native-sessions');
assert.equal(core.nativeSession.path, '/api/core/v1/native-sessions/:id');
assert.equal(core.sessions.path, '/api/core/v1/coding-sessions');
assert.equal(core.codingSession.path, '/api/core/v1/coding-sessions/:id');
assert.equal(core.sessionTurns.path, '/api/core/v1/coding-sessions/:id/turns');
assert.equal(core.events.path, '/api/core/v1/coding-sessions/:id/events');
assert.equal(core.sessionArtifacts.path, '/api/core/v1/coding-sessions/:id/artifacts');
assert.equal(core.sessionCheckpoints.path, '/api/core/v1/coding-sessions/:id/checkpoints');
assert.equal(core.approvals.path, '/api/core/v1/approvals/:approvalId/decision');
assert.equal(core.operations.path, '/api/core/v1/operations/:operationId');
assert.equal(core.models.path, '/api/core/v1/models');
assert.equal(core.routes.path, '/api/core/v1/routes');

const app = getBirdCoderAppApiContract();
assert.equal(app.authConfig.method, 'GET');
assert.equal(app.authConfig.path, '/api/app/v1/auth/config');
assert.equal(app.authSession.method, 'GET');
assert.equal(app.authSession.path, '/api/app/v1/auth/session');
assert.equal(app.login.method, 'POST');
assert.equal(app.login.path, '/api/app/v1/auth/login');
assert.equal(app.register.method, 'POST');
assert.equal(app.register.path, '/api/app/v1/auth/register');
assert.equal(app.logout.method, 'POST');
assert.equal(app.logout.path, '/api/app/v1/auth/logout');
assert.equal(app.exchangeUserCenterSession.method, 'POST');
assert.equal(app.exchangeUserCenterSession.path, '/api/app/v1/auth/session/exchange');
assert.equal(app.getCurrentUserProfile.method, 'GET');
assert.equal(app.getCurrentUserProfile.path, '/api/app/v1/user-center/profile');
assert.equal(app.updateCurrentUserProfile.method, 'PATCH');
assert.equal(app.updateCurrentUserProfile.path, '/api/app/v1/user-center/profile');
assert.equal(app.getCurrentUserMembership.method, 'GET');
assert.equal(app.getCurrentUserMembership.path, '/api/app/v1/user-center/membership');
assert.equal(app.updateCurrentUserMembership.method, 'PATCH');
assert.equal(app.updateCurrentUserMembership.path, '/api/app/v1/user-center/membership');
assert.equal(app.createWorkspace.method, 'POST');
assert.equal(app.createWorkspace.path, '/api/app/v1/workspaces');
assert.equal(app.updateWorkspace.method, 'PATCH');
assert.equal(app.updateWorkspace.path, '/api/app/v1/workspaces/:workspaceId');
assert.equal(app.deleteWorkspace.method, 'DELETE');
assert.equal(app.deleteWorkspace.path, '/api/app/v1/workspaces/:workspaceId');
assert.equal(app.subscribeWorkspaceRealtime.method, 'GET');
assert.equal(app.subscribeWorkspaceRealtime.path, '/api/app/v1/workspaces/:workspaceId/realtime');
assert.equal(app.createProject.method, 'POST');
assert.equal(app.createProject.path, '/api/app/v1/projects');
assert.equal(app.updateProject.method, 'PATCH');
assert.equal(app.updateProject.path, '/api/app/v1/projects/:projectId');
assert.equal(app.deleteProject.method, 'DELETE');
assert.equal(app.deleteProject.path, '/api/app/v1/projects/:projectId');
assert.equal(app.publishProject.method, 'POST');
assert.equal(app.publishProject.path, '/api/app/v1/projects/:projectId/publish');
assert.equal(app.workspaces.path, '/api/app/v1/workspaces');
assert.equal(app.projects.path, '/api/app/v1/projects');
assert.equal(app.documents.path, '/api/app/v1/documents');
assert.equal(app.teams.path, '/api/app/v1/teams');
assert.equal(app.deployments.path, '/api/app/v1/deployments');

const admin = getBirdCoderAdminApiContract();
assert.equal(admin.audit.path, '/api/admin/v1/audit');
assert.equal(admin.policies.path, '/api/admin/v1/policies');
assert.equal(admin.teams.path, '/api/admin/v1/teams');
assert.equal(admin.teamMembers.path, '/api/admin/v1/teams/:teamId/members');
assert.equal(admin.deploymentTargets.path, '/api/admin/v1/projects/:projectId/deployment-targets');
assert.equal(admin.releases.path, '/api/admin/v1/releases');
assert.equal(admin.deployments.path, '/api/admin/v1/deployments');

const routes = listBirdCoderCodingServerRoutes();
assert.equal(routes.length, 57, 'coding-server should expose the full core/app/admin route matrix');
assert.equal(
  routes.every((route) => route.path.startsWith('/api/core/v1') || route.path.startsWith('/api/app/v1') || route.path.startsWith('/api/admin/v1')),
  true,
  'all coding-server routes must stay inside the unified core/app/admin prefixes',
);

const routeCatalog = listBirdCoderCodingServerRouteCatalogEntries();
assert.equal(routeCatalog.length, routes.length, 'route catalog must stay in lockstep with the unified route matrix');
assert.equal(
  routeCatalog.every((route) => route.openApiPath.startsWith('/api/')),
  true,
  'route catalog must emit normalized OpenAPI path templates',
);
assert.equal(
  routeCatalog.every((route) => !route.openApiPath.includes('/:')),
  true,
  'route catalog must not leak Express-style :param placeholders into OpenAPI templates',
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'core.listRoutes'),
  {
    authMode: 'host',
    method: 'GET',
    openApiPath: '/api/core/v1/routes',
    operationId: 'core.listRoutes',
    path: '/api/core/v1/routes',
    surface: 'core',
    summary: 'List unified API routes',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'core.listNativeSessionProviders'),
  {
    authMode: 'host',
    method: 'GET',
    openApiPath: '/api/core/v1/native-session-providers',
    operationId: 'core.listNativeSessionProviders',
    path: '/api/core/v1/native-session-providers',
    surface: 'core',
    summary: 'List registered native engine session providers',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'core.listNativeSessions'),
  {
    authMode: 'host',
    method: 'GET',
    openApiPath: '/api/core/v1/native-sessions',
    operationId: 'core.listNativeSessions',
    path: '/api/core/v1/native-sessions',
    surface: 'core',
    summary: 'List discovered native engine sessions',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'core.getNativeSession'),
  {
    authMode: 'host',
    method: 'GET',
    openApiPath: '/api/core/v1/native-sessions/{id}',
    operationId: 'core.getNativeSession',
    path: '/api/core/v1/native-sessions/:id',
    surface: 'core',
    summary: 'Get discovered native engine session detail',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'app.subscribeWorkspaceRealtime'),
  {
    authMode: 'user',
    method: 'GET',
    openApiPath: '/api/app/v1/workspaces/{workspaceId}/realtime',
    operationId: 'app.subscribeWorkspaceRealtime',
    path: '/api/app/v1/workspaces/:workspaceId/realtime',
    surface: 'app',
    summary: 'Subscribe to workspace realtime invalidation events',
  },
);

console.log('coding server route contract passed.');
