import type {
  ChatCanonicalEvent,
  ChatMessage,
  ChatOptions,
} from '../../sdkwork-birdcoder-chat/src/index.ts';
import {
  createChatEngineById,
} from '../../sdkwork-birdcoder-commons/src/workbench/engines.ts';
import {
  resolveTransportKindForRuntimeMode,
} from '../../sdkwork-birdcoder-chat/src/index.ts';
import {
  getWorkbenchCodeEngineKernel,
  listWorkbenchCodeEngineDescriptors,
  listWorkbenchModelCatalogEntries,
} from '../../sdkwork-birdcoder-commons/src/workbench/kernel.ts';
import {
  BIRDCODER_DEFAULT_LOCAL_API_BASE_URL,
  BIRDCODER_DEFAULT_LOCAL_API_HOST,
  BIRDCODER_DEFAULT_LOCAL_API_PORT,
  createBirdHostDescriptorFromDistribution,
  type BirdHostDescriptor,
} from '../../sdkwork-birdcoder-host-core/src/index.ts';
import { bindDefaultBirdCoderIdeServicesRuntime } from '../../sdkwork-birdcoder-infrastructure/src/index.ts';
import type {
  BirdCoderApiEnvelope,
  BirdCoderApiGatewaySummary,
  BirdCoderApiRouteCatalogEntry,
  BirdCoderApiRouteDefinition,
  BirdCoderAdminApiContract,
  BirdCoderApiSurface,
  BirdCoderAppApiContract,
  BirdCoderApprovalDecisionResult,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdCoderCodingServerDescriptor,
  BirdCoderCoreApiContract,
  BirdCoderModelCatalogEntry,
  BirdCoderOperationDescriptor,
  BirdCoderCodingSessionArtifact,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionRuntime,
  BirdCoderHostMode,
  BirdCoderAppAdminApiClient,
} from '../../sdkwork-birdcoder-types/src/index.ts';
import { BIRDCODER_CODING_SERVER_API_VERSION as BIRDCODER_CODING_SERVER_API_VERSION_VALUE } from '../../sdkwork-birdcoder-types/src/index.ts';

export const BIRD_SERVER_DEFAULT_HOST = BIRDCODER_DEFAULT_LOCAL_API_HOST;
export const BIRD_SERVER_DEFAULT_PORT = BIRDCODER_DEFAULT_LOCAL_API_PORT;
export const BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME = 'bird-server.config.json';
export const BIRDCODER_CODING_SERVER_API_VERSION = BIRDCODER_CODING_SERVER_API_VERSION_VALUE;
export const BIRDCODER_CODING_SERVER_OPENAPI_PATH = '/openapi/coding-server-v1.json';
export const BIRDCODER_CODING_SERVER_LIVE_OPENAPI_PATH = '/openapi.json';
export const BIRDCODER_CODING_SERVER_DOCS_PATH = '/docs';
export const BIRDCODER_CODING_SERVER_GATEWAY_BASE_PATH = '/api';
export const BIRDCODER_CODING_SERVER_ROUTE_CATALOG_PATH = '/api/core/v1/routes';

export type BirdServerDistributionId = 'cn' | 'global';

export interface BirdCoderCoreSessionRunRequest {
  sessionId: string;
  runtimeId: string;
  turnId: string;
  engineId: string;
  modelId?: string;
  hostMode?: BirdCoderHostMode;
  messages: ChatMessage[];
  options?: ChatOptions;
}

export interface BirdCoderCoreSessionRunProjection {
  runtime: BirdCoderCodingSessionRuntime;
  events: BirdCoderCodingSessionEvent[];
  artifacts: BirdCoderCodingSessionArtifact[];
  operation: BirdCoderOperationDescriptor;
}

export interface BirdCoderCoreSessionProjectionSnapshot {
  codingSessionId: string;
  runtime: BirdCoderCodingSessionRuntime | null;
  events: BirdCoderCodingSessionEvent[];
  artifacts: BirdCoderCodingSessionArtifact[];
  operations: BirdCoderOperationDescriptor[];
}

export interface BirdCoderCoreSessionProjectionStore {
  getSessionSnapshot(codingSessionId: string): Promise<BirdCoderCoreSessionProjectionSnapshot>;
  persistRunProjection(
    projection: BirdCoderCoreSessionRunProjection,
  ): Promise<BirdCoderCoreSessionProjectionSnapshot>;
}

