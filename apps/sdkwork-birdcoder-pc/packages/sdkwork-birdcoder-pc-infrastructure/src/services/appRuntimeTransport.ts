import {
  assertWorkbenchServerImplementedEngineId,
  buildDefaultBirdCoderCodeEngineModelConfig,
  createBirdCoderCodeEngineModelConfigSyncPlan,
  listBirdCoderCodeEngineDescriptors,
  listBirdCoderCodeEngineModels,
  listBirdCoderCodeEngineNativeSessionProviders,
} from '@sdkwork/birdcoder-pc-codeengine';
import {
  BIRDCODER_APP_SDK_OPERATIONS,
} from '@sdkwork/birdcoder-pc-core/sdk/birdcoder-app';
import {
  BIRDCODER_FINALIZED_CODING_SERVER_OPENAPI_OPERATIONS,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  BIRDCODER_CODING_SERVER_API_PREFIXES,
  BIRDCODER_CODING_SERVER_API_VERSION,
  compareBirdCoderSessionSortTimestamp,
  resolveBirdCoderSessionSortTimestampString,
  stringifyBirdCoderApiJson,
  stringifyBirdCoderLongInteger,
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
  type BirdCoderCodeEngineModelConfig,
  type BirdCoderCoreHealthSummary,
  type BirdCoderCoreRuntimeSummary,
  type BirdCoderCreateCodingSessionRequest,
  type BirdCoderCreateCodingSessionTurnRequest,
  type BirdCoderDeleteCodingSessionResult,
  type BirdCoderDeleteCodingSessionMessageResult,
  type BirdCoderEditCodingSessionMessageRequest,
  type BirdCoderEditCodingSessionMessageResult,
  type BirdCoderForkCodingSessionRequest,
  type BirdCoderGetNativeSessionRequest,
  type BirdCoderHostMode,
  type BirdCoderListCodingSessionsRequest,
  type BirdCoderListNativeSessionsRequest,
  type BirdCoderNativeSessionDetail,
  type BirdCoderNativeSessionProviderSummary,
  type BirdCoderNativeSessionSummary,
  type BirdCoderProject,
  type BirdCoderSubmitApprovalDecisionRequest,
  type BirdCoderSubmitUserQuestionAnswerRequest,
  type BirdCoderUpdateCodingSessionRequest,
  type BirdCoderUserQuestionAnswerResult,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  BirdCoderCodingSessionListResult,
  IProjectService,
} from './interfaces/IProjectService.ts';
import { ProjectRuntimeLocationExecutionUnavailableError } from './interfaces/IProjectRuntimeLocationService.ts';
import type { IAppRuntimeReadService } from './interfaces/IAppRuntimeReadService.ts';
import { resolveRequiredCodingSessionSelection } from './codingSessionSelection.ts';
import { createBirdCoderLocalServerRequestId } from './localServerRequestId.ts';
import { randomString } from '@sdkwork/utils/id';
import {
  clampListPageSize,
  DEFAULT_LIST_PAGE_SIZE,
  MAX_LIST_PAGE_SIZE,
  normalizeOffsetListQuery,
  offsetFromPage,
  paginateItems,
} from '@sdkwork/utils/pagination';
import { createListEnvelope } from './sdkTransportShared.ts';

const IN_PROCESS_RUNTIME_SHIM_ERROR =
  'In-process BirdCoder app runtime does not execute live engine interactions. Start standalone-gateway host mode for approval, question, turn, and operation endpoints.';

function throwInProcessRuntimeShimError(operationId: string): never {
  throw new Error(`${IN_PROCESS_RUNTIME_SHIM_ERROR} (${operationId})`);
}

export interface CreateBirdCoderInProcessAppRuntimeTransportOptions {
  hostMode?: BirdCoderHostMode;
  nativeSessionProvider?: Pick<
    IAppRuntimeReadService,
    'getNativeSession' | 'listNativeSessionPage'
  >;
  observe?: (request: BirdCoderApiTransportRequest) => void;
  projectService: InProcessProjectService;
  runtime?: Partial<BirdCoderCoreRuntimeSummary>;
}

type InProcessProjectService = Pick<
  IProjectService,
  | 'addCodingSessionMessage'
  | 'createCodingSession'
  | 'deleteCodingSession'
  | 'deleteCodingSessionMessage'
  | 'editCodingSessionMessage'
  | 'forkCodingSession'
  | 'getCodingSessionTranscript'
  | 'getProjectById'
  | 'getProjects'
  | 'renameCodingSession'
  | 'updateCodingSession'
> &
  Partial<Pick<IProjectService, 'listCodingSessions'>>;

type RuntimeCodingSessionInventoryProjectService = Pick<
  IProjectService,
  'getProjectById' | 'getProjects'
> &
  Partial<Pick<IProjectService, 'listCodingSessions'>>;

interface ResolvedRouteOperation {
  operationId: string;
  pathParams: Record<string, string>;
}

type BirdCoderGeneratedSdkOperation =
  (typeof BIRDCODER_FINALIZED_CODING_SERVER_OPENAPI_OPERATIONS)[number];

const BIRDCODER_SPLIT_SDK_OPERATIONS = BIRDCODER_FINALIZED_CODING_SERVER_OPENAPI_OPERATIONS;

