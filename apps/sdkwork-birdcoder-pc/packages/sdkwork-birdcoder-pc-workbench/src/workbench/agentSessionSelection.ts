import {
  compareAgentSessionViewSortTimestamps,
  type AgentSessionView,
  type BirdCoderProject,
} from '@sdkwork/birdcoder-pc-contracts-commons';

export interface BirdCoderResolvedAgentSessionLocation {
  agentSession: AgentSessionView;
  project: BirdCoderProject;
}

export interface BirdCoderScopedAgentSessionReference {
  agentSessionId: string;
  projectId: string;
}

export interface BirdCoderProjectAgentSessionIndex {
  agentSessionLocationsById: ReadonlyMap<string, BirdCoderResolvedAgentSessionLocation>;
  agentSessionLocationsByProjectIdAndId:
    ReadonlyMap<string, BirdCoderResolvedAgentSessionLocation>;
  latestAgentSessionIdByProjectId: ReadonlyMap<string, string | null>;
  nextAgentSessionIdById: ReadonlyMap<string, string | null>;
  nextAgentSessionReferenceByProjectIdAndId:
    ReadonlyMap<string, BirdCoderScopedAgentSessionReference | null>;
  previousAgentSessionIdById: ReadonlyMap<string, string | null>;
  previousAgentSessionReferenceByProjectIdAndId:
    ReadonlyMap<string, BirdCoderScopedAgentSessionReference | null>;
  projectsById: ReadonlyMap<string, BirdCoderProject>;
}

const projectAgentSessionIndexCache = new WeakMap<
  readonly BirdCoderProject[],
  BirdCoderProjectAgentSessionIndex
>();

function isLaterAgentSession(
  candidate: AgentSessionView,
  current: AgentSessionView,
): boolean {
  const sortOrder = compareAgentSessionViewSortTimestamps(candidate, current);
  return sortOrder > 0 || (sortOrder === 0 && candidate.id.localeCompare(current.id) < 0);
}

export function buildAgentSessionProjectScopedKey(
  projectId: string,
  agentSessionId: string,
): string {
  return `${projectId}\u0001${agentSessionId}`;
}

function normalizeAgentSessionLocationScope(
  project: BirdCoderProject,
  agentSession: AgentSessionView,
): AgentSessionView {
  if (
    agentSession.birdCoderProjectId !== project.id
    || agentSession.agentProjectId !== project.defaultAgentProjectId
  ) {
    throw new Error(
      `Agent session ${agentSession.id} does not belong to BirdCoder project ${project.id}.`,
    );
  }
  return agentSession;
}

