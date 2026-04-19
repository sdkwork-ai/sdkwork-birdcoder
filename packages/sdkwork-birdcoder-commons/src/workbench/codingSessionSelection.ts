import {
  resolveBirdCoderSessionSortTimestamp,
  type BirdCoderCodingSession,
  type BirdCoderProject,
} from '@sdkwork/birdcoder-types';

export interface BirdCoderResolvedCodingSessionLocation {
  codingSession: BirdCoderCodingSession;
  project: BirdCoderProject;
}

export interface BirdCoderProjectCodingSessionIndex {
  codingSessionLocationsById: ReadonlyMap<string, BirdCoderResolvedCodingSessionLocation>;
  latestCodingSessionIdByProjectId: ReadonlyMap<string, string | null>;
  projectsById: ReadonlyMap<string, BirdCoderProject>;
}

function isLaterCodingSession(
  candidate: BirdCoderCodingSession,
  current: BirdCoderCodingSession,
): boolean {
  return (
    resolveBirdCoderSessionSortTimestamp(candidate) >
      resolveBirdCoderSessionSortTimestamp(current) ||
    (
      resolveBirdCoderSessionSortTimestamp(candidate) ===
        resolveBirdCoderSessionSortTimestamp(current) &&
      candidate.id.localeCompare(current.id) < 0
    )
  );
}

export function buildProjectCodingSessionIndex(
  projects: readonly BirdCoderProject[],
): BirdCoderProjectCodingSessionIndex {
  const projectsById = new Map<string, BirdCoderProject>();
  const codingSessionLocationsById = new Map<string, BirdCoderResolvedCodingSessionLocation>();
  const latestCodingSessionIdByProjectId = new Map<string, string | null>();

  for (const project of projects) {
    projectsById.set(project.id, project);

    let latestCodingSession: BirdCoderCodingSession | null = null;
    for (const codingSession of project.codingSessions) {
      codingSessionLocationsById.set(codingSession.id, {
        codingSession,
        project,
      });

      if (!latestCodingSession || isLaterCodingSession(codingSession, latestCodingSession)) {
        latestCodingSession = codingSession;
      }
    }

    latestCodingSessionIdByProjectId.set(project.id, latestCodingSession?.id ?? null);
  }

  return {
    codingSessionLocationsById,
    latestCodingSessionIdByProjectId,
    projectsById,
  };
}

export function resolveCodingSessionLocationInProjects(
  projects: readonly BirdCoderProject[],
  codingSessionId: string | null | undefined,
): BirdCoderResolvedCodingSessionLocation | null {
  const normalizedCodingSessionId = codingSessionId?.trim() ?? '';
  if (!normalizedCodingSessionId) {
    return null;
  }

  for (const project of projects) {
    const codingSession = project.codingSessions.find(
      (candidate) => candidate.id === normalizedCodingSessionId,
    );
    if (codingSession) {
      return {
        codingSession,
        project,
      };
    }
  }

  return null;
}

export function resolveProjectIdByCodingSessionId(
  projects: readonly BirdCoderProject[],
  codingSessionId: string | null | undefined,
): string {
  return resolveCodingSessionLocationInProjects(projects, codingSessionId)?.project.id ?? '';
}

export function resolveLatestCodingSessionIdForProject(
  projects: readonly BirdCoderProject[],
  projectId: string | null | undefined,
): string | null {
  const normalizedProjectId = projectId?.trim() ?? '';
  if (!normalizedProjectId) {
    return null;
  }

  const project = projects.find((candidate) => candidate.id === normalizedProjectId);
  if (!project || project.codingSessions.length === 0) {
    return null;
  }

  let latestCodingSession = project.codingSessions[0];
  for (let index = 1; index < project.codingSessions.length; index += 1) {
    const candidate = project.codingSessions[index];
    if (isLaterCodingSession(candidate, latestCodingSession)) {
      latestCodingSession = candidate;
    }
  }

  return latestCodingSession?.id ?? null;
}
