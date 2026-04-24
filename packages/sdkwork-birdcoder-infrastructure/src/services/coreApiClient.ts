import {
  assertWorkbenchServerImplementedEngineId,
  listBirdCoderCodeEngineDescriptors,
  listBirdCoderCodeEngineModels,
  listBirdCoderCodeEngineNativeSessionProviders,
} from '@sdkwork/birdcoder-codeengine';
import {
  BIRDCODER_CODING_SERVER_API_PREFIXES,
  BIRDCODER_CODING_SERVER_API_VERSION,
  BIRDCODER_FINALIZED_CODING_SERVER_CLIENT_OPERATIONS,
  resolveBirdCoderSessionSortTimestamp,
  type BirdCoderApiEnvelope,
  type BirdCoderApiGatewaySummary,
  type BirdCoderApiListEnvelope,
  type BirdCoderApiQueryValue,
  type BirdCoderApiRouteCatalogEntry,
  type BirdCoderApiSurface,
  type BirdCoderApiTransport,
  type BirdCoderApiTransportRequest,
  type BirdCoderApprovalDecisionResult,
  type BirdCoderCodingServerDescriptor,
  type BirdCoderCodingSession,
  type BirdCoderCodingSessionArtifact,
  type BirdCoderCodingSessionCheckpoint,
  type BirdCoderCodingSessionEvent,
  type BirdCoderCodingSessionMessageRole,
  type BirdCoderCodingSessionRuntimeStatus,
  type BirdCoderCodingSessionSummary,
  type BirdCoderCodingSessionTurn,
  type BirdCoderCoreHealthSummary,
  type BirdCoderCoreRuntimeSummary,
  type BirdCoderCreateCodingSessionRequest,
  type BirdCoderCreateCodingSessionTurnRequest,
  type BirdCoderDeleteCodingSessionResult,
  type BirdCoderDeleteCodingSessionMessageResult,
  type BirdCoderForkCodingSessionRequest,
  type BirdCoderHostMode,
  type BirdCoderListCodingSessionsRequest,
  type BirdCoderListNativeSessionsRequest,
  type BirdCoderNativeSessionDetail,
  type BirdCoderNativeSessionMessage,
  type BirdCoderNativeSessionProviderSummary,
  type BirdCoderNativeSessionSummary,
  type BirdCoderSubmitApprovalDecisionRequest,
  type BirdCoderUpdateCodingSessionRequest,
} from '@sdkwork/birdcoder-types';
import type { IProjectService } from './interfaces/IProjectService.ts';
import { resolveRequiredCodingSessionSelection } from './codingSessionSelection.ts';

export interface CreateBirdCoderInProcessCoreApiTransportOptions {
  hostMode?: BirdCoderHostMode;
  observe?: (request: BirdCoderApiTransportRequest) => void;
  projectService: Pick<
    IProjectService,
    | 'addCodingSessionMessage'
    | 'createCodingSession'
    | 'deleteCodingSession'
    | 'deleteCodingSessionMessage'
    | 'forkCodingSession'
    | 'getProjectById'
    | 'getProjects'
    | 'renameCodingSession'
    | 'updateCodingSession'
  >;
  runtime?: Partial<BirdCoderCoreRuntimeSummary>;
}

interface ResolvedRouteOperation {
  operationId: string;
  pathParams: Record<string, string>;
}

const DEFAULT_OPENAPI_PATH = '/openapi/coding-server-v1.json';
const DEFAULT_LIVE_OPENAPI_PATH = '/openapi.json';
const DEFAULT_DOCS_PATH = '/docs';
const DEFAULT_GATEWAY_BASE_PATH = '/api';
const DEFAULT_ROUTE_CATALOG_PATH = '/api/core/v1/routes';
const DEFAULT_RUNTIME_SUMMARY: BirdCoderCoreRuntimeSummary = {
  host: '127.0.0.1',
  port: 0,
  configFileName: 'birdcoder.in-process.json',
};

const ROUTE_SURFACE_DESCRIPTIONS: Record<BirdCoderApiSurface, string> = {
  core: 'Core coding runtime, engine catalog, session execution, and operation control.',
  app: 'Application-facing workspace, project, collaboration, and user-center routes.',
  admin: 'Administrative governance, audit, release, deployment, and team-management routes.',
};