export interface BirdCoderCodingServerOpenApiDocumentSeed {
  openapi: '3.1.0';
  info: {
    title: 'SDKWork BirdCoder Coding Server API';
    version: typeof BIRDCODER_CODING_SERVER_API_VERSION;
    description: string;
  };
  servers: Array<{ url: string; description: string }>;
  tags: Array<{ name: BirdCoderApiSurface; description: string }>;
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http';
        scheme: 'bearer';
        bearerFormat: 'Bearer token';
      };
    };
  };
  paths: Record<
    string,
    Partial<
      Record<
        Lowercase<BirdCoderApiRouteDefinition['method']>,
        {
          operationId: string;
          summary: string;
          description: string;
          tags: BirdCoderApiSurface[];
          responses: Record<string, { description: string }>;
          security?: Array<{ bearerAuth: [] }>;
          'x-sdkwork-auth-mode': BirdCoderApiRouteDefinition['authMode'];
          'x-sdkwork-surface': BirdCoderApiSurface;
        }
      >
    >
  >;
  'x-sdkwork-api-gateway': {
    basePath: typeof BIRDCODER_CODING_SERVER_GATEWAY_BASE_PATH;
    compatibilityOpenApiPaths: string[];
    docsPath: typeof BIRDCODER_CODING_SERVER_DOCS_PATH;
    liveOpenApiPath: typeof BIRDCODER_CODING_SERVER_LIVE_OPENAPI_PATH;
    routeCatalogPath: typeof BIRDCODER_CODING_SERVER_ROUTE_CATALOG_PATH;
    routeCount: number;
    routesBySurface: Record<BirdCoderApiSurface, number>;
    surfaces: Array<{
      authMode: BirdCoderApiRouteDefinition['authMode'];
      basePath: string;
      description: string;
      name: BirdCoderApiSurface;
      routeCount: number;
    }>;
  };
}

const BIRD_SERVER_DISTRIBUTIONS = {
  global: {
    id: 'global',
    appId: 'sdkwork-birdcoder',
    appName: 'SDKWork BirdCoder',
    apiBaseUrl: BIRDCODER_DEFAULT_LOCAL_API_BASE_URL,
  },
  cn: {
    id: 'cn',
    appId: 'sdkwork-birdcoder-cn',
    appName: 'SDKWork BirdCoder',
    apiBaseUrl: BIRDCODER_DEFAULT_LOCAL_API_BASE_URL,
  },
} as const;

const BIRD_SERVER_RUNTIME_TRANSPORT_BASE_URLS: Record<BirdServerDistributionId, string> = {
  global: BIRDCODER_DEFAULT_LOCAL_API_BASE_URL,
  cn: 'https://cn.sdkwork.local/birdcoder',
};

export interface BirdServerRuntime extends BirdHostDescriptor {
  host: string;
  port: number;
  configFileName: string;
}

export interface BindBirdCoderServerRuntimeTransportOptions {
  apiBaseUrl?: string;
  appAdminClient?: BirdCoderAppAdminApiClient;
  distributionId?: BirdServerDistributionId;
  host?: BirdServerRuntime;
}

interface BirdCoderCoreSessionProjectionState {
  runtime: BirdCoderCodingSessionRuntime | null;
  events: BirdCoderCodingSessionEvent[];
  artifacts: BirdCoderCodingSessionArtifact[];
  operationsById: Map<string, BirdCoderOperationDescriptor>;
}

