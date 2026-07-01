import type {
  ChatCanonicalEvent,
  ChatMessage,
  ChatOptions,
} from '@sdkwork/birdcoder-pc-projection';
import {
  buildDefaultBirdCoderCodeEngineModelConfig,
  createBirdCoderCodeEngineModelConfigSyncPlan,
  getBirdCoderCodeEngineCapabilities,
  getBirdCoderCodeEngineDescriptor,
  listBirdCoderCodeEngineNativeSessionProviders,
  listBirdCoderCodeEngineDescriptors,
  listBirdCoderCodeEngineModels,
} from '@sdkwork/birdcoder-pc-codeengine';
import { createWorkbenchServerSessionEngineBinding } from '@sdkwork/birdcoder-pc-codeengine/serverRuntime';
import {
  resolveTransportKindForRuntimeMode,
} from '@sdkwork/birdcoder-pc-projection';
import {
  BIRDCODER_DEFAULT_LOCAL_API_BASE_URL,
  BIRDCODER_DEFAULT_LOCAL_API_HOST,
  BIRDCODER_DEFAULT_LOCAL_API_PORT,
  createBirdHostDescriptorFromDistribution,
  type BirdHostDescriptor,
} from '@sdkwork/birdcoder-pc-host-core';
import {
  SDKWORK_IAM_HEADERS,
  SDKWORK_IAM_OPERATION_IDS,
} from '@sdkwork/iam-contracts';
import type {
  BirdCoderApiEnvelope,
  BirdCoderApiGatewaySummary,
  BirdCoderApiRouteCatalogEntry,
  BirdCoderApiRouteDefinition,
  BirdCoderBackendApiContract,
  BirdCoderApiSurface,
  BirdCoderAppApiContract,
  BirdCoderApprovalDecisionResult,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdCoderCodingServerDescriptor,
  BirdCoderCodeEngineModelConfig,
  BirdCoderCodeEngineModelConfigSyncResult,
  BirdCoderAppRuntimeApiContract,
  BirdCoderModelCatalogEntry,
  BirdCoderNativeSessionProviderSummary,
  BirdCoderOperationDescriptor,
  BirdCoderCodingSessionArtifact,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionRuntime,
  BirdCoderHostMode,
  BirdCoderUserQuestionAnswerResult,
} from '@sdkwork/birdcoder-pc-types';
import type {
  BirdCoderAppSdkApiClient,
  BirdCoderBackendSdkApiClient,
} from '@sdkwork/birdcoder-pc-infrastructure/services/sdkClients';
import { createBirdCoderServerRequestId } from './serverRequestId.ts';
import {
  BIRDCODER_CODING_SERVER_API_VERSION as BIRDCODER_CODING_SERVER_API_VERSION_VALUE,
  BIRDCODER_CODING_SESSION_ARTIFACT_KINDS,
  BIRDCODER_CODING_SESSION_EVENT_KINDS,
  BIRDCODER_CODING_SESSION_MESSAGE_ROLES,
  BIRDCODER_CODING_SESSION_RUNTIME_STATUSES,
  BIRDCODER_CODING_SESSION_STATUSES,
  BIRDCODER_DATA_SCOPES,
  BIRDCODER_ENGINE_INTEGRATION_CLASSES,
  BIRDCODER_ENGINE_RUNTIME_MODES,
  BIRDCODER_HOST_MODES,
  stringifyBirdCoderLongInteger,
} from '@sdkwork/birdcoder-pc-types';
import {
  BIRDCODER_CODING_SERVER_DOCS_PATH,
  BIRDCODER_CODING_SERVER_LIVE_OPENAPI_PATH,
  BIRDCODER_CODING_SERVER_OPENAPI_PATH,
  BIRDCODER_CODING_SERVER_ROUTE_CATALOG_PATH,
} from './serverConstants.ts';
import {
  createIamRoute,
  createRoute,
  getOperationIdForRoute,
  getSurfaceBasePath,
  getSurfaceDescription,
  toBirdCoderApiRouteDefinition,
  toOpenApiPathTemplate,
} from './serverRuntime.ts';

