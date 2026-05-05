import {
  compareBirdCoderSessionSortTimestamp,
  type BirdCoderCodingSession,
  type BirdCoderProject,
} from '@sdkwork/birdcoder-types';

export interface BirdCoderResolvedCodingSessionLocation {
  codingSession: BirdCoderCodingSession;
  project: BirdCoderProject;
}

export interface BirdCoderScopedCodingSessionReference {
  codingSessionId: string;
  projectId: string;
}

export interface BirdCoderProjectCodingSessionIndex {
  codingSessionLocationsById: ReadonlyMap<string, BirdCoderResolvedCodingSessionLocation>;
  codingSessionLocationsByProjectIdAndId:
    ReadonlyMap<string, BirdCoderResolvedCodingSessionLocation>;
  latestCodingSessionIdByProjectId: ReadonlyMap<string, string | null>;
  nextCodingSessionIdById: ReadonlyMap<string, string | null>;
  nextCodingSessionReferenceByProjectIdAndId:
    ReadonlyMap<string, BirdCoderScopedCodingSessionReference | null>;
  previousCodingSessionIdById: ReadonlyMap<string, string | null>;
  previousCodingSessionReferenceByProjectIdAndId:
    ReadonlyMap<string, BirdCoderScopedCodingSessionReference | null>;
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
  const sortOrder = compareBirdCoderSessionSortTimestamp(candidate, current);
  return sortOrder > 0 || (sortOrder === 0 && candidate.id.localeCompare(current.id) < 0);
}

export function buildCodingSessionProjectScopedKey(
  projectId: string,
  codingSessionId: string,
): string {
  return `${projectId}\u0001${codingSessionId}`;
}

function normalizeCodingSessionLocationScope(
  project: BirdCoderProject,
  codingSession: BirdCoderCodingSession,
): BirdCoderCodingSession {
  return codingSession.projectId === project.id
    ? codingSession
    : {
        ...codingSession,
        projectId: project.id,
      };
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
  const codingSessionLocationsByProjectIdAndId =
    new Map<string, BirdCoderResolvedCodingSessionLocation>();
  const latestCodingSessionIdByProjectId = new Map<string, string | null>();
  const previousCodingSessionIdById = new Map<string, string | null>();
  const nextCodingSessionIdById = new Map<string, string | null>();
  const previousCodingSessionReferenceByProjectIdAndId =
    new Map<string, BirdCoderScopedCodingSessionReference | null>();
  const nextCodingSessionReferenceByProjectIdAndId =
    new Map<string, BirdCoderScopedCodingSessionReference | null>();
  const ambiguousCodingSessionIds = new Set<string>();
  let previousTraversalCodingSessionReference: BirdCoderScopedCodingSessionReference | null = null;

  for (const project of projects) {
    projectsById.set(project.id, project);

    let latestCodingSession: BirdCoderCodingSession | null = null;
    for (const codingSession of project.codingSessions) {
      const scopedCodingSession = normalizeCodingSessionLocationScope(project, codingSession);
      const scopedReference: BirdCoderScopedCodingSessionReference = {
        codingSessionId: scopedCodingSession.id,
        projectId: project.id,
      };
      const scopedKey = buildCodingSessionProjectScopedKey(project.id, scopedCodingSession.id);
      previousCodingSessionIdById.set(
        scopedCodingSession.id,
        previousTraversalCodingSessionReference?.codingSessionId ?? null,
      );
      previousCodingSessionReferenceByProjectIdAndId.set(
        scopedKey,
        previousTraversalCodingSessionReference,
      );
      nextCodingSessionIdById.set(scopedCodingSession.id, null);
      nextCodingSessionReferenceByProjectIdAndId.set(scopedKey, null);
      if (previousTraversalCodingSessionReference) {
        const previousTraversalKey = buildCodingSessionProjectScopedKey(
          previousTraversalCodingSessionReference.projectId,
          previousTraversalCodingSessionReference.codingSessionId,
        );
        nextCodingSessionIdById.set(
          previousTraversalCodingSessionReference.codingSessionId,
          scopedCodingSession.id,
        );
        nextCodingSessionReferenceByProjectIdAndId.set(
          previousTraversalKey,
          scopedReference,
        );
      }
      previousTraversalCodingSessionReference = scopedReference;
      if (codingSessionLocationsById.has(scopedCodingSession.id)) {
        ambiguousCodingSessionIds.add(scopedCodingSession.id);
        codingSessionLocationsById.delete(scopedCodingSession.id);
      } else if (!ambiguousCodingSessionIds.has(scopedCodingSession.id)) {
        codingSessionLocationsById.set(scopedCodingSession.id, {
          codingSession: scopedCodingSession,
          project,
        });
      }
      codingSessionLocationsByProjectIdAndId.set(scopedKey, {
        codingSession: scopedCodingSession,
        project,
      });

      if (!latestCodingSession || isLaterCodingSession(scopedCodingSession, latestCodingSession)) {
        latestCodingSession = scopedCodingSession;
      }
    }

    latestCodingSessionIdByProjectId.set(project.id, latestCodingSession?.id ?? null);
  }

  for (const ambiguousCodingSessionId of ambiguousCodingSessionIds) {
    previousCodingSessionIdById.delete(ambiguousCodingSessionId);
    nextCodingSessionIdById.delete(ambiguousCodingSessionId);
  }
  for (const [codingSessionId, previousCodingSessionId] of previousCodingSessionIdById) {
    if (previousCodingSessionId && ambiguousCodingSessionIds.has(previousCodingSessionId)) {
      previousCodingSessionIdById.set(codingSessionId, null);
    }
  }
  for (const [codingSessionId, nextCodingSessionId] of nextCodingSessionIdById) {
    if (nextCodingSessionId && ambiguousCodingSessionIds.has(nextCodingSessionId)) {
      nextCodingSessionIdById.set(codingSessionId, null);
    }
  }

  const nextIndex = {
    codingSessionLocationsById,
    codingSessionLocationsByProjectIdAndId,
    latestCodingSessionIdByProjectId,
    nextCodingSessionIdById,
    nextCodingSessionReferenceByProjectIdAndId,
    previousCodingSessionIdById,
    previousCodingSessionReferenceByProjectIdAndId,
    projectsById,
  };
  projectCodingSessionIndexCache.set(projects, nextIndex);
  return nextIndex;
}

export function resolveCodingSessionLocationInProject(
  projects: readonly BirdCoderProject[],
  projectId: string | null | undefined,
  codingSessionId: string | null | undefined,
): BirdCoderResolvedCodingSessionLocation | null {
  const normalizedProjectId = projectId?.trim() ?? '';
  const normalizedCodingSessionId = codingSessionId?.trim() ?? '';
  if (!normalizedProjectId || !normalizedCodingSessionId) {
    return null;
  }
  return (
    buildProjectCodingSessionIndex(projects).codingSessionLocationsByProjectIdAndId.get(
      buildCodingSessionProjectScopedKey(normalizedProjectId, normalizedCodingSessionId),
    ) ?? null
  );
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