function createRoute(
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

function getSurfaceDescription(surface: BirdCoderApiSurface): string {
  switch (surface) {
    case 'core':
      return 'Core coding runtime, engine catalog, session execution, and operation control.';
    case 'app':
      return 'Application-facing workspace, project, collaboration, and user-center routes.';
    case 'admin':
      return 'Administrative governance, audit, release, deployment, and team-management routes.';
    default:
      return 'Unified BirdCoder API surface.';
  }
}

function toOpenApiPathTemplate(path: string): string {
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

function buildOpenApiResponses(): Record<string, { description: string }> {
  return {
    '200': {
      description: 'Successful response',
    },
    default: {
      description: 'Problem response',
    },
  };
}

function getSurfaceBasePath(surface: BirdCoderApiSurface): string {
  switch (surface) {
    case 'core':
      return '/api/core/v1';
    case 'app':
      return '/api/app/v1';
    case 'admin':
      return '/api/admin/v1';
    default:
      return BIRDCODER_CODING_SERVER_GATEWAY_BASE_PATH;
  }
}

function buildOpenApiOperationDescription(route: BirdCoderApiRouteDefinition): string {
  const authDescription =
    route.authMode === 'host'
      ? 'No user session is required; this route is available on the host runtime surface.'
      : route.authMode === 'user'
        ? 'Requires an authenticated BirdCoder user session.'
        : 'Requires an authenticated BirdCoder admin session.';

  return `${route.summary}. ${authDescription}`;
}

function buildOpenApiOperationSecurity(
  route: BirdCoderApiRouteDefinition,
): Array<{ bearerAuth: [] }> | undefined {
  return route.authMode === 'host' ? undefined : [{ bearerAuth: [] }];
}

function getOperationIdForRoute(route: BirdCoderApiRouteDefinition): string {
  const operationIds = new Map<string, string>([
    ['GET /api/core/v1/descriptor', 'core.getDescriptor'],
    ['GET /api/core/v1/routes', 'core.listRoutes'],
    ['GET /api/core/v1/engines', 'core.listEngines'],
    ['GET /api/core/v1/native-sessions', 'core.listNativeSessions'],
    ['GET /api/core/v1/native-sessions/:id', 'core.getNativeSession'],
    ['GET /api/core/v1/engines/:engineKey/capabilities', 'core.getEngineCapabilities'],
    ['GET /api/core/v1/models', 'core.listModels'],
    ['GET /api/core/v1/runtime', 'core.getRuntime'],
    ['GET /api/core/v1/health', 'core.getHealth'],
    ['POST /api/core/v1/coding-sessions', 'core.createCodingSession'],
    ['GET /api/core/v1/coding-sessions/:id', 'core.getCodingSession'],
    ['POST /api/core/v1/coding-sessions/:id/turns', 'core.createCodingSessionTurn'],
    ['GET /api/core/v1/coding-sessions/:id/events', 'core.listCodingSessionEvents'],
    ['GET /api/core/v1/coding-sessions/:id/artifacts', 'core.listCodingSessionArtifacts'],
    ['GET /api/core/v1/coding-sessions/:id/checkpoints', 'core.listCodingSessionCheckpoints'],
    ['POST /api/core/v1/approvals/:approvalId/decision', 'core.submitApprovalDecision'],
    ['GET /api/core/v1/operations/:operationId', 'core.getOperation'],
    ['GET /api/app/v1/auth/config', 'app.getUserCenterConfig'],
    ['GET /api/app/v1/auth/session', 'app.getCurrentUserSession'],
    ['POST /api/app/v1/auth/login', 'app.login'],
    ['POST /api/app/v1/auth/register', 'app.register'],
    ['POST /api/app/v1/auth/logout', 'app.logout'],
    ['POST /api/app/v1/auth/session/exchange', 'app.exchangeUserCenterSession'],
    ['GET /api/app/v1/user-center/profile', 'app.getCurrentUserProfile'],
    ['PATCH /api/app/v1/user-center/profile', 'app.updateCurrentUserProfile'],
    ['GET /api/app/v1/user-center/membership', 'app.getCurrentUserMembership'],
    ['PATCH /api/app/v1/user-center/membership', 'app.updateCurrentUserMembership'],
    ['GET /api/app/v1/workspaces', 'app.listWorkspaces'],
    ['POST /api/app/v1/workspaces', 'app.createWorkspace'],
    ['PATCH /api/app/v1/workspaces/:workspaceId', 'app.updateWorkspace'],
    ['DELETE /api/app/v1/workspaces/:workspaceId', 'app.deleteWorkspace'],
    ['GET /api/app/v1/projects', 'app.listProjects'],
    ['GET /api/app/v1/projects/:projectId/collaborators', 'app.listProjectCollaborators'],
    ['POST /api/app/v1/projects/:projectId/collaborators', 'app.upsertProjectCollaborator'],
    ['POST /api/app/v1/projects', 'app.createProject'],
    ['PATCH /api/app/v1/projects/:projectId', 'app.updateProject'],
    ['DELETE /api/app/v1/projects/:projectId', 'app.deleteProject'],
    ['GET /api/app/v1/documents', 'app.listDocuments'],
    ['GET /api/app/v1/teams', 'app.listTeams'],
    ['GET /api/app/v1/workspaces/:workspaceId/members', 'app.listWorkspaceMembers'],
    ['POST /api/app/v1/workspaces/:workspaceId/members', 'app.upsertWorkspaceMember'],
    ['POST /api/app/v1/projects/:projectId/publish', 'app.publishProject'],
    ['GET /api/app/v1/deployments', 'app.listDeployments'],
    ['GET /api/admin/v1/audit', 'admin.listAuditEvents'],
    ['GET /api/admin/v1/policies', 'admin.listPolicies'],
    ['GET /api/admin/v1/teams', 'admin.listTeams'],
    ['GET /api/admin/v1/teams/:teamId/members', 'admin.listTeamMembers'],
    ['GET /api/admin/v1/projects/:projectId/deployment-targets', 'admin.listDeploymentTargets'],
    ['GET /api/admin/v1/releases', 'admin.listReleases'],
    ['GET /api/admin/v1/deployments', 'admin.listDeployments'],
  ]);

  return (
    operationIds.get(`${route.method} ${route.path}`) ??
    `${route.surface}.${route.method.toLowerCase()}.${route.path}`
  );
}

export function listBirdCoderCodingServerRouteCatalogEntries(): BirdCoderApiRouteCatalogEntry[] {
  return listBirdCoderCodingServerRoutes().map((route) => ({
    ...route,
    openApiPath: toOpenApiPathTemplate(route.path),
    operationId: getOperationIdForRoute(route),
  }));
}

function buildBirdCoderApiGatewaySummary(): BirdCoderApiGatewaySummary {
  const routeCatalog = listBirdCoderCodingServerRouteCatalogEntries();
  const routesBySurface = routeCatalog.reduce<Record<BirdCoderApiSurface, number>>(
    (accumulator, route) => {
      accumulator[route.surface] += 1;
      return accumulator;
    },
    {
      core: 0,
      app: 0,
      admin: 0,
    },
  );

  return {
    basePath: BIRDCODER_CODING_SERVER_GATEWAY_BASE_PATH,
    docsPath: BIRDCODER_CODING_SERVER_DOCS_PATH,
    liveOpenApiPath: BIRDCODER_CODING_SERVER_LIVE_OPENAPI_PATH,
    openApiPath: BIRDCODER_CODING_SERVER_OPENAPI_PATH,
    routeCatalogPath: BIRDCODER_CODING_SERVER_ROUTE_CATALOG_PATH,
    routeCount: routeCatalog.length,
    routesBySurface,
    surfaces: (['core', 'app', 'admin'] as const).map((surface) => ({
      authMode:
        surface === 'core' ? 'host' : surface === 'app' ? 'user' : 'admin',
      basePath: getSurfaceBasePath(surface),
      description: getSurfaceDescription(surface),
      name: surface,
      routeCount: routesBySurface[surface],
    })),
  };
}

function buildRequestId(seed: string): string {
  return `req:${seed}:${Date.now().toString(36)}`;
}

function createEmptyCoreSessionProjectionSnapshot(
  codingSessionId: string,
): BirdCoderCoreSessionProjectionSnapshot {
  return {
    codingSessionId,
    runtime: null,
    events: [],
    artifacts: [],
    operations: [],
  };
}

function cloneCoreSessionProjectionSnapshot(
  codingSessionId: string,
  state: BirdCoderCoreSessionProjectionState,
): BirdCoderCoreSessionProjectionSnapshot {
  return {
    codingSessionId,
    runtime: state.runtime ? { ...state.runtime } : null,
    events: [...state.events],
    artifacts: [...state.artifacts],
    operations: [...state.operationsById.values()],
  };
}

function appendDistinctById<TEntity extends { id: string }>(
  target: TEntity[],
  entries: readonly TEntity[],
): void {
  const existingIds = new Set(target.map((entry) => entry.id));
  for (const entry of entries) {
    if (existingIds.has(entry.id)) {
      continue;
    }
    target.push(entry);
    existingIds.add(entry.id);
  }
}

function createEnvelope<T>(data: T, seed: string): BirdCoderApiEnvelope<T> {
  return {
    requestId: buildRequestId(seed),
    timestamp: new Date().toISOString(),
    data,
    meta: {
      version: BIRDCODER_CODING_SERVER_API_VERSION,
    },
  };
}

function mapCanonicalEventToCoreEvent(
  request: BirdCoderCoreSessionRunRequest,
  canonicalEvent: ChatCanonicalEvent,
): {
  event: BirdCoderCodingSessionEvent;
  artifact: BirdCoderCodingSessionArtifact | null;
} {
  const createdAt = new Date().toISOString();
  const event: BirdCoderCodingSessionEvent = {
    id: `${request.runtimeId}:${request.turnId}:event:${canonicalEvent.sequence}`,
    codingSessionId: request.sessionId,
    turnId: request.turnId,
    runtimeId: request.runtimeId,
    kind: canonicalEvent.kind,
    sequence: canonicalEvent.sequence,
    payload: {
      ...canonicalEvent.payload,
      engineId: request.engineId,
      modelId: request.modelId ?? request.options?.model ?? null,
      runtimeStatus: canonicalEvent.runtimeStatus,
    },
    createdAt,
  };

  const artifact = canonicalEvent.artifact
    ? {
        id: `${request.turnId}:artifact:${canonicalEvent.sequence}`,
        codingSessionId: request.sessionId,
        turnId: request.turnId,
        kind: canonicalEvent.artifact.kind,
        status: 'sealed' as const,
        title: canonicalEvent.artifact.title,
        metadata: {
          ...canonicalEvent.artifact.metadata,
          sourceEventKind: canonicalEvent.kind,
          sourceSequence: canonicalEvent.sequence,
          runtimeStatus: canonicalEvent.runtimeStatus,
        },
        createdAt,
      }
    : null;

  return {
    event,
    artifact,
  };
}

function resolveOperationStatus(
  events: BirdCoderCodingSessionEvent[],
): BirdCoderOperationDescriptor['status'] {
  const lastEvent = events.at(-1);
  if (!lastEvent) {
    return 'queued';
  }

  if (lastEvent.kind === 'turn.failed') {
    return 'failed';
  }

  if (lastEvent.kind === 'turn.completed') {
    const runtimeStatus = String(lastEvent.payload.runtimeStatus ?? '');
    return runtimeStatus === 'completed' ? 'succeeded' : 'running';
  }

  return 'running';
}

const CORE_API_CONTRACT: BirdCoderCoreApiContract = {
  codingSession: createRoute(
    'core',
    'host',
    'GET',
    '/api/core/v1/coding-sessions/:id',
    'Get coding session',
  ),
  descriptor: createRoute('core', 'host', 'GET', '/api/core/v1/descriptor', 'Get coding-server descriptor'),
  engineCapabilities: createRoute(
    'core',
    'host',
    'GET',
    '/api/core/v1/engines/:engineKey/capabilities',
    'Get runtime capabilities for one engine',
  ),
  engines: createRoute('core', 'host', 'GET', '/api/core/v1/engines', 'List available engines'),
  nativeSession: createRoute(
    'core',
    'host',
    'GET',
    '/api/core/v1/native-sessions/:id',
    'Get discovered native engine session detail',
  ),
  nativeSessions: createRoute(
    'core',
    'host',
    'GET',
    '/api/core/v1/native-sessions',
    'List discovered native engine sessions',
  ),
  events: createRoute(
    'core',
    'host',
    'GET',
    '/api/core/v1/coding-sessions/:id/events',
    'Replay or subscribe to coding session events',
  ),
  health: createRoute('core', 'host', 'GET', '/api/core/v1/health', 'Get coding-server health'),
  models: createRoute('core', 'host', 'GET', '/api/core/v1/models', 'List model catalog'),
  operations: createRoute(
    'core',
    'host',
    'GET',
    '/api/core/v1/operations/:operationId',
    'Get operation status',
  ),
  approvals: createRoute(
    'core',
    'host',
    'POST',
    '/api/core/v1/approvals/:approvalId/decision',
    'Submit approval decision',
  ),
  routes: createRoute('core', 'host', 'GET', BIRDCODER_CODING_SERVER_ROUTE_CATALOG_PATH, 'List unified API routes'),
  runtime: createRoute('core', 'host', 'GET', '/api/core/v1/runtime', 'Get runtime metadata'),
  sessions: createRoute(
    'core',
    'host',
    'POST',
    '/api/core/v1/coding-sessions',
    'Create coding session',
  ),
  sessionArtifacts: createRoute(
    'core',
    'host',
    'GET',
    '/api/core/v1/coding-sessions/:id/artifacts',
    'List coding session artifacts',
  ),
  sessionCheckpoints: createRoute(
    'core',
    'host',
    'GET',
    '/api/core/v1/coding-sessions/:id/checkpoints',
    'List coding session checkpoints',
  ),
  sessionTurns: createRoute(
    'core',
    'host',
    'POST',
    '/api/core/v1/coding-sessions/:id/turns',
    'Create coding session turn',
  ),
};

const APP_API_CONTRACT: BirdCoderAppApiContract = {
  authConfig: createRoute('app', 'user', 'GET', '/api/app/v1/auth/config', 'Get user center provider metadata'),
  authSession: createRoute('app', 'user', 'GET', '/api/app/v1/auth/session', 'Get current user center session'),
  createProject: createRoute('app', 'user', 'POST', '/api/app/v1/projects', 'Create project'),
  createProjectCollaborator: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/projects/:projectId/collaborators',
    'Upsert project collaborator',
  ),
  createWorkspace: createRoute('app', 'user', 'POST', '/api/app/v1/workspaces', 'Create workspace'),
  createWorkspaceMember: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/workspaces/:workspaceId/members',
    'Upsert workspace member',
  ),
  deleteProject: createRoute(
    'app',
    'user',
    'DELETE',
    '/api/app/v1/projects/:projectId',
    'Delete project',
  ),
  deleteWorkspace: createRoute(
    'app',
    'user',
    'DELETE',
    '/api/app/v1/workspaces/:workspaceId',
    'Delete workspace',
  ),
  deployments: createRoute('app', 'user', 'GET', '/api/app/v1/deployments', 'List deployments'),
  documents: createRoute('app', 'user', 'GET', '/api/app/v1/documents', 'List project documents'),
  exchangeUserCenterSession: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/auth/session/exchange',
    'Exchange third-party identity into a BirdCoder session',
  ),
  getCurrentUserMembership: createRoute(
    'app',
    'user',
    'GET',
    '/api/app/v1/user-center/membership',
    'Get current user membership',
  ),
  getCurrentUserProfile: createRoute(
    'app',
    'user',
    'GET',
    '/api/app/v1/user-center/profile',
    'Get current user profile',
  ),
  login: createRoute('app', 'user', 'POST', '/api/app/v1/auth/login', 'Create local user center session'),
  logout: createRoute('app', 'user', 'POST', '/api/app/v1/auth/logout', 'Revoke current user center session'),
  publishProject: createRoute(
    'app',
    'user',
    'POST',
    '/api/app/v1/projects/:projectId/publish',
    'Publish project release flow',
  ),
  projectCollaborators: createRoute(
    'app',
    'user',
    'GET',
    '/api/app/v1/projects/:projectId/collaborators',
    'List project collaborators',
  ),
  projects: createRoute('app', 'user', 'GET', '/api/app/v1/projects', 'List projects'),
  register: createRoute('app', 'user', 'POST', '/api/app/v1/auth/register', 'Register local user center identity'),
  teams: createRoute('app', 'user', 'GET', '/api/app/v1/teams', 'List workspace teams'),
  updateCurrentUserMembership: createRoute(
    'app',
    'user',
    'PATCH',
    '/api/app/v1/user-center/membership',
    'Update current user membership',
  ),
  updateCurrentUserProfile: createRoute(
    'app',
    'user',
    'PATCH',
    '/api/app/v1/user-center/profile',
    'Update current user profile',
  ),
  updateProject: createRoute(
    'app',
    'user',
    'PATCH',
    '/api/app/v1/projects/:projectId',
    'Update project',
  ),
  updateWorkspace: createRoute(
    'app',
    'user',
    'PATCH',
    '/api/app/v1/workspaces/:workspaceId',
    'Update workspace',
  ),
  workspaceMembers: createRoute(
    'app',
    'user',
    'GET',
    '/api/app/v1/workspaces/:workspaceId/members',
    'List workspace members',
  ),
  workspaces: createRoute('app', 'user', 'GET', '/api/app/v1/workspaces', 'List workspaces'),
};