export function listBirdCoderCodingServerRouteCatalogEntries(): BirdCoderApiRouteCatalogEntry[] {
  return listBirdCoderCodingServerRoutes().map((route) => ({
    ...route,
    openApiPath: toOpenApiPathTemplate(route.path),
    operationId: getOperationIdForRoute(route),
  }));
}

export function buildBirdCoderApiGatewaySummary(): BirdCoderApiGatewaySummary {
  const routeCatalog = listBirdCoderCodingServerRouteCatalogEntries();
  const routesBySurface = routeCatalog.reduce<Record<BirdCoderApiSurface, number>>(
    (accumulator, route) => {
      accumulator[route.surface] += 1;
      return accumulator;
    },
    {
      app: 0,
      backend: 0,
    },
  );

  return {
    docsPath: BIRDCODER_CODING_SERVER_DOCS_PATH,
    liveOpenApiPath: BIRDCODER_CODING_SERVER_LIVE_OPENAPI_PATH,
    openApiPath: BIRDCODER_CODING_SERVER_OPENAPI_PATH,
    routeCatalogPath: BIRDCODER_CODING_SERVER_ROUTE_CATALOG_PATH,
    routeCount: routeCatalog.length,
    routesBySurface,
    surfaces: (['app', 'backend'] as const).map((surface) => ({
      authMode: surface === 'app' ? 'user' : 'admin',
      basePath: getSurfaceBasePath(surface),
      description: getSurfaceDescription(surface),
      name: surface,
      routeCount: routesBySurface[surface],
    })),
  };
}

