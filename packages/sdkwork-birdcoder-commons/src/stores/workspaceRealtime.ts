import type {
  BirdCoderCodingSessionEvent,
  BirdCoderProject,
  BirdCoderWorkspaceRealtimeEvent,
} from '@sdkwork/birdcoder-types';
import { normalizeBirdCoderCodeEngineNativeSessionId } from '@sdkwork/birdcoder-codeengine';
import {
  BIRDCODER_CODING_SESSION_STATUSES,
  BIRDCODER_HOST_MODES,
  compareBirdCoderLongIntegers,
  compareBirdCoderProjectsByActivity,
  compareBirdCoderSessionSortTimestamp,
  formatBirdCoderSessionActivityDisplayTime,
  isBirdCoderCodingSessionExecuting,
  mergeBirdCoderProjectionMessages,
  normalizeBirdCoderCodeEngineRuntimeStatus,
  resolveBirdCoderCodingSessionRuntimeStatus,
  resolveBirdCoderSessionSortTimestampString,
  stringifyBirdCoderLongInteger,
} from '@sdkwork/birdcoder-types';

function resolveTimestamp(value: string | null | undefined): number {
  if (typeof value !== 'string') {
    return 0;
  }

  const parsedValue = Date.parse(value);
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
}

function findProject(
  projects: readonly BirdCoderProject[],
  projectId: string | undefined,
): BirdCoderProject | undefined {
  if (!projectId) {
    return undefined;
  }

  return projects.find((project) => project.id === projectId);
}

function resolveLatestTimestamp(
  ...candidates: Array<string | null | undefined>
): string | undefined {
  let latestTimestamp: string | undefined;
  let latestValue = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue;
    }

    const parsedValue = Date.parse(candidate);
    if (Number.isNaN(parsedValue) || parsedValue < latestValue) {
      continue;
    }

    latestTimestamp = candidate;
    latestValue = parsedValue;
  }

  return latestTimestamp;
}

function resolveRealtimeEventTimestamp(
  event: BirdCoderWorkspaceRealtimeEvent,
): string {
  return event.codingSessionUpdatedAt ?? event.projectUpdatedAt ?? event.occurredAt;
}

function buildRealtimeCodingSessionProjectionEvents(
  codingSessionId: string,
  event: BirdCoderWorkspaceRealtimeEvent,
): BirdCoderCodingSessionEvent[] {
  const genericEventKind = event.codingSessionEventKind;
  const genericEventPayload = event.codingSessionEventPayload;
  if (!genericEventKind) {
    return [];
  }

  const createdAt = event.codingSessionUpdatedAt ?? event.occurredAt;
  const projectionEvent: BirdCoderCodingSessionEvent = {
    id: `${event.eventId}:coding-session-event`,
    codingSessionId,
    turnId: event.turnId,
    kind: genericEventKind,
    sequence: stringifyBirdCoderLongInteger(resolveTimestamp(createdAt)),
    payload: genericEventPayload ?? {},
    createdAt,
  };

  if (genericEventKind === 'message.delta') {
    return [projectionEvent];
  }

  return [
    projectionEvent,
    {
      id: `${event.eventId}:message-delta-anchor`,
      codingSessionId,
      turnId: event.turnId,
      kind: 'message.delta',
      sequence: stringifyBirdCoderLongInteger(resolveTimestamp(createdAt) + 1),
      payload: {
        role: 'assistant',
        contentDelta: '',
        runtimeStatus: 'streaming',
      },
      createdAt,
    },
  ];
}

function resolveRealtimeCodingSessionActivityTimestamp(
  event: BirdCoderWorkspaceRealtimeEvent,
): number {
  return resolveTimestamp(
    resolveLatestTimestamp(event.codingSessionUpdatedAt, event.occurredAt),
  );
}

function resolveProjectCodingSessionActivityTimestamp(
  codingSession: BirdCoderProject['codingSessions'][number],
): number {
  return resolveTimestamp(
    resolveLatestTimestamp(
      codingSession.transcriptUpdatedAt,
      codingSession.lastTurnAt,
      codingSession.updatedAt,
    ),
  );
}

function normalizeRealtimeCodingSessionStatus(
  value: string | undefined,
): BirdCoderProject['codingSessions'][number]['status'] | null {
  if (!value || !BIRDCODER_CODING_SESSION_STATUSES.includes(value as never)) {
    return null;
  }

  return value as BirdCoderProject['codingSessions'][number]['status'];
}