const ADMIN_API_CONTRACT: BirdCoderAdminApiContract = {
  audit: createRoute('admin', 'admin', 'GET', '/api/admin/v1/audit', 'List audit events'),
  deployments: createRoute(
    'admin',
    'admin',
    'GET',
    '/api/admin/v1/deployments',
    'List governed deployments',
  ),
  deploymentTargets: createRoute(
    'admin',
    'admin',
    'GET',
    '/api/admin/v1/projects/:projectId/deployment-targets',
    'List deployment targets',
  ),
  policies: createRoute('admin', 'admin', 'GET', '/api/admin/v1/policies', 'List governance policies'),
  releases: createRoute('admin', 'admin', 'GET', '/api/admin/v1/releases', 'List releases'),
  teamMembers: createRoute(
    'admin',
    'admin',
    'GET',
    '/api/admin/v1/teams/:teamId/members',
    'List team members',
  ),
  teams: createRoute('admin', 'admin', 'GET', '/api/admin/v1/teams', 'List teams'),
};

export function resolveServerRuntime(
  distributionId: BirdServerDistributionId = 'global',
  overrides: Partial<BirdServerRuntime> = {},
): BirdServerRuntime {
  const distribution = BIRD_SERVER_DISTRIBUTIONS[distributionId];
  const hostDescriptor = createBirdHostDescriptorFromDistribution('server', distribution, {
    ...(overrides.apiBaseUrl ? { apiBaseUrl: overrides.apiBaseUrl } : {}),
    ...(overrides.appId ? { appId: overrides.appId } : {}),
    ...(overrides.appName ? { appName: overrides.appName } : {}),
    ...(overrides.distributionId ? { distributionId: overrides.distributionId } : {}),
    ...(overrides.mode ? { mode: overrides.mode } : {}),
  });

  return {
    ...hostDescriptor,
    host: overrides.host ?? BIRD_SERVER_DEFAULT_HOST,
    port: overrides.port ?? BIRD_SERVER_DEFAULT_PORT,
    configFileName: overrides.configFileName ?? BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME,
  };
}

