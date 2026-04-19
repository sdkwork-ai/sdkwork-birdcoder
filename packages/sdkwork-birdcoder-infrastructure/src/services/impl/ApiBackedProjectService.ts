import type {
  BirdCoderAppAdminApiClient,
  BirdCoderChatMessage,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSession,
  BirdCoderCodingSessionTurnIdeContext,
  BirdCoderCodingSessionSummary,
  BirdCoderCreateCodingSessionTurnRequest,
  BirdCoderCoreReadApiClient,
  BirdCoderCoreWriteApiClient,
  BirdCoderNativeSessionDetail,
  BirdCoderProject,
  BirdCoderProjectSummary,
} from '@sdkwork/birdcoder-types';
import {
  formatBirdCoderSessionActivityDisplayTime,
  resolveBirdCoderCodingSessionRuntimeStatus,
  resolveBirdCoderSessionSortTimestamp,
} from '@sdkwork/birdcoder-types';
import { isBirdCoderCodeEngineNativeSessionId } from '@sdkwork/birdcoder-codeengine';
import type { IAuthService } from '../interfaces/IAuthService.ts';
import type { IProjectSessionMirror } from '../interfaces/IProjectSessionMirror.ts';
import {
  buildBirdCoderAuthoritativeProjectionMessageId,
  mergeBirdCoderProjectionMessages,
} from '../codingSessionMessageProjection.ts';
import {
  isBirdCoderTransientApiError,
  retryBirdCoderTransientApiTask,
} from '../runtimeApiRetry.ts';
import type {
  BirdCoderCodingSessionMirrorSnapshot,
  BirdCoderProjectMirrorSnapshot,
  CreateCodingSessionOptions,
  CreateCodingSessionMessageInput,
  CreateProjectOptions,
  IProjectService,
} from '../interfaces/IProjectService.ts';

const ZERO_TIMESTAMP = new Date(0).toISOString();
const PROJECT_LIST_CACHE_TTL_MS = 30_000;
const PROJECT_DETAIL_CACHE_TTL_MS = 15_000;
const AUTHORITATIVE_CODING_SESSION_SUMMARY_CACHE_TTL_MS = 15_000;

interface ReadCacheEntry<T> {
  expiresAt: number;
  inflight: Promise<T> | null;
  value?: T;
}

type LocalCodingSessionSnapshot =
  | BirdCoderCodingSession
  | BirdCoderCodingSessionMirrorSnapshot;

type LocalProjectSnapshot =
  | BirdCoderProject
  | BirdCoderProjectMirrorSnapshot;

interface CodingSessionProjectionOptions {
  preserveLocalMessages?: boolean;
}

function hasCodingSessionMessages(
  codingSession: LocalCodingSessionSnapshot | undefined,
): codingSession is BirdCoderCodingSession {
  return !!codingSession && 'messages' in codingSession;
}

function stableSerializeCacheKeyPart(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerializeCacheKeyPart(entry)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
    return `{${entries
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${stableSerializeCacheKeyPart(entryValue)}`,
      )
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

export interface ApiBackedProjectServiceOptions {
  client: BirdCoderAppAdminApiClient;
  codingSessionMirror?: IProjectSessionMirror;
  coreReadClient?: BirdCoderCoreReadApiClient;
  coreWriteClient?: BirdCoderCoreWriteApiClient;
  identityProvider?: Pick<IAuthService, 'getCurrentUser'>;
  projectMirror?: {
    syncProjectSummary(summary: BirdCoderProjectSummary): Promise<BirdCoderProject>;
  };
  writeService: IProjectService;
}

function mergeProjectSummary(
  summary: Awaited<ReturnType<BirdCoderAppAdminApiClient['listProjects']>>[number],
  localProject: LocalProjectSnapshot | undefined,
): BirdCoderProject {
  const resolvedProjectPath = summary.rootPath?.trim() || localProject?.path;
  return {
    id: summary.id,
    uuid: summary.uuid,
    tenantId: summary.tenantId,
    organizationId: summary.organizationId,
    workspaceId: summary.workspaceId,
    workspaceUuid: summary.workspaceUuid,
    code: summary.code,
    title: summary.title,
    name: summary.name,
    description: summary.description,
    path: resolvedProjectPath,
    ownerId: summary.ownerId,
    leaderId: summary.leaderId,
    createdByUserId: summary.createdByUserId,
    author: summary.author,
    type: summary.type,
    viewerRole: summary.viewerRole,
    createdAt: summary.createdAt || localProject?.createdAt || ZERO_TIMESTAMP,
    updatedAt: summary.updatedAt || localProject?.updatedAt || summary.createdAt || ZERO_TIMESTAMP,
    archived: summary.status === 'archived',
    codingSessions: localProject?.codingSessions
      ? localProject.codingSessions.map((codingSession) =>
          toProjectCodingSession(codingSession, { preserveLocalMessages: false }),
        )
      : [],
  };
}

function mergeProjectMirrorSnapshot(
  summary: Awaited<ReturnType<BirdCoderAppAdminApiClient['listProjects']>>[number],
  localProject: BirdCoderProjectMirrorSnapshot | undefined,
): BirdCoderProjectMirrorSnapshot {
  const resolvedProjectPath = summary.rootPath?.trim() || localProject?.path;
  return {
    id: summary.id,
    uuid: summary.uuid,
    tenantId: summary.tenantId,
    organizationId: summary.organizationId,
    workspaceId: summary.workspaceId,
    workspaceUuid: summary.workspaceUuid,
    code: summary.code,
    title: summary.title,
    name: summary.name,
    description: summary.description,
    path: resolvedProjectPath,
    ownerId: summary.ownerId,
    leaderId: summary.leaderId,
    createdByUserId: summary.createdByUserId,
    author: summary.author,
    type: summary.type,
    viewerRole: summary.viewerRole,
    createdAt: summary.createdAt || localProject?.createdAt || ZERO_TIMESTAMP,
    updatedAt: summary.updatedAt || localProject?.updatedAt || summary.createdAt || ZERO_TIMESTAMP,
    archived: summary.status === 'archived',
    codingSessions: localProject?.codingSessions
      ? structuredClone(localProject.codingSessions)
      : [],
  };
}

function mergeCodingSessionSummary(
  summary: BirdCoderCodingSessionSummary,
  localCodingSession?: LocalCodingSessionSnapshot,
  options: CodingSessionProjectionOptions = {},
): BirdCoderCodingSession {
  const preserveLocalMessages = options.preserveLocalMessages ?? true;
  return {
    id: summary.id,
    workspaceId: summary.workspaceId,
    projectId: summary.projectId,
    title: summary.title,
    status: summary.status,
    hostMode: summary.hostMode,
    engineId: summary.engineId,
    modelId: summary.modelId ?? localCodingSession?.modelId,
    runtimeStatus: summary.runtimeStatus ?? localCodingSession?.runtimeStatus,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    lastTurnAt: summary.lastTurnAt,
    sortTimestamp: summary.sortTimestamp ?? localCodingSession?.sortTimestamp,
    transcriptUpdatedAt:
      summary.transcriptUpdatedAt ?? localCodingSession?.transcriptUpdatedAt ?? null,
    displayTime: formatBirdCoderSessionActivityDisplayTime(summary),
    pinned: localCodingSession?.pinned ?? false,
    archived: summary.status === 'archived',
    unread: localCodingSession?.unread ?? false,
    messages: preserveLocalMessages && hasCodingSessionMessages(localCodingSession)
      ? structuredClone(localCodingSession.messages)
      : [],
  };
}

function buildAuthoritativeCodingSessionUpdateRequest(
  updates: Partial<BirdCoderCodingSession>,
): Parameters<BirdCoderCoreWriteApiClient['updateCodingSession']>[1] {
  const request: Parameters<BirdCoderCoreWriteApiClient['updateCodingSession']>[1] = {};
  const normalizedTitle = updates.title?.trim();
  if (normalizedTitle) {
    request.title = normalizedTitle;
  }
  if (updates.hostMode) {
    request.hostMode = updates.hostMode;
  }
  if (updates.engineId) {
    request.engineId = updates.engineId;
  }
  if (typeof updates.modelId === 'string') {
    const normalizedModelId = updates.modelId.trim();
    if (normalizedModelId) {
      request.modelId = normalizedModelId;
    }
  }

  const nextStatus =
    updates.archived === true
      ? 'archived'
      : updates.archived === false
        ? 'active'
        : updates.status;
  if (nextStatus) {
    request.status = nextStatus;
  }

  return request;
}