export function buildProjectAgentSessionIndex(
  projects: readonly BirdCoderProject[],
): BirdCoderProjectAgentSessionIndex {
  const cachedIndex = projectAgentSessionIndexCache.get(projects);
  if (cachedIndex) {
    return cachedIndex;
  }

  const projectsById = new Map<string, BirdCoderProject>();
  const agentSessionLocationsById = new Map<string, BirdCoderResolvedAgentSessionLocation>();
  const agentSessionLocationsByProjectIdAndId =
    new Map<string, BirdCoderResolvedAgentSessionLocation>();
  const latestAgentSessionIdByProjectId = new Map<string, string | null>();
  const previousAgentSessionIdById = new Map<string, string | null>();
  const nextAgentSessionIdById = new Map<string, string | null>();
  const previousAgentSessionReferenceByProjectIdAndId =
    new Map<string, BirdCoderScopedAgentSessionReference | null>();
  const nextAgentSessionReferenceByProjectIdAndId =
    new Map<string, BirdCoderScopedAgentSessionReference | null>();
  const ambiguousAgentSessionIds = new Set<string>();
  let previousTraversalAgentSessionReference: BirdCoderScopedAgentSessionReference | null = null;

  for (const project of projects) {
    projectsById.set(project.id, project);

    let latestAgentSession: AgentSessionView | null = null;
    for (const agentSession of project.agentSessions) {
      const scopedAgentSession = normalizeAgentSessionLocationScope(project, agentSession);
      const scopedReference: BirdCoderScopedAgentSessionReference = {
        agentSessionId: scopedAgentSession.id,
        projectId: project.id,
      };
      const scopedKey = buildAgentSessionProjectScopedKey(project.id, scopedAgentSession.id);
      previousAgentSessionIdById.set(
        scopedAgentSession.id,
        previousTraversalAgentSessionReference?.agentSessionId ?? null,
      );
      previousAgentSessionReferenceByProjectIdAndId.set(
        scopedKey,
        previousTraversalAgentSessionReference,
      );
      nextAgentSessionIdById.set(scopedAgentSession.id, null);
      nextAgentSessionReferenceByProjectIdAndId.set(scopedKey, null);
      if (previousTraversalAgentSessionReference) {
        const previousTraversalKey = buildAgentSessionProjectScopedKey(
          previousTraversalAgentSessionReference.projectId,
          previousTraversalAgentSessionReference.agentSessionId,
        );
        nextAgentSessionIdById.set(
          previousTraversalAgentSessionReference.agentSessionId,
          scopedAgentSession.id,
        );
        nextAgentSessionReferenceByProjectIdAndId.set(
          previousTraversalKey,
          scopedReference,
        );
      }
      previousTraversalAgentSessionReference = scopedReference;
      if (agentSessionLocationsById.has(scopedAgentSession.id)) {
        ambiguousAgentSessionIds.add(scopedAgentSession.id);
        agentSessionLocationsById.delete(scopedAgentSession.id);
      } else if (!ambiguousAgentSessionIds.has(scopedAgentSession.id)) {
        agentSessionLocationsById.set(scopedAgentSession.id, {
          agentSession: scopedAgentSession,
          project,
        });
      }
      agentSessionLocationsByProjectIdAndId.set(scopedKey, {
        agentSession: scopedAgentSession,
        project,
      });

      if (!latestAgentSession || isLaterAgentSession(scopedAgentSession, latestAgentSession)) {
        latestAgentSession = scopedAgentSession;
      }
    }

    latestAgentSessionIdByProjectId.set(project.id, latestAgentSession?.id ?? null);
  }

  for (const ambiguousAgentSessionId of ambiguousAgentSessionIds) {
    previousAgentSessionIdById.delete(ambiguousAgentSessionId);
    nextAgentSessionIdById.delete(ambiguousAgentSessionId);
  }
  for (const [agentSessionId, previousAgentSessionId] of previousAgentSessionIdById) {
    if (previousAgentSessionId && ambiguousAgentSessionIds.has(previousAgentSessionId)) {
      previousAgentSessionIdById.set(agentSessionId, null);
    }
  }
  for (const [agentSessionId, nextAgentSessionId] of nextAgentSessionIdById) {
    if (nextAgentSessionId && ambiguousAgentSessionIds.has(nextAgentSessionId)) {
      nextAgentSessionIdById.set(agentSessionId, null);
    }
  }

  const nextIndex = {
    agentSessionLocationsById,
    agentSessionLocationsByProjectIdAndId,
    latestAgentSessionIdByProjectId,
    nextAgentSessionIdById,
    nextAgentSessionReferenceByProjectIdAndId,
    previousAgentSessionIdById,
    previousAgentSessionReferenceByProjectIdAndId,
    projectsById,
  };
  projectAgentSessionIndexCache.set(projects, nextIndex);
  return nextIndex;
}

export function resolveAgentSessionLocationInProject(
  projects: readonly BirdCoderProject[],
  projectId: string | null | undefined,
  agentSessionId: string | null | undefined,
): BirdCoderResolvedAgentSessionLocation | null {
  const normalizedProjectId = projectId?.trim() ?? '';
  const normalizedAgentSessionId = agentSessionId?.trim() ?? '';
  if (!normalizedProjectId || !normalizedAgentSessionId) {
    return null;
  }
  return (
    buildProjectAgentSessionIndex(projects).agentSessionLocationsByProjectIdAndId.get(
      buildAgentSessionProjectScopedKey(normalizedProjectId, normalizedAgentSessionId),
    ) ?? null
  );
}

export function resolveAgentSessionLocationInProjects(
  projects: readonly BirdCoderProject[],
  agentSessionId: string | null | undefined,
): BirdCoderResolvedAgentSessionLocation | null {
  const normalizedAgentSessionId = agentSessionId?.trim() ?? '';
  if (!normalizedAgentSessionId) {
    return null;
  }
  return (
    buildProjectAgentSessionIndex(projects).agentSessionLocationsById.get(
      normalizedAgentSessionId,
    ) ?? null
  );
}

export function resolveProjectIdByAgentSessionId(
  projects: readonly BirdCoderProject[],
  agentSessionId: string | null | undefined,
): string {
  const normalizedAgentSessionId = agentSessionId?.trim() ?? '';
  if (!normalizedAgentSessionId) {
    return '';
  }
  return (
    buildProjectAgentSessionIndex(projects).agentSessionLocationsById.get(
      normalizedAgentSessionId,
    )?.project.id ?? ''
  );
}

export function resolveLatestAgentSessionIdForProject(
  projects: readonly BirdCoderProject[],
  projectId: string | null | undefined,
): string | null {
  const normalizedProjectId = projectId?.trim() ?? '';
  if (!normalizedProjectId) {
    return null;
  }
  return (
    buildProjectAgentSessionIndex(projects).latestAgentSessionIdByProjectId.get(
      normalizedProjectId,
    ) ?? null
  );
}