export function bindBirdCoderServerRuntimeTransport(
  options: BindBirdCoderServerRuntimeTransportOptions = {},
): BirdServerRuntime {
  const host = options.host ?? resolveServerRuntime(options.distributionId);
  const distributionId = options.distributionId ?? (host.distributionId as BirdServerDistributionId);
  bindDefaultBirdCoderIdeServicesRuntime({
    appAdminClient: options.appAdminClient,
    apiBaseUrl:
      options.apiBaseUrl ??
      (options.host ? undefined : BIRD_SERVER_RUNTIME_TRANSPORT_BASE_URLS[distributionId]),
    host,
  });
  return host;
}

export function getBirdCoderCodingServerDescriptor(
  hostMode: BirdCoderHostMode = 'server',
): BirdCoderCodingServerDescriptor {
  return {
    apiVersion: BIRDCODER_CODING_SERVER_API_VERSION,
    gateway: buildBirdCoderApiGatewaySummary(),
    hostMode,
    moduleId: 'coding-server',
    openApiPath: BIRDCODER_CODING_SERVER_OPENAPI_PATH,
    surfaces: ['core', 'app', 'admin'],
  };
}

export function listBirdCoderCodingServerEngines(): ReadonlyArray<BirdCoderEngineDescriptor> {
  return listWorkbenchCodeEngineDescriptors();
}