export const APP_RUNTIME_API_CONTRACT: BirdCoderAppRuntimeApiContract = {
  codingSession: createRoute('app', 'user',
    'GET',
    '/app/v3/api/intelligence/coding_sessions/:sessionId',
    'Get coding session',
  ),
  codingSessions: createRoute('app', 'user',
    'GET',
    '/app/v3/api/intelligence/coding_sessions',
    'List coding sessions',
  ),
  descriptor: createRoute('app', 'user', 'GET', '/app/v3/api/system/descriptor', 'Get coding-server descriptor'),
  engineCapabilities: createRoute('app', 'user',
    'GET',
    '/app/v3/api/engines/:engineKey/capabilities',
    'Get runtime capabilities for one engine',
  ),
  engines: createRoute('app', 'user', 'GET', '/app/v3/api/engines', 'List available engines'),
  forkCodingSession: createRoute('app', 'user',
    'POST',
    '/app/v3/api/intelligence/coding_sessions/:sessionId/fork',
    'Fork coding session',
  ),
  nativeSession: createRoute('app', 'user',
    'GET',
    '/app/v3/api/native_sessions/:id',
    'Get discovered native engine session detail',
  ),
  nativeSessionProviders: createRoute('app', 'user',
    'GET',
    '/app/v3/api/native_session_providers',
    'List registered native engine session providers',
  ),
  nativeSessions: createRoute('app', 'user',
    'GET',
    '/app/v3/api/native_sessions',
    'List discovered native engine sessions',
  ),
  events: createRoute('app', 'user',
    'GET',
    '/app/v3/api/intelligence/coding_sessions/:sessionId/events',
    'Replay or subscribe to coding session events',
  ),
  health: createRoute('app', 'user', 'GET', '/app/v3/api/system/health', 'Get coding-server health'),
  modelConfig: createRoute('app', 'user',
    'GET',
    '/app/v3/api/model_config',
    'Get code engine model configuration',
  ),
  models: createRoute('app', 'user', 'GET', '/app/v3/api/models', 'List model catalog'),
  operations: createRoute('app', 'user',
    'GET',
    '/app/v3/api/operations/:operationId',
    'Get operation status',
  ),
  approvals: createRoute('app', 'user',
    'POST',
    '/app/v3/api/intelligence/coding_sessions/:sessionId/checkpoints/:checkpointId/approval',
    'Submit approval decision',
  ),
  questions: createRoute('app', 'user',
    'POST',
    '/app/v3/api/intelligence/coding_sessions/:sessionId/questions/:questionId/answer',
    'Submit user-question answer',
  ),
  routes: createRoute('app', 'user', 'GET', BIRDCODER_CODING_SERVER_ROUTE_CATALOG_PATH, 'List unified API routes'),
  runtime: createRoute('app', 'user', 'GET', '/app/v3/api/system/runtime', 'Get runtime metadata'),
  sessions: createRoute('app', 'user',
    'POST',
    '/app/v3/api/intelligence/coding_sessions',
    'Create coding session',
  ),
  sessionArtifacts: createRoute('app', 'user',
    'GET',
    '/app/v3/api/intelligence/coding_sessions/:sessionId/artifacts',
    'List coding session artifacts',
  ),
  sessionCheckpoints: createRoute('app', 'user',
    'GET',
    '/app/v3/api/intelligence/coding_sessions/:sessionId/checkpoints',
    'List coding session checkpoints',
  ),
  deleteCodingSession: createRoute('app', 'user',
    'DELETE',
    '/app/v3/api/intelligence/coding_sessions/:sessionId',
    'Delete coding session',
  ),
  sessionTurns: createRoute('app', 'user',
    'POST',
    '/app/v3/api/intelligence/coding_sessions/:sessionId/turns',
    'Create coding session turn',
  ),
  editCodingSessionMessage: createRoute('app', 'user',
    'PATCH',
    '/app/v3/api/intelligence/coding_sessions/:sessionId/messages/:messageId',
    'Edit coding session message',
  ),
  deleteCodingSessionMessage: createRoute('app', 'user',
    'DELETE',
    '/app/v3/api/intelligence/coding_sessions/:sessionId/messages/:messageId',
    'Delete coding session message',
  ),
  syncModelConfig: createRoute('app', 'user',
    'PUT',
    '/app/v3/api/model_config',
    'Sync code engine model configuration',
  ),
  updateCodingSession: createRoute('app', 'user',
    'PATCH',
    '/app/v3/api/intelligence/coding_sessions/:sessionId',
    'Update coding session',
  ),
};

export let birdCoderAppApiContract: BirdCoderAppApiContract | null = null;

