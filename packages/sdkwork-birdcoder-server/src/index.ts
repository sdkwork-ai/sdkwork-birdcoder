import type {
  ChatCanonicalEvent,
  ChatMessage,
  ChatOptions,
} from '../../sdkwork-birdcoder-chat/src/index.ts';
import { createChatEngineById } from '../../sdkwork-birdcoder-commons/src/workbench/engines.ts';
import {
  getWorkbenchCodeEngineKernel,
  listWorkbenchCodeEngineDescriptors,
  listWorkbenchModelCatalogEntries,
} from '../../sdkwork-birdcoder-commons/src/workbench/kernel.ts';
import {
  createBirdHostDescriptorFromDistribution,
  type BirdHostDescriptor,
} from '../../sdkwork-birdcoder-host-core/src/index.ts';
import { bindDefaultBirdCoderIdeServicesRuntime } from '../../sdkwork-birdcoder-infrastructure/src/index.ts';
import type {
  BirdCoderApiEnvelope,
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

export const BIRD_SERVER_DEFAULT_HOST = '127.0.0.1';
export const BIRD_SERVER_DEFAULT_PORT = 18989;
export const BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME = 'bird-server.config.json';
export const BIRDCODER_CODING_SERVER_API_VERSION = BIRDCODER_CODING_SERVER_API_VERSION_VALUE;
export const BIRDCODER_CODING_SERVER_OPENAPI_PATH = '/openapi/coding-server-v1.json';

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
  };
  servers: Array<{ url: string }>;
  tags: Array<{ name: BirdCoderApiSurface }>;
  paths: Record<
    string,
    Partial<
      Record<
        Lowercase<BirdCoderApiRouteDefinition['method']>,
        {
          operationId: string;
          summary: string;
          tags: BirdCoderApiSurface[];
        }
      >
    >
  >;
}

const BIRD_SERVER_DISTRIBUTIONS = {
  global: {
    id: 'global',
    appId: 'sdkwork-birdcoder',
    appName: 'SDKWork BirdCoder',
    apiBaseUrl: 'https://api.sdkwork.com/birdcoder',
  },
  cn: {
    id: 'cn',
    appId: 'sdkwork-birdcoder-cn',
    appName: 'SDKWork BirdCoder',
    apiBaseUrl: 'https://cn.sdkwork.local/birdcoder',
  },
} as const;

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
  descriptor: createRoute('core', 'host', 'GET', '/api/core/v1/descriptor', 'Get coding-server descriptor'),
  engineCapabilities: createRoute(
    'core',
    'host',
    'GET',
    '/api/core/v1/engines/:engineKey/capabilities',
    'Get runtime capabilities for one engine',
  ),
  engines: createRoute('core', 'host', 'GET', '/api/core/v1/engines', 'List available engines'),
  events: createRoute(
    'core',
    'host',
    'GET',
    '/api/core/v1/coding-sessions/:id/events',
    'Replay or subscribe to coding session events',
  ),
  health: createRoute('core', 'host', 'GET', '/api/core/v1/health', 'Get coding-server health'),
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
  deployments: createRoute('app', 'user', 'GET', '/api/app/v1/deployments', 'List deployments'),
  documents: createRoute('app', 'user', 'GET', '/api/app/v1/documents', 'List project documents'),
  projects: createRoute('app', 'user', 'GET', '/api/app/v1/projects', 'List projects'),
  teams: createRoute('app', 'user', 'GET', '/api/app/v1/teams', 'List workspace teams'),
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
): BirdServerRuntime {
  const distribution = BIRD_SERVER_DISTRIBUTIONS[distributionId];

  return {
    ...createBirdHostDescriptorFromDistribution('server', distribution),
    host: BIRD_SERVER_DEFAULT_HOST,
    port: BIRD_SERVER_DEFAULT_PORT,
    configFileName: BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME,
  };
}

export function bindBirdCoderServerRuntimeTransport(
  options: BindBirdCoderServerRuntimeTransportOptions = {},
): BirdServerRuntime {
  const host = options.host ?? resolveServerRuntime(options.distributionId);
  bindDefaultBirdCoderIdeServicesRuntime({
    appAdminClient: options.appAdminClient,
    apiBaseUrl: options.apiBaseUrl,
    host,
  });
  return host;
}