function buildLocalCodingSessionPreferencePatch(
  updates: Partial<BirdCoderCodingSession>,
): Pick<BirdCoderCodingSession, 'pinned' | 'unread'> {
  const patch: Pick<BirdCoderCodingSession, 'pinned' | 'unread'> = {};
  if ('pinned' in updates) {
    patch.pinned = updates.pinned;
  }
  if ('unread' in updates) {
    patch.unread = updates.unread;
  }
  return patch;
}

function toProjectCodingSession(
  localCodingSession: LocalCodingSessionSnapshot,
  options: CodingSessionProjectionOptions = {},
): BirdCoderCodingSession {
  const preserveLocalMessages = options.preserveLocalMessages ?? true;
  return {
    id: localCodingSession.id,
    workspaceId: localCodingSession.workspaceId,
    projectId: localCodingSession.projectId,
    title: localCodingSession.title,
    status: localCodingSession.status,
    hostMode: localCodingSession.hostMode,
    engineId: localCodingSession.engineId,
    modelId: localCodingSession.modelId,
    runtimeStatus: localCodingSession.runtimeStatus,
    createdAt: localCodingSession.createdAt,
    updatedAt: localCodingSession.updatedAt,
    lastTurnAt: localCodingSession.lastTurnAt,
    sortTimestamp: localCodingSession.sortTimestamp,
    transcriptUpdatedAt: localCodingSession.transcriptUpdatedAt ?? null,
    displayTime:
      'displayTime' in localCodingSession
        ? localCodingSession.displayTime
        : formatBirdCoderSessionActivityDisplayTime(localCodingSession),
    pinned: localCodingSession.pinned ?? false,
    archived: localCodingSession.archived ?? localCodingSession.status === 'archived',
    unread: localCodingSession.unread ?? false,
    messages:
      preserveLocalMessages && 'messages' in localCodingSession
        ? structuredClone(localCodingSession.messages)
        : [],
  };
}

function appendCodingSessionMessageIfMissing(
  messages: readonly BirdCoderChatMessage[],
  incomingMessage: BirdCoderChatMessage,
): BirdCoderChatMessage[] {
  const hasSameMessage = messages.some(
    (message) =>
      message.id === incomingMessage.id ||
      (message.turnId === incomingMessage.turnId &&
        message.role === incomingMessage.role &&
        message.content === incomingMessage.content &&
        message.createdAt === incomingMessage.createdAt),
  );
  if (hasSameMessage) {
    return messages as BirdCoderChatMessage[];
  }

  return [...messages, structuredClone(incomingMessage)];
}

function resolveAuthoritativeMirrorMessageCreatedAt(
  createdTurn: Awaited<ReturnType<BirdCoderCoreWriteApiClient['createCodingSessionTurn']>>,
): string {
  const createdAtCandidate = createdTurn.startedAt ?? createdTurn.completedAt;
  return createdAtCandidate && !Number.isNaN(Date.parse(createdAtCandidate))
    ? createdAtCandidate
    : new Date().toISOString();
}

function buildAuthoritativeMirrorMessage(
  codingSessionId: string,
  createdTurn: Awaited<ReturnType<BirdCoderCoreWriteApiClient['createCodingSessionTurn']>>,
  message: CreateCodingSessionMessageInput,
): CreateCodingSessionMessageInput {
  return {
    ...message,
    id: buildBirdCoderAuthoritativeProjectionMessageId(
      codingSessionId,
      createdTurn.id,
      message.role,
    ),
    turnId: createdTurn.id,
    createdAt: resolveAuthoritativeMirrorMessageCreatedAt(createdTurn),
  };
}

interface ProjectCatalogVisibilityCandidate {
  description?: string;
  id: string;
  name: string;
  path?: string;
  rootPath?: string;
}

function resolveProjectCatalogPath(
  candidate: ProjectCatalogVisibilityCandidate,
): string | undefined {
  const rawPath = candidate.rootPath ?? candidate.path;
  if (typeof rawPath !== 'string') {
    return undefined;
  }

  const normalizedPath = rawPath.trim();
  return normalizedPath.length > 0 && isAbsoluteProjectPath(normalizedPath)
    ? normalizedPath
    : undefined;
}

function shouldHideProjectFromCatalog(
  candidate: ProjectCatalogVisibilityCandidate,
): boolean {
  return !resolveProjectCatalogPath(candidate);
}

function isAbsoluteProjectPath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/u.test(path) || path.startsWith('\\\\') || path.startsWith('/');
}

function normalizeProjectPathForComparison(path: string | null | undefined): string | null {
  if (typeof path !== 'string') {
    return null;
  }

  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return null;
  }

  const isWindowsStylePath =
    /^[a-zA-Z]:/u.test(trimmedPath) ||
    trimmedPath.includes('\\') ||
    trimmedPath.startsWith('\\\\');
  const normalizedSeparators = trimmedPath.replace(/\\/gu, '/');
  const collapsedPath = normalizedSeparators.startsWith('//')
    ? `//${normalizedSeparators.slice(2).replace(/\/+/gu, '/')}`
    : normalizedSeparators.replace(/\/+/gu, '/');
  const withoutTrailingSeparator =
    collapsedPath === '/'
      ? collapsedPath
      : collapsedPath.replace(/\/+$/u, '') || collapsedPath;

  return isWindowsStylePath
    ? withoutTrailingSeparator.toLowerCase()
    : withoutTrailingSeparator;
}

function normalizeRequiredProjectPathForCreate(path: string | null | undefined): string {
  if (typeof path !== 'string') {
    throw new Error('Project root path is required to create a project.');
  }

  const normalizedPath = path.trim();
  if (!normalizedPath) {
    throw new Error('Project root path is required to create a project.');
  }

  if (!isAbsoluteProjectPath(normalizedPath)) {
    throw new Error('Project root path must be an absolute path.');
  }

  return normalizedPath;
}

function indexLocalCodingSessionsById(
  localProjects: readonly LocalProjectSnapshot[],
): Map<string, BirdCoderCodingSession> {
  const localCodingSessionsById = new Map<string, BirdCoderCodingSession>();

  for (const project of localProjects) {
    for (const codingSession of project.codingSessions) {
      localCodingSessionsById.set(codingSession.id, toProjectCodingSession(codingSession));
    }
  }

  return localCodingSessionsById;
}

function groupCodingSessionSummariesByProjectId(
  codingSessions: readonly BirdCoderCodingSessionSummary[],
): Map<string, BirdCoderCodingSessionSummary[]> {
  const codingSessionsByProjectId = new Map<string, BirdCoderCodingSessionSummary[]>();

  for (const codingSession of codingSessions) {
    const normalizedProjectId = codingSession.projectId.trim();
    if (!normalizedProjectId) {
      continue;
    }

    const projectCodingSessions = codingSessionsByProjectId.get(normalizedProjectId) ?? [];
    projectCodingSessions.push(codingSession);
    codingSessionsByProjectId.set(normalizedProjectId, projectCodingSessions);
  }

  for (const projectCodingSessions of codingSessionsByProjectId.values()) {
    projectCodingSessions.sort(
      (left, right) =>
        resolveBirdCoderSessionSortTimestamp(right) -
          resolveBirdCoderSessionSortTimestamp(left) ||
        right.updatedAt.localeCompare(left.updatedAt) ||
        left.id.localeCompare(right.id),
    );
  }

  return codingSessionsByProjectId;
}

function indexCodingSessionCountsByProjectId(
  projects: readonly LocalProjectSnapshot[],
): Map<string, number> {
  return new Map(
    projects.map((project) => [project.id, project.codingSessions.length] satisfies [string, number]),
  );
}