const ROUTE_AUTH_MODE_BY_SURFACE = {
  core: 'host',
  app: 'user',
  admin: 'admin',
} as const;

const REQUEST_KIND_BY_MESSAGE_ROLE: Partial<
  Record<BirdCoderCodingSessionMessageRole, BirdCoderCreateCodingSessionTurnRequest['requestKind']>
> = {
  user: 'chat',
  planner: 'plan',
  reviewer: 'review',
  tool: 'tool',
};

const MESSAGE_ROLE_BY_REQUEST_KIND: Record<
  BirdCoderCreateCodingSessionTurnRequest['requestKind'],
  BirdCoderCodingSessionMessageRole
> = {
  chat: 'user',
  plan: 'planner',
  review: 'reviewer',
  tool: 'tool',
  apply: 'user',
};

function createEnvelope<TData>(data: TData): BirdCoderApiEnvelope<TData> {
  return {
    requestId: `req.core.${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    data,
    meta: {
      version: BIRDCODER_CODING_SERVER_API_VERSION,
    },
  };
}

function createListEnvelope<TItem>(
  items: readonly TItem[],
  options: {
    offset?: number;
    pageSize?: number;
    total?: number;
  } = {},
): BirdCoderApiListEnvelope<TItem> {
  const total = options.total ?? items.length;
  const pageSize =
    typeof options.pageSize === 'number' && Number.isFinite(options.pageSize) && options.pageSize > 0
      ? Math.floor(options.pageSize)
      : items.length;
  const offset =
    typeof options.offset === 'number' && Number.isFinite(options.offset) && options.offset > 0
      ? Math.floor(options.offset)
      : 0;
  const pageBase = pageSize > 0 ? pageSize : Math.max(items.length, 1);
  return {
    requestId: `req.core.list.${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    items: [...items],
    meta: {
      page: Math.floor(offset / pageBase) + 1,
      pageSize,
      total,
      version: BIRDCODER_CODING_SERVER_API_VERSION,
    },
  };
}

function normalizeText(value: string | null | undefined): string | undefined {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : undefined;
}

function normalizeLimit(value: BirdCoderApiQueryValue): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : undefined;
  }
  return undefined;
}

function normalizeOffset(value: BirdCoderApiQueryValue): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : undefined;
  }
  return undefined;
}

function paginateItems<TItem>(
  items: readonly TItem[],
  options: {
    limit?: number;
    offset?: number;
  } = {},
): {
  items: readonly TItem[];
  offset: number;
  pageSize: number;
  total: number;
} {
  const total = items.length;
  const offset = Math.max(options.offset ?? 0, 0);
  const normalizedOffset = offset > total ? total : offset;
  const limit = options.limit;
  const pagedItems =
    typeof limit === 'number' && Number.isFinite(limit) && limit > 0
      ? items.slice(normalizedOffset, normalizedOffset + Math.floor(limit))
      : items.slice(normalizedOffset);

  return {
    items: pagedItems,
    offset: normalizedOffset,
    pageSize:
      typeof limit === 'number' && Number.isFinite(limit) && limit > 0
        ? Math.floor(limit)
        : pagedItems.length,
    total,
  };
}

function readTextQueryValue(value: BirdCoderApiQueryValue): string | undefined {
  return typeof value === 'string' ? normalizeText(value) : undefined;
}

function compareCodingSessions(
  left: BirdCoderCodingSessionSummary,
  right: BirdCoderCodingSessionSummary,
): number {
  return (
    resolveBirdCoderSessionSortTimestamp(right) - resolveBirdCoderSessionSortTimestamp(left) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.id.localeCompare(right.id)
  );
}

function compareCodingSessionMessages(
  left: BirdCoderCodingSession['messages'][number],
  right: BirdCoderCodingSession['messages'][number],
): number {
  if (left.turnId && left.turnId === right.turnId && left.role !== right.role) {
    if (left.role === 'user') {
      return -1;
    }
    if (right.role === 'user') {
      return 1;
    }
  }

  return (
    Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
    left.role.localeCompare(right.role) ||
    left.id.localeCompare(right.id)
  );
}