function normalizeRealtimeHostMode(
  value: string | undefined,
): BirdCoderProject['codingSessions'][number]['hostMode'] | null {
  if (!value || !BIRDCODER_HOST_MODES.includes(value as never)) {
    return null;
  }

  return value as BirdCoderProject['codingSessions'][number]['hostMode'];
}

function normalizeRealtimeCodingSessionRuntimeStatus(
  value: string | undefined,
): BirdCoderProject['codingSessions'][number]['runtimeStatus'] | null {
  return normalizeBirdCoderCodeEngineRuntimeStatus(value) ?? null;
}

function normalizeRealtimeNativeSessionId(value: string | undefined): string | undefined {
  return normalizeBirdCoderCodeEngineNativeSessionId(value) ?? undefined;
}

function resolveRealtimeCodingSessionEventRuntimeStatus(
  event: BirdCoderWorkspaceRealtimeEvent,
): BirdCoderProject['codingSessions'][number]['runtimeStatus'] | null {
  const genericEventKind = event.codingSessionEventKind?.trim();
  if (!genericEventKind) {
    return null;
  }

  return resolveBirdCoderCodingSessionRuntimeStatus(
    [
      {
        kind: genericEventKind,
        payload: event.codingSessionEventPayload ?? {},
      },
    ],
  ) ?? null;
}

function resolveRealtimeCodingSessionRuntimeStatus(
  event: BirdCoderWorkspaceRealtimeEvent,
  fallback?: BirdCoderProject['codingSessions'][number]['runtimeStatus'],
): BirdCoderProject['codingSessions'][number]['runtimeStatus'] | undefined {
  return (
    normalizeRealtimeCodingSessionRuntimeStatus(event.codingSessionRuntimeStatus?.trim()) ??
    resolveRealtimeCodingSessionEventRuntimeStatus(event) ??
    (event.eventKind === 'coding-session.turn.created' ? 'streaming' : fallback)
  );
}

function shouldPreferLocalCodingSessionMetadata(
  codingSession: BirdCoderProject['codingSessions'][number],
  event: BirdCoderWorkspaceRealtimeEvent,
): boolean {
  return (
    resolveProjectCodingSessionActivityTimestamp(codingSession) >
    resolveRealtimeCodingSessionActivityTimestamp(event)
  );
}

function isRealtimeCodingSessionTranscriptActivityEvent(
  event: BirdCoderWorkspaceRealtimeEvent,
): boolean {
  return (
    event.eventKind === 'coding-session.turn.created' ||
    typeof event.turnId === 'string' &&
      event.turnId.trim().length > 0
  );
}

function shouldPreserveExistingCodingSessionMetadata(
  codingSession: BirdCoderProject['codingSessions'][number],
  event: BirdCoderWorkspaceRealtimeEvent,
): boolean {
  return (
    isRealtimeCodingSessionTranscriptActivityEvent(event) ||
    shouldPreferLocalCodingSessionMetadata(codingSession, event)
  );
}

function shouldPreferLocalCodingSessionRuntimeStatus(
  codingSession: BirdCoderProject['codingSessions'][number],
  event: BirdCoderWorkspaceRealtimeEvent,
): boolean {
  const localActivityTimestamp = resolveProjectCodingSessionActivityTimestamp(codingSession);
  const realtimeActivityTimestamp = resolveRealtimeCodingSessionActivityTimestamp(event);
  if (localActivityTimestamp > realtimeActivityTimestamp) {
    return true;
  }

  const realtimeRuntimeStatus = resolveRealtimeCodingSessionRuntimeStatus(event);
  if (!realtimeRuntimeStatus) {
    return false;
  }

  if (
    localActivityTimestamp === realtimeActivityTimestamp &&
    isBirdCoderCodingSessionExecuting(codingSession) &&
    isTerminalCodingSessionRuntimeStatus(realtimeRuntimeStatus)
  ) {
    return false;
  }

  return (
    localActivityTimestamp >= realtimeActivityTimestamp &&
    isBirdCoderCodingSessionExecuting(codingSession) &&
    !isBirdCoderCodingSessionExecuting({
      runtimeStatus: realtimeRuntimeStatus,
    })
  );
}

