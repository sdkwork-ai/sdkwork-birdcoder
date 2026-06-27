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
import type { BirdServerDistributionId } from './serverConstants.ts';
import type {
  BirdCoderOpenApiDomain,
  BirdCoderOpenApiGovernanceMetadata,
} from './openApiDocumentTypes.ts';

export interface BirdServerRuntime extends BirdHostDescriptor {
  host: string;
  port: number;
  configFileName: string;
}

export interface BindBirdCoderServerRuntimeTransportOptions {
  apiBaseUrl?: string;
  appClient?: BirdCoderAppSdkApiClient;
  backendClient?: BirdCoderBackendSdkApiClient;
  distributionId?: BirdServerDistributionId;
  host?: BirdServerRuntime;
}

export interface BirdCoderCoreSessionProjectionState {
  runtime: BirdCoderCodingSessionRuntime | null;
  events: BirdCoderCodingSessionEvent[];
  artifacts: BirdCoderCodingSessionArtifact[];
  operationsById: Map<string, BirdCoderOperationDescriptor>;
}

export interface BirdCoderInfrastructureRuntimeModule {
  bindDefaultBirdCoderIdeServicesRuntime(options: {
    apiBaseUrl?: string;
    appClient?: BirdCoderAppSdkApiClient;
    backendClient?: BirdCoderBackendSdkApiClient;
    host?: BirdHostDescriptor;
  }): void;
}

export let birdCoderInfrastructureRuntimeModulePromise:
  | Promise<BirdCoderInfrastructureRuntimeModule>
  | null = null;

export function createRoute(
  surface: BirdCoderApiSurface,
  authMode: BirdCoderApiRouteDefinition['authMode'],
  method: BirdCoderApiRouteDefinition['method'],
  path: string,
  summary: string,
): BirdCoderApiRouteDefinition {
  return {
    authMode,
    method,
    path,
    surface,
    summary,
  };
}

export function toBirdCoderRoutePath(path: string): string {
  return path.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/gu, ':$1');
}

export function getSdkworkIamOperation(operationId: string): (typeof SDKWORK_IAM_OPERATION_IDS)[string] {
  const operation = SDKWORK_IAM_OPERATION_IDS[operationId];
  if (!operation) {
    throw new Error(`Unknown SDKWork IAM operation id: ${operationId}`);
  }
  return operation;
}

export function createIamRoute(
  operationId: string,
  summary: string,
): BirdCoderApiRouteDefinition {
  const operation = getSdkworkIamOperation(operationId);
  const surface: BirdCoderApiSurface = operation.path.startsWith('/backend/v3/api/')
    ? 'backend'
    : 'app';
  return toBirdCoderApiRouteDefinition({
    authMode: surface === 'backend' ? 'admin' : 'user',
    method: operation.method,
    operationId: operation.operationId,
    path: toBirdCoderRoutePath(operation.path),
    surface,
    summary,
  });
}

export function toBirdCoderApiRouteDefinition(
  route: Pick<
    BirdCoderApiRouteDefinition,
    'authMode' | 'method' | 'operationId' | 'path' | 'summary' | 'surface'
  >,
): BirdCoderApiRouteDefinition {
  return {
    authMode: route.authMode,
    method: route.method,
    operationId: route.operationId,
    path: route.path,
    surface: route.surface,
    summary: route.summary,
  };
}

export async function loadBirdCoderInfrastructureRuntimeModule(): Promise<BirdCoderInfrastructureRuntimeModule> {
  if (!birdCoderInfrastructureRuntimeModulePromise) {
    birdCoderInfrastructureRuntimeModulePromise = import(
      '@sdkwork/birdcoder-infrastructure'
    ).then(({ bindDefaultBirdCoderIdeServicesRuntime }) => ({
      bindDefaultBirdCoderIdeServicesRuntime,
    }));
  }

  return birdCoderInfrastructureRuntimeModulePromise;
}

export function getSurfaceDescription(surface: BirdCoderApiSurface): string {
  switch (surface) {
    case 'app':
      return 'Application-facing coding runtime, workspace, project, collaboration, and IAM routes.';
    case 'backend':
      return 'Backend governance, audit, release, deployment, and team-management routes.';
    default:
      return 'Unified BirdCoder API surface.';
  }
}