export function getResolvedBirdCoderAppApiContract(): BirdCoderAppApiContract {
  birdCoderAppApiContract ??= {
    iamRuntime: createIamRoute('iam.runtime.retrieve', 'Get SDKWork IAM runtime metadata'),
    iamVerificationPolicy: createIamRoute(
      'iam.verificationPolicy.retrieve',
      'Get SDKWork IAM verification policy',
    ),
    authOAuthAuthorizationUrl: createIamRoute(
      'oauth.authorizationUrls.create',
      'Resolve OAuth authorization URL for SDKWork IAM sign-in',
    ),
    authOAuthSession: createIamRoute(
      'oauth.sessions.create',
      'Create SDKWork IAM session with OAuth authorization code',
    ),
    oauthDeviceAuthorization: createIamRoute(
      'oauth.deviceAuthorizations.create',
      'Create SDKWork IAM OAuth device authorization',
    ),
    oauthDeviceAuthorizationStatus: createIamRoute(
      'oauth.deviceAuthorizations.retrieve',
      'Get SDKWork IAM OAuth device authorization',
    ),
    oauthDeviceAuthorizationScan: createIamRoute(
      'oauth.deviceAuthorizations.scans.create',
      'Create SDKWork IAM OAuth device authorization scan',
    ),
    oauthDeviceAuthorizationPasswordCompletion: createIamRoute(
      'oauth.deviceAuthorizations.passwordCompletions.create',
      'Complete SDKWork IAM OAuth device authorization with password',
    ),
    oauthDeviceAuthorizationSessionExchange: createIamRoute(
      'oauth.deviceAuthorizations.sessionExchanges.create',
      'Exchange SDKWork IAM OAuth device authorization for a session',
    ),
    authPasswordResetRequest: createIamRoute(
      'passwordResetRequests.create',
      'Create SDKWork IAM password reset request',
    ),
    authPasswordReset: createIamRoute('passwordResets.create', 'Reset SDKWork IAM password'),
    authRegistration: createIamRoute('registrations.create', 'Register SDKWork IAM user'),
    authSession: createIamRoute('sessions.create', 'Create SDKWork IAM session'),
    authCurrentSession: createIamRoute('sessions.current.retrieve', 'Get current SDKWork IAM session'),
    authCurrentSessionUpdate: createIamRoute(
      'sessions.current.update',
      'Update current SDKWork IAM session',
    ),
    authCurrentSessionDelete: createIamRoute(
      'sessions.current.delete',
      'Delete current SDKWork IAM session',
    ),
    authSessionRefresh: createIamRoute('sessions.refresh', 'Refresh SDKWork IAM session'),
    currentIamUser: createIamRoute('users.current.retrieve', 'Get current SDKWork IAM user'),
    appTemplates: createRoute('app', 'user', 'GET', '/app/v3/api/app_templates', 'List app templates'),
    createProject: createRoute('app', 'user', 'POST', '/app/v3/api/projects', 'Create project'),
    createProjectCollaborator: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/projects/:projectId/collaborators',
      'Upsert project collaborator',
    ),
    createWorkspace: createRoute('app', 'user', 'POST', '/app/v3/api/workspaces', 'Create workspace'),
    createWorkspaceMember: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/workspaces/:workspaceId/members',
      'Upsert workspace member',
    ),
    deleteProject: createRoute(
      'app',
      'user',
      'DELETE',
      '/app/v3/api/projects/:projectId',
      'Delete project',
    ),
    deleteWorkspace: createRoute(
      'app',
      'user',
      'DELETE',
      '/app/v3/api/workspaces/:workspaceId',
      'Delete workspace',
    ),
    subscribeWorkspaceRealtime: createRoute(
      'app',
      'user',
      'GET',
      '/app/v3/api/workspaces/:workspaceId/realtime',
      'Subscribe to workspace realtime invalidation events',
    ),
    deployments: createRoute('app', 'user', 'GET', '/app/v3/api/deployments', 'List deployments'),
    projectDeploymentTargets: createRoute(
      'app',
      'user',
      'GET',
      '/app/v3/api/projects/:projectId/deployment_targets',
      'List project deployment targets',
    ),
    documents: createRoute('app', 'user', 'GET', '/app/v3/api/documents', 'List project documents'),
    chatConversations: createRoute(
      'app',
      'user',
      'GET',
      '/app/v3/api/chat/conversations',
      'List chat conversations',
    ),
    createChatConversation: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/chat/conversations',
      'Create chat conversation',
    ),
    chatConversation: createRoute(
      'app',
      'user',
      'GET',
      '/app/v3/api/chat/conversations/:conversationId',
      'Get chat conversation',
    ),
    deleteChatConversation: createRoute(
      'app',
      'user',
      'DELETE',
      '/app/v3/api/chat/conversations/:conversationId',
      'Delete chat conversation',
    ),
    chatMessages: createRoute(
      'app',
      'user',
      'GET',
      '/app/v3/api/chat/conversations/:conversationId/messages',
      'List chat messages',
    ),
    createChatMessage: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/chat/conversations/:conversationId/messages',
      'Create chat message',
    ),
    project: createRoute('app', 'user', 'GET', '/app/v3/api/projects/:projectId', 'Get project'),
    workspace: createRoute(
      'app',
      'user',
      'GET',
      '/app/v3/api/workspaces/:workspaceId',
      'Get workspace',
    ),
    projectGitOverview: createRoute(
      'app',
      'user',
      'GET',
      '/app/v3/api/projects/:projectId/git/overview',
      'Get project Git overview',
    ),
    createProjectGitBranch: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/projects/:projectId/git/branches',
      'Create project Git branch',
    ),
    switchProjectGitBranch: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/projects/:projectId/git/branch_switch',
      'Switch project Git branch',
    ),
    commitProjectGitChanges: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/projects/:projectId/git/commits',
      'Commit project Git changes',
    ),
    pushProjectGitBranch: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/projects/:projectId/git/pushes',
      'Push project Git branch',
    ),
    createProjectGitWorktree: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/projects/:projectId/git/worktrees',
      'Create project Git worktree',
    ),
    removeProjectGitWorktree: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/projects/:projectId/git/worktree_removals',
      'Remove project Git worktree',
    ),
    pruneProjectGitWorktrees: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/projects/:projectId/git/worktree_prune',
      'Prune project Git worktrees',
    ),
    installSkillPackage: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/skill_packages/:packageId/installations',
      'Install skill package for a scope',
    ),
    publishProject: createRoute(
      'app',
      'user',
      'POST',
      '/app/v3/api/projects/:projectId/publish',
      'Publish project release flow',
    ),
    projectCollaborators: createRoute(
      'app',
      'user',
      'GET',
      '/app/v3/api/projects/:projectId/collaborators',
      'List project collaborators',
    ),
    projects: createRoute('app', 'user', 'GET', '/app/v3/api/projects', 'List projects'),
    skillPackages: createRoute('app', 'user', 'GET', '/app/v3/api/skill_packages', 'List skill packages'),
    teams: createRoute('app', 'user', 'GET', '/app/v3/api/teams', 'List workspace teams'),
    updateProject: createRoute(
      'app',
      'user',
      'PATCH',
      '/app/v3/api/projects/:projectId',
      'Update project',
    ),
    updateWorkspace: createRoute(
      'app',
      'user',
      'PATCH',
      '/app/v3/api/workspaces/:workspaceId',
      'Update workspace',
    ),
    membershipCurrent: createRoute(
      'app',
      'user',
      'GET',
      '/app/v3/api/memberships/current',
      'Get current SDKWork commerce membership',
    ),
    membershipPackageGroups: createRoute(
      'app',
      'user',
      'GET',
      '/app/v3/api/memberships/package_groups',
      'List SDKWork commerce membership package groups',
    ),
    updateCurrentUserProfile: toBirdCoderApiRouteDefinition({
      authMode: 'user',
      method: 'PATCH',
      operationId: 'users.current.update',
      path: '/app/v3/api/iam/users/current',
      surface: 'app',
      summary: 'Update current SDKWork IAM user profile',
    }),
    workspaceMembers: createRoute(
      'app',
      'user',
      'GET',
      '/app/v3/api/workspaces/:workspaceId/members',
      'List workspace members',
    ),
    workspaces: createRoute('app', 'user', 'GET', '/app/v3/api/workspaces', 'List workspaces'),
  };
  return birdCoderAppApiContract;
}