const DEFAULT_OPENAPI_PATH = '/openapi/coding-server-v1.json';
const DEFAULT_LIVE_OPENAPI_PATH = '/openapi.json';
const DEFAULT_DOCS_PATH = '/docs';
const DEFAULT_ROUTE_CATALOG_PATH = '/app/v3/api/system/routes';
const DEFAULT_RUNTIME_SUMMARY: BirdCoderCoreRuntimeSummary = {
  host: '127.0.0.1',
  port: 0,
  configFileName: 'birdcoder.in-process.json',
};

function buildInProcessCodeEngineModelConfig(): BirdCoderCodeEngineModelConfig {
  const updatedAt =
    listBirdCoderCodeEngineModels()
      .map((model) => Date.parse(model.updatedAt))
      .filter((timestamp) => Number.isFinite(timestamp))
      .sort((left, right) => right - left)[0] ?? Date.parse('2026-01-01T00:00:00.000Z');
  return buildDefaultBirdCoderCodeEngineModelConfig({
    source: 'server',
    updatedAt: new Date(updatedAt).toISOString(),
    version: BIRDCODER_CODING_SERVER_API_VERSION,
  });
}

const ROUTE_SURFACE_DESCRIPTIONS: Record<BirdCoderApiSurface, string> = {
  app: 'Application-facing coding runtime, workspace, project, collaboration, and IAM account routes.',
  backend: 'Backend governance, audit, release, deployment, and team-management routes.',
};

const ROUTE_AUTH_MODE_BY_SURFACE = {
  app: 'user',
  backend: 'admin',
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
    code: 0,
    data: { item: data },
    traceId: createBirdCoderLocalServerRequestId(),
  };
}

function normalizeText(value: string | null | undefined): string | undefined {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizePositiveIntegerQueryValue(value: BirdCoderApiQueryValue): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : undefined;
  }
  return undefined;
}

function readOffsetListPageParams(
  query: BirdCoderApiTransportRequest['query'],
): { offset: number; pageSize: number } {
  const normalized = normalizeOffsetListQuery({
    page: normalizePositiveIntegerQueryValue(query?.page),
    page_size: normalizePositiveIntegerQueryValue(query?.page_size),
  });
  return {
    offset: offsetFromPage(normalized.page, normalized.page_size),
    pageSize: normalized.page_size,
  };
}

function readTextQueryValue(value: BirdCoderApiQueryValue): string | undefined {
  return typeof value === 'string' ? normalizeText(value) : undefined;
}