export function getOpenApiTagDescription(tag: string): string {
  switch (tag) {
    case 'audit':
      return 'Audit and operational evidence resources.';
    case 'auth':
      return 'SDKWork IAM authentication and session resources.';
    case 'commerce':
      return 'Commerce membership, package catalog, entitlement, order, and payment resources.';
    case 'collaboration':
      return 'Workspace collaboration and team catalog resources.';
    case 'content':
      return 'Project document and content resources.';
    case 'iam':
      return 'IAM user, tenant, organization, role, permission, policy, and audit resources.';
    case 'intelligence':
      return 'Coding session, checkpoint, approval, and question resources.';
    case 'platform':
      return 'Workspace, project, release, deployment, and delivery resources.';
    case 'runtime':
      return 'Runtime engine, model, native session, and local operation resources.';
    case 'skills':
      return 'Skill package catalog and installation resources.';
    case 'system':
      return 'System descriptor, health, route catalog, and runtime metadata resources.';
    case 'templates':
      return 'Application template catalog resources.';
    default:
      return `${tag} resources.`;
  }
}

export function getOpenApiTagForOperationId(operationId: string): string {
  const normalizedOperationId = operationId.trim();
  if (/^oauth\./u.test(normalizedOperationId)) {
    return 'oauth';
  }
  if (
    /^(?:sessions|registrations|passwordResetRequests|passwordResets)\./u.test(
      normalizedOperationId,
    )
  ) {
    return 'auth';
  }
  if (/^iam\./u.test(normalizedOperationId)) {
    return 'system';
  }
  if (/^qrAuth\./u.test(normalizedOperationId)) {
    return 'openPlatform';
  }
  if (/^memberships\./u.test(normalizedOperationId)) {
    return 'commerce';
  }
  if (
    /^(?:codingSessions)\b/u.test(
      normalizedOperationId,
    )
  ) {
    return 'intelligence';
  }
  if (/^documents\./u.test(normalizedOperationId)) {
    return 'content';
  }
  if (/^workspaceTeams\./u.test(normalizedOperationId)) {
    return 'collaboration';
  }
  if (
    /^(?:apiKeys|auditEvents|organizationMemberships|organizations|permissions|policies|roleBindings|roles|securityEvents|tenants|users|teams|workspaces\.members)\./u.test(
      normalizedOperationId,
    )
  ) {
    return 'iam';
  }
  if (/^(?:workspaces|projects|deployments|releases|deploymentGovernance)\./u.test(normalizedOperationId)) {
    return 'platform';
  }
  if (/^(?:engines|nativeSessionProviders|nativeSessions|models|modelConfig)\./u.test(normalizedOperationId)) {
    return 'runtime';
  }
  if (/^skillPackages\./u.test(normalizedOperationId)) {
    return 'skills';
  }
  if (/^appTemplates\./u.test(normalizedOperationId)) {
    return 'templates';
  }
  return 'system';
}

export function toOpenApiPathTemplate(path: string): string {
  const normalizedPath = path.trim();
  if (!normalizedPath.startsWith('/')) {
    return normalizedPath;
  }

  return normalizedPath
    .split('/')
    .map((segment) => {
      if (!segment.startsWith(':')) {
        return segment;
      }

      const parameterName = segment.slice(1).trim();
      return parameterName ? `{${parameterName}}` : segment;
    })
    .join('/');
}

export function getSurfaceBasePath(surface: BirdCoderApiSurface): string {
  switch (surface) {
    case 'app':
      return '/app/v3/api';
    case 'backend':
      return '/backend/v3/api';
  }
  throw new Error(`Unexpected BirdCoder API surface: ${String(surface)}`);
}

export function buildOpenApiOperationDescription(route: BirdCoderApiRouteDefinition): string {
  const authDescription =
    route.authMode === 'host'
      ? 'No user session is required; this route is available on the host runtime surface.'
      : route.authMode === 'user'
        ? 'Requires an authenticated BirdCoder user session.'
        : 'Requires an authenticated BirdCoder admin session.';

  return `${route.summary}. ${authDescription}`;
}

