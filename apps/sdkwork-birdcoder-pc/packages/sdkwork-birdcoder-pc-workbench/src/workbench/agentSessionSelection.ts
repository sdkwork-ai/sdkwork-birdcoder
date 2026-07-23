import {
  compareAgentSessionViewSortTimestamps,
  type AgentSessionView,
  type AgentProjectView,
} from '@sdkwork/birdcoder-pc-contracts-commons';

export interface AgentSessionLocation {
  agentSession: AgentSessionView;
  project: AgentProjectView;
}

export interface ScopedAgentSessionReference {
  agentSessionId: string;
  projectId: string;
}

export interface AgentProjectSessionIndex {
  agentSessionLocationsById: ReadonlyMap<string, AgentSessionLocation>;
  agentSessionLocationsByProjectIdAndId:
    ReadonlyMap<string, AgentSessionLocation>;
  latestAgentSessionIdByProjectId: ReadonlyMap<string, string | null>;
  nextAgentSessionIdById: ReadonlyMap<string, string | null>;
  nextAgentSessionReferenceByProjectIdAndId:
    ReadonlyMap<string, ScopedAgentSessionReference | null>;
  previousAgentSessionIdById: ReadonlyMap<string, string | null>;
  previousAgentSessionReferenceByProjectIdAndId:
    ReadonlyMap<string, ScopedAgentSessionReference | null>;
  projectsById: ReadonlyMap<string, AgentProjectView>;
}

const projectAgentSessionIndexCache = new WeakMap<
  readonly AgentProjectView[],
  AgentProjectSessionIndex
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
  project: AgentProjectView,
  agentSession: AgentSessionView,
): AgentSessionView {
  if (agentSession.projectId !== project.projectId) {
    throw new Error(
      `Agent session ${agentSession.id} does not belong to Agents project ${project.projectId}.`,
    );
  }
  return agentSession;
}

export function buildProjectAgentSessionIndex(
  projects: readonly AgentProjectView[],
): AgentProjectSessionIndex {
  const cachedIndex = projectAgentSessionIndexCache.get(projects);
  if (cachedIndex) {
    return cachedIndex;
  }

  const projectsById = new Map<string, AgentProjectView>();
  const agentSessionLocationsById = new Map<string, AgentSessionLocation>();
  const agentSessionLocationsByProjectIdAndId =
    new Map<string, AgentSessionLocation>();
  const latestAgentSessionIdByProjectId = new Map<string, string | null>();
  const previousAgentSessionIdById = new Map<string, string | null>();
  const nextAgentSessionIdById = new Map<string, string | null>();
  const previousAgentSessionReferenceByProjectIdAndId =
    new Map<string, ScopedAgentSessionReference | null>();
  const nextAgentSessionReferenceByProjectIdAndId =
    new Map<string, ScopedAgentSessionReference | null>();
  const ambiguousAgentSessionIds = new Set<string>();
  let previousTraversalAgentSessionReference: ScopedAgentSessionReference | null = null;

  for (const project of projects) {
    projectsById.set(project.projectId, project);

    let latestAgentSession: AgentSessionView | null = null;
    for (const agentSession of project.agentSessions) {
      const scopedAgentSession = normalizeAgentSessionLocationScope(project, agentSession);
      const scopedReference: ScopedAgentSessionReference = {
        agentSessionId: scopedAgentSession.id,
        projectId: project.projectId,
      };
      const scopedKey = buildAgentSessionProjectScopedKey(project.projectId, scopedAgentSession.id);
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

    latestAgentSessionIdByProjectId.set(project.projectId, latestAgentSession?.id ?? null);
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
  projects: readonly AgentProjectView[],
  projectId: string | null | undefined,
  agentSessionId: string | null | undefined,
): AgentSessionLocation | null {
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
  projects: readonly AgentProjectView[],
  agentSessionId: string | null | undefined,
): AgentSessionLocation | null {
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
  projects: readonly AgentProjectView[],
  agentSessionId: string | null | undefined,
): string {
  const normalizedAgentSessionId = agentSessionId?.trim() ?? '';
  if (!normalizedAgentSessionId) {
    return '';
  }
  return (
    buildProjectAgentSessionIndex(projects).agentSessionLocationsById.get(
      normalizedAgentSessionId,
    )?.project.projectId ?? ''
  );
}

export function resolveLatestAgentSessionIdForProject(
  projects: readonly AgentProjectView[],
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