function collectRedundantDuplicateProjectIds(
  projectSummaries: readonly BirdCoderProjectSummary[],
  localProjects: readonly LocalProjectSnapshot[],
  authoritativeCodingSessionsByProjectId: ReadonlyMap<string, readonly BirdCoderCodingSessionSummary[]> | null,
): string[] {
  const localSessionCountsByProjectId = indexCodingSessionCountsByProjectId(localProjects);
  const projectGroupsByNormalizedPath = new Map<string, BirdCoderProjectSummary[]>();

  for (const projectSummary of projectSummaries) {
    const normalizedRootPath = normalizeProjectPathForComparison(projectSummary.rootPath);
    if (!normalizedRootPath) {
      continue;
    }

    const projectGroup = projectGroupsByNormalizedPath.get(normalizedRootPath) ?? [];
    projectGroup.push(projectSummary);
    projectGroupsByNormalizedPath.set(normalizedRootPath, projectGroup);
  }

  const redundantProjectIds = new Set<string>();
  for (const projectGroup of projectGroupsByNormalizedPath.values()) {
    if (projectGroup.length <= 1) {
      continue;
    }

    const rankedProjects = [...projectGroup].sort((left, right) => {
      const leftAuthoritativeCount =
        authoritativeCodingSessionsByProjectId?.get(left.id)?.length ?? 0;
      const rightAuthoritativeCount =
        authoritativeCodingSessionsByProjectId?.get(right.id)?.length ?? 0;
      const leftLocalCount = localSessionCountsByProjectId.get(left.id) ?? 0;
      const rightLocalCount = localSessionCountsByProjectId.get(right.id) ?? 0;
      const leftScore = leftAuthoritativeCount + leftLocalCount;
      const rightScore = rightAuthoritativeCount + rightLocalCount;

      return (
        rightScore - leftScore ||
        Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
        Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
        left.id.localeCompare(right.id)
      );
    });

    for (const redundantProject of rankedProjects.slice(1)) {
      const authoritativeCount =
        authoritativeCodingSessionsByProjectId?.get(redundantProject.id)?.length ?? 0;
      const localCount = localSessionCountsByProjectId.get(redundantProject.id) ?? 0;
      if (authoritativeCount === 0 && localCount === 0) {
        redundantProjectIds.add(redundantProject.id);
      }
    }
  }

  return [...redundantProjectIds];
}

function hasDuplicateProjectSummaryPaths(
  projectSummaries: readonly BirdCoderProjectSummary[],
): boolean {
  const normalizedPaths = new Set<string>();

  for (const projectSummary of projectSummaries) {
    const normalizedRootPath = normalizeProjectPathForComparison(projectSummary.rootPath);
    if (!normalizedRootPath) {
      continue;
    }

    if (normalizedPaths.has(normalizedRootPath)) {
      return true;
    }

    normalizedPaths.add(normalizedRootPath);
  }

  return false;
}

function mergeAuthoritativeProjectSessions(
  localProjects: readonly LocalProjectSnapshot[],
  authoritativeCodingSessions: readonly BirdCoderCodingSessionSummary[] | null,
  projectId: string,
): BirdCoderCodingSession[] {
  const localProject = localProjects.find((candidate) => candidate.id === projectId);
  if (authoritativeCodingSessions === null) {
    return (localProject?.codingSessions ?? []).map((codingSession) =>
      toProjectCodingSession(codingSession),
    );
  }

  const localCodingSessionsById = indexLocalCodingSessionsById(localProjects);
  return authoritativeCodingSessions.map((codingSession) =>
    mergeCodingSessionSummary(codingSession, localCodingSessionsById.get(codingSession.id), {
      preserveLocalMessages: shouldPreserveLocalCodingSessionMessages(
        codingSession,
        localCodingSessionsById.get(codingSession.id),
      ),
    }),
  );
}

function shouldPreserveLocalCodingSessionMessages(
  summary: BirdCoderCodingSessionSummary,
  localCodingSession: LocalCodingSessionSnapshot | undefined,
): boolean {
  if (!hasCodingSessionMessages(localCodingSession) || localCodingSession.messages.length === 0) {
    return false;
  }

  const localTranscriptTimestamp = resolveComparableTimestamp(
    localCodingSession.transcriptUpdatedAt ??
      localCodingSession.lastTurnAt ??
      localCodingSession.updatedAt,
  );
  const authoritativeTranscriptTimestamp = resolveComparableTimestamp(
    summary.transcriptUpdatedAt ?? summary.lastTurnAt ?? summary.updatedAt,
  );

  return localTranscriptTimestamp >= authoritativeTranscriptTimestamp;
}

function resolveLatestCodingSessionMessageTimestamp(
  messages: readonly Pick<BirdCoderChatMessage, 'createdAt'>[],
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index]?.createdAt;
    if (typeof candidate === 'string' && !Number.isNaN(Date.parse(candidate))) {
      return candidate;
    }
  }

  return null;
}

function resolveComparableTimestamp(value: string | null | undefined): number {
  if (typeof value !== 'string') {
    return 0;
  }

  const parsedValue = Date.parse(value);
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
}

function sortCachedProjectCodingSessions(
  codingSessions: readonly BirdCoderCodingSession[],
): BirdCoderCodingSession[] {
  return [...codingSessions].sort(
    (left, right) =>
      resolveBirdCoderSessionSortTimestamp(right) -
        resolveBirdCoderSessionSortTimestamp(left) ||
      left.id.localeCompare(right.id),
  );
}

function sortCachedProjects(projects: readonly BirdCoderProject[]): BirdCoderProject[] {
  return [...projects].sort(
    (left, right) =>
      resolveComparableTimestamp(right.updatedAt) -
        resolveComparableTimestamp(left.updatedAt) ||
      left.id.localeCompare(right.id),
  );
}

function finalizeCachedCodingSession(
  codingSession: BirdCoderCodingSession,
): BirdCoderCodingSession {
  const sortTimestamp = resolveBirdCoderSessionSortTimestamp(codingSession);
  return {
    ...codingSession,
    displayTime: formatBirdCoderSessionActivityDisplayTime({
      ...codingSession,
      sortTimestamp,
    }),
    sortTimestamp,
  };
}

function isBirdCoderProject(value: unknown): value is BirdCoderProject {
  return (
    !!value &&
    typeof value === 'object' &&
    'id' in value &&
    'workspaceId' in value &&
    'codingSessions' in value
  );
}

function upsertCachedProjectCodingSession(
  project: BirdCoderProject,
  codingSession: BirdCoderCodingSession,
): BirdCoderProject {
  const nextCodingSession = finalizeCachedCodingSession(structuredClone(codingSession));
  return {
    ...project,
    codingSessions: sortCachedProjectCodingSessions([
      ...project.codingSessions.filter(
        (candidateCodingSession) => candidateCodingSession.id !== nextCodingSession.id,
      ),
      nextCodingSession,
    ]),
    updatedAt:
      nextCodingSession.updatedAt ||
      nextCodingSession.lastTurnAt ||
      nextCodingSession.createdAt ||
      project.updatedAt,
  };
}

function updateCachedProjectCodingSession(
  project: BirdCoderProject,
  codingSessionId: string,
  updater: (codingSession: BirdCoderCodingSession) => BirdCoderCodingSession,
): BirdCoderProject {
  const currentCodingSession = project.codingSessions.find(
    (candidateCodingSession) => candidateCodingSession.id === codingSessionId,
  );
  if (!currentCodingSession) {
    return project;
  }

  const nextCodingSession = finalizeCachedCodingSession(
    updater(structuredClone(currentCodingSession)),
  );
  return {
    ...project,
    codingSessions: sortCachedProjectCodingSessions([
      ...project.codingSessions.filter(
        (candidateCodingSession) => candidateCodingSession.id !== codingSessionId,
      ),
      nextCodingSession,
    ]),
    updatedAt:
      nextCodingSession.updatedAt ||
      nextCodingSession.lastTurnAt ||
      nextCodingSession.createdAt ||
      project.updatedAt,
  };
}

function removeCachedProjectCodingSession(
  project: BirdCoderProject,
  codingSessionId: string,
): BirdCoderProject {
  return {
    ...project,
    codingSessions: sortCachedProjectCodingSessions(
      project.codingSessions.filter(
        (candidateCodingSession) => candidateCodingSession.id !== codingSessionId,
      ),
    ),
  };
}

const REMOTE_CODING_SESSION_TURN_REQUEST_KIND_BY_ROLE = {
  planner: 'plan',
  reviewer: 'review',
  tool: 'tool',
  user: 'chat',
} as const satisfies Partial<
  Record<BirdCoderChatMessage['role'], BirdCoderCreateCodingSessionTurnRequest['requestKind']>
>;

function resolveRemoteCodingSessionTurnRequest(
  message: Omit<BirdCoderChatMessage, 'codingSessionId' | 'createdAt' | 'id'>,
): BirdCoderCreateCodingSessionTurnRequest | null {
  if (message.turnId) {
    return null;
  }

  const requestKind = REMOTE_CODING_SESSION_TURN_REQUEST_KIND_BY_ROLE[message.role];
  const inputSummary = message.content.trim();

  if (!requestKind || inputSummary.length === 0) {
    return null;
  }

  const ideContext = readRemoteCodingSessionTurnIdeContext(message.metadata);
  return {
    requestKind,
    inputSummary,
    ideContext,
  };
}