export const BACKEND_API_CONTRACT: BirdCoderBackendApiContract = {
  iamApiKeys: createIamRoute('apiKeys.list', 'List SDKWork IAM API keys'),
  iamApiKeyRevoke: createIamRoute('apiKeys.revoke', 'Revoke SDKWork IAM API key'),
  iamAuditEvents: createIamRoute('auditEvents.list', 'List SDKWork IAM audit events'),
  iamOrganizations: createIamRoute('organizations.list', 'List SDKWork IAM organizations'),
  iamOrganization: createIamRoute('organizations.retrieve', 'Get SDKWork IAM organization'),
  createIamOrganization: createIamRoute('organizations.create', 'Create SDKWork IAM organization'),
  updateIamOrganization: createIamRoute('organizations.update', 'Update SDKWork IAM organization'),
  deleteIamOrganization: createIamRoute('organizations.delete', 'Delete SDKWork IAM organization'),
  iamOrganizationTree: createIamRoute(
    'organizations.tree.retrieve',
    'Get SDKWork IAM organization tree',
  ),
  iamOrganizationMemberships: createIamRoute(
    'organizationMemberships.list',
    'List SDKWork IAM organization memberships',
  ),
  createIamOrganizationMembership: createIamRoute(
    'organizationMemberships.create',
    'Create SDKWork IAM organization membership',
  ),
  updateIamOrganizationMembership: createIamRoute(
    'organizationMemberships.update',
    'Update SDKWork IAM organization membership',
  ),
  iamPermissions: createIamRoute('permissions.list', 'List SDKWork IAM permissions'),
  iamPermission: createIamRoute('permissions.retrieve', 'Get SDKWork IAM permission'),
  createIamPermission: createIamRoute('permissions.create', 'Create SDKWork IAM permission'),
  updateIamPermission: createIamRoute('permissions.update', 'Update SDKWork IAM permission'),
  deleteIamPermission: createIamRoute('permissions.delete', 'Delete SDKWork IAM permission'),
  iamPolicies: createIamRoute('policies.list', 'List SDKWork IAM policies'),
  iamPolicy: createIamRoute('policies.retrieve', 'Get SDKWork IAM policy'),
  createIamPolicy: createIamRoute('policies.create', 'Create SDKWork IAM policy'),
  updateIamPolicy: createIamRoute('policies.update', 'Update SDKWork IAM policy'),
  deleteIamPolicy: createIamRoute('policies.delete', 'Delete SDKWork IAM policy'),
  iamRoles: createIamRoute('roles.list', 'List SDKWork IAM roles'),
  iamRole: createIamRoute('roles.retrieve', 'Get SDKWork IAM role'),
  createIamRole: createIamRoute('roles.create', 'Create SDKWork IAM role'),
  updateIamRole: createIamRoute('roles.update', 'Update SDKWork IAM role'),
  deleteIamRole: createIamRoute('roles.delete', 'Delete SDKWork IAM role'),
  iamRolePermissions: createIamRoute('roles.permissions.list', 'List SDKWork IAM role permissions'),
  createIamRolePermission: createIamRoute(
    'roles.permissions.create',
    'Create SDKWork IAM role permission',
  ),
  deleteIamRolePermission: createIamRoute(
    'roles.permissions.delete',
    'Delete SDKWork IAM role permission',
  ),
  iamSecurityEvents: createIamRoute('securityEvents.list', 'List SDKWork IAM security events'),
  iamTenants: createIamRoute('tenants.list', 'List SDKWork IAM tenants'),
  iamTenant: createIamRoute('tenants.retrieve', 'Get SDKWork IAM tenant'),
  createIamTenant: createIamRoute('tenants.create', 'Create SDKWork IAM tenant'),
  updateIamTenant: createIamRoute('tenants.update', 'Update SDKWork IAM tenant'),
  deleteIamTenant: createIamRoute('tenants.delete', 'Delete SDKWork IAM tenant'),
  iamTenantMembers: createIamRoute('tenants.members.list', 'List SDKWork IAM tenant members'),
  createIamTenantMember: createIamRoute('tenants.members.create', 'Create SDKWork IAM tenant member'),
  updateIamTenantMember: createIamRoute('tenants.members.update', 'Update SDKWork IAM tenant member'),
  deleteIamTenantMember: createIamRoute('tenants.members.delete', 'Delete SDKWork IAM tenant member'),
  iamUsers: createIamRoute('users.list', 'List SDKWork IAM users'),
  iamUser: createIamRoute('users.retrieve', 'Get SDKWork IAM user'),
  createIamUser: createIamRoute('users.create', 'Create SDKWork IAM user'),
  updateIamUser: createIamRoute('users.update', 'Update SDKWork IAM user'),
  deleteIamUser: createIamRoute('users.delete', 'Delete SDKWork IAM user'),
  iamUserRoles: createIamRoute('roleBindings.list', 'List SDKWork IAM user role bindings'),
  createIamUserRole: createIamRoute('roleBindings.create', 'Create SDKWork IAM user role binding'),
  deleteIamUserRole: createIamRoute('roleBindings.delete', 'Delete SDKWork IAM user role binding'),
  audit: createRoute('backend', 'admin', 'GET', '/backend/v3/api/iam/audit_events', 'List audit events'),
  deployments: createRoute(
    'backend',
    'admin',
    'GET',
    '/backend/v3/api/deployments',
    'List governed deployments',
  ),
  deploymentTargets: createRoute(
    'backend',
    'admin',
    'GET',
    '/backend/v3/api/projects/:projectId/deployment_targets',
    'List deployment targets',
  ),
  policies: createRoute('backend', 'admin', 'GET', '/backend/v3/api/iam/policies', 'List governance policies'),
  releases: createRoute('backend', 'admin', 'GET', '/backend/v3/api/releases', 'List releases'),
  teamMembers: createRoute(
    'backend',
    'admin',
    'GET',
    '/backend/v3/api/iam/teams/:teamId/members',
    'List team members',
  ),
  teams: createRoute('backend', 'admin', 'GET', '/backend/v3/api/iam/teams', 'List teams'),
};