function toCodingSessionSummary(
  session: BirdCoderCodingSession,
): BirdCoderCodingSessionSummary {
  return {
    id: session.id,
    workspaceId: session.workspaceId,
    projectId: session.projectId,
    title: session.title,
    status: session.status,
    hostMode: session.hostMode,
    engineId: session.engineId,
    modelId: session.modelId,
    runtimeStatus: session.runtimeStatus,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastTurnAt: session.lastTurnAt,
    sortTimestamp: session.sortTimestamp,
    transcriptUpdatedAt: session.transcriptUpdatedAt,
  };
}

function toNativeSessionMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, string> | undefined {
  if (!metadata) {
    return undefined;
  }

  const normalizedEntries = Object.entries(metadata)
    .map(([key, value]) => {
      if (typeof value === 'string') {
        return [key, value] as const;
      }
      if (
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null
      ) {
        return [key, String(value)] as const;
      }
      const serializedValue = JSON.stringify(value);
      return typeof serializedValue === 'string'
        ? ([key, serializedValue] as const)
        : null;
    })
    .filter((entry): entry is readonly [string, string] => !!entry && entry[1].trim().length > 0);

  return normalizedEntries.length > 0 ? Object.fromEntries(normalizedEntries) : undefined;
}

function toNativeSessionMessage(
  message: BirdCoderCodingSession['messages'][number],
): BirdCoderNativeSessionMessage {
  return {
    id: message.id,
    codingSessionId: message.codingSessionId,
    turnId: message.turnId,
    role: message.role,
    content: message.content,
    commands: message.commands?.map((command) => ({
      command: command.command,
      output: command.output,
      status: command.status,
    })),
    metadata: toNativeSessionMetadata(message.metadata),
    createdAt: message.createdAt,
  };
}

function toNativeSessionSummary(
  session: BirdCoderCodingSession,
): BirdCoderNativeSessionSummary {
  return {
    ...toCodingSessionSummary(session),
    kind: 'coding',
    nativeCwd: null,
    sortTimestamp:
      session.sortTimestamp ?? resolveBirdCoderSessionSortTimestamp(session),
    transcriptUpdatedAt: session.transcriptUpdatedAt ?? null,
  };
}

function resolveTurnRuntimeId(
  codingSessionId: string,
  turnId: string | undefined,
): string {
  return turnId ? `runtime:${turnId}` : `runtime:${codingSessionId}`;
}

function createTurnEvent(
  session: BirdCoderCodingSession,
  turnId: string,
  sequence: number,
  createdAt: string,
  kind: BirdCoderCodingSessionEvent['kind'],
  payload: Record<string, unknown>,
): BirdCoderCodingSessionEvent {
  return {
    id: `${session.id}:${turnId}:${sequence}:${kind}`,
    codingSessionId: session.id,
    turnId,
    runtimeId: resolveTurnRuntimeId(session.id, turnId),
    kind,
    sequence,
    payload,
    createdAt,
  };
}

function buildProjectionEvents(
  session: BirdCoderCodingSession,
): BirdCoderCodingSessionEvent[] {
  const messages = [...session.messages].sort(compareCodingSessionMessages);
  const events: BirdCoderCodingSessionEvent[] = [];
  let sequence = 1;

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const turnId = normalizeText(message.turnId);
    const previousTurnId = index > 0 ? normalizeText(messages[index - 1]?.turnId) : undefined;
    const nextTurnId =
      index + 1 < messages.length ? normalizeText(messages[index + 1]?.turnId) : undefined;

    if (turnId && turnId !== previousTurnId) {
      events.push(
        createTurnEvent(session, turnId, sequence, message.createdAt, 'turn.started', {
          inputSummary: message.content,
          requestKind: REQUEST_KIND_BY_MESSAGE_ROLE[message.role] ?? 'chat',
          runtimeStatus: 'streaming' satisfies BirdCoderCodingSessionRuntimeStatus,
        }),
      );
      sequence += 1;
    }

    const payload: Record<string, unknown> = {
      role: message.role,
      content: message.content,
      runtimeStatus: 'completed' satisfies BirdCoderCodingSessionRuntimeStatus,
    };
    if (message.commands && message.commands.length > 0) {
      payload.commandsJson = JSON.stringify(message.commands);
    }

    events.push({
      id: `${session.id}:${message.id}:message.completed`,
      codingSessionId: session.id,
      turnId,
      runtimeId: resolveTurnRuntimeId(session.id, turnId),
      kind: 'message.completed',
      sequence,
      payload,
      createdAt: message.createdAt,
    });
    sequence += 1;

    if (turnId && turnId !== nextTurnId) {
      events.push(
        createTurnEvent(session, turnId, sequence, message.createdAt, 'turn.completed', {
          finishReason: 'stop',
          runtimeStatus: 'completed' satisfies BirdCoderCodingSessionRuntimeStatus,
        }),
      );
      sequence += 1;
    }
  }

  return events;
}

