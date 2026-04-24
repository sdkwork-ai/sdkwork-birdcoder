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
  nextCodingSessionIdById: ReadonlyMap<string, string | null>;
  previousCodingSessionIdById: ReadonlyMap<string, string | null>;
  projectsById: ReadonlyMap<string, BirdCoderProject>;
}

const projectCodingSessionIndexCache = new WeakMap<
  readonly BirdCoderProject[],
  BirdCoderProjectCodingSessionIndex
>();

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
  const cachedIndex = projectCodingSessionIndexCache.get(projects);
  if (cachedIndex) {
    return cachedIndex;
  }

  const projectsById = new Map<string, BirdCoderProject>();
  const codingSessionLocationsById = new Map<string, BirdCoderResolvedCodingSessionLocation>();
  const latestCodingSessionIdByProjectId = new Map<string, string | null>();
  const previousCodingSessionIdById = new Map<string, string | null>();
  const nextCodingSessionIdById = new Map<string, string | null>();
  let previousTraversalCodingSessionId: string | null = null;

  for (const project of projects) {
    projectsById.set(project.id, project);

    let latestCodingSession: BirdCoderCodingSession | null = null;
    for (const codingSession of project.codingSessions) {
      previousCodingSessionIdById.set(codingSession.id, previousTraversalCodingSessionId);
      nextCodingSessionIdById.set(codingSession.id, null);
      if (previousTraversalCodingSessionId) {
        nextCodingSessionIdById.set(previousTraversalCodingSessionId, codingSession.id);
      }
      previousTraversalCodingSessionId = codingSession.id;
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

  const nextIndex = {
    codingSessionLocationsById,
    latestCodingSessionIdByProjectId,
    nextCodingSessionIdById,
    previousCodingSessionIdById,
    projectsById,
  };
  projectCodingSessionIndexCache.set(projects, nextIndex);
  return nextIndex;
}

export function resolveCodingSessionLocationInProjects(
  projects: readonly BirdCoderProject[],
  codingSessionId: string | null | undefined,
): BirdCoderResolvedCodingSessionLocation | null {
  const normalizedCodingSessionId = codingSessionId?.trim() ?? '';
  if (!normalizedCodingSessionId) {
    return null;
  }
  return (
    buildProjectCodingSessionIndex(projects).codingSessionLocationsById.get(
      normalizedCodingSessionId,
    ) ?? null
  );
}

export function resolveProjectIdByCodingSessionId(
  projects: readonly BirdCoderProject[],
  codingSessionId: string | null | undefined,
): string {
  const normalizedCodingSessionId = codingSessionId?.trim() ?? '';
  if (!normalizedCodingSessionId) {
    return '';
  }
  return (
    buildProjectCodingSessionIndex(projects).codingSessionLocationsById.get(
      normalizedCodingSessionId,
    )?.project.id ?? ''
  );
}

export function resolveLatestCodingSessionIdForProject(
  projects: readonly BirdCoderProject[],
  projectId: string | null | undefined,
): string | null {
  const normalizedProjectId = projectId?.trim() ?? '';
  if (!normalizedProjectId) {
    return null;
  }
  return (
    buildProjectCodingSessionIndex(projects).latestCodingSessionIdByProjectId.get(
      normalizedProjectId,
    ) ?? null
  );
}