export function listBirdCoderCodingServerModels(): ReadonlyArray<BirdCoderModelCatalogEntry> {
  return listWorkbenchModelCatalogEntries();
}

export function getBirdCoderCodingServerEngineDescriptor(
  engineKey: string,
): BirdCoderEngineDescriptor | null {
  return (
    listBirdCoderCodingServerEngines().find((descriptor) => descriptor.engineKey === engineKey) ??
    null
  );
}

export function getBirdCoderCodingServerEngineCapabilities(
  engineKey: string,
): BirdCoderEngineCapabilityMatrix | null {
  return getBirdCoderCodingServerEngineDescriptor(engineKey)?.capabilityMatrix ?? null;
}

export function getBirdCoderCoreApiContract(): BirdCoderCoreApiContract {
  return CORE_API_CONTRACT;
}

export function getBirdCoderAppApiContract(): BirdCoderAppApiContract {
  return APP_API_CONTRACT;
}

export function getBirdCoderAdminApiContract(): BirdCoderAdminApiContract {
  return ADMIN_API_CONTRACT;
}

export function listBirdCoderCodingServerRoutes(): BirdCoderApiRouteDefinition[] {
  return [
    ...Object.values(CORE_API_CONTRACT),
    ...Object.values(APP_API_CONTRACT),
    ...Object.values(ADMIN_API_CONTRACT),
  ];
}

