import {
  areBirdCoderChatMessagesEquivalent,
  buildBirdCoderSessionSynchronizationVersion,
  formatBirdCoderSessionActivityDisplayTime,
  type BirdCoderChatMessage,
  type BirdCoderCodingSession,
  type BirdCoderCodingSessionEvent,
  type BirdCoderProject,
  type BirdCoderGetNativeSessionRequest,
  type BirdCoderListCodingSessionsRequest,
  type BirdCoderNativeSessionDetail,
  type BirdCoderCodingSessionSummary,
  mergeBirdCoderProjectionMessages,
  resolveBirdCoderCodingSessionRuntimeStatus,
} from '@sdkwork/birdcoder-types';
import type {
  BirdCoderCodingSessionMirrorSnapshot,
  BirdCoderProjectMirrorSnapshot,
  IProjectService,
} from '../services/interfaces/IProjectService.ts';
import {
  isAuthorityBackedNativeSessionId,
  type NativeSessionAuthorityCoreReadService,
} from './nativeSessionAuthority.ts';

type CodingSessionRefreshCoreReadService =
  NativeSessionAuthorityCoreReadService &
  Pick<
    {
      getCodingSession(codingSessionId: string): Promise<BirdCoderCodingSessionSummary>;
      getNativeSession(
        codingSessionId: string,
        request?: BirdCoderGetNativeSessionRequest,
      ): Promise<BirdCoderNativeSessionDetail>;
      listCodingSessions(
        request?: BirdCoderListCodingSessionsRequest,
      ): Promise<BirdCoderCodingSessionSummary[]>;
      listCodingSessionEvents(codingSessionId: string): Promise<BirdCoderCodingSessionEvent[]>;
    },
    'getCodingSession' | 'getNativeSession' | 'listCodingSessions' | 'listCodingSessionEvents'
  >;

export interface RefreshProjectSessionsOptions {
  coreReadService?: CodingSessionRefreshCoreReadService;
  identityScope?: string;
  projectId?: string;
  projectService: IProjectService;
  refreshTimeoutMs?: number;
  workspaceId: string;
}

export interface RefreshCodingSessionMessagesOptions {
  codingSessionId: string;
  coreReadService?: CodingSessionRefreshCoreReadService;
  identityScope?: string;
  projectService: IProjectService;
  refreshTimeoutMs?: number;
  resolvedLocation?: ResolvedCodingSessionLocation;
  workspaceId?: string;
}

export interface RefreshProjectSessionsResult {
  mirroredSessionIds: string[];
  projectIds: string[];
  projects?: BirdCoderProject[];
  source: 'core' | 'project-service';
  status: 'failed' | 'refreshed';
}

export interface RefreshCodingSessionMessagesResult {
  codingSessionId: string;
  codingSession?: BirdCoderCodingSession;
  messageCount: number;
  projectId: string;
  source: 'core' | 'engine' | 'native-engine';
  status: 'failed' | 'not-found' | 'refreshed' | 'unsupported';
  synchronizationVersion?: string;
  workspaceId?: string;
}

const inflightRefreshes = new Map<string, Promise<unknown>>();
const DEFAULT_SESSION_REFRESH_TIMEOUT_MS = 30_000;
const ORPHANED_EXECUTING_RUNTIME_STATUS_STALE_MS = 2 * 60 * 1000;
const ORPHANABLE_EXECUTING_RUNTIME_STATUS_SET = new Set<
  NonNullable<BirdCoderCodingSession['runtimeStatus']>
>(['initializing', 'streaming', 'awaiting_tool']);

interface RefreshTimeoutBoundary {
  clear: () => void;
  promise: Promise<never>;
}

function normalizeSessionRefreshTimeoutMs(timeoutMs: number | null | undefined): number {
  return Number.isFinite(timeoutMs) && typeof timeoutMs === 'number' && timeoutMs > 0
    ? timeoutMs
    : DEFAULT_SESSION_REFRESH_TIMEOUT_MS;
}