function matchOperationPath(
  template: string,
  actualPath: string,
): Record<string, string> | null {
  const templateSegments = template.split('/').filter(Boolean);
  const actualSegments = actualPath.split('/').filter(Boolean);
  if (templateSegments.length !== actualSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let index = 0; index < templateSegments.length; index += 1) {
    const templateSegment = templateSegments[index];
    const actualSegment = actualSegments[index];
    if (
      templateSegment.startsWith('{') &&
      templateSegment.endsWith('}') &&
      templateSegment.length > 2
    ) {
      params[templateSegment.slice(1, -1)] = decodeURIComponent(actualSegment);
      continue;
    }

    if (templateSegment !== actualSegment) {
      return null;
    }
  }

  return params;
}

function resolveRouteOperation(
  request: BirdCoderApiTransportRequest,
): ResolvedRouteOperation | null {
  for (const [operationId, operation] of Object.entries(
    BIRDCODER_FINALIZED_CODING_SERVER_CLIENT_OPERATIONS,
  )) {
    if (operation.method !== request.method) {
      continue;
    }
    const pathParams = matchOperationPath(operation.path, request.path);
    if (!pathParams) {
      continue;
    }

    return {
      operationId,
      pathParams,
    };
  }

  return null;
}

function toRouteCatalogEntry(
  operationId: string,
  operation: (typeof BIRDCODER_FINALIZED_CODING_SERVER_CLIENT_OPERATIONS)[keyof typeof BIRDCODER_FINALIZED_CODING_SERVER_CLIENT_OPERATIONS],
): BirdCoderApiRouteCatalogEntry {
  return {
    authMode: ROUTE_AUTH_MODE_BY_SURFACE[operation.surface],
    method: operation.method,
    path: operation.path,
    surface: operation.surface,
    summary: operation.summary,
    openApiPath: operation.path,
    operationId,
  };
}

function createGatewaySummary(): BirdCoderApiGatewaySummary {
  const routeEntries = Object.entries(BIRDCODER_FINALIZED_CODING_SERVER_CLIENT_OPERATIONS).map(
    ([operationId, operation]) => toRouteCatalogEntry(operationId, operation),
  );
  const routesBySurface = routeEntries.reduce<Record<BirdCoderApiSurface, number>>(
    (summary, route) => {
      summary[route.surface] += 1;
      return summary;
    },
    {
      core: 0,
      app: 0,
      admin: 0,
    },
  );

  return {
    basePath: DEFAULT_GATEWAY_BASE_PATH,
    docsPath: DEFAULT_DOCS_PATH,
    liveOpenApiPath: DEFAULT_LIVE_OPENAPI_PATH,
    openApiPath: DEFAULT_OPENAPI_PATH,
    routeCatalogPath: DEFAULT_ROUTE_CATALOG_PATH,
    routeCount: routeEntries.length,
    routesBySurface,
    surfaces: (Object.keys(BIRDCODER_CODING_SERVER_API_PREFIXES) as BirdCoderApiSurface[]).map(
      (surface) => ({
        authMode: ROUTE_AUTH_MODE_BY_SURFACE[surface],
        basePath: BIRDCODER_CODING_SERVER_API_PREFIXES[surface],
        description: ROUTE_SURFACE_DESCRIPTIONS[surface],
        name: surface,
        routeCount: routesBySurface[surface],
      }),
    ),
  };
}