function readRemoteCodingSessionTurnIdeContext(
  metadata: BirdCoderChatMessage['metadata'],
): BirdCoderCodingSessionTurnIdeContext | undefined {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }

  const ideContextCandidate = (metadata as Record<string, unknown>).ideContext;
  if (!ideContextCandidate || typeof ideContextCandidate !== 'object') {
    return undefined;
  }

  const record = ideContextCandidate as Record<string, unknown>;
  const workspaceId =
    typeof record.workspaceId === 'string' && record.workspaceId.trim()
      ? record.workspaceId.trim()
      : undefined;
  const projectId =
    typeof record.projectId === 'string' && record.projectId.trim()
      ? record.projectId.trim()
      : undefined;
  const threadId =
    typeof record.threadId === 'string' && record.threadId.trim()
      ? record.threadId.trim()
      : undefined;
  const currentFileCandidate =
    record.currentFile && typeof record.currentFile === 'object'
      ? (record.currentFile as Record<string, unknown>)
      : null;
  const currentFile =
    currentFileCandidate &&
    typeof currentFileCandidate.path === 'string' &&
    currentFileCandidate.path.trim()
      ? {
          path: currentFileCandidate.path.trim(),
          content:
            typeof currentFileCandidate.content === 'string'
              ? currentFileCandidate.content
              : undefined,
          language:
            typeof currentFileCandidate.language === 'string' &&
            currentFileCandidate.language.trim()
              ? currentFileCandidate.language.trim()
              : undefined,
        }
      : undefined;

  if (!workspaceId && !projectId && !threadId && !currentFile) {
    return undefined;
  }

  return {
    workspaceId,
    projectId,
    threadId,
    currentFile,
  };
}

function isAuthorityBackedNativeSessionId(
  codingSessionId: string,
  engineId?: string,
): boolean {
  return isBirdCoderCodeEngineNativeSessionId(codingSessionId, engineId);
}

function cloneMessages(messages: readonly BirdCoderChatMessage[]): BirdCoderChatMessage[] {
  return messages.map((message) => structuredClone(message));
}

function compareCodingSessionMessages(
  left: BirdCoderChatMessage,
  right: BirdCoderChatMessage,
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
    left.role.localeCompare(right.role)
  );
}

function mergeAuthoritativeProjectionMessages(
  codingSessionId: string,
  existingMessages: readonly BirdCoderChatMessage[],
  events: readonly BirdCoderCodingSessionEvent[],
): BirdCoderChatMessage[] {
  return mergeBirdCoderProjectionMessages({
    codingSessionId,
    events,
    existingMessages,
    idPrefix: 'authoritative',
  }).sort(compareCodingSessionMessages);
}

function toNativeAuthorityMessage(
  message: BirdCoderNativeSessionDetail['messages'][number],
): BirdCoderChatMessage {
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
    metadata: message.metadata,
    createdAt: message.createdAt,
    timestamp: Date.parse(message.createdAt),
  };
}

function findAuthoritativeMessage(
  codingSession: BirdCoderCodingSession,
  turnId: string | undefined,
  role: BirdCoderChatMessage['role'],
  content: string,
): BirdCoderChatMessage | undefined {
  const normalizedContent = content.trim();

  return (
    codingSession.messages.find(
      (message) =>
        message.role === role &&
        message.turnId === turnId &&
        message.content.trim() === normalizedContent,
    ) ??
    [...codingSession.messages]
      .reverse()
      .find(
        (message) =>
          message.role === role && message.content.trim() === normalizedContent,
      )
  );
}

export class ApiBackedProjectService implements IProjectService {
  private readonly client: BirdCoderAppAdminApiClient;
  private readonly codingSessionMirror?: IProjectSessionMirror;
  private readonly coreReadClient?: BirdCoderCoreReadApiClient;
  private readonly coreWriteClient?: BirdCoderCoreWriteApiClient;
  private readonly identityProvider?: Pick<IAuthService, 'getCurrentUser'>;
  private readonly projectMirror?: {
    syncProjectSummary(summary: BirdCoderProjectSummary): Promise<BirdCoderProject>;
  };
  private readonly readCache = new Map<string, ReadCacheEntry<unknown>>();
  private readonly writeService: IProjectService;

  constructor({
    client,
    codingSessionMirror,
    coreReadClient,
    coreWriteClient,
    identityProvider,
    projectMirror,
    writeService,
  }: ApiBackedProjectServiceOptions) {
    this.client = client;
    this.codingSessionMirror = codingSessionMirror;
    this.coreReadClient = coreReadClient;
    this.coreWriteClient = coreWriteClient;
    this.identityProvider = identityProvider;
    this.projectMirror = projectMirror;
    this.writeService = writeService;
  }

  private async resolveCurrentUserId(): Promise<string | undefined> {
    const user = await this.identityProvider?.getCurrentUser();
    const userId = user?.id?.trim();
    return userId && userId.length > 0 ? userId : undefined;
  }

  private buildCacheKey(scope: string, payload?: unknown): string {
    return `${scope}:${stableSerializeCacheKeyPart(payload ?? null)}`;
  }

  private readThroughCache<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const now = Date.now();
    const cachedEntry = this.readCache.get(key) as ReadCacheEntry<T> | undefined;

    if (cachedEntry?.inflight) {
      return cachedEntry.inflight;
    }

    if (cachedEntry && ttlMs > 0 && cachedEntry.value !== undefined && cachedEntry.expiresAt > now) {
      return Promise.resolve(cachedEntry.value);
    }

    const request = loader()
      .then((value) => {
        if (ttlMs > 0) {
          this.readCache.set(key, {
            expiresAt: Date.now() + ttlMs,
            inflight: null,
            value,
          });
        } else {
          this.readCache.delete(key);
        }
        return value;
      })
      .catch((error) => {
        this.readCache.delete(key);
        throw error;
      });

    this.readCache.set(key, {
      expiresAt: now + ttlMs,
      inflight: request,
      value: cachedEntry?.value,
    });