export function buildBirdCoderCodingServerOpenApiDocument(
  distributionId: BirdServerDistributionId = 'global',
): BirdCoderCodingServerOpenApiDocumentSeed {
  void distributionId;
  const routes = listBirdCoderCodingServerRoutes();
  const gateway = buildBirdCoderApiGatewaySummary();

  const paths: BirdCoderCodingServerOpenApiDocumentSeed['paths'] = {};
  for (const route of routes) {
    const method = route.method.toLowerCase() as Lowercase<BirdCoderApiRouteDefinition['method']>;
    const openApiPath = toOpenApiPathTemplate(route.path);
    const security = buildOpenApiOperationSecurity(route);
    const operationId = getOperationIdForRoute(route);
    paths[openApiPath] = {
      ...(paths[openApiPath] ?? {}),
      [method]: {
        operationId,
        summary: route.summary,
        description: buildOpenApiOperationDescription(route),
        tags: [route.surface],
        responses: buildOpenApiResponses(),
        ...(security ? { security } : {}),
        'x-sdkwork-auth-mode': route.authMode,
        'x-sdkwork-surface': route.surface,
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'SDKWork BirdCoder Coding Server API',
      version: BIRDCODER_CODING_SERVER_API_VERSION,
      description:
        'OpenAPI 3.1 schema generated from the live BirdCoder unified same-port API gateway.',
    },
    servers: [
      {
        url: '/',
        description: 'Unified same-port BirdCoder API gateway.',
      },
    ],
    tags: [
      { name: 'core', description: getSurfaceDescription('core') },
      { name: 'app', description: getSurfaceDescription('app') },
      { name: 'admin', description: getSurfaceDescription('admin') },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'Bearer token',
        },
      },
    },
    paths,
    'x-sdkwork-api-gateway': {
      basePath: BIRDCODER_CODING_SERVER_GATEWAY_BASE_PATH,
      compatibilityOpenApiPaths: [BIRDCODER_CODING_SERVER_OPENAPI_PATH],
      docsPath: BIRDCODER_CODING_SERVER_DOCS_PATH,
      liveOpenApiPath: BIRDCODER_CODING_SERVER_LIVE_OPENAPI_PATH,
      routeCatalogPath: BIRDCODER_CODING_SERVER_ROUTE_CATALOG_PATH,
      routeCount: gateway.routeCount,
      routesBySurface: gateway.routesBySurface,
      surfaces: [...gateway.surfaces],
    },
  };
}

export function buildBirdCoderCodingServerOpenApiDocumentSeed(
  distributionId: BirdServerDistributionId = 'global',
): BirdCoderCodingServerOpenApiDocumentSeed {
  return buildBirdCoderCodingServerOpenApiDocument(distributionId);
}