export const COMMERCE_API_CONTRACT: Record<string, BirdCoderApiRouteDefinition> = {
  commerceApiKeysCreate: toBirdCoderApiRouteDefinition({
    authMode: 'admin',
    method: 'POST',
    operationId: 'commerce.apiKeys.create',
    path: '/api/v1/api-keys',
    surface: 'app',
    summary: 'Create BirdCoder commerce API key',
  }),
  commerceApiKeysList: toBirdCoderApiRouteDefinition({
    authMode: 'admin',
    method: 'GET',
    operationId: 'commerce.apiKeys.list',
    path: '/api/v1/api-keys',
    surface: 'app',
    summary: 'List BirdCoder commerce API keys',
  }),
  commerceApiKeysRevoke: toBirdCoderApiRouteDefinition({
    authMode: 'admin',
    method: 'DELETE',
    operationId: 'commerce.apiKeys.revoke',
    path: '/api/v1/api-keys/:id',
    surface: 'app',
    summary: 'Revoke BirdCoder commerce API key',
  }),
  commerceApiKeysRotate: toBirdCoderApiRouteDefinition({
    authMode: 'admin',
    method: 'POST',
    operationId: 'commerce.apiKeys.rotate',
    path: '/api/v1/api-keys/:id/rotate',
    surface: 'app',
    summary: 'Rotate BirdCoder commerce API key',
  }),
  commerceNotificationsList: toBirdCoderApiRouteDefinition({
    authMode: 'admin',
    method: 'GET',
    operationId: 'commerce.notifications.list',
    path: '/api/v1/notifications',
    surface: 'app',
    summary: 'List BirdCoder commerce notifications',
  }),
  commerceNotificationsGet: toBirdCoderApiRouteDefinition({
    authMode: 'admin',
    method: 'GET',
    operationId: 'commerce.notifications.get',
    path: '/api/v1/notifications/:id',
    surface: 'app',
    summary: 'Get BirdCoder commerce notification',
  }),
  commerceNotificationsUnreadCount: toBirdCoderApiRouteDefinition({
    authMode: 'admin',
    method: 'GET',
    operationId: 'commerce.notifications.unreadCount',
    path: '/api/v1/notifications/unread-count',
    surface: 'app',
    summary: 'Get BirdCoder commerce unread notification count',
  }),
  commerceNotificationsSend: toBirdCoderApiRouteDefinition({
    authMode: 'admin',
    method: 'POST',
    operationId: 'commerce.notifications.send',
    path: '/api/v1/notifications',
    surface: 'app',
    summary: 'Send BirdCoder commerce notification',
  }),
  commerceNotificationsMarkRead: toBirdCoderApiRouteDefinition({
    authMode: 'admin',
    method: 'POST',
    operationId: 'commerce.notifications.markRead',
    path: '/api/v1/notifications/:id/read',
    surface: 'app',
    summary: 'Mark BirdCoder commerce notification as read',
  }),
  commerceNotificationsMarkAllRead: toBirdCoderApiRouteDefinition({
    authMode: 'admin',
    method: 'POST',
    operationId: 'commerce.notifications.markAllRead',
    path: '/api/v1/notifications/read-all',
    surface: 'app',
    summary: 'Mark all BirdCoder commerce notifications as read',
  }),
  commerceUsageRecord: toBirdCoderApiRouteDefinition({
    authMode: 'admin',
    method: 'POST',
    operationId: 'commerce.usage.record',
    path: '/api/v1/usage/record',
    surface: 'app',
    summary: 'Record BirdCoder commerce usage event',
  }),
  commerceUsageCurrentPeriod: toBirdCoderApiRouteDefinition({
    authMode: 'admin',
    method: 'GET',
    operationId: 'commerce.usage.currentPeriod',
    path: '/api/v1/usage/current-period',
    surface: 'app',
    summary: 'Get BirdCoder commerce usage for current period',
  }),
  commerceUsageHistory: toBirdCoderApiRouteDefinition({
    authMode: 'admin',
    method: 'GET',
    operationId: 'commerce.usage.history',
    path: '/api/v1/usage/history',
    surface: 'app',
    summary: 'List BirdCoder commerce usage history',
  }),
  commerceUsageBreakdown: toBirdCoderApiRouteDefinition({
    authMode: 'admin',
    method: 'GET',
    operationId: 'commerce.usage.breakdown',
    path: '/api/v1/usage/breakdown',
    surface: 'app',
    summary: 'Get BirdCoder commerce usage breakdown',
  }),
  commerceUsageQuota: toBirdCoderApiRouteDefinition({
    authMode: 'admin',
    method: 'GET',
    operationId: 'commerce.usage.quota',
    path: '/api/v1/usage/quota',
    surface: 'app',
    summary: 'Get BirdCoder commerce usage quota',
  }),
};