export function buildOpenApiOperationSecurity(
  route: BirdCoderApiRouteDefinition,
  operationId: string,
): Array<{ bearerAuth: []; sdkworkAccessToken: [] }> | [] {
  return isPublicOpenApiOperation(route, operationId)
    ? []
    : [{ bearerAuth: [], sdkworkAccessToken: [] }];
}

export function isPublicOpenApiOperation(
  route: BirdCoderApiRouteDefinition,
  operationId: string,
): boolean {
  if (route.authMode === 'host') {
    return true;
  }

  const sdkworkIamOperation = SDKWORK_IAM_OPERATION_IDS[operationId];
  if (sdkworkIamOperation) {
    return sdkworkIamOperation.security !== 'dualToken';
  }

  return /^(?:oauth\.(?:authorizationUrls\.create|sessions\.create|deviceAuthorizations\.(?:create|retrieve|scans\.create|passwordCompletions\.create|sessionExchanges\.create))|registrations\.create|sessions\.(?:create|refresh)|passwordResetRequests\.create|passwordResets\.create|iam\.(?:runtime|verificationPolicy)\.retrieve)$/u.test(
    operationId,
  );
}

export function getOpenApiDomainForOperationId(operationId: string): BirdCoderOpenApiDomain {
  if (/^iam\.(?:runtime|verificationPolicy)\.retrieve$/u.test(operationId)) {
    return 'iam';
  }

  const tag = getOpenApiTagForOperationId(operationId);
  switch (tag) {
    case 'auth':
    case 'iam':
    case 'audit':
    case 'openPlatform':
      return 'iam';
    case 'commerce':
      return 'commerce';
    case 'collaboration':
      return 'collaboration';
    case 'content':
      return 'content';
    case 'intelligence':
      return 'intelligence';
    case 'platform':
      return 'platform';
    case 'runtime':
      return 'runtime';
    case 'skills':
      return 'ecosystem';
    case 'system':
      return 'system';
    case 'templates':
      return 'ecosystem';
    default:
      return 'system';
  }
}

export function getOpenApiResourceForOperationId(
  operationId: string,
  domain: BirdCoderOpenApiDomain,
): string {
  const operationParts = operationId.split('.').filter(Boolean);
  const resourceParts = operationParts.slice(0, -1);
  const normalizedResource =
    resourceParts.length > 0 ? resourceParts.join('.') : operationParts[0] ?? 'operations';

  return normalizedResource.startsWith(`${domain}.`)
    ? normalizedResource
    : `${domain}.${normalizedResource}`;
}

export function getOpenApiActionForOperation(
  route: BirdCoderApiRouteDefinition,
  operationId: string,
): 'create' | 'delete' | 'execute' | 'read' | 'subscribe' | 'update' | 'write' {
  const lastOperationIdSegment = operationId.split('.').at(-1) ?? '';
  switch (lastOperationIdSegment) {
    case 'create':
      return 'create';
    case 'delete':
      return 'delete';
    case 'retrieve':
    case 'list':
      return 'read';
    case 'subscribe':
      return 'subscribe';
    case 'sync':
    case 'update':
      return 'update';
  }

  switch (route.method) {
    case 'GET':
      return 'read';
    case 'DELETE':
      return 'delete';
    case 'PATCH':
    case 'PUT':
      return 'update';
    case 'POST':
      return 'create';
    default:
      return 'execute';
  }
}

export function getOpenApiScopeMetadata(
  route: BirdCoderApiRouteDefinition,
  operationId: string,
): Pick<BirdCoderOpenApiGovernanceMetadata, 'dataScope' | 'tenantScope'> {
  if (isPublicOpenApiOperation(route, operationId)) {
    return {
      dataScope: 'platform',
      tenantScope: 'platform',
    };
  }

  if (/^(?:sessions\.current|users\.current|memberships\.current|memberships\.packageGroups)/u.test(operationId)) {
    return {
      dataScope: 'user',
      tenantScope: 'tenant',
    };
  }

  if (
    /^(?:codingSessions|operations|nativeSessions)/u.test(
      operationId,
    )
  ) {
    return {
      dataScope: 'user',
      tenantScope: 'tenant',
    };
  }

  if (/^(?:descriptor|health|runtime|routes|engines|models|modelConfig|nativeSessionProviders)/u.test(operationId)) {
    return {
      dataScope: 'platform',
      tenantScope: 'tenant',
    };
  }

  void route;
  return {
    dataScope: 'organization',
    tenantScope: 'tenant',
  };
}

