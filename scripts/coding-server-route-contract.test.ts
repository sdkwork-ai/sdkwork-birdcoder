import assert from 'node:assert/strict';

import {
  getBirdCoderBackendApiContract,
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
    routeCount: 129,
    routesBySurface: {
      app: 80,
      backend: 49,
    },
    surfaces: [
      {
        authMode: 'user',
        basePath: '/app/v3/api',
        description: 'Application-facing coding runtime, workspace, project, collaboration, and IAM routes.',
        name: 'app',
        routeCount: 80,
      },
      {
        authMode: 'admin',
        basePath: '/backend/v3/api',
        description: 'Backend governance, audit, release, deployment, and team-management routes.',
        name: 'backend',
        routeCount: 49,
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
assert.equal(app.iamRuntime.method, 'GET');
assert.equal(app.iamRuntime.path, '/app/v3/api/system/iam/runtime');
assert.equal(app.iamVerificationPolicy.method, 'GET');
assert.equal(app.iamVerificationPolicy.path, '/app/v3/api/system/iam/verification_policy');
assert.equal(app.authSession.method, 'POST');
assert.equal(app.authSession.path, '/app/v3/api/auth/sessions');
assert.equal(app.authCurrentSession.method, 'GET');
assert.equal(app.authCurrentSession.path, '/app/v3/api/auth/sessions/current');
assert.equal(app.authCurrentSessionUpdate.method, 'PATCH');
assert.equal(app.authCurrentSessionUpdate.path, '/app/v3/api/auth/sessions/current');
assert.equal(app.authCurrentSessionDelete.method, 'DELETE');
assert.equal(app.authCurrentSessionDelete.path, '/app/v3/api/auth/sessions/current');
assert.equal(app.authSessionRefresh.method, 'POST');
assert.equal(app.authSessionRefresh.path, '/app/v3/api/auth/sessions/refresh');
assert.equal(app.authRegistration.method, 'POST');
assert.equal(app.authRegistration.path, '/app/v3/api/auth/registrations');
assert.equal(
  'authVerificationCode' in app,
  false,
  'BirdCoder app API must not publish messaging-owned verification-code delivery routes.',
);
assert.equal(
  'authVerificationCodeVerify' in app,
  false,
  'BirdCoder app API must not publish messaging-owned verification-code verify routes.',
);
assert.equal(app.authPasswordResetRequest.method, 'POST');
assert.equal(app.authPasswordResetRequest.path, '/app/v3/api/auth/password_reset_requests');
assert.equal(app.authPasswordReset.method, 'POST');
assert.equal(app.authPasswordReset.path, '/app/v3/api/auth/password_resets');
assert.equal(app.authOAuthAuthorizationUrl.method, 'GET');
assert.equal(app.authOAuthAuthorizationUrl.path, '/app/v3/api/auth/oauth_authorization_urls');
assert.equal(app.authOAuthSession.method, 'POST');
assert.equal(app.authOAuthSession.path, '/app/v3/api/auth/oauth_sessions');
assert.equal(app.qrAuthSession.method, 'POST');
assert.equal(app.qrAuthSession.path, '/app/v3/api/open_platform/qr_auth/sessions');
assert.equal(app.qrAuthSessionStatus.method, 'GET');
assert.equal(app.qrAuthSessionStatus.path, '/app/v3/api/open_platform/qr_auth/sessions/:sessionKey');
assert.equal(app.qrAuthSessionScan.method, 'POST');
assert.equal(app.qrAuthSessionScan.path, '/app/v3/api/open_platform/qr_auth/sessions/:sessionKey/scans');
assert.equal(app.qrAuthSessionPassword.method, 'POST');
assert.equal(app.qrAuthSessionPassword.path, '/app/v3/api/open_platform/qr_auth/sessions/:sessionKey/passwords');
assert.equal(app.currentIamUser.method, 'GET');
assert.equal(app.currentIamUser.path, '/app/v3/api/iam/users/current');
assert.equal(app.updateCurrentUserProfile.method, 'PATCH');
assert.equal(app.updateCurrentUserProfile.path, '/app/v3/api/iam/users/current');
assert.equal(app.membershipCurrent.method, 'GET');
assert.equal(app.membershipCurrent.path, '/app/v3/api/memberships/current');
assert.equal(app.membershipPackageGroups.method, 'GET');
assert.equal(app.membershipPackageGroups.path, '/app/v3/api/memberships/package_groups');
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

const admin = getBirdCoderBackendApiContract();
assert.equal(admin.audit.path, '/backend/v3/api/iam/audit_events');
assert.equal(admin.policies.path, '/backend/v3/api/iam/policies');
assert.equal(admin.iamUsers.path, '/backend/v3/api/iam/users');
assert.equal(admin.iamUser.path, '/backend/v3/api/iam/users/:userId');
assert.equal(admin.createIamUser.path, '/backend/v3/api/iam/users');
assert.equal(admin.updateIamUser.path, '/backend/v3/api/iam/users/:userId');
assert.equal(admin.deleteIamUser.path, '/backend/v3/api/iam/users/:userId');
assert.equal(admin.iamUserRoles.path, '/app/v3/api/iam/role_bindings');
assert.equal(admin.createIamUserRole.path, '/backend/v3/api/iam/role_bindings');
assert.equal(admin.deleteIamUserRole.path, '/backend/v3/api/iam/role_bindings/:roleBindingId');
assert.equal(admin.teams.path, '/backend/v3/api/iam/teams');
assert.equal(admin.teamMembers.path, '/backend/v3/api/iam/teams/:teamId/members');
assert.equal(admin.deploymentTargets.path, '/backend/v3/api/projects/:projectId/deployment_targets');
assert.equal(admin.releases.path, '/backend/v3/api/releases');
assert.equal(admin.deployments.path, '/backend/v3/api/deployments');

const routes = listBirdCoderCodingServerRoutes();
assert.equal(routes.length, 129, 'coding-server should expose the full app/backend route matrix');
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
  '/app/v3/api/auth/config',
  '/app/v3/api/auth/session',
  '/app/v3/api/auth/session_exchanges',
  '/app/v3/api/auth/qr_login_codes',
  '/app/v3/api/auth/qr_login_codes/{qrKey}',
  '/app/v3/api/auth/qr_login_codes/{qrKey}/entry',
  '/app/v3/api/auth/qr_login_codes/{qrKey}/callback',
  '/app/v3/api/auth/qr_login_codes/confirm',
  '/app/v3/api/auth/verify_send',
  '/app/v3/api/iam/user_profile',
  '/app/v3/api/billing/vip_info',
  '/app/v3/api/billing/vip/info',
]) {
  assert.equal(
    routeCatalog.some((route) => route.openApiPath === oldAppbasePath),
    false,
    `${oldAppbasePath} must not be exposed because BirdCoder uses the canonical SDKWork IAM and commerce route set.`,
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
  routeCatalog.find((route) => route.operationId === 'iam.runtime.retrieve'),
  {
    authMode: 'user',
    method: 'GET',
    openApiPath: '/app/v3/api/system/iam/runtime',
    operationId: 'iam.runtime.retrieve',
    path: '/app/v3/api/system/iam/runtime',
    surface: 'app',
    summary: 'Get SDKWork IAM runtime metadata',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'iam.verificationPolicy.retrieve'),
  {
    authMode: 'user',
    method: 'GET',
    openApiPath: '/app/v3/api/system/iam/verification_policy',
    operationId: 'iam.verificationPolicy.retrieve',
    path: '/app/v3/api/system/iam/verification_policy',
    surface: 'app',
    summary: 'Get SDKWork IAM verification policy',
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
    summary: 'Create SDKWork IAM session',
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
    summary: 'Get current SDKWork IAM session',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'sessions.current.delete'),
  {
    authMode: 'user',
    method: 'DELETE',
    openApiPath: '/app/v3/api/auth/sessions/current',
    operationId: 'sessions.current.delete',
    path: '/app/v3/api/auth/sessions/current',
    surface: 'app',
    summary: 'Delete current SDKWork IAM session',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'sessions.refresh'),
  {
    authMode: 'user',
    method: 'POST',
    openApiPath: '/app/v3/api/auth/sessions/refresh',
    operationId: 'sessions.refresh',
    path: '/app/v3/api/auth/sessions/refresh',
    surface: 'app',
    summary: 'Refresh SDKWork IAM session',
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
    summary: 'Resolve OAuth authorization URL for SDKWork IAM sign-in',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'qrAuth.sessions.create'),
  {
    authMode: 'user',
    method: 'POST',
    openApiPath: '/app/v3/api/open_platform/qr_auth/sessions',
    operationId: 'qrAuth.sessions.create',
    path: '/app/v3/api/open_platform/qr_auth/sessions',
    surface: 'app',
    summary: 'Create SDKWork IAM QR auth session',
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
    summary: 'Get current SDKWork IAM user',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'memberships.current.retrieve'),
  {
    authMode: 'user',
    method: 'GET',
    openApiPath: '/app/v3/api/memberships/current',
    operationId: 'memberships.current.retrieve',
    path: '/app/v3/api/memberships/current',
    surface: 'app',
    summary: 'Get current SDKWork commerce membership',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'memberships.packageGroups.list'),
  {
    authMode: 'user',
    method: 'GET',
    openApiPath: '/app/v3/api/memberships/package_groups',
    operationId: 'memberships.packageGroups.list',
    path: '/app/v3/api/memberships/package_groups',
    surface: 'app',
    summary: 'List SDKWork commerce membership package groups',
  },
);
assert.equal(
  routeCatalog.some((route) => route.operationId === 'vip.info.retrieve' || route.operationId === 'vip.info.update'),
  false,
  'BirdCoder must not publish retired billing.vip route aliases; membership belongs to SDKWork commerce.',
);
assert.deepEqual(
  routeCatalog.filter((route) =>
    route.openApiPath.startsWith('/backend/v3/api/iam/users')
    || route.openApiPath.startsWith('/app/v3/api/iam/role_bindings')
    || route.openApiPath.startsWith('/backend/v3/api/iam/role_bindings'),
  ),
  [
    {
      authMode: 'admin',
      method: 'GET',
      openApiPath: '/backend/v3/api/iam/users',
      operationId: 'users.list',
      path: '/backend/v3/api/iam/users',
      surface: 'backend',
      summary: 'List SDKWork IAM users',
    },
    {
      authMode: 'admin',
      method: 'GET',
      openApiPath: '/backend/v3/api/iam/users/{userId}',
      operationId: 'users.retrieve',
      path: '/backend/v3/api/iam/users/:userId',
      surface: 'backend',
      summary: 'Get SDKWork IAM user',
    },
    {
      authMode: 'admin',
      method: 'POST',
      openApiPath: '/backend/v3/api/iam/users',
      operationId: 'users.create',
      path: '/backend/v3/api/iam/users',
      surface: 'backend',
      summary: 'Create SDKWork IAM user',
    },
    {
      authMode: 'admin',
      method: 'PATCH',
      openApiPath: '/backend/v3/api/iam/users/{userId}',
      operationId: 'users.update',
      path: '/backend/v3/api/iam/users/:userId',
      surface: 'backend',
      summary: 'Update SDKWork IAM user',
    },
    {
      authMode: 'admin',
      method: 'DELETE',
      openApiPath: '/backend/v3/api/iam/users/{userId}',
      operationId: 'users.delete',
      path: '/backend/v3/api/iam/users/:userId',
      surface: 'backend',
      summary: 'Delete SDKWork IAM user',
    },
    {
      authMode: 'user',
      method: 'GET',
      openApiPath: '/app/v3/api/iam/role_bindings',
      operationId: 'roleBindings.list',
      path: '/app/v3/api/iam/role_bindings',
      surface: 'app',
      summary: 'List SDKWork IAM user role bindings',
    },
    {
      authMode: 'admin',
      method: 'POST',
      openApiPath: '/backend/v3/api/iam/role_bindings',
      operationId: 'roleBindings.create',
      path: '/backend/v3/api/iam/role_bindings',
      surface: 'backend',
      summary: 'Create SDKWork IAM user role binding',
    },
    {
      authMode: 'admin',
      method: 'DELETE',
      openApiPath: '/backend/v3/api/iam/role_bindings/{roleBindingId}',
      operationId: 'roleBindings.delete',
      path: '/backend/v3/api/iam/role_bindings/:roleBindingId',
      surface: 'backend',
      summary: 'Delete SDKWork IAM user role binding',
    },
  ],
  'backend route catalog must expose the standard IAM users and role binding resource surface.',
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