function createDescriptor(hostMode: BirdCoderHostMode): BirdCoderCodingServerDescriptor {
  return {
    apiVersion: BIRDCODER_CODING_SERVER_API_VERSION,
    gateway: createGatewaySummary(),
    hostMode,
    moduleId: 'coding-server',
    openApiPath: DEFAULT_OPENAPI_PATH,
    surfaces: ['core', 'app', 'admin'],
  };
}

async function listAllCodingSessions(
  projectService: Pick<IProjectService, 'getProjectById' | 'getProjects'>,
  codingSessionProjectIndex: Map<string, { projectId: string; workspaceId: string }>,
  knownWorkspaceIds: Set<string>,
  request: BirdCoderListCodingSessionsRequest | BirdCoderListNativeSessionsRequest = {},
): Promise<BirdCoderCodingSession[]> {
  const projects = await projectService.getProjects(request.workspaceId);
  for (const project of projects) {
    const normalizedWorkspaceId = project.workspaceId.trim();
    if (normalizedWorkspaceId) {
      knownWorkspaceIds.add(normalizedWorkspaceId);
    }
    for (const codingSession of project.codingSessions) {
      codingSessionProjectIndex.set(codingSession.id, {
        projectId: project.id,
        workspaceId: project.workspaceId,
      });
    }
  }
  const sessions = projects
    .filter((project) => {
      if (request.projectId && project.id !== request.projectId) {
        return false;
      }
      return true;
    })
    .flatMap((project) => project.codingSessions)
    .filter((session) => {
      if (request.engineId && session.engineId !== request.engineId) {
        return false;
      }
      return true;
    })
    .sort(compareCodingSessions);

  return sessions;
}

async function getCodingSessionById(
  projectService: Pick<IProjectService, 'getProjectById' | 'getProjects'>,
  codingSessionProjectIndex: Map<string, { projectId: string; workspaceId: string }>,
  knownWorkspaceIds: ReadonlySet<string>,
  codingSessionId: string,
): Promise<BirdCoderCodingSession> {
  const cachedLocation = codingSessionProjectIndex.get(codingSessionId);
  if (cachedLocation) {
    const cachedProject = await projectService.getProjectById(cachedLocation.projectId);
    const cachedCodingSession = cachedProject?.codingSessions.find(
      (candidate) => candidate.id === codingSessionId,
    );
    if (cachedProject && cachedCodingSession) {
      if (cachedProject.workspaceId.trim()) {
        (knownWorkspaceIds as Set<string>).add(cachedProject.workspaceId.trim());
      }
      codingSessionProjectIndex.set(codingSessionId, {
        projectId: cachedProject.id,
        workspaceId: cachedProject.workspaceId,
      });
      return cachedCodingSession;
    }

    const workspaceProjects = await projectService.getProjects(cachedLocation.workspaceId);
    for (const project of workspaceProjects) {
      for (const codingSession of project.codingSessions) {
        codingSessionProjectIndex.set(codingSession.id, {
          projectId: project.id,
          workspaceId: project.workspaceId,
        });
        if (codingSession.id === codingSessionId) {
          return codingSession;
        }
      }
    }

    codingSessionProjectIndex.delete(codingSessionId);
  }

  for (const workspaceId of knownWorkspaceIds) {
    const projects = await projectService.getProjects(workspaceId);
    for (const project of projects) {
      for (const codingSession of project.codingSessions) {
        codingSessionProjectIndex.set(codingSession.id, {
          projectId: project.id,
          workspaceId: project.workspaceId,
        });
        if (codingSession.id === codingSessionId) {
          return codingSession;
        }
      }
    }
  }

  if (knownWorkspaceIds.size === 0) {
    const projects = await projectService.getProjects();
    for (const project of projects) {
      if (project.workspaceId.trim()) {
        (knownWorkspaceIds as Set<string>).add(project.workspaceId.trim());
      }
      for (const codingSession of project.codingSessions) {
        codingSessionProjectIndex.set(codingSession.id, {
          projectId: project.id,
          workspaceId: project.workspaceId,
        });
        if (codingSession.id === codingSessionId) {
          return codingSession;
        }
      }
    }
  }

  throw new Error(`Coding session ${codingSessionId} not found.`);
}