export function getBirdCoderCodingServerDescriptor(
  hostMode: BirdCoderHostMode = 'server',
): BirdCoderCodingServerDescriptor {
  return {
    apiVersion: BIRDCODER_CODING_SERVER_API_VERSION,
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
    createRoute('core', 'host', 'GET', '/api/core/v1/models', 'List model catalog'),
    createRoute('core', 'host', 'GET', '/api/core/v1/coding-sessions/:id', 'Get coding session'),
    ...Object.values(APP_API_CONTRACT),
    ...Object.values(ADMIN_API_CONTRACT),
  ];
}

export function buildBirdCoderCodingServerOpenApiDocument(
  distributionId: BirdServerDistributionId = 'global',
): BirdCoderCodingServerOpenApiDocumentSeed {
  const serverRuntime = resolveServerRuntime(distributionId);
  const routes = listBirdCoderCodingServerRoutes();
  const operationIds = new Map<string, string>([
    ['/api/core/v1/descriptor', 'core.getDescriptor'],
    ['/api/core/v1/engines', 'core.listEngines'],
    ['/api/core/v1/engines/:engineKey/capabilities', 'core.getEngineCapabilities'],
    ['/api/core/v1/models', 'core.listModels'],
    ['/api/core/v1/runtime', 'core.getRuntime'],
    ['/api/core/v1/health', 'core.getHealth'],
    ['/api/core/v1/coding-sessions', 'core.createCodingSession'],
    ['/api/core/v1/coding-sessions/:id', 'core.getCodingSession'],
    ['/api/core/v1/coding-sessions/:id/turns', 'core.createCodingSessionTurn'],
    ['/api/core/v1/coding-sessions/:id/events', 'core.listCodingSessionEvents'],
    ['/api/core/v1/coding-sessions/:id/artifacts', 'core.listCodingSessionArtifacts'],
    ['/api/core/v1/coding-sessions/:id/checkpoints', 'core.listCodingSessionCheckpoints'],
    ['/api/core/v1/approvals/:approvalId/decision', 'core.submitApprovalDecision'],
    ['/api/core/v1/operations/:operationId', 'core.getOperation'],
    ['/api/app/v1/workspaces', 'app.listWorkspaces'],
    ['/api/app/v1/projects', 'app.listProjects'],
    ['/api/app/v1/documents', 'app.listDocuments'],
    ['/api/app/v1/teams', 'app.listTeams'],
    ['/api/app/v1/deployments', 'app.listDeployments'],
    ['/api/admin/v1/audit', 'admin.listAuditEvents'],
    ['/api/admin/v1/policies', 'admin.listPolicies'],
    ['/api/admin/v1/teams', 'admin.listTeams'],
    ['/api/admin/v1/teams/:teamId/members', 'admin.listTeamMembers'],
    ['/api/admin/v1/projects/:projectId/deployment-targets', 'admin.listDeploymentTargets'],
    ['/api/admin/v1/releases', 'admin.listReleases'],
    ['/api/admin/v1/deployments', 'admin.listDeployments'],
  ]);

  const paths: BirdCoderCodingServerOpenApiDocumentSeed['paths'] = {};
  for (const route of routes) {
    const method = route.method.toLowerCase() as Lowercase<BirdCoderApiRouteDefinition['method']>;
    const operationId = operationIds.get(route.path) ?? `${route.surface}.${method}.${route.path}`;
    paths[route.path] = {
      ...(paths[route.path] ?? {}),
      [method]: {
        operationId,
        summary: route.summary,
        tags: [route.surface],
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'SDKWork BirdCoder Coding Server API',
      version: BIRDCODER_CODING_SERVER_API_VERSION,
    },
    servers: [
      {
        url: `http://${serverRuntime.host}:${serverRuntime.port}`,
      },
    ],
    tags: [{ name: 'core' }, { name: 'app' }, { name: 'admin' }],
    paths,
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
      transportKind: runtimeDescriptor.transportKind,
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
