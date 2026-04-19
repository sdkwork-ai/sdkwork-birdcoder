import {
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
  isBirdCoderCodingSessionExecuting,
  resolveBirdCoderCodingSessionRuntimeStatus,
} from '@sdkwork/birdcoder-types';
import { mergeBirdCoderProjectionMessages } from '@sdkwork/birdcoder-infrastructure';
import type { IProjectService } from '../services/interfaces/IProjectService.ts';
import {
  isAuthorityBackedNativeSessionId,
  readAuthorityBackedNativeSessionRecord,
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
  projectId?: string;
  projectService: IProjectService;
  workspaceId: string;
}

export interface RefreshCodingSessionMessagesOptions {
  codingSessionId: string;
  coreReadService?: CodingSessionRefreshCoreReadService;
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

function normalizeComparableTimestamp(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function areRefreshMessageBoundariesEqual(
  left: BirdCoderChatMessage,
  right: BirdCoderChatMessage,
): boolean {
  return (
    left.id === right.id &&
    left.codingSessionId === right.codingSessionId &&
    left.turnId === right.turnId &&
    left.role === right.role &&
    left.content === right.content &&
    left.createdAt === right.createdAt &&
    left.timestamp === right.timestamp &&
    left.name === right.name &&
    left.tool_call_id === right.tool_call_id
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

  return (
    areRefreshMessageBoundariesEqual(left[0], right[0]) &&
    areRefreshMessageBoundariesEqual(left[left.length - 1], right[right.length - 1])
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

function doesSummaryMatchLocalTranscript(
  codingSession: BirdCoderCodingSession,
  summary: BirdCoderCodingSessionSummary,
): boolean {
  return (
    codingSession.id === summary.id &&
    codingSession.workspaceId === summary.workspaceId &&
    codingSession.projectId === summary.projectId &&
    codingSession.status === summary.status &&
    normalizeComparableTimestamp(codingSession.transcriptUpdatedAt) ===
      normalizeComparableTimestamp(summary.transcriptUpdatedAt) &&
    normalizeComparableTimestamp(codingSession.lastTurnAt) ===
      normalizeComparableTimestamp(summary.lastTurnAt) &&
    normalizeComparableTimestamp(codingSession.updatedAt) ===
      normalizeComparableTimestamp(summary.updatedAt)
  );
}

function canReuseLocalCodingSessionMessages(
  codingSession: BirdCoderCodingSession,
  summary: BirdCoderCodingSessionSummary,
): boolean {
  if (codingSession.messages.length === 0) {
    return false;
  }

  if (
    isBirdCoderCodingSessionExecuting({
      runtimeStatus: summary.runtimeStatus ?? codingSession.runtimeStatus,
    })
  ) {
    return false;
  }

  return doesSummaryMatchLocalTranscript(codingSession, summary);
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

  await projectService.upsertCodingSession(projectId, refreshedSession);
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
    modelId: summary.modelId ?? existingSession.modelId,
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
    idPrefix: 'refreshed',
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
      const authorityProject =
        summary.projectId.trim()
          ? await projectService.getProjectById(summary.projectId)
          : null;

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
  return runGuardedRefresh(
    `project:${normalizedWorkspaceId}:${normalizedProjectId || '*'}`,
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
  const normalizedWorkspaceId = options.workspaceId?.trim();

  return runGuardedRefresh(`session:${normalizedCodingSessionId}`, async () => {
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

    requireProjectServiceUpsert(options.projectService);

    if (
      isAuthorityBackedNativeSessionId(
        normalizedCodingSessionId,
        resolvedLocation.codingSession.engineId,
      )
    ) {
      const nativeSessionRecord = await readAuthorityBackedNativeSessionRecord(
        normalizedCodingSessionId,
        {
          coreReadService: options.coreReadService,
          engineId: resolvedLocation.codingSession.engineId,
          projectId: resolvedLocation.project.id,
          workspaceId: resolvedLocation.project.workspaceId,
        },
      );
      if (!nativeSessionRecord) {
        return {
          codingSessionId: normalizedCodingSessionId,
          messageCount: resolvedLocation.codingSession.messages.length,
          projectId: resolvedLocation.project.id,
          source: 'native-engine',
          status: 'failed',
        } satisfies RefreshCodingSessionMessagesResult;
      }

    const refreshedSession = buildRefreshedCodingSession(
      resolvedLocation.codingSession,
      {
          ...nativeSessionRecord.summary,
          workspaceId: resolvedLocation.project.workspaceId,
          projectId: resolvedLocation.project.id,
        },
        nativeSessionRecord.messages,
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
        source: 'native-engine',
        status: 'refreshed',
        synchronizationVersion: buildBirdCoderSessionSynchronizationVersion(
          refreshedSession,
          refreshedSession.messages.length,
        ),
        workspaceId: resolvedLocation.project.workspaceId,
      } satisfies RefreshCodingSessionMessagesResult;
    }

    if (!options.coreReadService) {
      return {
        codingSessionId: normalizedCodingSessionId,
        messageCount: resolvedLocation.codingSession.messages.length,
        projectId: resolvedLocation.project.id,
        source: 'engine',
        status: 'unsupported',
      } satisfies RefreshCodingSessionMessagesResult;
    }

    const summary =
      resolvedLocation.summary ??
      (await options.coreReadService.getCodingSession(normalizedCodingSessionId));
    const refreshedSession =
      canReuseLocalCodingSessionMessages(resolvedLocation.codingSession, summary)
        ? buildRefreshedCodingSession(
            resolvedLocation.codingSession,
            summary,
            resolvedLocation.codingSession.messages,
            summary.runtimeStatus ?? resolvedLocation.codingSession.runtimeStatus,
          )
        : await (async () => {
            const events = await options.coreReadService.listCodingSessionEvents(
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
            return buildRefreshedCodingSession(
              resolvedLocation.codingSession,
              summary,
              mergedMessages,
              resolvedRuntimeStatus,
            );
          })();

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
      source: 'core',
      status: 'refreshed',
      synchronizationVersion: buildBirdCoderSessionSynchronizationVersion(
        refreshedSession,
        refreshedSession.messages.length,
      ),
      workspaceId: resolvedLocation.project.workspaceId,
    } satisfies RefreshCodingSessionMessagesResult;
  });
}