function isTerminalCodingSessionRuntimeStatus(
  runtimeStatus: BirdCoderProject['codingSessions'][number]['runtimeStatus'],
): boolean {
  return (
    runtimeStatus === 'completed' ||
    runtimeStatus === 'failed' ||
    runtimeStatus === 'terminated'
  );
}

function buildRealtimeProjectSeed(
  event: BirdCoderWorkspaceRealtimeEvent,
): BirdCoderProject | null {
  const normalizedProjectId = event.projectId?.trim();
  const normalizedProjectName = event.projectName?.trim();
  const normalizedWorkspaceId = event.workspaceId.trim();
  if (!normalizedProjectId || !normalizedProjectName || !normalizedWorkspaceId) {
    return null;
  }

  const timestamp = resolveRealtimeEventTimestamp(event);
  const sortTimestamp = stringifyBirdCoderLongInteger(resolveTimestamp(timestamp));
  return {
    id: normalizedProjectId,
    workspaceId: normalizedWorkspaceId,
    name: normalizedProjectName,
    description: undefined,
    path: event.projectRootPath?.trim() || undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
    archived: false,
    codingSessions: [],
  };
}

function updateProjectMetadataFromEvent(
  project: BirdCoderProject,
  event: BirdCoderWorkspaceRealtimeEvent,
): BirdCoderProject {
  const nextName = event.projectName?.trim() || project.name;
  const nextPath = event.projectRootPath?.trim() || project.path;
  const nextUpdatedAt =
    resolveLatestTimestamp(project.updatedAt, event.projectUpdatedAt, event.occurredAt) ??
    project.updatedAt;

  if (
    nextName === project.name &&
    nextPath === project.path &&
    nextUpdatedAt === project.updatedAt
  ) {
    return project;
  }

  return {
    ...project,
    name: nextName,
    path: nextPath,
    updatedAt: nextUpdatedAt,
  };
}

function buildRealtimeCodingSessionSeed(
  event: BirdCoderWorkspaceRealtimeEvent,
): BirdCoderProject['codingSessions'][number] | null {
  const normalizedCodingSessionId = event.codingSessionId?.trim();
  const normalizedProjectId = event.projectId?.trim();
  const normalizedWorkspaceId = event.workspaceId.trim();
  const normalizedTitle = event.codingSessionTitle?.trim();
  const normalizedStatus = normalizeRealtimeCodingSessionStatus(
    event.codingSessionStatus?.trim(),
  );
  const normalizedHostMode = normalizeRealtimeHostMode(
    event.codingSessionHostMode?.trim(),
  );
  const normalizedEngineId = event.codingSessionEngineId?.trim();
  const normalizedModelId = event.codingSessionModelId?.trim();
  const normalizedNativeSessionId = normalizeRealtimeNativeSessionId(event.nativeSessionId);

  if (
    !normalizedCodingSessionId ||
    !normalizedProjectId ||
    !normalizedWorkspaceId ||
    !normalizedTitle ||
    !normalizedStatus ||
    !normalizedHostMode ||
    !normalizedEngineId ||
    !normalizedModelId
  ) {
    return null;
  }

  const timestamp = resolveRealtimeEventTimestamp(event);
  const sortTimestamp = stringifyBirdCoderLongInteger(resolveTimestamp(timestamp));
  return {
    id: normalizedCodingSessionId,
    workspaceId: normalizedWorkspaceId,
    projectId: normalizedProjectId,
    title: normalizedTitle,
    status: normalizedStatus,
    hostMode: normalizedHostMode,
    engineId: normalizedEngineId,
    modelId: normalizedModelId,
    nativeSessionId: normalizedNativeSessionId,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastTurnAt: timestamp,
    sortTimestamp,
    transcriptUpdatedAt: timestamp,
    runtimeStatus: resolveRealtimeCodingSessionRuntimeStatus(event),
    displayTime: formatBirdCoderSessionActivityDisplayTime({
      createdAt: timestamp,
      updatedAt: timestamp,
      lastTurnAt: timestamp,
      sortTimestamp,
      transcriptUpdatedAt: timestamp,
    }),
    pinned: false,
    archived: normalizedStatus === 'archived',
    unread: false,
    messages: [],
  };
}

function sortProjectsByActivity(projects: readonly BirdCoderProject[]): BirdCoderProject[] {
  if (projects.length < 2) {
    return projects as BirdCoderProject[];
  }

  for (let index = 1; index < projects.length; index += 1) {
    if (compareProjectsByActivity(projects[index - 1], projects[index]) > 0) {
      return [...projects].sort(compareProjectsByActivity);
    }
  }

  return projects as BirdCoderProject[];
}

