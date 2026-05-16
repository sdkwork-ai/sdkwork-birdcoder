import assert from 'node:assert/strict';

import {
  getBirdCoderAdminApiContract,
  getBirdCoderAppApiContract,
  getBirdCoderAppRuntimeApiContract,
  getBirdCoderCodingServerDescriptor,
  listBirdCoderCodingServerRouteCatalogEntries,
  listBirdCoderCodingServerRoutes,
} from '../packages/sdkwork-birdcoder-server/src/index.ts';

const descriptor = getBirdCoderCodingServerDescriptor();
assert.deepEqual(descriptor, {
  apiVersion: 'v1',
  gateway: {
    docsPath: '/docs',
    liveOpenApiPath: '/openapi.json',
    openApiPath: '/openapi/coding-server-v1.json',
    routeCatalogPath: '/app/v3/api/system/routes',
    routeCount: 80,
    routesBySurface: {
      app: 73,
      backend: 7,
    },
    surfaces: [
      {
        authMode: 'user',
        basePath: '/app/v3/api',
        description: 'Application-facing coding runtime, workspace, project, collaboration, and user-center routes.',
        name: 'app',
        routeCount: 73,
      },
      {
        authMode: 'admin',
        basePath: '/backend/v3/api',
        description: 'Backend governance, audit, release, deployment, and team-management routes.',
        name: 'backend',
        routeCount: 7,
      },
    ],
  },
  hostMode: 'server',
  moduleId: 'coding-server',
  openApiPath: '/openapi/coding-server-v1.json',
  surfaces: ['app', 'backend'],
});

const appRuntimeContract = getBirdCoderAppRuntimeApiContract();
assert.equal(appRuntimeContract.engines.method, 'GET');
assert.equal(appRuntimeContract.engines.path, '/app/v3/api/engines');
assert.equal(appRuntimeContract.engineCapabilities.path, '/app/v3/api/engines/:engineKey/capabilities');
assert.equal(appRuntimeContract.nativeSessionProviders.path, '/app/v3/api/native_session_providers');
assert.equal(appRuntimeContract.nativeSessions.path, '/app/v3/api/native_sessions');
assert.equal(appRuntimeContract.nativeSession.path, '/app/v3/api/native_sessions/:id');
assert.equal(appRuntimeContract.sessions.path, '/app/v3/api/coding_sessions');
assert.equal(appRuntimeContract.codingSession.path, '/app/v3/api/coding_sessions/:id');
assert.equal(appRuntimeContract.updateCodingSession.path, '/app/v3/api/coding_sessions/:id');
assert.equal(appRuntimeContract.deleteCodingSession.path, '/app/v3/api/coding_sessions/:id');
assert.equal(appRuntimeContract.editCodingSessionMessage.path, '/app/v3/api/coding_sessions/:id/messages/:messageId');
assert.equal(appRuntimeContract.deleteCodingSessionMessage.path, '/app/v3/api/coding_sessions/:id/messages/:messageId');
assert.equal(appRuntimeContract.forkCodingSession.path, '/app/v3/api/coding_sessions/:id/fork');
assert.equal(appRuntimeContract.sessionTurns.path, '/app/v3/api/coding_sessions/:id/turns');
assert.equal(appRuntimeContract.events.path, '/app/v3/api/coding_sessions/:id/events');
assert.equal(appRuntimeContract.sessionArtifacts.path, '/app/v3/api/coding_sessions/:id/artifacts');
assert.equal(appRuntimeContract.sessionCheckpoints.path, '/app/v3/api/coding_sessions/:id/checkpoints');
assert.equal(appRuntimeContract.approvals.path, '/app/v3/api/approvals/:approvalId/decision');
assert.equal(appRuntimeContract.questions.path, '/app/v3/api/questions/:questionId/answer');
assert.equal(appRuntimeContract.operations.path, '/app/v3/api/operations/:operationId');
assert.equal(appRuntimeContract.models.path, '/app/v3/api/models');
assert.equal(appRuntimeContract.modelConfig.path, '/app/v3/api/model_config');
assert.equal(appRuntimeContract.syncModelConfig.path, '/app/v3/api/model_config');
assert.equal(appRuntimeContract.routes.path, '/app/v3/api/system/routes');