export function buildOpenApiGovernanceMetadata(
  route: BirdCoderApiRouteDefinition,
  operationId: string,
): BirdCoderOpenApiGovernanceMetadata {
  const domain = getOpenApiDomainForOperationId(operationId);
  const resource = getOpenApiResourceForOperationId(operationId, domain);
  const scopeMetadata = getOpenApiScopeMetadata(route, operationId);
  const isPublic = isPublicOpenApiOperation(route, operationId);

  return {
    ...scopeMetadata,
    deployment: 'all',
    domain,
    isPublic,
    ...(isPublic
      ? {}
      : {
          permission: `${resource}.${getOpenApiActionForOperation(route, operationId)}`,
        }),
    resource,
  };
}

export function getOperationIdForRoute(route: BirdCoderApiRouteDefinition): string {
  const operationIds = new Map<string, string>([
    ...Object.values(SDKWORK_IAM_OPERATION_IDS).map((operation) => [
      `${operation.method} ${toBirdCoderRoutePath(operation.path)}`,
      operation.operationId,
    ] as const),
    ['GET /app/v3/api/system/descriptor', 'descriptor.retrieve'],
    ['GET /app/v3/api/system/routes', 'routes.list'],
    ['GET /app/v3/api/engines', 'engines.list'],
    ['GET /app/v3/api/native_session_providers', 'nativeSessionProviders.list'],
    ['GET /app/v3/api/native_sessions', 'nativeSessions.list'],
    ['GET /app/v3/api/native_sessions/:id', 'nativeSessions.retrieve'],
    ['GET /app/v3/api/engines/:engineKey/capabilities', 'engines.capabilities.retrieve'],
    ['GET /app/v3/api/models', 'models.list'],
    ['GET /app/v3/api/model_config', 'modelConfig.retrieve'],
    ['PUT /app/v3/api/model_config', 'modelConfig.sync'],
    ['GET /app/v3/api/system/runtime', 'runtime.retrieve'],
    ['GET /app/v3/api/system/health', 'health.retrieve'],
    ['GET /app/v3/api/intelligence/coding_sessions', 'codingSessions.list'],
    ['POST /app/v3/api/intelligence/coding_sessions', 'codingSessions.create'],
    ['GET /app/v3/api/intelligence/coding_sessions/:sessionId', 'codingSessions.retrieve'],
    ['PATCH /app/v3/api/intelligence/coding_sessions/:sessionId', 'codingSessions.update'],
    ['DELETE /app/v3/api/intelligence/coding_sessions/:sessionId', 'codingSessions.delete'],
    ['POST /app/v3/api/intelligence/coding_sessions/:sessionId/fork', 'codingSessions.forks.create'],
    ['POST /app/v3/api/intelligence/coding_sessions/:sessionId/turns', 'codingSessions.turns.create'],
    [
      'PATCH /app/v3/api/intelligence/coding_sessions/:sessionId/messages/:messageId',
      'codingSessions.messages.update',
    ],
    [
      'DELETE /app/v3/api/intelligence/coding_sessions/:sessionId/messages/:messageId',
      'codingSessions.messages.delete',
    ],
    ['GET /app/v3/api/intelligence/coding_sessions/:sessionId/events', 'codingSessions.events.list'],
    ['GET /app/v3/api/intelligence/coding_sessions/:sessionId/artifacts', 'codingSessions.artifacts.list'],
    ['GET /app/v3/api/intelligence/coding_sessions/:sessionId/checkpoints', 'codingSessions.checkpoints.list'],
    [
      'POST /app/v3/api/intelligence/coding_sessions/:sessionId/checkpoints/:checkpointId/approval',
      'codingSessions.checkpoints.approval.create',
    ],
    [
      'POST /app/v3/api/intelligence/coding_sessions/:sessionId/questions/:questionId/answer',
      'codingSessions.questions.answers.create',
    ],
    ['GET /app/v3/api/operations/:operationId', 'operations.retrieve'],
    ['GET /app/v3/api/memberships/current', 'memberships.current.retrieve'],
    ['GET /app/v3/api/memberships/package_groups', 'memberships.packageGroups.list'],
    ['PATCH /app/v3/api/iam/users/current', 'users.current.update'],
    ['GET /app/v3/api/workspaces', 'workspaces.list'],
    ['POST /app/v3/api/workspaces', 'workspaces.create'],
    ['GET /app/v3/api/workspaces/:workspaceId', 'workspaces.retrieve'],
    ['PATCH /app/v3/api/workspaces/:workspaceId', 'workspaces.update'],
    ['DELETE /app/v3/api/workspaces/:workspaceId', 'workspaces.delete'],
    ['GET /app/v3/api/workspaces/:workspaceId/realtime', 'workspaces.realtime.subscribe'],
    ['GET /app/v3/api/projects', 'projects.list'],
    ['GET /app/v3/api/projects/:projectId', 'projects.retrieve'],
    ['GET /app/v3/api/projects/:projectId/git/overview', 'projects.git.overview.retrieve'],
    ['POST /app/v3/api/projects/:projectId/git/branches', 'projects.git.branches.create'],
    ['POST /app/v3/api/projects/:projectId/git/branch_switch', 'projects.git.branchSwitch.create'],
    ['POST /app/v3/api/projects/:projectId/git/commits', 'projects.git.commits.create'],
    ['POST /app/v3/api/projects/:projectId/git/pushes', 'projects.git.pushes.create'],
    ['POST /app/v3/api/projects/:projectId/git/worktrees', 'projects.git.worktrees.create'],
    ['POST /app/v3/api/projects/:projectId/git/worktree_removals', 'projects.git.worktreeRemovals.create'],
    ['POST /app/v3/api/projects/:projectId/git/worktree_prune', 'projects.git.worktreePrune.create'],
    ['GET /app/v3/api/projects/:projectId/collaborators', 'projects.collaborators.list'],
    ['POST /app/v3/api/projects/:projectId/collaborators', 'projects.collaborators.upsert'],
    ['POST /app/v3/api/projects', 'projects.create'],
    ['PATCH /app/v3/api/projects/:projectId', 'projects.update'],
    ['DELETE /app/v3/api/projects/:projectId', 'projects.delete'],
    ['GET /app/v3/api/skill_packages', 'skillPackages.list'],
    ['POST /app/v3/api/skill_packages/:packageId/installations', 'skillPackages.installations.create'],
    ['GET /app/v3/api/app_templates', 'appTemplates.list'],
    ['GET /app/v3/api/documents', 'documents.list'],
    ['GET /app/v3/api/teams', 'workspaceTeams.list'],
    ['GET /app/v3/api/workspaces/:workspaceId/members', 'workspaces.members.list'],
    ['POST /app/v3/api/workspaces/:workspaceId/members', 'workspaces.members.upsert'],
    ['POST /app/v3/api/projects/:projectId/publish', 'projects.publish.create'],
    ['GET /app/v3/api/projects/:projectId/deployment_targets', 'projects.deploymentTargets.list'],
    ['GET /app/v3/api/deployments', 'deployments.list'],
    ['GET /backend/v3/api/iam/audit_events', 'auditEvents.list'],
    ['GET /backend/v3/api/iam/policies', 'policies.list'],
    ['GET /backend/v3/api/iam/teams', 'teams.list'],
    ['GET /backend/v3/api/iam/teams/:teamId/members', 'teams.members.list'],
    ['GET /backend/v3/api/projects/:projectId/deployment_targets', 'projects.deploymentTargets.list'],
    ['GET /backend/v3/api/releases', 'releases.list'],
    ['GET /backend/v3/api/deployments', 'deploymentGovernance.list'],
  ]);
  const operationId = operationIds.get(`${route.method} ${route.path}`);
  if (operationId) {
    return operationId;
  }

  const routeOperationId = route.operationId?.trim();
  if (routeOperationId && !/^(?:app|backend|core|admin)\./u.test(routeOperationId)) {
    return routeOperationId;
  }

  return `custom.${route.method.toLowerCase()}.${route.path
    .split('/')
    .filter((segment) => segment && !segment.startsWith(':'))
    .map((segment) => segment.replace(/_([a-z0-9])/gu, (_, next: string) => next.toUpperCase()))
    .join('.')}`;
}