function sortProjectCodingSessions(project: BirdCoderProject): BirdCoderProject {
  if (project.codingSessions.length < 2) {
    return project;
  }

  for (let index = 1; index < project.codingSessions.length; index += 1) {
    if (
      compareProjectCodingSessions(
        project.codingSessions[index - 1],
        project.codingSessions[index],
      ) > 0
    ) {
      return {
        ...project,
        codingSessions: [...project.codingSessions].sort(compareProjectCodingSessions),
      };
    }
  }

  return project;
}

function compareProjectsByActivity(left: BirdCoderProject, right: BirdCoderProject): number {
  return compareBirdCoderProjectsByActivity(left, right);
}

function compareProjectCodingSessions(
  left: BirdCoderProject['codingSessions'][number],
  right: BirdCoderProject['codingSessions'][number],
): number {
  return (
    compareBirdCoderSessionSortTimestamp(right, left) ||
    left.id.localeCompare(right.id)
  );
}

function updateProjectTimestamp(
  project: BirdCoderProject,
  event: BirdCoderWorkspaceRealtimeEvent,
): BirdCoderProject {
  return updateProjectMetadataFromEvent(project, event);
}

function updateCodingSessionTimestamp(
  project: BirdCoderProject,
  event: BirdCoderWorkspaceRealtimeEvent,
): BirdCoderProject | null {
  const normalizedCodingSessionId = event.codingSessionId?.trim();
  if (!normalizedCodingSessionId) {
    return null;
  }

  const codingSession = project.codingSessions.find(
    (candidateCodingSession) => candidateCodingSession.id === normalizedCodingSessionId,
  );
  if (!codingSession) {
    return null;
  }

  const nextActivityAt =
    resolveLatestTimestamp(
      codingSession.transcriptUpdatedAt,
      codingSession.lastTurnAt,
      codingSession.updatedAt,
      event.codingSessionUpdatedAt,
      event.occurredAt,
    ) ??
    codingSession.updatedAt;
  const nextUpdatedAt =
    resolveLatestTimestamp(codingSession.updatedAt, event.codingSessionUpdatedAt, nextActivityAt) ??
    codingSession.updatedAt;
  const nextProjectUpdatedAt =
    resolveLatestTimestamp(project.updatedAt, event.projectUpdatedAt, nextActivityAt) ??
    project.updatedAt;
  const preserveExistingMetadata = shouldPreserveExistingCodingSessionMetadata(
    codingSession,
    event,
  );
  const nextStatus = preserveExistingMetadata
    ? codingSession.status
    : normalizeRealtimeCodingSessionStatus(event.codingSessionStatus?.trim()) ??
      codingSession.status;
  const nextHostMode = preserveExistingMetadata
    ? codingSession.hostMode
    : normalizeRealtimeHostMode(event.codingSessionHostMode?.trim()) ??
      codingSession.hostMode;
  const nextTitle = preserveExistingMetadata
    ? codingSession.title
    : event.codingSessionTitle?.trim() || codingSession.title;
  const nextRuntimeStatus = shouldPreferLocalCodingSessionRuntimeStatus(
    codingSession,
    event,
  )
    ? codingSession.runtimeStatus
    : resolveRealtimeCodingSessionRuntimeStatus(event, codingSession.runtimeStatus);
  const nextNativeSessionId =
    normalizeRealtimeNativeSessionId(event.nativeSessionId) ?? codingSession.nativeSessionId;
  const realtimeProjectionEvents = buildRealtimeCodingSessionProjectionEvents(
    normalizedCodingSessionId,
    event,
  );
  const nextMessages = realtimeProjectionEvents.length > 0
    ? mergeBirdCoderProjectionMessages({
        codingSessionId: normalizedCodingSessionId,
        events: realtimeProjectionEvents,
        existingMessages: codingSession.messages,
        idPrefix: 'realtime',
      })
    : codingSession.messages;
  if (
    nextActivityAt === codingSession.lastTurnAt &&
    nextUpdatedAt === codingSession.updatedAt &&
    nextProjectUpdatedAt === project.updatedAt &&
    (codingSession.transcriptUpdatedAt ?? undefined) === nextActivityAt &&
    nextRuntimeStatus === codingSession.runtimeStatus &&
    nextNativeSessionId === codingSession.nativeSessionId &&
    nextStatus === codingSession.status &&
    nextHostMode === codingSession.hostMode &&
    nextTitle === codingSession.title &&
    nextMessages === codingSession.messages
  ) {
    return null;
  }

  const nextCodingSession = {
    ...codingSession,
    updatedAt: nextUpdatedAt,
    lastTurnAt: nextActivityAt,
    transcriptUpdatedAt: nextActivityAt,
    runtimeStatus: nextRuntimeStatus,
    nativeSessionId: nextNativeSessionId,
    messages: nextMessages,
  };
  const nextCodingSessionWithMetadata = {
    ...nextCodingSession,
    title: nextTitle,
    status: nextStatus,
    hostMode: nextHostMode,
  };
  const nextSortTimestamp = resolveBirdCoderSessionSortTimestampString({
    ...nextCodingSessionWithMetadata,
    sortTimestamp: undefined,
  });
  const nextCodingSessionWithDerivedState = {
    ...nextCodingSessionWithMetadata,
    displayTime: formatBirdCoderSessionActivityDisplayTime({
      ...nextCodingSessionWithMetadata,
      sortTimestamp: nextSortTimestamp,
    }),
    sortTimestamp: nextSortTimestamp,
  };

  const nextProject = sortProjectCodingSessions({
    ...project,
    updatedAt: nextProjectUpdatedAt,
    codingSessions: project.codingSessions.map((candidateCodingSession) =>
      candidateCodingSession.id === normalizedCodingSessionId
        ? nextCodingSessionWithDerivedState
        : candidateCodingSession,
    ),
  });
  return nextProject;
}