function readRequiredTextQueryValue(
  value: BirdCoderApiQueryValue,
  name: string,
): string {
  const normalized = readTextQueryValue(value)?.trim();
  if (!normalized) {
    throw new Error(`${name} is required for native session operations.`);
  }
  return normalized;
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

function getOrderedCodingSessionMessages(
  messages: readonly BirdCoderCodingSession['messages'][number][],
): readonly BirdCoderCodingSession['messages'][number][] {
  for (let index = 1; index < messages.length; index += 1) {
    if (compareCodingSessionMessages(messages[index - 1]!, messages[index]!) > 0) {
      return [...messages].sort(compareCodingSessionMessages);
    }
  }

  return messages;
}

function toCodingSessionSummary(
  session: BirdCoderCodingSession,
): BirdCoderCodingSessionSummary {
  return {
    id: session.id,
    workspaceId: session.workspaceId,
    projectId: session.projectId,
    runtimeLocationId: session.runtimeLocationId,
    title: session.title,
    status: session.status,
    hostMode: session.hostMode,
    engineId: session.engineId,
    modelId: session.modelId,
    nativeSessionId: session.nativeSessionId,
    runtimeStatus: session.runtimeStatus,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastTurnAt: session.lastTurnAt,
    sortTimestamp: session.sortTimestamp,
    transcriptUpdatedAt: session.transcriptUpdatedAt,
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
    sequence: stringifyBirdCoderLongInteger(sequence),
    payload,
    createdAt,
  };
}

function buildProjectionEvents(
  session: BirdCoderCodingSession,
): BirdCoderCodingSessionEvent[] {
  const messages = getOrderedCodingSessionMessages(session.messages);
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
          engineId: session.engineId,
          modelId: session.modelId,
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
      payload.commands = message.commands;
    }
    if (message.tool_calls && message.tool_calls.length > 0) {
      payload.toolCalls = message.tool_calls;
    }
    if (message.tool_call_id) {
      payload.toolCallId = message.tool_call_id;
    }
    if (message.fileChanges && message.fileChanges.length > 0) {
      payload.fileChanges = message.fileChanges;
    }
    if (message.taskProgress) {
      payload.taskProgress = message.taskProgress;
    }

    events.push({
      id: `${session.id}:${message.id}:message.completed`,
      codingSessionId: session.id,
      turnId,
      runtimeId: resolveTurnRuntimeId(session.id, turnId),
      kind: 'message.completed',
      sequence: stringifyBirdCoderLongInteger(sequence),
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

function readFileChangePath(fileChange: unknown): string | undefined {
  const record = readRecord(fileChange);
  if (!record) {
    return undefined;
  }
  const pathValue =
    typeof record.path === 'string'
      ? record.path
      : typeof record.filePath === 'string'
        ? record.filePath
        : undefined;
  return normalizeText(pathValue);
}

function buildProjectionArtifacts(
  session: BirdCoderCodingSession,
): BirdCoderCodingSessionArtifact[] {
  const messages = getOrderedCodingSessionMessages(session.messages);
  const artifacts: BirdCoderCodingSessionArtifact[] = [];

  for (const message of messages) {
    const turnId = normalizeText(message.turnId) ?? session.id;
    for (const [index, fileChange] of (message.fileChanges ?? []).entries()) {
      const path = readFileChangePath(fileChange);
      if (!path) {
        continue;
      }
      artifacts.push({
        id: `${session.id}:${message.id}:artifact:${index}`,
        codingSessionId: session.id,
        turnId,
        kind: 'patch',
        status: 'sealed',
        title: path,
        blobRef: path,
        metadata: readRecord(fileChange) ?? {},
        createdAt: message.createdAt,
      });
    }
  }

  return artifacts;
}

function buildProjectionCheckpoints(
  session: BirdCoderCodingSession,
): BirdCoderCodingSessionCheckpoint[] {
  const messages = getOrderedCodingSessionMessages(session.messages);
  const checkpoints: BirdCoderCodingSessionCheckpoint[] = [];

  for (const message of messages) {
    const turnId = normalizeText(message.turnId);
    for (const [index, command] of (message.commands ?? []).entries()) {
      const commandRecord = readRecord(command);
      if (!commandRecord) {
        continue;
      }
      const requiresApproval = commandRecord.requiresApproval === true;
      const requiresReply = commandRecord.requiresReply === true;
      if (!requiresApproval && !requiresReply) {
        continue;
      }
      checkpoints.push({
        id: `${session.id}:${message.id}:checkpoint:${index}`,
        codingSessionId: session.id,
        runtimeId: resolveTurnRuntimeId(session.id, turnId),
        checkpointKind: requiresApproval ? 'approval' : 'snapshot',
        resumable: true,
        state: commandRecord,
        createdAt: message.createdAt,
      });
    }
  }

  return checkpoints;
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

function resolveCodingSessionPathParam(pathParams: Record<string, string>): string {
  return pathParams.sessionId ?? pathParams.id ?? '';
}

function resolveRouteOperation(
  request: BirdCoderApiTransportRequest,
): ResolvedRouteOperation | null {
  for (const operation of BIRDCODER_APP_SDK_OPERATIONS) {
    if (operation.method !== request.method) {
      continue;
    }
    const pathParams = matchOperationPath(operation.path, request.path);
    if (!pathParams) {
      continue;
    }

    return {
      operationId: operation.operationId,
      pathParams,
    };
  }

  return null;
}

function toRouteCatalogEntry(
  operation: BirdCoderGeneratedSdkOperation,
): BirdCoderApiRouteCatalogEntry {
  const surface: BirdCoderApiSurface =
    operation.surface === 'backend' ? 'backend' : 'app';
  return {
    authMode: ROUTE_AUTH_MODE_BY_SURFACE[surface],
    method: operation.method,
    path: operation.path,
    surface,
    summary: operation.summary,
    openApiPath: operation.path,
    operationId: operation.operationId,
  };
}

function createGatewaySummary(): BirdCoderApiGatewaySummary {
  const routeEntries = BIRDCODER_SPLIT_SDK_OPERATIONS.map(toRouteCatalogEntry);
  const routesBySurface = routeEntries.reduce<Record<BirdCoderApiSurface, number>>(
    (summary, route) => {
      summary[route.surface] += 1;
      return summary;
    },
    {
      app: 0,
      backend: 0,
    },
  );

  return {
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
    surfaces: ['app', 'backend'],
  };
}

function matchesCodingSessionListRequest(
  session: BirdCoderCodingSession,
  filters: BirdCoderListCodingSessionsRequest,
): boolean {
  return !(
    (filters.workspaceId && session.workspaceId !== filters.workspaceId) ||
    (filters.projectId && session.projectId !== filters.projectId) ||
    (filters.engineId && session.engineId !== filters.engineId)
  );
}

function compareRuntimeCodingSessions(
  left: BirdCoderCodingSession,
  right: BirdCoderCodingSession,
): number {
  return (
    compareBirdCoderSessionSortTimestamp(right, left) ||
    left.id.localeCompare(right.id)
  );
}

function resolveNativeSessionProviderPrefix(engineId: string): string {
  return (
    listBirdCoderCodeEngineNativeSessionProviders().find(
      (provider) => provider.engineId === engineId,
    )?.nativeSessionIdPrefix ?? `${engineId}-native:`
  );
}

function resolveLogicalNativeSessionIdentity(
  summary: BirdCoderCodingSessionSummary,
): string | null {
  const engineId = normalizeText(summary.engineId)?.toLowerCase();
  const nativeSessionId = normalizeText(summary.nativeSessionId);
  return engineId && nativeSessionId ? `native:${engineId}:${nativeSessionId}` : null;
}

function resolveNativeInventorySessionIdentity(
  summary: BirdCoderNativeSessionSummary,
): string | null {
  const engineId = normalizeText(summary.engineId)?.toLowerCase();
  const providerPrefix = engineId
    ? resolveNativeSessionProviderPrefix(summary.engineId)
    : undefined;
  const candidate = normalizeText(summary.nativeSessionId) ?? normalizeText(summary.id);
  const nativeSessionId =
    providerPrefix && candidate?.startsWith(providerPrefix)
      ? candidate.slice(providerPrefix.length).trim()
      : candidate;
  return engineId && nativeSessionId ? `native:${engineId}:${nativeSessionId}` : null;
}

function resolveLatestTimestamp(
  left: string | null | undefined,
  right: string | null | undefined,
): string | undefined {
  if (!left) {
    return right || undefined;
  }
  if (!right) {
    return left;
  }
  return Date.parse(right) > Date.parse(left) ? right : left;
}

function mergeLogicalAndNativeSessionSummaries(
  logical: BirdCoderCodingSessionSummary,
  native: BirdCoderCodingSessionSummary,
): BirdCoderCodingSessionSummary {
  const nativeHasNewerActivity = compareBirdCoderSessionSortTimestamp(native, logical) > 0;
  const activity = nativeHasNewerActivity ? native : logical;
  return {
    ...logical,
    // The logical session owns selection and scope. A native inventory item is
    // only allowed to contribute provider activity after both identities match.
    status: activity.status,
    hostMode: activity.hostMode,
    runtimeStatus: activity.runtimeStatus ?? logical.runtimeStatus,
    nativeSessionId: logical.nativeSessionId,
    nativeAttributes: native.nativeAttributes ?? logical.nativeAttributes,
    updatedAt: resolveLatestTimestamp(logical.updatedAt, native.updatedAt) ?? logical.updatedAt,
    lastTurnAt: resolveLatestTimestamp(logical.lastTurnAt, native.lastTurnAt),
    sortTimestamp: nativeHasNewerActivity
      ? native.sortTimestamp ?? logical.sortTimestamp
      : logical.sortTimestamp ?? native.sortTimestamp,
    transcriptUpdatedAt:
      resolveLatestTimestamp(logical.transcriptUpdatedAt, native.transcriptUpdatedAt) ?? null,
  };
}

function mergeNativeInventorySessionSummaries(
  existing: BirdCoderCodingSessionSummary,
  incoming: BirdCoderCodingSessionSummary,
): BirdCoderCodingSessionSummary {
  const incomingHasNewerActivity = compareBirdCoderSessionSortTimestamp(incoming, existing) > 0;
  const activity = incomingHasNewerActivity ? incoming : existing;
  return {
    ...existing,
    title: activity.title,
    status: activity.status,
    hostMode: activity.hostMode,
    modelId: activity.modelId,
    nativeSessionId: existing.nativeSessionId ?? incoming.nativeSessionId,
    runtimeStatus: activity.runtimeStatus ?? existing.runtimeStatus,
    nativeAttributes: activity.nativeAttributes ?? existing.nativeAttributes,
    updatedAt: resolveLatestTimestamp(existing.updatedAt, incoming.updatedAt) ?? existing.updatedAt,
    lastTurnAt: resolveLatestTimestamp(existing.lastTurnAt, incoming.lastTurnAt),
    sortTimestamp: incomingHasNewerActivity
      ? incoming.sortTimestamp ?? existing.sortTimestamp
      : existing.sortTimestamp ?? incoming.sortTimestamp,
    transcriptUpdatedAt:
      resolveLatestTimestamp(existing.transcriptUpdatedAt, incoming.transcriptUpdatedAt) ?? null,
  };
}

function resolveNativeOnlySessionRecordId(
  summary: BirdCoderCodingSessionSummary,
  records: ReadonlyMap<string, BirdCoderCodingSessionSummary>,
): string {
  if (!records.has(summary.id)) {
    return summary.id;
  }
  const providerPrefix = resolveNativeSessionProviderPrefix(summary.engineId);
  const candidate = normalizeText(summary.nativeSessionId) ?? normalizeText(summary.id) ?? 'session';
  const rawNativeSessionId = candidate.startsWith(providerPrefix)
    ? candidate.slice(providerPrefix.length).trim()
    : candidate;
  const baseId = `${providerPrefix}${rawNativeSessionId || 'session'}`;
  let resolvedId = baseId;
  let suffix = 2;
  while (records.has(resolvedId)) {
    resolvedId = `${baseId}:${suffix}`;
    suffix += 1;
  }
  return resolvedId;
}

/**
 * The coding-session list is the workbench inventory authority. Native
 * providers still expose their dedicated route for detail/recovery, but list
 * consumers must receive one stable, deduplicated page from this operation.
 */
async function listUnifiedCodingSessionsForRuntime(
  projectService: RuntimeCodingSessionInventoryProjectService,
  nativeSessionProvider: CreateBirdCoderInProcessAppRuntimeTransportOptions['nativeSessionProvider'],
  request: BirdCoderListCodingSessionsRequest,
): Promise<{ items: BirdCoderCodingSessionSummary[]; total: number }> {
  const requestedLimit = request.limit ?? DEFAULT_LIST_PAGE_SIZE;
  const requestedOffset = request.offset ?? 0;
  const targetEnd = requestedOffset + requestedLimit;
  const projectionPage = await listCodingSessionsForRuntime(projectService, {
    ...request,
    offset: 0,
    limit: targetEnd,
  });
  const nativePage =
    nativeSessionProvider && request.projectId && request.runtimeLocationId && request.workspaceId
      ? await nativeSessionProvider.listNativeSessionPage({
          engineId: request.engineId,
          projectId: request.projectId,
          runtimeLocationId: request.runtimeLocationId,
          workspaceId: request.workspaceId,
          offset: 0,
          limit: targetEnd,
        })
      : null;

  const records = new Map<string, BirdCoderCodingSessionSummary>();
  const logicalSessionIdsByNativeIdentity = new Map<string, string>();
  const nativeSessionIdsByIdentity = new Map<string, string>();
  let matchedNativeCount = 0;
  for (const summary of projectionPage.items.map(toCodingSessionSummary)) {
    records.set(summary.id, summary);
    const nativeIdentity = resolveLogicalNativeSessionIdentity(summary);
    if (nativeIdentity) {
      logicalSessionIdsByNativeIdentity.set(nativeIdentity, summary.id);
    }
  }
  for (const summary of nativePage?.items ?? []) {
    const identity = resolveNativeInventorySessionIdentity(summary);
    const logicalSessionId = identity
      ? logicalSessionIdsByNativeIdentity.get(identity)
      : undefined;
    const logical = logicalSessionId ? records.get(logicalSessionId) : undefined;
    if (logical && logical.engineId === summary.engineId) {
      matchedNativeCount += 1;
      records.set(logical.id, mergeLogicalAndNativeSessionSummaries(logical, summary));
      continue;
    }

    const existingNativeSessionId = identity
      ? nativeSessionIdsByIdentity.get(identity)
      : undefined;
    const existingNative = existingNativeSessionId
      ? records.get(existingNativeSessionId)
      : undefined;
    if (existingNative && existingNative.engineId === summary.engineId) {
      records.set(
        existingNative.id,
        mergeNativeInventorySessionSummaries(existingNative, summary),
      );
      continue;
    }

    const id = resolveNativeOnlySessionRecordId(summary, records);
    const nativeOnlySummary = id === summary.id ? summary : { ...summary, id };
    records.set(nativeOnlySummary.id, nativeOnlySummary);
    if (identity) {
      nativeSessionIdsByIdentity.set(identity, nativeOnlySummary.id);
    }
  }

  const uniqueItems = [...records.values()].sort((left, right) =>
    compareBirdCoderSessionSortTimestamp(right, left) || left.id.localeCompare(right.id),
  );
  const items = uniqueItems.slice(requestedOffset, targetEnd);
  const nativeTotal = nativePage ? Number(nativePage.pageInfo.totalItems) : 0;
  return {
    items,
    total: Math.max(uniqueItems.length, projectionPage.total + nativeTotal - matchedNativeCount),
  };
}

function pushCodingSessionIntoSortedWindow(
  items: BirdCoderCodingSession[],
  session: BirdCoderCodingSession,
  capacity: number,
): void {
  if (capacity <= 0) {
    return;
  }

  const insertionIndex = items.findIndex(
    (candidate) => compareRuntimeCodingSessions(session, candidate) < 0,
  );
  if (insertionIndex === -1) {
    items.push(session);
  } else {
    items.splice(insertionIndex, 0, session);
  }
  if (items.length > capacity) {
    items.pop();
  }
}

async function readCodingSessionProjectInventoryPages(
  projectService: Pick<IProjectService, 'getProjects'>,
  workspaceId: string | undefined,
  visitProject: (project: BirdCoderProject) => boolean | void,
): Promise<void> {
  let projectOffset = 0;

  while (true) {
    const projects = await projectService.getProjects(workspaceId, {
      offset: projectOffset,
      limit: MAX_LIST_PAGE_SIZE,
    });
    for (const project of projects) {
      if (visitProject(project) === false) {
        return;
      }
    }
    if (projects.length < MAX_LIST_PAGE_SIZE) {
      return;
    }
    projectOffset += MAX_LIST_PAGE_SIZE;
  }
}

async function findCodingSessionFromProjectInventory(
  projectService: Pick<IProjectService, 'getProjectById' | 'getProjects'>,
  filters: BirdCoderListCodingSessionsRequest,
  codingSessionId: string,
): Promise<BirdCoderCodingSession | null> {
  const visitProject = (project: BirdCoderProject | null): BirdCoderCodingSession | null => {
    if (
      !project ||
      (filters.workspaceId && project.workspaceId !== filters.workspaceId) ||
      (filters.projectId && project.id !== filters.projectId)
    ) {
      return null;
    }
    return (
      project.codingSessions.find(
        (session) =>
          session.id === codingSessionId &&
          matchesCodingSessionListRequest(session, filters),
      ) ?? null
    );
  };

  if (filters.projectId) {
    return visitProject(await projectService.getProjectById(filters.projectId));
  }

  let match: BirdCoderCodingSession | null = null;
  await readCodingSessionProjectInventoryPages(
    projectService,
    filters.workspaceId,
    (project) => {
      if (!match) {
        match = visitProject(project);
      }
      return match ? false : undefined;
    },
  );
  return match;
}

async function listCodingSessionsFromProjectInventory(
  projectService: Pick<IProjectService, 'getProjectById' | 'getProjects'>,
  request: BirdCoderListCodingSessionsRequest,
): Promise<BirdCoderCodingSessionListResult> {
  const { offset, pageSize } = clampListPageSize(request.offset, request.limit);
  const pageCapacity = offset + pageSize;
  const items: BirdCoderCodingSession[] = [];
  let total = 0;

  const visitProject = (project: BirdCoderProject | null): void => {
    if (!project) {
      return;
    }
    if (
      (request.workspaceId && project.workspaceId !== request.workspaceId) ||
      (request.projectId && project.id !== request.projectId)
    ) {
      return;
    }
    for (const session of project.codingSessions) {
      if (!matchesCodingSessionListRequest(session, request)) {
        continue;
      }
      total += 1;
      pushCodingSessionIntoSortedWindow(items, session, pageCapacity);
    }
  };

  if (request.projectId) {
    visitProject(await projectService.getProjectById(request.projectId));
  } else {
    await readCodingSessionProjectInventoryPages(
      projectService,
      request.workspaceId,
      visitProject,
    );
  }

  return {
    items: readSortedWindowPage(items, offset, pageSize),
    total,
  };
}

function readSortedWindowPage<TItem>(
  sortedWindow: readonly TItem[],
  offset: number,
  pageSize: number,
): TItem[] {
  const pageItems: TItem[] = [];
  for (let index = offset; index < sortedWindow.length && pageItems.length < pageSize; index += 1) {
    const item = sortedWindow[index];
    if (item !== undefined) {
      pageItems.push(item);
    }
  }
  return pageItems;
}

async function listCodingSessionsForRuntime(
  projectService: RuntimeCodingSessionInventoryProjectService,
  request: BirdCoderListCodingSessionsRequest,
): Promise<BirdCoderCodingSessionListResult> {
  if (typeof projectService.listCodingSessions === 'function') {
    return projectService.listCodingSessions(request);
  }

  return listCodingSessionsFromProjectInventory(projectService, request);
}

async function findCodingSessionInPagedInventory(
  projectService: RuntimeCodingSessionInventoryProjectService,
  filters: BirdCoderListCodingSessionsRequest,
  codingSessionId: string,
): Promise<BirdCoderCodingSession | null> {
  if (typeof projectService.listCodingSessions !== 'function') {
    return findCodingSessionFromProjectInventory(projectService, filters, codingSessionId);
  }

  let offset = filters.offset ?? 0;
  const { pageSize } = clampListPageSize(offset, filters.limit ?? DEFAULT_LIST_PAGE_SIZE);

  while (true) {
    const page = await listCodingSessionsForRuntime(projectService, {
      ...filters,
      offset,
      limit: pageSize,
    });
    const match = page.items.find((session) => session.id === codingSessionId);
    if (match) {
      return match;
    }
    if (page.items.length < pageSize || offset + page.items.length >= page.total) {
      return null;
    }
    offset += pageSize;
  }
}

async function getCodingSessionById(
  projectService: RuntimeCodingSessionInventoryProjectService,
  codingSessionProjectIndex: Map<string, { projectId: string; workspaceId: string }>,
  knownWorkspaceIds: Set<string>,
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
        knownWorkspaceIds.add(cachedProject.workspaceId.trim());
      }
      codingSessionProjectIndex.set(codingSessionId, {
        projectId: cachedProject.id,
        workspaceId: cachedProject.workspaceId,
      });
      return cachedCodingSession;
    }

    const workspaceMatch = await findCodingSessionInPagedInventory(
      projectService,
      { workspaceId: cachedLocation.workspaceId },
      codingSessionId,
    );
    if (workspaceMatch) {
      codingSessionProjectIndex.set(workspaceMatch.id, {
        projectId: workspaceMatch.projectId,
        workspaceId: workspaceMatch.workspaceId,
      });
      if (workspaceMatch.workspaceId.trim()) {
        knownWorkspaceIds.add(workspaceMatch.workspaceId.trim());
      }
      return workspaceMatch;
    }

    codingSessionProjectIndex.delete(codingSessionId);
  }

  for (const workspaceId of knownWorkspaceIds) {
    const workspaceMatch = await findCodingSessionInPagedInventory(
      projectService,
      { workspaceId },
      codingSessionId,
    );
    if (workspaceMatch) {
      codingSessionProjectIndex.set(workspaceMatch.id, {
        projectId: workspaceMatch.projectId,
        workspaceId: workspaceMatch.workspaceId,
      });
      return workspaceMatch;
    }
  }

  const globalMatch = await findCodingSessionInPagedInventory(
    projectService,
    {},
    codingSessionId,
  );
  if (globalMatch) {
    codingSessionProjectIndex.set(globalMatch.id, {
      projectId: globalMatch.projectId,
      workspaceId: globalMatch.workspaceId,
    });
    if (globalMatch.workspaceId.trim()) {
      knownWorkspaceIds.add(globalMatch.workspaceId.trim());
    }
    return globalMatch;
  }

  throw new Error(`Coding session ${codingSessionId} not found.`);
}

async function getCodingSessionTranscriptById(
  projectService: RuntimeCodingSessionInventoryProjectService &
    Pick<IProjectService, 'getCodingSessionTranscript'>,
  codingSessionProjectIndex: Map<string, { projectId: string; workspaceId: string }>,
  knownWorkspaceIds: Set<string>,
  codingSessionId: string,
): Promise<BirdCoderCodingSession> {
  const codingSession = await getCodingSessionById(
    projectService,
    codingSessionProjectIndex,
    knownWorkspaceIds,
    codingSessionId,
  );
  if (typeof projectService.getCodingSessionTranscript !== 'function') {
    return codingSession;
  }

  const hydratedCodingSession = await projectService.getCodingSessionTranscript(
    codingSession.projectId,
    codingSession.id,
    {
      expectedTranscriptUpdatedAt: codingSession.transcriptUpdatedAt ?? null,
    },
  );
  if (!hydratedCodingSession) {
    return codingSession;
  }

  codingSessionProjectIndex.set(hydratedCodingSession.id, {
    projectId: hydratedCodingSession.projectId,
    workspaceId: hydratedCodingSession.workspaceId,
  });
  if (hydratedCodingSession.workspaceId.trim()) {
    knownWorkspaceIds.add(hydratedCodingSession.workspaceId.trim());
  }
  return hydratedCodingSession;
}

async function resolveProjectIdForCodingSession(
  projectService: RuntimeCodingSessionInventoryProjectService,
  codingSessionProjectIndex: Map<string, { projectId: string; workspaceId: string }>,
  knownWorkspaceIds: Set<string>,
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

export function createBirdCoderInProcessAppRuntimeTransport({
  hostMode = 'desktop',
  nativeSessionProvider,
  observe,
  projectService,
  runtime,
}: CreateBirdCoderInProcessAppRuntimeTransportOptions): BirdCoderApiTransport {
  const runtimeSummary: BirdCoderCoreRuntimeSummary = {
    ...DEFAULT_RUNTIME_SUMMARY,
    ...runtime,
  };
  const codingSessionProjectIndex = new Map<
    string,
    { projectId: string; workspaceId: string }
  >();
  const knownWorkspaceIds = new Set<string>();
  let serverModelConfig = buildInProcessCodeEngineModelConfig();

  return {
    async request<TResponse>(request: BirdCoderApiTransportRequest): Promise<TResponse> {
      observe?.(request);
      const resolvedOperation = resolveRouteOperation(request);
      if (!resolvedOperation) {
        throw new Error(`Unsupported BirdCoder app runtime route: ${request.method} ${request.path}`);
      }

      switch (resolvedOperation.operationId) {
        case 'descriptor.retrieve':
          return createEnvelope(createDescriptor(hostMode)) as TResponse;
        case 'runtime.retrieve':
          return createEnvelope(runtimeSummary) as TResponse;
        case 'health.retrieve':
          return createEnvelope<BirdCoderCoreHealthSummary>({
            status: 'healthy',
          }) as TResponse;
        case 'routes.list':
          return createListEnvelope(
            BIRDCODER_SPLIT_SDK_OPERATIONS.map(toRouteCatalogEntry),
          ) as TResponse;
        case 'engines.list':
          return createListEnvelope(listBirdCoderCodeEngineDescriptors()) as TResponse;
        case 'models.list':
          return createListEnvelope(listBirdCoderCodeEngineModels()) as TResponse;
        case 'modelConfig.retrieve':
          return createEnvelope(serverModelConfig) as TResponse;
        case 'modelConfig.update': {
          const syncPlan = createBirdCoderCodeEngineModelConfigSyncPlan({
            localConfig:
              request.body && typeof request.body === 'object' && 'localConfig' in request.body
                ? (request.body.localConfig as BirdCoderCodeEngineModelConfig)
                : null,
            serverConfig: serverModelConfig,
          });
          if (syncPlan.shouldWriteServer) {
            serverModelConfig = syncPlan.config;
          }
          return createEnvelope(syncPlan) as TResponse;
        }
        case 'nativeSessionProviders.list':
          return createListEnvelope<BirdCoderNativeSessionProviderSummary>(
            listBirdCoderCodeEngineNativeSessionProviders(),
          ) as TResponse;
        case 'engines.capabilities.retrieve': {
          const engineKey = resolvedOperation.pathParams.engineKey;
          const descriptor = listBirdCoderCodeEngineDescriptors().find(
            (candidate) => candidate.engineKey === engineKey,
          );
          if (!descriptor) {
            throw new Error(`Engine ${engineKey} not found.`);
          }
          return createEnvelope(descriptor.capabilityMatrix) as TResponse;
        }
        case 'codingSessions.list': {
          const { offset, pageSize } = readOffsetListPageParams(request.query);
          const page = await listUnifiedCodingSessionsForRuntime(projectService, nativeSessionProvider, {
            engineId: readTextQueryValue(request.query?.engineId) as
              | BirdCoderListCodingSessionsRequest['engineId']
              | undefined,
            projectId: readTextQueryValue(request.query?.projectId),
            runtimeLocationId: readTextQueryValue(request.query?.runtimeLocationId),
            workspaceId: readTextQueryValue(request.query?.workspaceId),
            offset,
            limit: pageSize,
          });
          for (const codingSession of page.items) {
            codingSessionProjectIndex.set(codingSession.id, {
              projectId: codingSession.projectId,
              workspaceId: codingSession.workspaceId,
            });
            const normalizedWorkspaceId = codingSession.workspaceId.trim();
            if (normalizedWorkspaceId) {
              knownWorkspaceIds.add(normalizedWorkspaceId);
            }
          }
          return createListEnvelope(page.items, {
            offset,
            pageSize,
            total: page.total,
          }) as TResponse;
        }
        case 'codingSessions.retrieve': {
          const codingSession = await getCodingSessionById(
            projectService,
            codingSessionProjectIndex,
            knownWorkspaceIds,
            resolveCodingSessionPathParam(resolvedOperation.pathParams),
          );
          return createEnvelope(toCodingSessionSummary(codingSession)) as TResponse;
        }
        case 'nativeSessions.list': {
          const { offset, pageSize } = readOffsetListPageParams(request.query);
          if (!nativeSessionProvider) {
            throw new Error(
              'Native session provider is unavailable in the in-process app runtime.',
            );
          }
          const page = await nativeSessionProvider.listNativeSessionPage({
            engineId: readTextQueryValue(request.query?.engineId) as
              | BirdCoderListNativeSessionsRequest['engineId']
              | undefined,
            projectId: readRequiredTextQueryValue(request.query?.projectId, 'projectId'),
            runtimeLocationId: readRequiredTextQueryValue(
              request.query?.runtimeLocationId,
              'runtimeLocationId',
            ),
            workspaceId: readRequiredTextQueryValue(request.query?.workspaceId, 'workspaceId'),
            offset,
            limit: pageSize,
          });
          return createListEnvelope(page.items, {
            offset,
            pageSize,
            total: Number(page.pageInfo.totalItems),
          }) as TResponse;
        }
        case 'nativeSessions.retrieve': {
          if (!nativeSessionProvider) {
            throw new Error(
              'Native session provider is unavailable in the in-process app runtime.',
            );
          }
          const detail = await nativeSessionProvider.getNativeSession(
            resolveCodingSessionPathParam(resolvedOperation.pathParams),
            {
              engineId: readTextQueryValue(request.query?.engineId) as
                | BirdCoderGetNativeSessionRequest['engineId']
                | undefined,
              projectId: readRequiredTextQueryValue(request.query?.projectId, 'projectId'),
              runtimeLocationId: readRequiredTextQueryValue(
                request.query?.runtimeLocationId,
                'runtimeLocationId',
              ),
              workspaceId: readRequiredTextQueryValue(request.query?.workspaceId, 'workspaceId'),
            },
          );
          return createEnvelope<BirdCoderNativeSessionDetail>(detail) as TResponse;
        }
        case 'codingSessions.events.list': {
          const { offset, pageSize } = readOffsetListPageParams(request.query);
          const codingSession = await getCodingSessionTranscriptById(
            projectService,
            codingSessionProjectIndex,
            knownWorkspaceIds,
            resolveCodingSessionPathParam(resolvedOperation.pathParams),
          );
          const page = paginateItems(buildProjectionEvents(codingSession), { limit: pageSize, offset });
          return createListEnvelope(page.items, {
            offset: page.offset,
            pageSize: page.pageSize,
            total: page.total,
          }) as TResponse;
        }
        case 'codingSessions.artifacts.list': {
          const { offset, pageSize } = readOffsetListPageParams(request.query);
          const codingSession = await getCodingSessionTranscriptById(
            projectService,
            codingSessionProjectIndex,
            knownWorkspaceIds,
            resolveCodingSessionPathParam(resolvedOperation.pathParams),
          );
          const page = paginateItems(buildProjectionArtifacts(codingSession), { limit: pageSize, offset });
          return createListEnvelope(page.items, {
            offset: page.offset,
            pageSize: page.pageSize,
            total: page.total,
          }) as TResponse;
        }
        case 'codingSessions.checkpoints.list': {
          const { offset, pageSize } = readOffsetListPageParams(request.query);
          const codingSession = await getCodingSessionTranscriptById(
            projectService,
            codingSessionProjectIndex,
            knownWorkspaceIds,
            resolveCodingSessionPathParam(resolvedOperation.pathParams),
          );
          const page = paginateItems(buildProjectionCheckpoints(codingSession), { limit: pageSize, offset });
          return createListEnvelope(page.items, {
            offset: page.offset,
            pageSize: page.pageSize,
            total: page.total,
          }) as TResponse;
        }
        case 'codingSessions.create': {
          const body = readRequestBody<BirdCoderCreateCodingSessionRequest>(request);
          const selection = resolveRequiredCodingSessionSelection({
            engineId: normalizeText(body.engineId),
            modelId: normalizeText(body.modelId),
          });
          const runtimeLocationId = normalizeText(body.runtimeLocationId);
          if (!runtimeLocationId) {
            throw new ProjectRuntimeLocationExecutionUnavailableError({
              code: 'missing_runtime_location_id',
              message: 'Coding-session creation requires a runtime-location binding.',
              projectId: body.projectId,
            });
          }
          assertWorkbenchServerImplementedEngineId(selection.engineId);
          const createdSession = await projectService.createCodingSession(
            body.projectId,
            normalizeText(body.title) ?? 'New Session',
            {
              engineId: selection.engineId,
              hostMode: body.hostMode ?? hostMode,
              modelId: selection.modelId,
              runtimeLocationId,
            },
          );
          if (createdSession.workspaceId !== body.workspaceId) {
            throw new Error(
              `Project ${body.projectId} does not belong to workspace ${body.workspaceId}.`,
            );
          }
          if (createdSession.workspaceId.trim()) {
            knownWorkspaceIds.add(createdSession.workspaceId.trim());
          }
          codingSessionProjectIndex.set(createdSession.id, {
            projectId: createdSession.projectId || body.projectId,
            workspaceId: createdSession.workspaceId,
          });
          return createEnvelope(toCodingSessionSummary(createdSession)) as TResponse;
        }
        case 'codingSessions.forks.create': {
          const codingSessionId = resolveCodingSessionPathParam(resolvedOperation.pathParams);
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
        case 'codingSessions.update': {
          const codingSessionId = resolveCodingSessionPathParam(resolvedOperation.pathParams);
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
        case 'codingSessions.delete': {
          const codingSessionId = resolveCodingSessionPathParam(resolvedOperation.pathParams);
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
        case 'codingSessions.turns.create':
          throwInProcessRuntimeShimError(resolvedOperation.operationId);
        case 'operations.retrieve':
          throwInProcessRuntimeShimError(resolvedOperation.operationId);
        case 'submitApprovalDecision':
          throwInProcessRuntimeShimError(resolvedOperation.operationId);
        case 'submitUserQuestionAnswer':
          throwInProcessRuntimeShimError(resolvedOperation.operationId);
        default:
          throw new Error(
            `Unsupported in-process BirdCoder app runtime operation: ${resolvedOperation.operationId}`,
          );
      }
    },
  };
}