export async function executeBirdCoderCoreSessionRun(
  request: BirdCoderCoreSessionRunRequest,
): Promise<BirdCoderCoreSessionRunProjection> {
  const kernel = getWorkbenchCodeEngineKernel(request.engineId);
  const chatEngine = createChatEngineById(request.engineId);
  const runtimeDescriptor =
    chatEngine.describeRuntime?.({
      ...request.options,
      model: request.modelId ?? request.options?.model ?? kernel.defaultModelId,
    }) ??
    (() => {
      throw new Error(`Engine ${request.engineId} does not expose describeRuntime()`);
    })();
  const runtimeHealth = await chatEngine.getHealth?.();
  const runtimeTransportKind = runtimeHealth
    ? resolveTransportKindForRuntimeMode(
        kernel.descriptor.transportKinds,
        runtimeHealth.runtimeMode,
      )
    : runtimeDescriptor.transportKind;
  const createdAt = new Date().toISOString();
  const events: BirdCoderCodingSessionEvent[] = [];
  const artifacts: BirdCoderCodingSessionArtifact[] = [];

  for await (const canonicalEvent of chatEngine.sendCanonicalEvents?.(
    request.messages,
    {
      ...request.options,
      model: runtimeDescriptor.modelId,
    },
  ) ?? []) {
    const projection = mapCanonicalEventToCoreEvent(request, canonicalEvent);
    events.push(projection.event);
    if (projection.artifact) {
      artifacts.push(projection.artifact);
    }
  }

  const runtime: BirdCoderCodingSessionRuntime = {
    id: request.runtimeId,
    codingSessionId: request.sessionId,
    hostMode: request.hostMode ?? 'server',
    status:
      (String(events.at(-1)?.payload.runtimeStatus ?? 'initializing') as BirdCoderCodingSessionRuntime['status']) ??
      'initializing',
    engineId: runtimeDescriptor.engineId,
    modelId: runtimeDescriptor.modelId,
    nativeRef: {
      engineId: runtimeDescriptor.engineId,
      transportKind: runtimeTransportKind,
      nativeSessionId: request.sessionId,
      nativeTurnContainerId: request.turnId,
      metadata: {
        approvalPolicy: runtimeDescriptor.approvalPolicy,
      },
    },
    capabilitySnapshot: runtimeDescriptor.capabilityMatrix,
    metadata: {
      approvalPolicy: runtimeDescriptor.approvalPolicy,
    },
    createdAt,
    updatedAt: events.at(-1)?.createdAt ?? createdAt,
  };

  const operation: BirdCoderOperationDescriptor = {
    operationId: `${request.turnId}:operation`,
    status: resolveOperationStatus(events),
    artifactRefs: artifacts.map((artifact) => artifact.id),
    streamUrl: `/api/core/v1/coding-sessions/${request.sessionId}/events`,
    streamKind: 'sse',
  };

  return {
    runtime,
    events,
    artifacts,
    operation,
  };
}

export function createInMemoryBirdCoderCoreSessionProjectionStore(): BirdCoderCoreSessionProjectionStore {
  const states = new Map<string, BirdCoderCoreSessionProjectionState>();

  return {
    async getSessionSnapshot(
      codingSessionId: string,
    ): Promise<BirdCoderCoreSessionProjectionSnapshot> {
      const state = states.get(codingSessionId);
      return state
        ? cloneCoreSessionProjectionSnapshot(codingSessionId, state)
        : createEmptyCoreSessionProjectionSnapshot(codingSessionId);
    },
    async persistRunProjection(
      projection: BirdCoderCoreSessionRunProjection,
    ): Promise<BirdCoderCoreSessionProjectionSnapshot> {
      const codingSessionId = projection.runtime.codingSessionId;
      const state =
        states.get(codingSessionId) ??
        {
          runtime: null,
          events: [],
          artifacts: [],
          operationsById: new Map<string, BirdCoderOperationDescriptor>(),
        };

      state.runtime = projection.runtime;
      appendDistinctById(state.events, projection.events);
      appendDistinctById(state.artifacts, projection.artifacts);
      state.operationsById.set(projection.operation.operationId, projection.operation);
      states.set(codingSessionId, state);

      return cloneCoreSessionProjectionSnapshot(codingSessionId, state);
    },
  };
}

export async function persistBirdCoderCoreSessionRunProjection(
  store: BirdCoderCoreSessionProjectionStore,
  projection: BirdCoderCoreSessionRunProjection,
): Promise<BirdCoderCoreSessionProjectionSnapshot> {
  return store.persistRunProjection(projection);
}

export async function* streamBirdCoderCoreSessionEventEnvelopes(
  request: BirdCoderCoreSessionRunRequest,
): AsyncGenerator<BirdCoderApiEnvelope<BirdCoderCodingSessionEvent>, void, unknown> {
  const projection = await executeBirdCoderCoreSessionRun(request);
  for (const event of projection.events) {
    yield createEnvelope(event, event.id);
  }
}

export function createBirdCoderApprovalDecisionEnvelope(
  result: BirdCoderApprovalDecisionResult,
): BirdCoderApiEnvelope<BirdCoderApprovalDecisionResult> {
  return createEnvelope(result, result.approvalId);
}

export {
  createBirdCoderRepresentativeAppAdminRepositories,
  type BirdCoderRepresentativeAppAdminRepositories,
  type BirdCoderRepresentativeProjectRecord,
  type BirdCoderRepresentativeReleaseRecord,
  type BirdCoderRepresentativeTeamRecord,
} from './appAdminRepository.ts';

export {
  buildBirdCoderCoreSessionProjectionBindings,
  createProviderBackedBirdCoderCoreSessionProjectionStore,
  createJsonBirdCoderCoreSessionProjectionStore,
  type JsonBirdCoderCoreSessionProjectionStore,
  type ProviderBackedBirdCoderCoreSessionProjectionStore,
} from './projectionRepository.ts';
