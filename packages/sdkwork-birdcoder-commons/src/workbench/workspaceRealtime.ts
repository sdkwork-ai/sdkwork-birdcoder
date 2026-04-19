import type {
  BirdCoderProject,
  BirdCoderWorkspaceRealtimeEvent,
} from '@sdkwork/birdcoder-types';
import {
  BIRDCODER_CODING_SESSION_STATUSES,
  BIRDCODER_HOST_MODES,
  formatBirdCoderSessionActivityDisplayTime,
  resolveBirdCoderSessionSortTimestamp,
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

  if (
    !normalizedCodingSessionId ||
    !normalizedProjectId ||
    !normalizedWorkspaceId ||
    !normalizedTitle ||
    !normalizedStatus ||
    !normalizedHostMode ||
    !normalizedEngineId
  ) {
    return null;
  }

  const timestamp = resolveRealtimeEventTimestamp(event);
  return {
    id: normalizedCodingSessionId,
    workspaceId: normalizedWorkspaceId,
    projectId: normalizedProjectId,
    title: normalizedTitle,
    status: normalizedStatus,
    hostMode: normalizedHostMode,
    engineId: normalizedEngineId,
    modelId: event.codingSessionModelId?.trim() || undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastTurnAt: timestamp,
    sortTimestamp: resolveTimestamp(timestamp),
    transcriptUpdatedAt: timestamp,
    runtimeStatus: event.eventKind === 'coding-session.turn.created' ? 'streaming' : undefined,
    displayTime: formatBirdCoderSessionActivityDisplayTime({
      createdAt: timestamp,
      updatedAt: timestamp,
      lastTurnAt: timestamp,
      sortTimestamp: resolveTimestamp(timestamp),
      transcriptUpdatedAt: timestamp,
    }),
    pinned: false,
    archived: normalizedStatus === 'archived',
    unread: false,
    messages: [],
  };
}

function sortProjectsByUpdatedAt(projects: readonly BirdCoderProject[]): BirdCoderProject[] {
  if (projects.length < 2) {
    return projects as BirdCoderProject[];
  }

  for (let index = 1; index < projects.length; index += 1) {
    if (compareProjectsByUpdatedAt(projects[index - 1], projects[index]) > 0) {
      return [...projects].sort(compareProjectsByUpdatedAt);
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

function compareProjectsByUpdatedAt(left: BirdCoderProject, right: BirdCoderProject): number {
  return (
    resolveTimestamp(right.updatedAt) - resolveTimestamp(left.updatedAt) ||
    left.id.localeCompare(right.id)
  );
}

function compareProjectCodingSessions(
  left: BirdCoderProject['codingSessions'][number],
  right: BirdCoderProject['codingSessions'][number],
): number {
  return (
    resolveBirdCoderSessionSortTimestamp(right) -
      resolveBirdCoderSessionSortTimestamp(left) ||
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
  if (
    nextActivityAt === codingSession.lastTurnAt &&
    nextUpdatedAt === codingSession.updatedAt &&
    nextProjectUpdatedAt === project.updatedAt &&
    (codingSession.transcriptUpdatedAt ?? undefined) === nextActivityAt
  ) {
    return null;
  }

  const nextCodingSession = {
    ...codingSession,
    updatedAt: nextUpdatedAt,
    lastTurnAt: nextActivityAt,
    transcriptUpdatedAt: nextActivityAt,
    runtimeStatus:
      event.eventKind === 'coding-session.turn.created' ? 'streaming' : codingSession.runtimeStatus,
  };
  const nextStatus =
    normalizeRealtimeCodingSessionStatus(event.codingSessionStatus?.trim()) ??
    nextCodingSession.status;
  const nextHostMode =
    normalizeRealtimeHostMode(event.codingSessionHostMode?.trim()) ??
    nextCodingSession.hostMode;
  const nextCodingSessionWithMetadata = {
    ...nextCodingSession,
    title: event.codingSessionTitle?.trim() || nextCodingSession.title,
    status: nextStatus,
    hostMode: nextHostMode,
    engineId: event.codingSessionEngineId?.trim() || nextCodingSession.engineId,
    modelId: event.codingSessionModelId?.trim() || nextCodingSession.modelId,
  };
  const nextCodingSessionWithDerivedState = {
    ...nextCodingSessionWithMetadata,
    displayTime: formatBirdCoderSessionActivityDisplayTime(nextCodingSessionWithMetadata),
    sortTimestamp: resolveBirdCoderSessionSortTimestamp(nextCodingSessionWithMetadata),
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
        : sortProjectsByUpdatedAt(nextProjects);
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
        return seedProject ? sortProjectsByUpdatedAt([...projects, seedProject]) : null;
      }

      const nextProject = updateProjectTimestamp(project, event);
      if (nextProject === project) {
        return null;
      }

      return sortProjectsByUpdatedAt(
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

      return sortProjectsByUpdatedAt(
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
        return null;
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
           return sortProjectsByUpdatedAt(
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

      return sortProjectsByUpdatedAt(
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
        return true;
      }

      const codingSession = project.codingSessions.find(
        (candidateCodingSession) => candidateCodingSession.id === event.codingSessionId,
      );
      if (!codingSession) {
        return false;
      }

      if (!event.codingSessionUpdatedAt) {
        return true;
      }

      return (
        resolveBirdCoderSessionSortTimestamp(codingSession) >=
        resolveTimestamp(event.codingSessionUpdatedAt)
      );
    }
    default:
      return false;
  }
}
