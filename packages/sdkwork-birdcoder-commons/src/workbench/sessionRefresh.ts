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
import type { IProjectService } from '../services/interfaces/IProjectService.ts';
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
  workspaceId: string;
}

export interface RefreshCodingSessionMessagesOptions {
  codingSessionId: string;
  coreReadService?: CodingSessionRefreshCoreReadService;
  identityScope?: string;
  projectService: IProjectService;
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

async function runGuardedRefresh<T>(key: string, task: () => Promise<T>): Promise<T> {
  const inflightRefresh = inflightRefreshes.get(key);
  if (inflightRefresh) {
    return inflightRefresh as Promise<T>;
  }

  const nextRefresh = task().finally(() => {
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
  for (const project of projects) {
    const codingSession = project.codingSessions.find((candidate) => candidate.id === codingSessionId);
    if (codingSession) {
      return {
        codingSession,
        project,
      };
    }
  }

  return null;
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
    (await resolveCodingSessionLocation(
      options.projectService,
      normalizedCodingSessionId,
      normalizedWorkspaceId,
      options.coreReadService,
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
    async () => {
      requireProjectServiceUpsert(options.projectService);

      if (!options.coreReadService) {
        return {
          codingSessionId: normalizedCodingSessionId,
          messageCount: resolvedLocation.codingSession.messages.length,
          projectId: resolvedLocation.project.id,
          source: 'engine',
          status: 'unsupported',
        } satisfies RefreshCodingSessionMessagesResult;
      }

      const coreReadService = options.coreReadService;
      const summary =
        resolvedLocation.summary ??
        (await coreReadService.getCodingSession(normalizedCodingSessionId));
      const events = await coreReadService.listCodingSessionEvents(
        normalizedCodingSessionId,
      );
      const resolvedRuntimeStatus = resolveBirdCoderCodingSessionRuntimeStatus(
        events,
        resolvedLocation.codingSession.runtimeStatus ?? resolvedLocation.summary?.runtimeStatus,
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
        resolvedRuntimeStatus,
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