const app = getBirdCoderAppApiContract();
assert.equal(app.authConfig.method, 'GET');
assert.equal(app.authConfig.path, '/app/v3/api/auth/config');
assert.equal(app.authSession.method, 'GET');
assert.equal(app.authSession.path, '/app/v3/api/auth/sessions/current');
assert.equal(app.login.method, 'POST');
assert.equal(app.login.path, '/app/v3/api/auth/sessions');
assert.equal(app.loginWithEmailCode.method, 'POST');
assert.equal(app.loginWithEmailCode.path, '/app/v3/api/auth/sessions');
assert.equal(app.loginWithPhoneCode.method, 'POST');
assert.equal(app.loginWithPhoneCode.path, '/app/v3/api/auth/sessions');
assert.equal(app.register.method, 'POST');
assert.equal(app.register.path, '/app/v3/api/auth/registrations');
assert.equal(app.sendVerifyCode.method, 'POST');
assert.equal(app.sendVerifyCode.path, '/app/v3/api/auth/verification_codes');
assert.equal(app.requestPasswordReset.method, 'POST');
assert.equal(app.requestPasswordReset.path, '/app/v3/api/auth/password_reset_requests');
assert.equal(app.resetPassword.method, 'POST');
assert.equal(app.resetPassword.path, '/app/v3/api/auth/password_resets');
assert.equal(app.logout.method, 'POST');
assert.equal(app.logout.path, '/app/v3/api/auth/sessions/current');
assert.equal(app.exchangeUserCenterSession.method, 'POST');
assert.equal(app.exchangeUserCenterSession.path, '/app/v3/api/auth/session_exchanges');
assert.equal(app.authOAuthUrl.method, 'GET');
assert.equal(app.authOAuthUrl.path, '/app/v3/api/auth/oauth_authorization_urls');
assert.equal(app.authOAuthLogin.method, 'POST');
assert.equal(app.authOAuthLogin.path, '/app/v3/api/auth/oauth_sessions');
assert.equal(app.getCurrentUserProfile.method, 'GET');
assert.equal(app.getCurrentUserProfile.path, '/app/v3/api/iam/users/current');
assert.equal(app.updateCurrentUserProfile.method, 'PATCH');
assert.equal(app.updateCurrentUserProfile.path, '/app/v3/api/iam/users/current');
assert.equal(app.getCurrentUserMembership.method, 'GET');
assert.equal(app.getCurrentUserMembership.path, '/app/v3/api/billing/vip/info');
assert.equal(app.updateCurrentUserMembership.method, 'PATCH');
assert.equal(app.updateCurrentUserMembership.path, '/app/v3/api/billing/vip/info');
assert.equal(app.createWorkspace.method, 'POST');
assert.equal(app.createWorkspace.path, '/app/v3/api/workspaces');
assert.equal(app.updateWorkspace.method, 'PATCH');
assert.equal(app.updateWorkspace.path, '/app/v3/api/workspaces/:workspaceId');
assert.equal(app.deleteWorkspace.method, 'DELETE');
assert.equal(app.deleteWorkspace.path, '/app/v3/api/workspaces/:workspaceId');
assert.equal(app.subscribeWorkspaceRealtime.method, 'GET');
assert.equal(app.subscribeWorkspaceRealtime.path, '/app/v3/api/workspaces/:workspaceId/realtime');
assert.equal(app.createProject.method, 'POST');
assert.equal(app.createProject.path, '/app/v3/api/projects');
assert.equal(app.updateProject.method, 'PATCH');
assert.equal(app.updateProject.path, '/app/v3/api/projects/:projectId');
assert.equal(app.deleteProject.method, 'DELETE');
assert.equal(app.deleteProject.path, '/app/v3/api/projects/:projectId');
assert.equal(app.projectGitOverview.method, 'GET');
assert.equal(app.projectGitOverview.path, '/app/v3/api/projects/:projectId/git/overview');
assert.equal(app.createProjectGitBranch.method, 'POST');
assert.equal(app.createProjectGitBranch.path, '/app/v3/api/projects/:projectId/git/branches');
assert.equal(app.switchProjectGitBranch.method, 'POST');
assert.equal(app.switchProjectGitBranch.path, '/app/v3/api/projects/:projectId/git/branch_switch');
assert.equal(app.commitProjectGitChanges.method, 'POST');
assert.equal(app.commitProjectGitChanges.path, '/app/v3/api/projects/:projectId/git/commits');
assert.equal(app.pushProjectGitBranch.method, 'POST');
assert.equal(app.pushProjectGitBranch.path, '/app/v3/api/projects/:projectId/git/pushes');
assert.equal(app.createProjectGitWorktree.method, 'POST');
assert.equal(app.createProjectGitWorktree.path, '/app/v3/api/projects/:projectId/git/worktrees');
assert.equal(app.removeProjectGitWorktree.method, 'POST');
assert.equal(
  app.removeProjectGitWorktree.path,
  '/app/v3/api/projects/:projectId/git/worktree_removals',
);
assert.equal(app.pruneProjectGitWorktrees.method, 'POST');
assert.equal(
  app.pruneProjectGitWorktrees.path,
  '/app/v3/api/projects/:projectId/git/worktree_prune',
);
assert.equal(app.publishProject.method, 'POST');
assert.equal(app.publishProject.path, '/app/v3/api/projects/:projectId/publish');
assert.equal(app.workspaces.path, '/app/v3/api/workspaces');
assert.equal(app.projects.path, '/app/v3/api/projects');
assert.equal(app.documents.path, '/app/v3/api/documents');
assert.equal(app.teams.path, '/app/v3/api/teams');
assert.equal(app.deployments.path, '/app/v3/api/deployments');