export function getBirdCoderCommerceApiContract(): Record<string, BirdCoderApiRouteDefinition> {
  return COMMERCE_API_CONTRACT;
}

export function getBirdCoderAppRuntimeApiContract(): BirdCoderAppRuntimeApiContract {
  return APP_RUNTIME_API_CONTRACT;
}

export function getBirdCoderAppApiContract(): BirdCoderAppApiContract {
  return getResolvedBirdCoderAppApiContract();
}

export function getBirdCoderBackendApiContract(): BirdCoderBackendApiContract {
  return BACKEND_API_CONTRACT;
}

export function listBirdCoderCodingServerRoutes(): BirdCoderApiRouteDefinition[] {
  const routes = [
    ...Object.values(APP_RUNTIME_API_CONTRACT),
    ...Object.values(getResolvedBirdCoderAppApiContract()),
    ...Object.values(BACKEND_API_CONTRACT),
    ...Object.values(COMMERCE_API_CONTRACT),
  ];
  const routesByMethodAndPath = new Map<string, BirdCoderApiRouteDefinition>();

  for (const route of routes) {
    const routeKey = `${route.method} ${route.path}`;
    if (!routesByMethodAndPath.has(routeKey)) {
      routesByMethodAndPath.set(routeKey, route);
    }
  }

  return [...routesByMethodAndPath.values()];
}