    return request;
  }

  private readFreshCachedValue<T>(key: string): T | undefined {
    const cachedEntry = this.readCache.get(key) as ReadCacheEntry<T> | undefined;
    if (!cachedEntry || cachedEntry.value === undefined) {
      return undefined;
    }

    if (cachedEntry.expiresAt <= Date.now()) {
      return undefined;
    }

    return cachedEntry.value;
  }

  private buildProjectsListCacheKey(
    workspaceId?: string,
    userId?: string,
  ): string {
    return this.buildCacheKey('getProjects', {
      userId: userId ?? null,
      workspaceId: workspaceId?.trim() || null,
    });
  }

  private buildAuthoritativeCodingSessionSummariesCacheKey(options: {
    projectId?: string;
    userId?: string;
    workspaceId?: string;
  }): string {
    return this.buildCacheKey('listAuthoritativeCodingSessionSummaries', {
      projectId: options.projectId?.trim() || null,
      userId: options.userId ?? null,
      workspaceId: options.workspaceId?.trim() || null,
    });
  }

  private isAuthoritativeCodingSessionSummariesCacheKeyForScope(
    key: string,
    options: {
      projectId?: string;
      userId?: string;
      workspaceId?: string;
    } = {},
  ): boolean {
    if (!key.startsWith('listAuthoritativeCodingSessionSummaries:')) {
      return false;
    }

    if (
      options.userId !== undefined &&
      !key.includes(
        `${JSON.stringify('userId')}:${stableSerializeCacheKeyPart(options.userId ?? null)}`,
      )
    ) {
      return false;
    }

    if (
      options.workspaceId !== undefined &&
      !key.includes(
        `${JSON.stringify('workspaceId')}:${stableSerializeCacheKeyPart(
          options.workspaceId?.trim() || null,
        )}`,
      )
    ) {
      return false;
    }

    if (
      options.projectId !== undefined &&
      !key.includes(
        `${JSON.stringify('projectId')}:${stableSerializeCacheKeyPart(
          options.projectId?.trim() || null,
        )}`,
      )
    ) {
      return false;
    }

    return true;
  }

  private isProjectsListCacheKeyForUser(
    key: string,
    userId?: string,
  ): boolean {
    return (
      key.startsWith('getProjects:') &&
      key.includes(`${JSON.stringify('userId')}:${stableSerializeCacheKeyPart(userId ?? null)}`)
    );
  }

  private findFreshCachedProjectFromLists(
    matcher: (project: BirdCoderProject) => boolean,
    options: {
      userId?: string;
      workspaceId?: string;
    } = {},
  ): BirdCoderProject | null {
    const normalizedWorkspaceId = options.workspaceId?.trim() || undefined;

    if (normalizedWorkspaceId) {
      const cachedProjects = this.readFreshCachedValue<BirdCoderProject[]>(
        this.buildProjectsListCacheKey(normalizedWorkspaceId, options.userId),
      );
      if (cachedProjects) {
        return cachedProjects.find(matcher) ?? null;
      }
    }

    for (const [key] of this.readCache.entries()) {
      if (!this.isProjectsListCacheKeyForUser(key, options.userId)) {
        continue;
      }

      const cachedProjects = this.readFreshCachedValue<BirdCoderProject[]>(key);
      if (!cachedProjects) {
        continue;
      }

      const matchedProject = cachedProjects.find(matcher);
      if (matchedProject) {
        return matchedProject;
      }
    }

    return null;
  }

  private findFreshCachedProjectDetail(
    projectId: string,
    userId?: string,
  ): BirdCoderProject | null {
    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) {
      return null;
    }

    return (
      this.readFreshCachedValue<BirdCoderProject>(
        this.buildCacheKey('getProjectById', {
          projectId: normalizedProjectId,
          userId: userId ?? null,
        }),
      ) ?? null
    );
  }

  private invalidateReadCache(): void {
    this.readCache.clear();
  }

  invalidateProjectReadCache(scope: {
    projectId?: string;
    workspaceId?: string;
  } = {}): void {
    const normalizedProjectId = scope.projectId?.trim() || undefined;
    const normalizedWorkspaceId = scope.workspaceId?.trim() || undefined;

    if (!normalizedProjectId && !normalizedWorkspaceId) {
      this.invalidateReadCache();
      return;
    }

    for (const [key] of this.readCache.entries()) {
      if (
        normalizedWorkspaceId &&
        key.startsWith('getProjects:') &&
        key.includes(
          `${JSON.stringify('workspaceId')}:${stableSerializeCacheKeyPart(
            normalizedWorkspaceId,
          )}`,
        )
      ) {
        this.readCache.delete(key);
        continue;
      }

      if (
        normalizedProjectId &&
        (
          (key.startsWith('getProjectById:') &&
          key.includes(
            `${JSON.stringify('projectId')}:${stableSerializeCacheKeyPart(
              normalizedProjectId,
            )}`,
          )) ||
          this.isAuthoritativeCodingSessionSummariesCacheKeyForScope(key, {
            projectId: normalizedProjectId,
          })
        )
      ) {
        this.readCache.delete(key);
        continue;
      }

      if (
        normalizedWorkspaceId &&
        key.startsWith('getProjectByPath:') &&
        key.includes(
          `${JSON.stringify('workspaceId')}:${stableSerializeCacheKeyPart(
            normalizedWorkspaceId,
          )}`,
        )
      ) {
        this.readCache.delete(key);
        continue;
      }

      if (
        normalizedWorkspaceId &&
        this.isAuthoritativeCodingSessionSummariesCacheKeyForScope(key, {
          workspaceId: normalizedWorkspaceId,
        })
      ) {
        this.readCache.delete(key);
      }
    }
  }

  private async listAuthoritativeCodingSessionsByProjectId(options: {
    projectId?: string;
    userId?: string;
    workspaceId?: string;
  }): Promise<Map<string, BirdCoderCodingSessionSummary[]> | null> {
    if (!this.coreReadClient) {
      return null;
    }

    const normalizedWorkspaceId = options.workspaceId?.trim() || undefined;
    const normalizedProjectId = options.projectId?.trim() || undefined;
    return this.readThroughCache(
      this.buildAuthoritativeCodingSessionSummariesCacheKey({
        projectId: normalizedProjectId,
        userId: options.userId,
        workspaceId: normalizedWorkspaceId,
      }),
      AUTHORITATIVE_CODING_SESSION_SUMMARY_CACHE_TTL_MS,
      async () =>
        groupCodingSessionSummariesByProjectId(
          await this.coreReadClient!.listCodingSessions({
            projectId: normalizedProjectId,
            workspaceId: normalizedWorkspaceId,
          }),
        ),
    );
  }

  private mutateCachedProjectEntries(
    projectId: string,
    updater: (project: BirdCoderProject) => BirdCoderProject | null,
  ): void {
    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) {
      return;
    }

    for (const [key, entry] of this.readCache.entries()) {
      const currentValue = entry.value;
      if (currentValue === undefined) {
        continue;
      }

      if (Array.isArray(currentValue)) {
        let changed = false;
        const nextProjects: BirdCoderProject[] = [];

        for (const candidateProject of currentValue) {
          if (!isBirdCoderProject(candidateProject)) {
            nextProjects.push(candidateProject as BirdCoderProject);
            continue;
          }

          if (candidateProject.id !== normalizedProjectId) {
            nextProjects.push(candidateProject);
            continue;
          }

          const nextProject = updater(candidateProject);
          changed = changed || nextProject !== candidateProject;
          if (nextProject) {
            nextProjects.push(nextProject);
          }
        }

        if (changed) {
          this.readCache.set(key, {
            ...entry,
            value: sortCachedProjects(nextProjects),
          });
        }
        continue;
      }

      if (!isBirdCoderProject(currentValue) || currentValue.id !== normalizedProjectId) {
        continue;
      }

      const nextProject = updater(currentValue);
      if (nextProject === currentValue) {
        continue;
      }

      this.readCache.set(key, {
        ...entry,
        value: nextProject,
      });
    }
  }

  private patchCachedProjectCodingSession(
    projectId: string,
    codingSession: BirdCoderCodingSession,
  ): void {
    this.mutateCachedProjectEntries(projectId, (project) =>
      upsertCachedProjectCodingSession(project, codingSession),
    );
  }

  private patchCachedProjectCodingSessionUpdate(
    projectId: string,
    codingSessionId: string,
    updater: (codingSession: BirdCoderCodingSession) => BirdCoderCodingSession,
  ): void {
    this.mutateCachedProjectEntries(projectId, (project) =>
      updateCachedProjectCodingSession(project, codingSessionId, updater),
    );
  }

  private patchCachedProjectCodingSessionRemoval(
    projectId: string,
    codingSessionId: string,
  ): void {
    this.mutateCachedProjectEntries(projectId, (project) =>
      removeCachedProjectCodingSession(project, codingSessionId),
    );
  }

  private async hydrateAuthoritativeCodingSession(
    projectId: string,
    summary: BirdCoderCodingSessionSummary,
    localCodingSession?: BirdCoderCodingSession,
  ): Promise<BirdCoderCodingSession> {
    const fallbackCodingSession = mergeCodingSessionSummary(summary, localCodingSession);
    if (!this.coreReadClient) {
      return fallbackCodingSession;
    }

    if (isAuthorityBackedNativeSessionId(summary.id, summary.engineId)) {
      const detail = await this.coreReadClient.getNativeSession(summary.id, {
        engineId: summary.engineId,
        projectId,
        workspaceId: summary.workspaceId,
      });
      const hydratedCodingSession = mergeCodingSessionSummary(detail.summary, localCodingSession);
      hydratedCodingSession.messages = detail.messages.map(toNativeAuthorityMessage);
      hydratedCodingSession.transcriptUpdatedAt =
        resolveLatestCodingSessionMessageTimestamp(hydratedCodingSession.messages) ??
        hydratedCodingSession.transcriptUpdatedAt ??
        hydratedCodingSession.lastTurnAt ??
        hydratedCodingSession.updatedAt;
      await this.upsertCodingSession(projectId, hydratedCodingSession);
      return hydratedCodingSession;
    }

    const events = await this.coreReadClient.listCodingSessionEvents(summary.id);
    const runtimeStatus = resolveBirdCoderCodingSessionRuntimeStatus(
      events,
      summary.runtimeStatus ?? localCodingSession?.runtimeStatus,
    );
    const hydratedCodingSession = mergeCodingSessionSummary(summary, localCodingSession);
    hydratedCodingSession.runtimeStatus = runtimeStatus;
    hydratedCodingSession.messages = mergeAuthoritativeProjectionMessages(
      summary.id,
      localCodingSession?.messages ?? [],
      events,
    );
    hydratedCodingSession.transcriptUpdatedAt =
      resolveLatestCodingSessionMessageTimestamp(hydratedCodingSession.messages) ??
      hydratedCodingSession.transcriptUpdatedAt ??
      hydratedCodingSession.lastTurnAt ??
      hydratedCodingSession.updatedAt;
    await this.upsertCodingSession(projectId, hydratedCodingSession);
    return hydratedCodingSession;
  }

  private async synchronizeAuthoritativeCodingSession(
    projectId: string,
    codingSessionId: string,
  ): Promise<BirdCoderCodingSession | null> {
    if (!this.coreReadClient) {
      return null;
    }

    const localProjects = await this.writeService.getProjects();
    const localProject = localProjects.find((candidate) => candidate.id === projectId);
    const localCodingSession = localProject?.codingSessions.find(
      (candidate) => candidate.id === codingSessionId,
    );
    const summary = await this.coreReadClient.getCodingSession(codingSessionId);
    return this.hydrateAuthoritativeCodingSession(projectId, summary, localCodingSession);
  }

  private async listAuthoritativeProjectSummaries(
    workspaceId?: string,
    userId?: string,
  ): Promise<BirdCoderProjectSummary[]> {
    return (
      await retryBirdCoderTransientApiTask(() =>
        this.client.listProjects({
          userId: userId ?? undefined,
          workspaceId,
        }),
      )
    ).filter((projectSummary) => !shouldHideProjectFromCatalog(projectSummary));
  }

  private async listLocalProjects(
    workspaceId?: string,
  ): Promise<BirdCoderProject[]> {
    return (await this.writeService.getProjects(workspaceId)).filter(
      (project) => !shouldHideProjectFromCatalog(project),
    );
  }

  private shouldSyncProjectSummaryToMirror(
    summary: BirdCoderProjectSummary,
    localProject: LocalProjectSnapshot | undefined,
  ): boolean {
    if (!this.projectMirror) {
      return false;
    }

    if (!localProject) {
      return true;
    }

    return (
      localProject.workspaceId !== summary.workspaceId ||
      localProject.name !== summary.name ||
      (localProject.description ?? undefined) !== (summary.description ?? undefined) ||
      (localProject.path ?? undefined) !== (summary.rootPath ?? undefined) ||
      localProject.updatedAt !== (summary.updatedAt || localProject.updatedAt) ||
      localProject.archived !== (summary.status === 'archived')
    );
  }

  private async syncProjectSummaryToMirror(
    summary: BirdCoderProjectSummary,
    localProject: LocalProjectSnapshot | undefined,
  ): Promise<BirdCoderProject | null> {
    if (!this.shouldSyncProjectSummaryToMirror(summary, localProject)) {
      return localProject && isBirdCoderProject(localProject)
        ? structuredClone(localProject)
        : localProject
          ? mergeProjectSummary(summary, localProject)
          : null;
    }

    try {
      return await this.projectMirror!.syncProjectSummary(summary);
    } catch (error) {
      console.error(`Failed to mirror authoritative project summary "${summary.id}" locally`, error);
      return localProject && isBirdCoderProject(localProject)
        ? structuredClone(localProject)
        : localProject
          ? mergeProjectSummary(summary, localProject)
          : null;
    }
  }

  async getProjects(workspaceId?: string): Promise<BirdCoderProject[]> {
    const normalizedWorkspaceId = workspaceId?.trim() || undefined;
    const currentUserId = await this.resolveCurrentUserId();
    return this.readThroughCache(
      this.buildCacheKey('getProjects', {
        userId: currentUserId ?? null,
        workspaceId: normalizedWorkspaceId ?? null,
      }),
      PROJECT_LIST_CACHE_TTL_MS,
      async () => {
        const localProjects = await this.listLocalProjects(workspaceId);
        let projectSummaries: BirdCoderProjectSummary[];
        try {
          projectSummaries = await this.listAuthoritativeProjectSummaries(
            normalizedWorkspaceId,
            currentUserId,
          );
        } catch (error) {
          if (localProjects.length > 0 && isBirdCoderTransientApiError(error)) {
            console.warn(
              'Falling back to locally mirrored projects because the remote project catalog is temporarily unavailable.',
              error,
            );
            return localProjects.map((project) => structuredClone(project));
          }
          throw error;
        }
        let authoritativeCodingSessionsByProjectId: Map<
          string,
          BirdCoderCodingSessionSummary[]
        > | null = null;
        if (this.coreReadClient) {
          try {
            authoritativeCodingSessionsByProjectId =
              await this.listAuthoritativeCodingSessionsByProjectId({
                userId: currentUserId,
                workspaceId: normalizedWorkspaceId,
              });
          } catch (error) {
            console.error(
              'Failed to load authoritative coding sessions while reading projects',
              error,
            );
          }
        }

        const redundantProjectIds = collectRedundantDuplicateProjectIds(
          projectSummaries,
          localProjects,
          authoritativeCodingSessionsByProjectId,
        );
        if (redundantProjectIds.length > 0) {
          for (const redundantProjectId of redundantProjectIds) {
            try {
              await this.client.deleteProject(redundantProjectId);
              await this.writeService.deleteProject(redundantProjectId);
            } catch (error) {
              console.error(
                `Failed to clean redundant duplicate project "${redundantProjectId}" from authority`,
                error,
              );
            }
          }

          projectSummaries = await this.listAuthoritativeProjectSummaries(
            normalizedWorkspaceId,
            currentUserId,
          );
        }

        const localProjectsById = new Map(localProjects.map((project) => [project.id, project]));
        const mirroredProjectsById = new Map<string, BirdCoderProject>();
        const mirroredProjects = await Promise.all(
          projectSummaries.map(async (projectSummary) => {
            const localProject = localProjectsById.get(projectSummary.id);
            const mirroredProject = await this.syncProjectSummaryToMirror(
              projectSummary,
              localProject,
            );
            return {
              mirroredProject,
              projectId: projectSummary.id,
            };
          }),
        );

        for (const mirroredProject of mirroredProjects) {
          if (mirroredProject.mirroredProject) {
            mirroredProjectsById.set(
              mirroredProject.projectId,
              mirroredProject.mirroredProject,
            );
          }
        }

        return projectSummaries.map((projectSummary) => {
          const mirroredProject = mirroredProjectsById.get(projectSummary.id);
          return {
            ...mergeProjectSummary(projectSummary, mirroredProject),
            codingSessions: mergeAuthoritativeProjectSessions(
              localProjects,
              authoritativeCodingSessionsByProjectId?.get(projectSummary.id) ?? null,
              projectSummary.id,
            ),
          };
        });
      },
    );
  }

  async getProjectById(projectId: string): Promise<BirdCoderProject | null> {
    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) {
      return null;
    }

    const currentUserId = await this.resolveCurrentUserId();
    return this.readThroughCache(
      this.buildCacheKey('getProjectById', {
        projectId: normalizedProjectId,
        userId: currentUserId ?? null,
      }),
      PROJECT_DETAIL_CACHE_TTL_MS,
      async () => {
        const cachedProject = this.findFreshCachedProjectDetail(
          normalizedProjectId,
          currentUserId,
        );
        if (cachedProject) {
          return structuredClone(cachedProject);
        }

        const localProject = await this.writeService.getProjectById(normalizedProjectId);
        let projectSummary: BirdCoderProjectSummary;
        try {
          projectSummary = await retryBirdCoderTransientApiTask(() =>
            this.client.getProject(normalizedProjectId),
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes('-> 404') || /project .+ was not found/i.test(message)) {
            return null;
          }
          if (localProject && isBirdCoderTransientApiError(error)) {
            console.warn(
              `Falling back to locally mirrored project "${normalizedProjectId}" because the remote project detail API is temporarily unavailable.`,
              error,
            );
            return structuredClone(localProject);
          }
          throw error;
        }
        if (shouldHideProjectFromCatalog(projectSummary)) {
          return null;
        }

        const mirroredProject =
          (await this.syncProjectSummaryToMirror(projectSummary, localProject)) ?? localProject;

        const localProjects = await this.listLocalProjects(projectSummary.workspaceId);
        const localProjectsForMerge =
          mirroredProject &&
          !localProjects.some((candidate) => candidate.id === mirroredProject.id)
            ? [...localProjects, mirroredProject]
            : localProjects;
        let authoritativeCodingSessionsByProjectId: Map<
          string,
          BirdCoderCodingSessionSummary[]
        > | null = null;
        if (this.coreReadClient) {
          try {
            authoritativeCodingSessionsByProjectId =
              await this.listAuthoritativeCodingSessionsByProjectId({
                projectId: normalizedProjectId,
                userId: currentUserId,
                workspaceId: projectSummary.workspaceId,
              });
          } catch (error) {
            console.error(
              'Failed to load authoritative coding sessions while reading one project',
              error,
            );
          }
        }

        const mergedLocalProject =
          localProjectsForMerge.find((candidate) => candidate.id === normalizedProjectId) ??
          mirroredProject;
        return {
          ...mergeProjectSummary(projectSummary, mergedLocalProject),
          codingSessions: mergeAuthoritativeProjectSessions(
            localProjectsForMerge,
            authoritativeCodingSessionsByProjectId?.get(normalizedProjectId) ?? null,
            normalizedProjectId,
          ),
        };
      },
    );
  }

  async getProjectByPath(workspaceId: string, path: string): Promise<BirdCoderProject | null> {
    const normalizedWorkspaceId = workspaceId.trim();
    const normalizedPath = path.trim();
    if (!normalizedWorkspaceId || !normalizedPath) {
      return null;
    }

    const currentUserId = await this.resolveCurrentUserId();
    return this.readThroughCache(
      this.buildCacheKey('getProjectByPath', {
        path: normalizedPath,
        userId: currentUserId ?? null,
        workspaceId: normalizedWorkspaceId,
      }),
      PROJECT_DETAIL_CACHE_TTL_MS,
      async () => {
        const normalizedComparablePath =
          normalizeProjectPathForComparison(normalizedPath);
        const cachedProject = normalizedComparablePath
          ? this.findFreshCachedProjectFromLists(
              (candidateProject) =>
                normalizeProjectPathForComparison(candidateProject.path) ===
                normalizedComparablePath,
              {
                userId: currentUserId,
                workspaceId: normalizedWorkspaceId,
              },
            )
          : null;
        if (cachedProject) {
          return structuredClone(cachedProject);
        }

        const localProject = await this.writeService.getProjectByPath(
          normalizedWorkspaceId,
          normalizedPath,
        );
        let projectSummary:
          | Awaited<ReturnType<BirdCoderAppAdminApiClient['listProjects']>>[number]
          | undefined;
        try {
          projectSummary = (
            await retryBirdCoderTransientApiTask(() =>
              this.client.listProjects({
                rootPath: normalizedPath,
                userId: currentUserId,
                workspaceId: normalizedWorkspaceId,
              }),
            )
          ).find((candidate) => !shouldHideProjectFromCatalog(candidate));
        } catch (error) {
          if (localProject && isBirdCoderTransientApiError(error)) {
            console.warn(
              `Falling back to locally mirrored project for path "${normalizedPath}" because the remote project lookup API is temporarily unavailable.`,
              error,
            );
            return structuredClone(localProject);
          }
          throw error;
        }
        if (!projectSummary) {
          return localProject ? structuredClone(localProject) : null;
        }

        const mirroredProject =
          (await this.syncProjectSummaryToMirror(projectSummary, localProject)) ?? localProject;

        const localProjects = await this.listLocalProjects(normalizedWorkspaceId);
        const localProjectsForMerge =
          mirroredProject &&
          !localProjects.some((candidate) => candidate.id === mirroredProject.id)
            ? [...localProjects, mirroredProject]
            : localProjects;
        const mergedLocalProject =
          localProjectsForMerge.find((candidate) => candidate.id === projectSummary.id) ??
          mirroredProject;
        return {
          ...mergeProjectSummary(projectSummary, mergedLocalProject),
          // Path-based lookup is used by import/dedupe flows. Those flows only need
          // stable project identity and authoritative root-path matching, not a
          // separate session-summary roundtrip.
          codingSessions:
            mergedLocalProject?.codingSessions.map((codingSession) =>
              toProjectCodingSession(codingSession, { preserveLocalMessages: false }),
            ) ?? [],
        };
      },
    );
  }

  async getProjectMirrorSnapshots(workspaceId?: string): Promise<BirdCoderProjectMirrorSnapshot[]> {
    const localProjects: BirdCoderProjectMirrorSnapshot[] = (
      await (this.writeService.getProjectMirrorSnapshots
        ? this.writeService.getProjectMirrorSnapshots(workspaceId)
        : this.writeService.getProjects(workspaceId).then((projects) =>
            projects.map((project) => ({
              id: project.id,
              workspaceId: project.workspaceId,
              name: project.name,
              description: project.description,
              path: project.path,
              createdAt: project.createdAt,
              updatedAt: project.updatedAt,
              archived: project.archived,
              codingSessions: project.codingSessions.map((codingSession): BirdCoderCodingSessionMirrorSnapshot => ({
                id: codingSession.id,
                workspaceId: codingSession.workspaceId,
                projectId: codingSession.projectId,
                title: codingSession.title,
                status: codingSession.status,
                hostMode: codingSession.hostMode,
                engineId: codingSession.engineId,
                modelId: codingSession.modelId,
                runtimeStatus: codingSession.runtimeStatus,
                createdAt: codingSession.createdAt,
                updatedAt: codingSession.updatedAt,
                lastTurnAt: codingSession.lastTurnAt,
                sortTimestamp: codingSession.sortTimestamp,
                transcriptUpdatedAt: codingSession.transcriptUpdatedAt ?? null,
                displayTime: formatBirdCoderSessionActivityDisplayTime(codingSession),
                pinned: codingSession.pinned,
                archived: codingSession.archived,
                unread: codingSession.unread,
                messageCount: codingSession.messages.length,
                nativeTranscriptUpdatedAt: [...codingSession.messages]
                  .reverse()
                  .find((message) => message.id.includes(':native-message:'))
                  ?.createdAt ?? null,
              })),
            })),
          ))
    ).filter((project) => !shouldHideProjectFromCatalog(project));
    let projectSummaries: Awaited<ReturnType<BirdCoderAppAdminApiClient['listProjects']>>;
    try {
      projectSummaries = (
        await retryBirdCoderTransientApiTask(async () =>
          this.client.listProjects({
            userId: await this.resolveCurrentUserId(),
            workspaceId,
          }),
        )
      ).filter((projectSummary) => !shouldHideProjectFromCatalog(projectSummary));
    } catch (error) {
      if (localProjects.length > 0 && isBirdCoderTransientApiError(error)) {
        console.warn(
          'Falling back to locally mirrored project snapshots because the remote project catalog is temporarily unavailable.',
          error,
        );
        return structuredClone(localProjects);
      }
      throw error;
    }

    const localProjectsById = new Map<string, BirdCoderProjectMirrorSnapshot>(
      localProjects.map((project): [string, BirdCoderProjectMirrorSnapshot] => [project.id, project]),
    );
    const mergedProjects = projectSummaries.map((projectSummary) =>
      mergeProjectMirrorSnapshot(projectSummary, localProjectsById.get(projectSummary.id)),
    );

    return mergedProjects;
  }

  async createProject(
    workspaceId: string,
    name: string,
    options?: CreateProjectOptions,
  ): Promise<BirdCoderProject> {
    const normalizedPath = normalizeRequiredProjectPathForCreate(options?.path);
    const currentUserId = await this.resolveCurrentUserId();
    const summary = await this.client.createProject({
      workspaceId,
      name,
      description: options?.description,
      ownerId: currentUserId,
      leaderId: currentUserId,
      createdByUserId: currentUserId,
      author: currentUserId,
      rootPath: normalizedPath,
      appTemplateVersionId: options?.appTemplateVersionId,
      templatePresetKey: options?.templatePresetKey,
    });
    const createdProject =
      (await this.projectMirror?.syncProjectSummary(summary)) ??
      mergeProjectSummary(summary, undefined);
    await this.writeService.recordProjectCreationEvidence?.(summary.id, options);
    this.invalidateReadCache();
    return createdProject;
  }

  async renameProject(projectId: string, name: string): Promise<void> {
    const summary = await this.client.updateProject(projectId, {
      name,
    });
    await this.projectMirror?.syncProjectSummary(summary);
    this.invalidateReadCache();
  }

  async updateProject(projectId: string, updates: Partial<BirdCoderProject>): Promise<void> {
    const summary = await this.client.updateProject(projectId, {
      name: updates.name,
      description: updates.description,
      code: updates.code,
      title: updates.title,
      ownerId: updates.ownerId,
      leaderId: updates.leaderId,
      author: updates.author,
      type: updates.type,
      rootPath: updates.path,
      status:
        updates.archived === undefined
          ? undefined
          : updates.archived
            ? 'archived'
            : 'active',
    });
    await this.projectMirror?.syncProjectSummary(summary);
    this.invalidateReadCache();
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.client.deleteProject(projectId);
    await this.writeService.deleteProject(projectId);
    this.invalidateReadCache();
  }

  async createCodingSession(
    projectId: string,
    title: string,
    options?: CreateCodingSessionOptions,
  ): Promise<BirdCoderCodingSession> {
    if (!this.coreWriteClient) {
      throw new Error(
        'Coding session creation requires a bound core write client backed by the Rust server.',
      );
    }

    const project = await this.resolveProject(projectId);
    const createdCodingSessionSummary = await this.coreWriteClient.createCodingSession({
      workspaceId: project.workspaceId,
      projectId,
      title,
      engineId: options?.engineId,
      modelId: options?.modelId,
    });
    const createdCodingSession = mergeCodingSessionSummary(createdCodingSessionSummary);

    await this.upsertCodingSession(projectId, createdCodingSession);
    return structuredClone(createdCodingSession);
  }

  async upsertCodingSession(projectId: string, codingSession: BirdCoderCodingSession): Promise<void> {
    if (this.codingSessionMirror) {
      await this.codingSessionMirror.upsertCodingSession(projectId, codingSession);
      this.patchCachedProjectCodingSession(projectId, codingSession);
      return;
    }

    if (this.writeService.upsertCodingSession) {
      await this.writeService.upsertCodingSession(projectId, codingSession);
      this.patchCachedProjectCodingSession(projectId, codingSession);
      return;
    }

    throw new Error(
      'Project service session mirroring requires a codingSessionMirror or writeService.upsertCodingSession implementation.',
    );
  }

  private async resolveProject(projectId: string): Promise<BirdCoderProject> {
    const project = await this.getProjectById(projectId);
    if (project) {
      return project;
    }

    throw new Error(`Project ${projectId} not found`);
  }

  private async resolveProjectCodingSession(
    projectId: string,
    codingSessionId: string,
  ): Promise<BirdCoderCodingSession> {
    const project = await this.resolveProject(projectId);
    const codingSession = project.codingSessions.find(
      (candidate) => candidate.id === codingSessionId,
    );
    if (codingSession) {
      return structuredClone(codingSession);
    }

    throw new Error(`Coding session ${codingSessionId} not found in project ${projectId}`);
  }

  async renameCodingSession(
    projectId: string,
    codingSessionId: string,
    title: string,
  ): Promise<void> {
    await this.updateCodingSession(projectId, codingSessionId, { title });
  }

  async updateCodingSession(
    projectId: string,
    codingSessionId: string,
    updates: Partial<BirdCoderCodingSession>,
  ): Promise<void> {
    const authoritativeRequest = buildAuthoritativeCodingSessionUpdateRequest(updates);
    const localPreferencePatch = buildLocalCodingSessionPreferencePatch(updates);
    const hasAuthoritativeUpdates = Object.keys(authoritativeRequest).length > 0;
    const hasLocalPreferenceUpdates = Object.keys(localPreferencePatch).length > 0;

    if (!hasAuthoritativeUpdates && !hasLocalPreferenceUpdates) {
      return;
    }

    let synchronizedCodingSession: BirdCoderCodingSession | null = null;
    if (hasAuthoritativeUpdates) {
      if (!this.coreWriteClient) {
        throw new Error(
          'Updating authoritative coding session metadata requires a bound core write client backed by the Rust server.',
        );
      }

      const updatedCodingSessionSummary = await this.coreWriteClient.updateCodingSession(
        codingSessionId,
        authoritativeRequest,
      );

      if (this.coreReadClient) {
        synchronizedCodingSession = await this.synchronizeAuthoritativeCodingSession(
          projectId,
          codingSessionId,
        );
      } else {
        const localCodingSession = await this.resolveProjectCodingSession(projectId, codingSessionId);
        synchronizedCodingSession = mergeCodingSessionSummary(
          updatedCodingSessionSummary,
          localCodingSession,
        );
        await this.upsertCodingSession(projectId, synchronizedCodingSession);
      }
    }

    if (hasLocalPreferenceUpdates) {
      const baseCodingSession =
        synchronizedCodingSession ??
        (await this.resolveProjectCodingSession(projectId, codingSessionId));
      const patchedCodingSession: BirdCoderCodingSession = {
        ...baseCodingSession,
        ...localPreferencePatch,
      };
      await this.upsertCodingSession(projectId, patchedCodingSession);
    }
  }

  async forkCodingSession(
    projectId: string,
    codingSessionId: string,
    newTitle?: string,
  ): Promise<BirdCoderCodingSession> {
    if (!this.coreWriteClient) {
      throw new Error(
        'Forking coding sessions requires a bound core write client backed by the Rust server.',
      );
    }

    const forkedCodingSessionSummary = await this.coreWriteClient.forkCodingSession(
      codingSessionId,
      newTitle?.trim() ? { title: newTitle } : {},
    );
    const forkedCodingSession = this.coreReadClient
      ? await this.synchronizeAuthoritativeCodingSession(
          projectId,
          forkedCodingSessionSummary.id,
        )
      : mergeCodingSessionSummary(forkedCodingSessionSummary);
    this.patchCachedProjectCodingSession(projectId, forkedCodingSession);
    return forkedCodingSession;
  }

  async deleteCodingSession(projectId: string, codingSessionId: string): Promise<void> {
    if (!this.coreWriteClient) {
      throw new Error(
        'Deleting coding sessions requires a bound core write client backed by the Rust server.',
      );
    }

    await this.coreWriteClient.deleteCodingSession(codingSessionId);
    await this.writeService.deleteCodingSession(projectId, codingSessionId);
    this.patchCachedProjectCodingSessionRemoval(projectId, codingSessionId);
  }

  async addCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    message: CreateCodingSessionMessageInput,
  ): Promise<BirdCoderChatMessage> {
    if (!this.coreWriteClient) {
      throw new Error(
        'Sending coding session messages requires a bound core write client backed by the Rust server.',
      );
    }

    const remoteTurnRequest = resolveRemoteCodingSessionTurnRequest(message);
    if (!remoteTurnRequest) {
      throw new Error(
        `Unsupported authoritative coding session message role: ${message.role}.`,
      );
    }

    const createdTurn = await this.coreWriteClient.createCodingSessionTurn(
      codingSessionId,
      remoteTurnRequest,
    );
    const mirroredMessage = await this.writeService.addCodingSessionMessage(
      projectId,
      codingSessionId,
      buildAuthoritativeMirrorMessage(codingSessionId, createdTurn, message),
    );
    const messageTimestamp = mirroredMessage.createdAt;
    this.patchCachedProjectCodingSessionUpdate(
      projectId,
      codingSessionId,
      (codingSession) => ({
        ...codingSession,
        messages: appendCodingSessionMessageIfMissing(
          codingSession.messages,
          mirroredMessage,
        ),
        updatedAt: messageTimestamp || codingSession.updatedAt,
        lastTurnAt: messageTimestamp || codingSession.lastTurnAt,
        transcriptUpdatedAt: messageTimestamp || codingSession.transcriptUpdatedAt,
      }),
    );
    if (!this.coreReadClient) {
      return mirroredMessage;
    }

    const synchronizedCodingSession = await this.syncRemoteTurnMirror(projectId, codingSessionId);
    if (!synchronizedCodingSession) {
      return mirroredMessage;
    }

    const authoritativeMessage = findAuthoritativeMessage(
      synchronizedCodingSession,
      createdTurn.id,
      message.role,
      message.content,
    );
    if (!authoritativeMessage) {
      return mirroredMessage;
    }

    return authoritativeMessage;
  }

  async editCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    messageId: string,
    updates: Partial<BirdCoderChatMessage>,
  ): Promise<void> {
    if (this.coreWriteClient || this.coreReadClient) {
      throw new Error(
        'Authoritative coding session message editing is not implemented yet. TODO: add server-side transcript patch operations instead of mutating the local mirror.',
      );
    }

    await this.writeService.editCodingSessionMessage(projectId, codingSessionId, messageId, updates);
    this.patchCachedProjectCodingSessionUpdate(
      projectId,
      codingSessionId,
      (codingSession) => ({
        ...codingSession,
        messages: codingSession.messages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                ...updates,
              }
            : message,
        ),
      }),
    );
  }

  async deleteCodingSessionMessage(
    projectId: string,
    codingSessionId: string,
    messageId: string,
  ): Promise<void> {
    if (this.coreWriteClient) {
      const codingSession = await this.resolveProjectCodingSession(projectId, codingSessionId);
      if (isAuthorityBackedNativeSessionId(codingSessionId, codingSession.engineId)) {
        throw new Error(
          'Deleting transcript messages for native engine sessions is not implemented yet. TODO: add native engine transcript mutation support in the Rust server.',
        );
      }

      await this.coreWriteClient.deleteCodingSessionMessage(codingSessionId, messageId);
      if (this.coreReadClient) {
        await this.synchronizeAuthoritativeCodingSession(projectId, codingSessionId);
        return;
      }
    }

    await this.writeService.deleteCodingSessionMessage(projectId, codingSessionId, messageId);
    this.patchCachedProjectCodingSessionUpdate(
      projectId,
      codingSessionId,
      (codingSession) => ({
        ...codingSession,
        messages: codingSession.messages.filter((message) => message.id !== messageId),
      }),
    );
  }

  private async syncRemoteTurnMirror(
    projectId: string,
    codingSessionId: string,
  ): Promise<BirdCoderCodingSession | null> {
    return this.synchronizeAuthoritativeCodingSession(projectId, codingSessionId);
  }
}