export function applyWorkspaceRealtimeEventToProjects(
  projects: readonly BirdCoderProject[],
  event: BirdCoderWorkspaceRealtimeEvent,
): BirdCoderProject[] | null {
  switch (event.eventKind) {
    case 'project.deleted': {
      const normalizedProjectId = event.projectId?.trim();
      if (!normalizedProjectId) {
        return null;
      }

      const nextProjects = projects.filter((project) => project.id !== normalizedProjectId);
      return nextProjects.length === projects.length
        ? null
        : sortProjectsByActivity(nextProjects);
    }
    case 'project.created':
    case 'project.updated': {
      const normalizedProjectId = event.projectId?.trim();
      if (!normalizedProjectId) {
        return null;
      }

      const project = projects.find((candidateProject) => candidateProject.id === normalizedProjectId);
      if (!project) {
        const seedProject = buildRealtimeProjectSeed(event);
        return seedProject ? sortProjectsByActivity([...projects, seedProject]) : null;
      }

      const nextProject = updateProjectTimestamp(project, event);
      if (nextProject === project) {
        return null;
      }

      return sortProjectsByActivity(
        projects.map((candidateProject) =>
          candidateProject.id === normalizedProjectId ? nextProject : candidateProject,
        )
      );
    }
    case 'coding-session.deleted': {
      const normalizedProjectId = event.projectId?.trim();
      const normalizedCodingSessionId = event.codingSessionId?.trim();
      if (!normalizedProjectId || !normalizedCodingSessionId) {
        return null;
      }

      const project = projects.find((candidateProject) => candidateProject.id === normalizedProjectId);
      if (!project) {
        return null;
      }

      const nextCodingSessions = project.codingSessions.filter(
        (candidateCodingSession) => candidateCodingSession.id !== normalizedCodingSessionId,
      );
      if (nextCodingSessions.length === project.codingSessions.length) {
        return null;
      }

      const nextProject = sortProjectCodingSessions({
        ...updateProjectMetadataFromEvent(project, event),
        updatedAt:
          resolveLatestTimestamp(project.updatedAt, event.codingSessionUpdatedAt, event.occurredAt) ??
          project.updatedAt,
        codingSessions: nextCodingSessions,
      });

      return sortProjectsByActivity(
        projects.map((candidateProject) =>
          candidateProject.id === normalizedProjectId ? nextProject : candidateProject,
        ),
      );
    }
    case 'coding-session.created':
    case 'coding-session.updated':
    case 'coding-session.turn.created': {
      const normalizedProjectId = event.projectId?.trim();
      if (!normalizedProjectId) {
        return null;
      }

      const project = projects.find((candidateProject) => candidateProject.id === normalizedProjectId);
      if (!project) {
        const seedProject = buildRealtimeProjectSeed(event);
        const seedCodingSession = buildRealtimeCodingSessionSeed(event);
        return seedProject && seedCodingSession
          ? sortProjectsByActivity([
              ...projects,
              {
                ...seedProject,
                codingSessions: [seedCodingSession],
              },
            ])
          : null;
      }

       const normalizedCodingSessionId = event.codingSessionId?.trim();
       const codingSessionExists = normalizedCodingSessionId
         ? project.codingSessions.some(
             (candidateCodingSession) => candidateCodingSession.id === normalizedCodingSessionId,
           )
         : false;
       if (!codingSessionExists) {
         const seedCodingSession = buildRealtimeCodingSessionSeed(event);
         if (seedCodingSession) {
           const nextProject = sortProjectCodingSessions({
             ...updateProjectMetadataFromEvent(project, event),
             codingSessions: [...project.codingSessions, seedCodingSession],
             updatedAt:
               resolveLatestTimestamp(
                 project.updatedAt,
                 event.projectUpdatedAt,
                 event.codingSessionUpdatedAt,
                 event.occurredAt,
               ) ?? project.updatedAt,
           });
           return sortProjectsByActivity(
             projects.map((candidateProject) =>
               candidateProject.id === normalizedProjectId ? nextProject : candidateProject,
             ),
           );
         }
       }

      const nextProject = updateCodingSessionTimestamp(project, event);
      if (!nextProject) {
        return null;
      }

      return sortProjectsByActivity(
        projects.map((candidateProject) =>
          candidateProject.id === normalizedProjectId ? nextProject : candidateProject,
        )
      );
    }
    default:
      return null;
  }
}