async function resolveProjectIdForCodingSession(
  projectService: Pick<IProjectService, 'getProjectById' | 'getProjects'>,
  codingSessionProjectIndex: Map<string, { projectId: string; workspaceId: string }>,
  knownWorkspaceIds: ReadonlySet<string>,
  codingSessionId: string,
): Promise<string> {
  const cachedLocation = codingSessionProjectIndex.get(codingSessionId);
  if (cachedLocation) {
    return cachedLocation.projectId;
  }

  const codingSession = await getCodingSessionById(
    projectService,
    codingSessionProjectIndex,
    knownWorkspaceIds,
    codingSessionId,
  );
  const resolvedLocation = codingSessionProjectIndex.get(codingSession.id);
  if (!resolvedLocation) {
    throw new Error(`Project for coding session ${codingSessionId} not found.`);
  }

  return resolvedLocation.projectId;
}

function readRequestBody<TBody>(
  request: BirdCoderApiTransportRequest,
): TBody {
  if (!request.body || typeof request.body !== 'object') {
    throw new Error(`Request body is required for ${request.method} ${request.path}.`);
  }

  return request.body as TBody;
}

export function createBirdCoderInProcessCoreApiTransport({
  hostMode = 'desktop',
  observe,
  projectService,
  runtime,
}: CreateBirdCoderInProcessCoreApiTransportOptions): BirdCoderApiTransport {
  const runtimeSummary: BirdCoderCoreRuntimeSummary = {
    ...DEFAULT_RUNTIME_SUMMARY,
    ...runtime,
  };
  const codingSessionProjectIndex = new Map<
    string,
    { projectId: string; workspaceId: string }
  >();
  const knownWorkspaceIds = new Set<string>();

  return {
    async request<TResponse>(request: BirdCoderApiTransportRequest): Promise<TResponse> {
      observe?.(request);
      const resolvedOperation = resolveRouteOperation(request);
      if (!resolvedOperation) {
        throw new Error(`Unsupported BirdCoder core route: ${request.method} ${request.path}`);
      }

      switch (resolvedOperation.operationId) {
        case 'core.getDescriptor':
          return createEnvelope(createDescriptor(hostMode)) as TResponse;
        case 'core.getRuntime':
          return createEnvelope(runtimeSummary) as TResponse;
        case 'core.getHealth':
          return createEnvelope<BirdCoderCoreHealthSummary>({
            status: 'healthy',
          }) as TResponse;
        case 'core.listRoutes':
          return createListEnvelope(
            Object.entries(BIRDCODER_FINALIZED_CODING_SERVER_CLIENT_OPERATIONS).map(
              ([operationId, operation]) => toRouteCatalogEntry(operationId, operation),
            ),
          ) as TResponse;
        case 'core.listEngines':
          return createListEnvelope(listBirdCoderCodeEngineDescriptors()) as TResponse;
        case 'core.listModels':
          return createListEnvelope(listBirdCoderCodeEngineModels()) as TResponse;
        case 'core.listNativeSessionProviders':
          return createListEnvelope<BirdCoderNativeSessionProviderSummary>(
            listBirdCoderCodeEngineNativeSessionProviders(),
          ) as TResponse;
        case 'core.getEngineCapabilities': {
          const engineKey = resolvedOperation.pathParams.engineKey;
          const descriptor = listBirdCoderCodeEngineDescriptors().find(
            (candidate) => candidate.engineKey === engineKey,
          );
          if (!descriptor) {
            throw new Error(`Engine ${engineKey} not found.`);
          }
          return createEnvelope(descriptor.capabilityMatrix) as TResponse;
        }
        case 'core.listCodingSessions': {
          const codingSessions = await listAllCodingSessions(
            projectService,
            codingSessionProjectIndex,
            knownWorkspaceIds,
            {
              engineId: readTextQueryValue(request.query?.engineId),
              projectId: readTextQueryValue(request.query?.projectId),
              workspaceId: readTextQueryValue(request.query?.workspaceId),
            },
          );
          const page = paginateItems(codingSessions.map(toCodingSessionSummary), {
            limit: normalizeLimit(request.query?.limit),
            offset: normalizeOffset(request.query?.offset),
          });
          return createListEnvelope(page.items, {
            offset: page.offset,
            pageSize: page.pageSize,
            total: page.total,
          }) as TResponse;
        }
        case 'core.getCodingSession': {
          const codingSession = await getCodingSessionById(
            projectService,
            codingSessionProjectIndex,
            knownWorkspaceIds,
            resolvedOperation.pathParams.id,
          );
          return createEnvelope(toCodingSessionSummary(codingSession)) as TResponse;
        }
        case 'core.listNativeSessions': {
          const codingSessions = await listAllCodingSessions(
            projectService,
            codingSessionProjectIndex,
            knownWorkspaceIds,
            {
              engineId: readTextQueryValue(request.query?.engineId),
              projectId: readTextQueryValue(request.query?.projectId),
              workspaceId: readTextQueryValue(request.query?.workspaceId),
            },
          );
          const page = paginateItems(codingSessions.map(toNativeSessionSummary), {
            limit: normalizeLimit(request.query?.limit),
            offset: normalizeOffset(request.query?.offset),
          });
          return createListEnvelope(page.items, {
            offset: page.offset,
            pageSize: page.pageSize,
            total: page.total,
          }) as TResponse;
        }
        case 'core.getNativeSession': {
          const codingSession = await getCodingSessionById(
            projectService,
            codingSessionProjectIndex,
            knownWorkspaceIds,
            resolvedOperation.pathParams.id,
          );
          return createEnvelope<BirdCoderNativeSessionDetail>({
            summary: toNativeSessionSummary(codingSession),
            messages: [...codingSession.messages]
              .sort(compareCodingSessionMessages)
              .map(toNativeSessionMessage),
          }) as TResponse;
        }
        case 'core.listCodingSessionEvents': {
          const codingSession = await getCodingSessionById(
            projectService,
            codingSessionProjectIndex,
            knownWorkspaceIds,
            resolvedOperation.pathParams.id,
          );
          return createListEnvelope(buildProjectionEvents(codingSession)) as TResponse;
        }
        case 'core.listCodingSessionArtifacts':
          return createListEnvelope<BirdCoderCodingSessionArtifact>([]) as TResponse;
        case 'core.listCodingSessionCheckpoints':
          return createListEnvelope<BirdCoderCodingSessionCheckpoint>([]) as TResponse;
        case 'core.createCodingSession': {
          const body = readRequestBody<BirdCoderCreateCodingSessionRequest>(request);
          const selection = resolveRequiredCodingSessionSelection({
            engineId: normalizeText(body.engineId),
            modelId: normalizeText(body.modelId),
          });
          assertWorkbenchServerImplementedEngineId(selection.engineId);
          const createdSession = await projectService.createCodingSession(
            body.projectId,
            normalizeText(body.title) ?? 'New Session',
            {
              engineId: selection.engineId,
              hostMode: body.hostMode ?? hostMode,
              modelId: selection.modelId,
            },
          );
          if (createdSession.workspaceId !== body.workspaceId) {
            throw new Error(
              `Project ${body.projectId} does not belong to workspace ${body.workspaceId}.`,
            );
          }
          return createEnvelope(toCodingSessionSummary(createdSession)) as TResponse;
        }
        case 'core.forkCodingSession': {
          const codingSessionId = resolvedOperation.pathParams.id;
          const body = readRequestBody<BirdCoderForkCodingSessionRequest>(request);
          const projectId = await resolveProjectIdForCodingSession(
            projectService,
            codingSessionProjectIndex,
            knownWorkspaceIds,
            codingSessionId,
          );
          const forkedSession = await projectService.forkCodingSession(
            projectId,
            codingSessionId,
            normalizeText(body.title),
          );
          codingSessionProjectIndex.set(codingSessionId, {
            projectId,
            workspaceId: forkedSession.workspaceId,
          });
          codingSessionProjectIndex.set(forkedSession.id, {
            projectId,
            workspaceId: forkedSession.workspaceId,
          });
          return createEnvelope(toCodingSessionSummary(forkedSession)) as TResponse;
        }
        case 'core.updateCodingSession': {
          const codingSessionId = resolvedOperation.pathParams.id;
          const body = readRequestBody<BirdCoderUpdateCodingSessionRequest>(request);
          const projectId = await resolveProjectIdForCodingSession(
            projectService,
            codingSessionProjectIndex,
            knownWorkspaceIds,
            codingSessionId,
          );
          const title = normalizeText(body.title);
          const nextStatus = body.status;

          if (title) {
            await projectService.renameCodingSession(projectId, codingSessionId, title);
          }
          if (nextStatus || body.hostMode) {
            await projectService.updateCodingSession(projectId, codingSessionId, {
              ...(nextStatus ? { status: nextStatus } : {}),
              ...(body.hostMode ? { hostMode: body.hostMode } : {}),
            });
          }
          const updatedSession = await getCodingSessionById(
            projectService,
            codingSessionProjectIndex,
            knownWorkspaceIds,
            codingSessionId,
          );
          return createEnvelope(toCodingSessionSummary(updatedSession)) as TResponse;
        }
        case 'core.deleteCodingSession': {
          const codingSessionId = resolvedOperation.pathParams.id;
          const projectId = await resolveProjectIdForCodingSession(
            projectService,
            codingSessionProjectIndex,
            knownWorkspaceIds,
            codingSessionId,
          );
          await projectService.deleteCodingSession(projectId, codingSessionId);
          codingSessionProjectIndex.delete(codingSessionId);
          return createEnvelope<BirdCoderDeleteCodingSessionResult>({
            id: codingSessionId,
          }) as TResponse;
        }
        case 'core.deleteCodingSessionMessage': {
          const codingSessionId = resolvedOperation.pathParams.id;
          const messageId = resolvedOperation.pathParams.messageId;
          const projectId = await resolveProjectIdForCodingSession(
            projectService,
            codingSessionProjectIndex,
            knownWorkspaceIds,
            codingSessionId,
          );
          await projectService.deleteCodingSessionMessage(projectId, codingSessionId, messageId);
          return createEnvelope<BirdCoderDeleteCodingSessionMessageResult>({
            id: messageId,
            codingSessionId,
          }) as TResponse;
        }
        case 'core.createCodingSessionTurn': {
          const codingSessionId = resolvedOperation.pathParams.id;
          const body = readRequestBody<BirdCoderCreateCodingSessionTurnRequest>(request);
          const projectId = await resolveProjectIdForCodingSession(
            projectService,
            codingSessionProjectIndex,
            knownWorkspaceIds,
            codingSessionId,
          );
          const codingSession = await getCodingSessionById(
            projectService,
            codingSessionProjectIndex,
            knownWorkspaceIds,
            codingSessionId,
          );
          assertWorkbenchServerImplementedEngineId(codingSession.engineId);
          const turnId = `coding-turn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
          const createdMessage = await projectService.addCodingSessionMessage(
            projectId,
            codingSessionId,
            {
              turnId,
              role: MESSAGE_ROLE_BY_REQUEST_KIND[body.requestKind],
              content: body.inputSummary,
              metadata: body.ideContext ? { ideContext: body.ideContext } : undefined,
            },
          );
          return createEnvelope<BirdCoderCodingSessionTurn>({
            id: turnId,
            codingSessionId,
            runtimeId: normalizeText(body.runtimeId) ?? resolveTurnRuntimeId(codingSessionId, turnId),
            requestKind: body.requestKind,
            status: 'completed',
            inputSummary: body.inputSummary,
            startedAt: createdMessage.createdAt,
            completedAt: createdMessage.createdAt,
          }) as TResponse;
        }
        case 'core.getOperation':
          return createEnvelope({
            operationId: resolvedOperation.pathParams.operationId,
            status: 'succeeded',
            artifactRefs: [],
          }) as TResponse;
        case 'core.submitApprovalDecision': {
          const approvalId = resolvedOperation.pathParams.approvalId;
          const body = readRequestBody<BirdCoderSubmitApprovalDecisionRequest>(request);
          const result: BirdCoderApprovalDecisionResult = {
            approvalId,
            checkpointId: '',
            codingSessionId: '',
            decision: body.decision,
            decidedAt: new Date().toISOString(),
            operationId: '',
            operationStatus: 'succeeded',
            reason: normalizeText(body.reason),
            runtimeId: '',
            runtimeStatus: 'completed',
            turnId: '',
          };
          return createEnvelope(result) as TResponse;
        }
        default:
          throw new Error(
            `Unsupported in-process BirdCoder core operation: ${resolvedOperation.operationId}`,
          );
      }
    },
  };
}