function createRefreshTimeoutPromise(
  operationName: string,
  timeoutMs: number,
): RefreshTimeoutBoundary {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const promise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Timed out ${operationName} after ${timeoutMs} ms.`));
    }, timeoutMs);
  });

  return {
    clear: () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    },
    promise,
  };
}

function runRefreshTaskWithTimeout<T>(
  operationName: string,
  task: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const timeoutBoundary = createRefreshTimeoutPromise(operationName, timeoutMs);
  return Promise.race([
    Promise.resolve().then(task),
    timeoutBoundary.promise,
  ]).finally(() => {
    timeoutBoundary.clear();
  });
}

function normalizeRefreshIdentityScope(identityScope: string | null | undefined): string {
  const normalizedIdentityScope =
    typeof identityScope === 'string' ? identityScope.trim() : '';
  return normalizedIdentityScope || 'anonymous';
}

function copyMessagesIfNeeded(
  existingMessages: readonly BirdCoderChatMessage[],
  nextMessages?: readonly BirdCoderChatMessage[],
): BirdCoderChatMessage[] {
  if (!nextMessages) {
    return existingMessages as BirdCoderChatMessage[];
  }

  if (nextMessages === existingMessages) {
    return existingMessages as BirdCoderChatMessage[];
  }

  return [...nextMessages];
}

function findLatestTranscriptTimestamp(
  messages: readonly Pick<BirdCoderChatMessage, 'createdAt'>[],
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (typeof message.createdAt === 'string' && !Number.isNaN(Date.parse(message.createdAt))) {
      return message.createdAt;
    }
  }

  return null;
}

function parseRefreshTimestamp(value: string | null | undefined): number {
  if (typeof value !== 'string') {
    return Number.NaN;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NaN : timestamp;
}

function resolveLatestRefreshTimestamp(
  ...candidates: Array<string | null | undefined>
): number {
  let latestTimestamp = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const parsedTimestamp = parseRefreshTimestamp(candidate);
    if (Number.isNaN(parsedTimestamp) || parsedTimestamp < latestTimestamp) {
      continue;
    }

    latestTimestamp = parsedTimestamp;
  }

  return Number.isFinite(latestTimestamp) ? latestTimestamp : Number.NaN;
}

function resolveLatestRefreshEventTimestamp(
  events: readonly BirdCoderCodingSessionEvent[],
): number {
  let latestTimestamp = Number.NEGATIVE_INFINITY;

  for (const event of events) {
    const parsedTimestamp = parseRefreshTimestamp(event.createdAt);
    if (Number.isNaN(parsedTimestamp) || parsedTimestamp < latestTimestamp) {
      continue;
    }

    latestTimestamp = parsedTimestamp;
  }

  return Number.isFinite(latestTimestamp) ? latestTimestamp : Number.NaN;
}

function isOrphanableExecutingRuntimeStatus(
  runtimeStatus: BirdCoderCodingSession['runtimeStatus'],
): runtimeStatus is NonNullable<BirdCoderCodingSession['runtimeStatus']> {
  return Boolean(
    runtimeStatus && ORPHANABLE_EXECUTING_RUNTIME_STATUS_SET.has(runtimeStatus),
  );
}

function resolveRefreshRuntimeActivityTimestamp(
  summary: BirdCoderCodingSessionSummary,
  existingSession: BirdCoderCodingSession,
  events: readonly BirdCoderCodingSessionEvent[],
): number {
  const candidateTimestamps = [
    resolveLatestRefreshEventTimestamp(events),
    resolveLatestRefreshTimestamp(
      summary.transcriptUpdatedAt,
      summary.lastTurnAt,
      summary.updatedAt,
    ),
    resolveLatestRefreshTimestamp(
      existingSession.transcriptUpdatedAt,
      existingSession.lastTurnAt,
      existingSession.updatedAt,
    ),
  ].filter((timestamp) => Number.isFinite(timestamp));

  return candidateTimestamps.length > 0
    ? Math.max(...candidateTimestamps)
    : Number.NaN;
}

function resolveConvergedRefreshRuntimeStatus(
  resolvedRuntimeStatus: BirdCoderCodingSession['runtimeStatus'],
  summary: BirdCoderCodingSessionSummary,
  existingSession: BirdCoderCodingSession,
  events: readonly BirdCoderCodingSessionEvent[],
): BirdCoderCodingSession['runtimeStatus'] {
  if (!isOrphanableExecutingRuntimeStatus(resolvedRuntimeStatus)) {
    return resolvedRuntimeStatus;
  }

  const latestRuntimeActivityTimestamp = resolveRefreshRuntimeActivityTimestamp(
    summary,
    existingSession,
    events,
  );
  if (
    !Number.isFinite(latestRuntimeActivityTimestamp) ||
    Date.now() - latestRuntimeActivityTimestamp < ORPHANED_EXECUTING_RUNTIME_STATUS_STALE_MS
  ) {
    return resolvedRuntimeStatus;
  }

  return 'completed';
}

function isStaleOrphanedRefreshRuntimeStatus(
  codingSession: BirdCoderCodingSession,
): boolean {
  if (!isOrphanableExecutingRuntimeStatus(codingSession.runtimeStatus)) {
    return false;
  }

  const latestRuntimeActivityTimestamp = resolveLatestRefreshTimestamp(
    codingSession.transcriptUpdatedAt,
    codingSession.lastTurnAt,
    codingSession.updatedAt,
  );
  return (
    Number.isFinite(latestRuntimeActivityTimestamp) &&
    Date.now() - latestRuntimeActivityTimestamp >= ORPHANED_EXECUTING_RUNTIME_STATUS_STALE_MS
  );
}

function areRefreshMessagesEquivalent(
  left: readonly BirdCoderChatMessage[],
  right: readonly BirdCoderChatMessage[],
): boolean {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  if (left.length === 0) {
    return true;
  }

  return left.every((message, index) =>
    areBirdCoderChatMessagesEquivalent(message, right[index]!),
  );
}

function areRefreshedCodingSessionScalarsEqual(
  left: BirdCoderCodingSession,
  right: BirdCoderCodingSession,
): boolean {
  return (
    left.id === right.id &&
    left.workspaceId === right.workspaceId &&
    left.projectId === right.projectId &&
    left.title === right.title &&
    left.status === right.status &&
    left.hostMode === right.hostMode &&
    left.engineId === right.engineId &&
    left.modelId === right.modelId &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    left.lastTurnAt === right.lastTurnAt &&
    left.sortTimestamp === right.sortTimestamp &&
    left.transcriptUpdatedAt === right.transcriptUpdatedAt &&
    left.runtimeStatus === right.runtimeStatus &&
    left.displayTime === right.displayTime &&
    left.pinned === right.pinned &&
    left.archived === right.archived &&
    left.unread === right.unread
  );
}

function canSkipRefreshedCodingSessionUpsert(
  existingSession: BirdCoderCodingSession,
  refreshedSession: BirdCoderCodingSession,
): boolean {
  return (
    areRefreshedCodingSessionScalarsEqual(existingSession, refreshedSession) &&
    areRefreshMessagesEquivalent(existingSession.messages, refreshedSession.messages)
  );
}

function isMissingProjectPersistenceError(error: unknown, projectId: string): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.trim().toLowerCase();
  const normalizedProjectId = projectId.trim().toLowerCase();
  return (
    normalizedProjectId.length > 0 &&
    (
      normalizedMessage.includes(`project ${normalizedProjectId} not found`) ||
      normalizedMessage.includes(`project ${normalizedProjectId} was not found`)
    )
  );
}

async function persistRefreshedCodingSessionIfNeeded(
  projectService: IProjectService & Required<Pick<IProjectService, 'upsertCodingSession'>>,
  projectId: string,
  existingSession: BirdCoderCodingSession,
  refreshedSession: BirdCoderCodingSession,
): Promise<void> {
  if (canSkipRefreshedCodingSessionUpsert(existingSession, refreshedSession)) {
    return;
  }

  try {
    await projectService.upsertCodingSession(projectId, refreshedSession);
  } catch (error) {
    if (isMissingProjectPersistenceError(error, projectId)) {
      await recoverMissingProjectPersistenceAndRetryUpsert(
        projectService,
        projectId,
        existingSession,
        refreshedSession,
      );
      return;
    }

    throw error;
  }
}

async function recoverMissingProjectPersistenceAndRetryUpsert(
  projectService: IProjectService & Required<Pick<IProjectService, 'upsertCodingSession'>>,
  projectId: string,
  existingSession: BirdCoderCodingSession,
  refreshedSession: BirdCoderCodingSession,
): Promise<void> {
  const workspaceId =
    refreshedSession.workspaceId.trim() ||
    existingSession.workspaceId.trim() ||
    undefined;

  try {
    await projectService.invalidateProjectReadCache?.({
      projectId,
      workspaceId,
    });
    const recoveredProject = await projectService.getProjectById(projectId);
    if (!recoveredProject) {
      return;
    }

    await projectService.upsertCodingSession(projectId, refreshedSession);
  } catch (error) {
    if (isMissingProjectPersistenceError(error, projectId)) {
      return;
    }

    throw error;
  }
}

function requireProjectServiceUpsert(
  projectService: IProjectService,
): asserts projectService is IProjectService & Required<Pick<IProjectService, 'upsertCodingSession'>> {
  if (typeof projectService.upsertCodingSession !== 'function') {
    throw new Error('Project service must support upsertCodingSession for authority refresh synchronization.');
  }
}

async function settleStaleOrphanedRefreshRuntimeStatus({
  codingSessionId,
  projectService,
  resolvedLocation,
  source,
}: {
  codingSessionId: string;
  projectService: IProjectService & Required<Pick<IProjectService, 'upsertCodingSession'>>;
  resolvedLocation: ResolvedCodingSessionLocation;
  source: RefreshCodingSessionMessagesResult['source'];
}): Promise<RefreshCodingSessionMessagesResult | null> {
  if (!isStaleOrphanedRefreshRuntimeStatus(resolvedLocation.codingSession)) {
    return null;
  }

  const refreshedSession = {
    ...resolvedLocation.codingSession,
    runtimeStatus: undefined,
  } satisfies BirdCoderCodingSession;

  await persistRefreshedCodingSessionIfNeeded(
    projectService,
    resolvedLocation.project.id,
    resolvedLocation.codingSession,
    refreshedSession,
  );

  return {
    codingSessionId,
    codingSession: refreshedSession,
    messageCount: refreshedSession.messages.length,
    projectId: resolvedLocation.project.id,
    source,
    status: 'refreshed',
    synchronizationVersion: buildBirdCoderSessionSynchronizationVersion(
      refreshedSession,
      refreshedSession.messages.length,
    ),
    workspaceId: resolvedLocation.project.workspaceId,
  } satisfies RefreshCodingSessionMessagesResult;
}

function buildRefreshedCodingSession(
  existingSession: BirdCoderCodingSession,
  summary: BirdCoderCodingSessionSummary,
  messages?: readonly BirdCoderChatMessage[],
  runtimeStatus?: BirdCoderCodingSession['runtimeStatus'],
): BirdCoderCodingSession {
  const resolvedTranscriptUpdatedAt =
    summary.transcriptUpdatedAt ??
    (messages ? findLatestTranscriptTimestamp(messages) : null) ??
    existingSession.transcriptUpdatedAt ??
    null;
  return {
    id: summary.id,
    workspaceId: summary.workspaceId.trim() || existingSession.workspaceId,
    projectId: summary.projectId.trim() || existingSession.projectId,
    title: summary.title,
    status: summary.status,
    hostMode: summary.hostMode,
    engineId: summary.engineId,
    modelId: summary.modelId,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    lastTurnAt: summary.lastTurnAt,
    sortTimestamp: summary.sortTimestamp ?? existingSession.sortTimestamp,
    transcriptUpdatedAt: resolvedTranscriptUpdatedAt,
    runtimeStatus: runtimeStatus ?? summary.runtimeStatus ?? existingSession.runtimeStatus,
    displayTime: formatBirdCoderSessionActivityDisplayTime({
      ...summary,
      transcriptUpdatedAt: resolvedTranscriptUpdatedAt,
    }),
    pinned: existingSession.pinned ?? false,
    archived: existingSession.archived ?? summary.status === 'archived',
    unread: existingSession.unread ?? false,
    messages: copyMessagesIfNeeded(existingSession.messages, messages),
  };
}

function isCodingSessionSummaryInResolvedLocationScope(
  requestedCodingSessionId: string,
  summary: BirdCoderCodingSessionSummary,
  resolvedLocation: ResolvedCodingSessionLocation,
  fallbackWorkspaceId: string,
): boolean {
  const summaryCodingSessionId = summary.id.trim();
  if (summaryCodingSessionId && summaryCodingSessionId !== requestedCodingSessionId) {
    return false;
  }

  const summaryProjectId = summary.projectId.trim();
  const resolvedProjectId = resolvedLocation.project.id.trim();
  if (summaryProjectId && resolvedProjectId && summaryProjectId !== resolvedProjectId) {
    return false;
  }

  const summaryWorkspaceId = summary.workspaceId.trim();
  const resolvedWorkspaceId =
    resolvedLocation.project.workspaceId.trim() ||
    resolvedLocation.codingSession.workspaceId.trim() ||
    fallbackWorkspaceId;
  return !summaryWorkspaceId || !resolvedWorkspaceId || summaryWorkspaceId === resolvedWorkspaceId;
}

function mergeCoreVisibleMessages(
  codingSessionId: string,
  existingMessages: readonly BirdCoderChatMessage[],
  events: readonly BirdCoderCodingSessionEvent[],
): BirdCoderChatMessage[] {
  return mergeBirdCoderProjectionMessages({
    codingSessionId,
    events,
    existingMessages,
    idPrefix: 'authoritative',
  });
}

async function runGuardedRefresh<T>(
  key: string,
  operationName: string,
  timeoutMs: number | null | undefined,
  task: () => Promise<T>,
): Promise<T> {
  const inflightRefresh = inflightRefreshes.get(key);
  if (inflightRefresh) {
    return inflightRefresh as Promise<T>;
  }

  const nextRefresh = runRefreshTaskWithTimeout(
    operationName,
    task,
    normalizeSessionRefreshTimeoutMs(timeoutMs),
  ).finally(() => {
    if (inflightRefreshes.get(key) === nextRefresh) {
      inflightRefreshes.delete(key);
    }
  });
  inflightRefreshes.set(key, nextRefresh);
  return nextRefresh;
}

function findCodingSessionLocationInProjects(
  projects: Awaited<ReturnType<IProjectService['getProjects']>>,
  codingSessionId: string,
) {
  let matchedLocation: {
    codingSession: BirdCoderCodingSession;
    project: BirdCoderProject;
  } | null = null;
  for (const project of projects) {
    const codingSession = project.codingSessions.find((candidate) => candidate.id === codingSessionId);
    if (!codingSession) {
      continue;
    }

    if (matchedLocation) {
      return null;
    }
    matchedLocation = {
      codingSession,
      project,
    };
  }

  return matchedLocation;
}

function materializeCodingSessionFromMirrorSnapshot(
  codingSessionSnapshot: BirdCoderCodingSessionMirrorSnapshot,
): BirdCoderCodingSession {
  const {
    messageCount: _messageCount,
    nativeTranscriptUpdatedAt: _nativeTranscriptUpdatedAt,
    ...codingSession
  } = codingSessionSnapshot;
  return {
    ...codingSession,
    messages: [],
  };
}

function materializeProjectFromMirrorSnapshot(
  projectSnapshot: BirdCoderProjectMirrorSnapshot,
): BirdCoderProject {
  const { codingSessions, ...project } = projectSnapshot;
  return {
    ...project,
    codingSessions: codingSessions.map(materializeCodingSessionFromMirrorSnapshot),
  };
}

function findProjectMirrorSnapshotLocation(
  projectSnapshots: readonly BirdCoderProjectMirrorSnapshot[],
  codingSessionId: string,
): ResolvedCodingSessionLocation | null {
  let matchedLocation: ResolvedCodingSessionLocation | null = null;
  for (const projectSnapshot of projectSnapshots) {
    const codingSessionSnapshot = projectSnapshot.codingSessions.find(
      (candidate) => candidate.id === codingSessionId,
    );
    if (!codingSessionSnapshot) {
      continue;
    }

    if (matchedLocation) {
      return null;
    }
    matchedLocation = {
      codingSession: materializeCodingSessionFromMirrorSnapshot(codingSessionSnapshot),
      project: materializeProjectFromMirrorSnapshot(projectSnapshot),
    };
  }

  return matchedLocation;
}

async function readProjectMirrorSnapshotsForLocation(
  projectService: IProjectService,
  workspaceId: string,
): Promise<readonly BirdCoderProjectMirrorSnapshot[] | null> {
  const projectMirrorReader = projectService.getProjectMirrorSnapshots?.bind(projectService);
  if (!projectMirrorReader) {
    return null;
  }

  return projectMirrorReader(workspaceId || undefined);
}

async function resolveAuthorityProjectFromMirrorSnapshots(
  projectService: IProjectService,
  summary: BirdCoderCodingSessionSummary,
): Promise<BirdCoderProject | null> {
  const projectId = summary.projectId.trim();
  const workspaceId = summary.workspaceId.trim();
  const projectSnapshots = await readProjectMirrorSnapshotsForLocation(
    projectService,
    workspaceId,
  );
  if (!projectSnapshots) {
    return null;
  }

  const projectSnapshot = projectSnapshots.find((candidate) => candidate.id === projectId);
  return projectSnapshot ? materializeProjectFromMirrorSnapshot(projectSnapshot) : null;
}

async function resolveCodingSessionLocationFromMirrorSnapshots(
  projectService: IProjectService,
  codingSessionId: string,
  workspaceId: string,
): Promise<ResolvedCodingSessionLocation | null> {
  const projectSnapshots = await readProjectMirrorSnapshotsForLocation(
    projectService,
    workspaceId,
  );
  return projectSnapshots
    ? findProjectMirrorSnapshotLocation(projectSnapshots, codingSessionId)
    : null;
}

function buildBootstrapCodingSession(
  summary: BirdCoderCodingSessionSummary,
): BirdCoderCodingSession {
  return {
    ...summary,
    runtimeStatus: summary.runtimeStatus,
    displayTime: formatBirdCoderSessionActivityDisplayTime(summary),
    pinned: false,
    archived: summary.status === 'archived',
    unread: false,
    messages: [],
  };
}

interface ResolvedCodingSessionLocation {
  codingSession: BirdCoderCodingSession;
  project: BirdCoderProject;
  summary?: BirdCoderCodingSessionSummary;
}

async function resolveAuthorityProjectForCodingSession(
  projectService: IProjectService,
  summary: BirdCoderCodingSessionSummary,
): Promise<BirdCoderProject | null> {
  const projectId = summary.projectId.trim();
  if (!projectId) {
    return null;
  }

  try {
    const mirrorProject = await resolveAuthorityProjectFromMirrorSnapshots(
      projectService,
      summary,
    );
    if (mirrorProject) {
      return mirrorProject;
    }
  } catch (error) {
    console.error(
      `Failed to resolve coding session "${summary.id}" from project mirror snapshots`,
      error,
    );
  }

  const authorityProject = await projectService.getProjectById(projectId);
  if (authorityProject || !projectService.invalidateProjectReadCache) {
    return authorityProject;
  }

  await projectService.invalidateProjectReadCache({
    projectId,
    workspaceId: summary.workspaceId.trim() || undefined,
  });
  return projectService.getProjectById(projectId);
}

async function resolveCodingSessionLocation(
  projectService: IProjectService,
  codingSessionId: string,
  workspaceId?: string,
  coreReadService?: CodingSessionRefreshCoreReadService,
): Promise<ResolvedCodingSessionLocation | null> {
  const normalizedCodingSessionId = codingSessionId.trim();
  const normalizedWorkspaceId = workspaceId?.trim() || '';
  let preferredProjects: Awaited<ReturnType<IProjectService['getProjects']>> | null = null;

  if (!normalizedCodingSessionId) {
    return null;
  }

  if (coreReadService) {
    try {
      const summary = await coreReadService.getCodingSession(normalizedCodingSessionId);
      const authorityProject = await resolveAuthorityProjectForCodingSession(
        projectService,
        summary,
      );

      if (authorityProject) {
        const authorityCodingSession = authorityProject.codingSessions.find(
          (candidate) => candidate.id === normalizedCodingSessionId,
        );
        return {
          codingSession:
            authorityCodingSession ??
            buildBootstrapCodingSession({
              ...summary,
              projectId: authorityProject.id,
              workspaceId: authorityProject.workspaceId,
            }),
          project: authorityProject,
          summary,
        };
      }

    } catch (error) {
      console.error(
        `Failed to resolve coding session "${normalizedCodingSessionId}" from authority summary`,
        error,
      );
    }
  }

  if (normalizedWorkspaceId) {
    try {
      if (coreReadService) {
        const mirrorLocation = await resolveCodingSessionLocationFromMirrorSnapshots(
          projectService,
          normalizedCodingSessionId,
          normalizedWorkspaceId,
        );
        if (mirrorLocation) {
          return mirrorLocation;
        }
      }

      preferredProjects = await projectService.getProjects(normalizedWorkspaceId);
      return findCodingSessionLocationInProjects(
        preferredProjects,
        normalizedCodingSessionId,
      );
    } catch (error) {
      console.error(
        `Failed to resolve coding session "${normalizedCodingSessionId}" from workspace projects`,
        error,
      );
    }
  }

  return null;
}

export async function refreshProjectSessions(
  options: RefreshProjectSessionsOptions,
): Promise<RefreshProjectSessionsResult> {
  const normalizedWorkspaceId = options.workspaceId.trim();
  const normalizedProjectId = options.projectId?.trim() || '';
  const refreshIdentityScope = normalizeRefreshIdentityScope(options.identityScope);
  return runGuardedRefresh(
    `project:${refreshIdentityScope}:${normalizedWorkspaceId}:${normalizedProjectId || '*'}`,
    'refreshing project sessions',
    options.refreshTimeoutMs,
    async () => {
      if (!normalizedWorkspaceId) {
        return {
          mirroredSessionIds: [],
          projectIds: [],
          source: 'project-service',
          status: 'failed',
        } satisfies RefreshProjectSessionsResult;
      }

      await options.projectService.invalidateProjectReadCache?.({
        projectId: normalizedProjectId || undefined,
        workspaceId: normalizedWorkspaceId,
      });

      const preciseProject =
        normalizedProjectId
          ? await options.projectService.getProjectById(normalizedProjectId)
          : null;
      if (
        normalizedProjectId &&
        (!preciseProject || preciseProject.workspaceId.trim() !== normalizedWorkspaceId)
      ) {
        return {
          mirroredSessionIds: [],
          projectIds: [],
          projects: [],
          source: options.coreReadService ? 'core' : 'project-service',
          status: 'failed',
        } satisfies RefreshProjectSessionsResult;
      }
      const projects =
        preciseProject
          ? [preciseProject]
          : (await options.projectService.getProjects(normalizedWorkspaceId)).filter((project) =>
              normalizedProjectId ? project.id === normalizedProjectId : true,
            );
      if (normalizedProjectId && projects.length === 0) {
        return {
          mirroredSessionIds: [],
          projectIds: [],
          projects: [],
          source: options.coreReadService ? 'core' : 'project-service',
          status: 'failed',
        } satisfies RefreshProjectSessionsResult;
      }
      const projectIds = projects.map((project) => project.id);
      const mirroredSessionIds = projects.flatMap((project) =>
        project.codingSessions.map((codingSession) => codingSession.id),
      );

      return {
        mirroredSessionIds,
        projectIds,
        projects,
        source: options.coreReadService ? 'core' : 'project-service',
        status: 'refreshed',
      } satisfies RefreshProjectSessionsResult;
    },
  );
}

export async function refreshCodingSessionMessages(
  options: RefreshCodingSessionMessagesOptions,
): Promise<RefreshCodingSessionMessagesResult> {
  const normalizedCodingSessionId = options.codingSessionId.trim();
  const normalizedWorkspaceId = options.workspaceId?.trim() ?? '';
  const refreshIdentityScope = normalizeRefreshIdentityScope(options.identityScope);

  if (!normalizedCodingSessionId) {
    return {
      codingSessionId: normalizedCodingSessionId,
      messageCount: 0,
      projectId: '',
      source: 'engine',
      status: 'not-found',
    } satisfies RefreshCodingSessionMessagesResult;
  }

  const resolvedLocation =
    options.resolvedLocation ??
    (await runGuardedRefresh(
      `session-location:${refreshIdentityScope}:${normalizedWorkspaceId || '*'}:${normalizedCodingSessionId}`,
      'resolving coding session location',
      options.refreshTimeoutMs,
      () => resolveCodingSessionLocation(
        options.projectService,
        normalizedCodingSessionId,
        normalizedWorkspaceId,
        options.coreReadService,
      ),
    ));
  if (!resolvedLocation) {
    return {
      codingSessionId: normalizedCodingSessionId,
      messageCount: 0,
      projectId: '',
      source: 'engine',
      status: 'not-found',
    } satisfies RefreshCodingSessionMessagesResult;
  }

  const guardWorkspaceId =
    normalizedWorkspaceId ||
    resolvedLocation.project.workspaceId.trim() ||
    resolvedLocation.codingSession.workspaceId.trim();
  const guardProjectId =
    resolvedLocation.project.id.trim() ||
    resolvedLocation.codingSession.projectId.trim();

  return runGuardedRefresh(
    `session:${refreshIdentityScope}:${guardWorkspaceId}:${guardProjectId}:${normalizedCodingSessionId}`,
    'refreshing coding session messages',
    options.refreshTimeoutMs,
    async () => {
      requireProjectServiceUpsert(options.projectService);

      if (!options.coreReadService) {
        const settledRefresh = await settleStaleOrphanedRefreshRuntimeStatus({
          codingSessionId: normalizedCodingSessionId,
          projectService: options.projectService,
          resolvedLocation,
          source: 'engine',
        });
        if (settledRefresh) {
          return settledRefresh;
        }

        return {
          codingSessionId: normalizedCodingSessionId,
          messageCount: resolvedLocation.codingSession.messages.length,
          projectId: resolvedLocation.project.id,
          source: 'engine',
          status: 'unsupported',
        } satisfies RefreshCodingSessionMessagesResult;
      }

      const coreReadService = options.coreReadService;
      let summary: BirdCoderCodingSessionSummary;
      let events: BirdCoderCodingSessionEvent[];
      try {
        summary =
          resolvedLocation.summary ??
          (await coreReadService.getCodingSession(normalizedCodingSessionId));
        events = await coreReadService.listCodingSessionEvents(
          normalizedCodingSessionId,
        );
      } catch (error) {
        const settledRefresh = await settleStaleOrphanedRefreshRuntimeStatus({
          codingSessionId: normalizedCodingSessionId,
          projectService: options.projectService,
          resolvedLocation,
          source: 'core',
        });
        if (settledRefresh) {
          return settledRefresh;
        }

        throw error;
      }
      if (
        !isCodingSessionSummaryInResolvedLocationScope(
          normalizedCodingSessionId,
          summary,
          resolvedLocation,
          normalizedWorkspaceId,
        )
      ) {
        return {
          codingSessionId: normalizedCodingSessionId,
          messageCount: resolvedLocation.codingSession.messages.length,
          projectId: resolvedLocation.project.id,
          source: 'core',
          status: 'not-found',
          workspaceId: resolvedLocation.project.workspaceId,
        } satisfies RefreshCodingSessionMessagesResult;
      }

      const resolvedRuntimeStatus = resolveBirdCoderCodingSessionRuntimeStatus(
        events,
        summary.runtimeStatus ?? resolvedLocation.codingSession.runtimeStatus,
      );
      const convergedRuntimeStatus = resolveConvergedRefreshRuntimeStatus(
        resolvedRuntimeStatus,
        summary,
        resolvedLocation.codingSession,
        events,
      );
      const mergedMessages = mergeCoreVisibleMessages(
        normalizedCodingSessionId,
        resolvedLocation.codingSession.messages,
        events,
      );
      const refreshedSession = buildRefreshedCodingSession(
        resolvedLocation.codingSession,
        summary,
        mergedMessages,
        convergedRuntimeStatus,
      );

      await persistRefreshedCodingSessionIfNeeded(
        options.projectService,
        resolvedLocation.project.id,
        resolvedLocation.codingSession,
        refreshedSession,
      );

      return {
        codingSessionId: normalizedCodingSessionId,
        codingSession: refreshedSession,
        messageCount: refreshedSession.messages.length,
        projectId: resolvedLocation.project.id,
        source: isAuthorityBackedNativeSessionId(
          normalizedCodingSessionId,
          resolvedLocation.codingSession.engineId,
          resolvedLocation.codingSession.nativeSessionId,
        )
          ? 'native-engine'
          : 'core',
        status: 'refreshed',
        synchronizationVersion: buildBirdCoderSessionSynchronizationVersion(
          refreshedSession,
          refreshedSession.messages.length,
        ),
        workspaceId: resolvedLocation.project.workspaceId,
      } satisfies RefreshCodingSessionMessagesResult;
    },
  );
}