export function isWorkspaceRealtimeEventSatisfiedByProjects(
  projects: readonly BirdCoderProject[],
  event: BirdCoderWorkspaceRealtimeEvent,
): boolean {
  switch (event.eventKind) {
    case 'project.deleted':
      return Boolean(event.projectId) && !findProject(projects, event.projectId);
    case 'project.created':
    case 'project.updated': {
      const project = findProject(projects, event.projectId);
      if (!project) {
        return event.eventKind === 'project.updated';
      }

      if (!event.projectUpdatedAt) {
        return true;
      }

      return resolveTimestamp(project.updatedAt) >= resolveTimestamp(event.projectUpdatedAt);
    }
    case 'coding-session.deleted': {
      const project = findProject(projects, event.projectId);
      if (!project) {
        return true;
      }

      return !project.codingSessions.some(
        (candidateCodingSession) => candidateCodingSession.id === event.codingSessionId,
      );
    }
    case 'coding-session.created':
    case 'coding-session.updated':
    case 'coding-session.turn.created': {
      const project = findProject(projects, event.projectId);
      if (!project) {
        return false;
      }

      const codingSession = project.codingSessions.find(
        (candidateCodingSession) => candidateCodingSession.id === event.codingSessionId,
      );
      if (!codingSession) {
        return false;
      }

      const requiredNativeSessionId = normalizeRealtimeNativeSessionId(event.nativeSessionId);
      if (
        requiredNativeSessionId &&
        codingSession.nativeSessionId !== requiredNativeSessionId
      ) {
        return false;
      }

      if (
        shouldPreferLocalCodingSessionMetadata(codingSession, event) ||
        shouldPreferLocalCodingSessionRuntimeStatus(codingSession, event)
      ) {
        return true;
      }

      if (!event.codingSessionUpdatedAt) {
        const requiredRuntimeStatus = resolveRealtimeCodingSessionRuntimeStatus(event);
        return !requiredRuntimeStatus || codingSession.runtimeStatus === requiredRuntimeStatus;
      }

      const hasSatisfiedTimestamp =
        compareBirdCoderLongIntegers(
          codingSession.sortTimestamp ??
            resolveBirdCoderSessionSortTimestampString(codingSession),
          stringifyBirdCoderLongInteger(resolveTimestamp(event.codingSessionUpdatedAt)),
        ) >= 0;
      if (!hasSatisfiedTimestamp) {
        return false;
      }

      const requiredRuntimeStatus = resolveRealtimeCodingSessionRuntimeStatus(event);
      return !requiredRuntimeStatus || codingSession.runtimeStatus === requiredRuntimeStatus;
    }
    default:
      return false;
  }
}