const admin = getBirdCoderAdminApiContract();
assert.equal(admin.audit.path, '/backend/v3/api/iam/audit_events');
assert.equal(admin.policies.path, '/backend/v3/api/iam/policies');
assert.equal(admin.teams.path, '/backend/v3/api/iam/teams');
assert.equal(admin.teamMembers.path, '/backend/v3/api/iam/teams/:teamId/members');
assert.equal(admin.deploymentTargets.path, '/backend/v3/api/projects/:projectId/deployment_targets');
assert.equal(admin.releases.path, '/backend/v3/api/releases');
assert.equal(admin.deployments.path, '/backend/v3/api/deployments');

const routes = listBirdCoderCodingServerRoutes();
assert.equal(routes.length, 80, 'coding-server should expose the full app/backend route matrix');
assert.equal(
  routes.every((route) => route.path.startsWith('/app/v3/api') || route.path.startsWith('/backend/v3/api')),
  true,
  'all coding-server routes must stay inside the unified app/backend prefixes',
);

const routeCatalog = listBirdCoderCodingServerRouteCatalogEntries();
const routeCatalogOperationIds = routeCatalog.map((route) => route.operationId);
assert.equal(routeCatalog.length, routes.length, 'route catalog must stay in lockstep with the unified route matrix');
assert.equal(
  routeCatalogOperationIds.includes('sessions.createWithEmailCode'),
  false,
  'email-code login must reuse POST /auth/sessions through sessions.create instead of publishing a duplicate OpenAPI operation.',
);
assert.equal(
  routeCatalogOperationIds.includes('sessions.createWithPhoneCode'),
  false,
  'phone-code login must reuse POST /auth/sessions through sessions.create instead of publishing a duplicate OpenAPI operation.',
);
for (const oldAppbasePath of [
  '/app/v3/api/auth/email_login',
  '/app/v3/api/auth/password_login',
  '/app/v3/api/auth/password_reset',
  '/app/v3/api/auth/phone_login',
  '/app/v3/api/auth/session',
  '/app/v3/api/auth/verify_send',
  '/app/v3/api/iam/user_profile',
  '/app/v3/api/billing/vip_info',
]) {
  assert.equal(
    routeCatalog.some((route) => route.openApiPath === oldAppbasePath),
    false,
    `${oldAppbasePath} must not be exposed because BirdCoder uses the canonical appbase IAM route set.`,
  );
}
assert.equal(
  routeCatalog.every(
    (route) =>
      route.openApiPath.startsWith('/app/v3/api') ||
      route.openApiPath.startsWith('/backend/v3/api'),
  ),
  true,
  'route catalog must emit normalized OpenAPI path templates',
);
assert.equal(
  routeCatalog.every((route) => !route.openApiPath.includes('/:')),
  true,
  'route catalog must not leak Express-style :param placeholders into OpenAPI templates',
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'routes.list'),
  {
    authMode: 'user',
    method: 'GET',
    openApiPath: '/app/v3/api/system/routes',
    operationId: 'routes.list',
    path: '/app/v3/api/system/routes',
    surface: 'app',
    summary: 'List unified API routes',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'nativeSessionProviders.list'),
  {
    authMode: 'user',
    method: 'GET',
    openApiPath: '/app/v3/api/native_session_providers',
    operationId: 'nativeSessionProviders.list',
    path: '/app/v3/api/native_session_providers',
    surface: 'app',
    summary: 'List registered native engine session providers',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'nativeSessions.list'),
  {
    authMode: 'user',
    method: 'GET',
    openApiPath: '/app/v3/api/native_sessions',
    operationId: 'nativeSessions.list',
    path: '/app/v3/api/native_sessions',
    surface: 'app',
    summary: 'List discovered native engine sessions',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'nativeSessions.retrieve'),
  {
    authMode: 'user',
    method: 'GET',
    openApiPath: '/app/v3/api/native_sessions/{id}',
    operationId: 'nativeSessions.retrieve',
    path: '/app/v3/api/native_sessions/:id',
    surface: 'app',
    summary: 'Get discovered native engine session detail',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'codingSessions.update'),
  {
    authMode: 'user',
    method: 'PATCH',
    openApiPath: '/app/v3/api/coding_sessions/{id}',
    operationId: 'codingSessions.update',
    path: '/app/v3/api/coding_sessions/:id',
    surface: 'app',
    summary: 'Update coding session',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'codingSessions.delete'),
  {
    authMode: 'user',
    method: 'DELETE',
    openApiPath: '/app/v3/api/coding_sessions/{id}',
    operationId: 'codingSessions.delete',
    path: '/app/v3/api/coding_sessions/:id',
    surface: 'app',
    summary: 'Delete coding session',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'codingSessions.messages.update'),
  {
    authMode: 'user',
    method: 'PATCH',
    openApiPath: '/app/v3/api/coding_sessions/{id}/messages/{messageId}',
    operationId: 'codingSessions.messages.update',
    path: '/app/v3/api/coding_sessions/:id/messages/:messageId',
    surface: 'app',
    summary: 'Edit coding session message',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'codingSessions.messages.delete'),
  {
    authMode: 'user',
    method: 'DELETE',
    openApiPath: '/app/v3/api/coding_sessions/{id}/messages/{messageId}',
    operationId: 'codingSessions.messages.delete',
    path: '/app/v3/api/coding_sessions/:id/messages/:messageId',
    surface: 'app',
    summary: 'Delete coding session message',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'codingSessions.forks.create'),
  {
    authMode: 'user',
    method: 'POST',
    openApiPath: '/app/v3/api/coding_sessions/{id}/fork',
    operationId: 'codingSessions.forks.create',
    path: '/app/v3/api/coding_sessions/:id/fork',
    surface: 'app',
    summary: 'Fork coding session',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'questions.answers.create'),
  {
    authMode: 'user',
    method: 'POST',
    openApiPath: '/app/v3/api/questions/{questionId}/answer',
    operationId: 'questions.answers.create',
    path: '/app/v3/api/questions/:questionId/answer',
    surface: 'app',
    summary: 'Submit user-question answer',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'sessions.create'),
  {
    authMode: 'user',
    method: 'POST',
    openApiPath: '/app/v3/api/auth/sessions',
    operationId: 'sessions.create',
    path: '/app/v3/api/auth/sessions',
    surface: 'app',
    summary: 'Create a login session with account and password credentials.',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'sessions.current.retrieve'),
  {
    authMode: 'user',
    method: 'GET',
    openApiPath: '/app/v3/api/auth/sessions/current',
    operationId: 'sessions.current.retrieve',
    path: '/app/v3/api/auth/sessions/current',
    surface: 'app',
    summary: 'Get the current login session snapshot for the active principal.',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'oauthAuthorizationUrls.retrieve'),
  {
    authMode: 'user',
    method: 'GET',
    openApiPath: '/app/v3/api/auth/oauth_authorization_urls',
    operationId: 'oauthAuthorizationUrls.retrieve',
    path: '/app/v3/api/auth/oauth_authorization_urls',
    surface: 'app',
    summary: 'Resolve OAuth authorization URL for social sign-in',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'users.current.retrieve'),
  {
    authMode: 'user',
    method: 'GET',
    openApiPath: '/app/v3/api/iam/users/current',
    operationId: 'users.current.retrieve',
    path: '/app/v3/api/iam/users/current',
    surface: 'app',
    summary: "Get the current user's canonical profile projection.",
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'vip.info.retrieve'),
  {
    authMode: 'user',
    method: 'GET',
    openApiPath: '/app/v3/api/billing/vip/info',
    operationId: 'vip.info.retrieve',
    path: '/app/v3/api/billing/vip/info',
    surface: 'app',
    summary: "Get the current user's VIP or membership projection.",
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'workspaces.realtime.subscribe'),
  {
    authMode: 'user',
    method: 'GET',
    openApiPath: '/app/v3/api/workspaces/{workspaceId}/realtime',
    operationId: 'workspaces.realtime.subscribe',
    path: '/app/v3/api/workspaces/:workspaceId/realtime',
    surface: 'app',
    summary: 'Subscribe to workspace realtime invalidation events',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'projects.git.overview.retrieve'),
  {
    authMode: 'user',
    method: 'GET',
    openApiPath: '/app/v3/api/projects/{projectId}/git/overview',
    operationId: 'projects.git.overview.retrieve',
    path: '/app/v3/api/projects/:projectId/git/overview',
    surface: 'app',
    summary: 'Get project Git overview',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'projects.git.branches.create'),
  {
    authMode: 'user',
    method: 'POST',
    openApiPath: '/app/v3/api/projects/{projectId}/git/branches',
    operationId: 'projects.git.branches.create',
    path: '/app/v3/api/projects/:projectId/git/branches',
    surface: 'app',
    summary: 'Create project Git branch',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'projects.git.branchSwitch.create'),
  {
    authMode: 'user',
    method: 'POST',
    openApiPath: '/app/v3/api/projects/{projectId}/git/branch_switch',
    operationId: 'projects.git.branchSwitch.create',
    path: '/app/v3/api/projects/:projectId/git/branch_switch',
    surface: 'app',
    summary: 'Switch project Git branch',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'projects.git.commits.create'),
  {
    authMode: 'user',
    method: 'POST',
    openApiPath: '/app/v3/api/projects/{projectId}/git/commits',
    operationId: 'projects.git.commits.create',
    path: '/app/v3/api/projects/:projectId/git/commits',
    surface: 'app',
    summary: 'Commit project Git changes',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'projects.git.pushes.create'),
  {
    authMode: 'user',
    method: 'POST',
    openApiPath: '/app/v3/api/projects/{projectId}/git/pushes',
    operationId: 'projects.git.pushes.create',
    path: '/app/v3/api/projects/:projectId/git/pushes',
    surface: 'app',
    summary: 'Push project Git branch',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'projects.git.worktrees.create'),
  {
    authMode: 'user',
    method: 'POST',
    openApiPath: '/app/v3/api/projects/{projectId}/git/worktrees',
    operationId: 'projects.git.worktrees.create',
    path: '/app/v3/api/projects/:projectId/git/worktrees',
    surface: 'app',
    summary: 'Create project Git worktree',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'projects.git.worktreeRemovals.create'),
  {
    authMode: 'user',
    method: 'POST',
    openApiPath: '/app/v3/api/projects/{projectId}/git/worktree_removals',
    operationId: 'projects.git.worktreeRemovals.create',
    path: '/app/v3/api/projects/:projectId/git/worktree_removals',
    surface: 'app',
    summary: 'Remove project Git worktree',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'projects.git.worktreePrune.create'),
  {
    authMode: 'user',
    method: 'POST',
    openApiPath: '/app/v3/api/projects/{projectId}/git/worktree_prune',
    operationId: 'projects.git.worktreePrune.create',
    path: '/app/v3/api/projects/:projectId/git/worktree_prune',
    surface: 'app',
    summary: 'Prune project Git worktrees',
  },
);

console.log('coding server route contract passed.');
