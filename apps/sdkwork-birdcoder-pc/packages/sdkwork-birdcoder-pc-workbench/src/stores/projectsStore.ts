import type {
  AgentSessionItemView,
  AgentSessionView,
  AgentProjectView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  areAgentSessionItemsEquivalent,
  buildAgentSessionViewSynchronizationVersion,
  compareWorkbenchProjectsByActivity,
  compareAgentSessionViewSortTimestamps,
  deduplicateAgentSessionItemViews,
  formatAgentSessionActivityDisplayTime,
  resolveAgentSessionViewSortTimestampString,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { AgentProjectViewPage } from '../services/interfaces/IProjectService.ts';

export interface ProjectsStoreSnapshot {
  error: string | null;
  hasFetched: boolean;
  isLoading: boolean;
  pageInfo: AgentProjectViewPage['pageInfo'] | null;
  projects: AgentProjectView[];
}

export interface ProjectsStore {
  inventoryVersion: number;
  inflight: Promise<AgentProjectView[]> | null;
  inflightKey: string | null;
  listeners: Set<(snapshot: ProjectsStoreSnapshot) => void>;
  snapshot: ProjectsStoreSnapshot;
}

const projectStoresByScopeKey = new Map<string, ProjectsStore>();

export function peekProjectsStore(scopeKey: string): ProjectsStore | null {
  return projectStoresByScopeKey.get(scopeKey) ?? null;
}

export function normalizeProjectsStoreUserScope(
  userId: string | null | undefined,
): string {
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
  return normalizedUserId || 'anonymous';
}

export function buildProjectsStoreScopeKey(
  userScope: string,
): string {
  return normalizeProjectsStoreUserScope(userScope);
}

export function createProjectsStoreSnapshot(): ProjectsStoreSnapshot {
  return {
    error: null,
    hasFetched: false,
    isLoading: false,
    pageInfo: null,
    projects: [],
  };
}

function areProjectScalarsEqual(
  left: AgentProjectView,
  right: AgentProjectView,
): boolean {
  return (
    left.projectId === right.projectId &&
    left.tenantId === right.tenantId &&
    left.organizationId === right.organizationId &&
    left.ownerUserId === right.ownerUserId &&
    left.name === right.name &&
    left.description === right.description &&
    left.visibility === right.visibility &&
    left.status === right.status &&
    left.driveAccessMode === right.driveAccessMode &&
    left.defaultAgentId === right.defaultAgentId &&
    left.defaultModelId === right.defaultModelId &&
    left.version === right.version &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    left.archivedAt === right.archivedAt
  );
}

function areAgentSessionScalarsEqual(
  left: AgentSessionView,
  right: AgentSessionView,
): boolean {
  return (
    left.id === right.id &&
    left.projectId === right.projectId &&
    left.runtimeLocationId === right.runtimeLocationId &&
    left.title === right.title &&
    left.status === right.status &&
    left.hostMode === right.hostMode &&
    left.engineId === right.engineId &&
    left.modelId === right.modelId &&
    left.nativeSessionId === right.nativeSessionId &&
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

export function areCollectionsReferentiallyEqual<TValue>(
  left: readonly TValue[],
  right: readonly TValue[],
): boolean {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => Object.is(value, right[index]));
}

function areProjectsStoreSnapshotsEqual(
  left: ProjectsStoreSnapshot,
  right: ProjectsStoreSnapshot,
): boolean {
  return (
    left.error === right.error &&
    left.hasFetched === right.hasFetched &&
    left.isLoading === right.isLoading &&
    left.pageInfo === right.pageInfo &&
    left.projects === right.projects
  );
}

export function reuseProjectCollectionIfUnchanged(
  previousProjects: readonly AgentProjectView[],
  nextProjects: readonly AgentProjectView[],
): AgentProjectView[] {
  return areCollectionsReferentiallyEqual(previousProjects, nextProjects)
    ? (previousProjects as AgentProjectView[])
    : [...nextProjects];
}

function buildAgentSessionStoreVersion(
  agentSession: AgentSessionView,
  itemCount: number = agentSession.items.length,
): string {
  return buildAgentSessionViewSynchronizationVersion(agentSession, itemCount);
}

function areAgentSessionItemCollectionsEquivalent(
  leftItems: readonly AgentSessionItemView[],
  rightItems: readonly AgentSessionItemView[],
): boolean {
  if (leftItems === rightItems) {
    return true;
  }

  if (leftItems.length !== rightItems.length) {
    return false;
  }

  return leftItems.every((item, index) =>
    areAgentSessionItemsEquivalent(item, rightItems[index]!),
  );
}

function canReuseAgentSessionItems(
  existingAgentSession: AgentSessionView,
  incomingAgentSession: AgentSessionView,
): boolean {
  const existingItems = existingAgentSession.items;
  const incomingItems = incomingAgentSession.items;

  if (incomingItems.length === 0) {
    return existingItems.length > 0;
  }

  if (existingItems.length !== incomingItems.length) {
    return false;
  }

  if (
    buildAgentSessionStoreVersion(existingAgentSession, existingItems.length) !==
    buildAgentSessionStoreVersion(incomingAgentSession, incomingItems.length)
  ) {
    return false;
  }

  return areAgentSessionItemCollectionsEquivalent(existingItems, incomingItems);
}

function filterAgentSessionItemsForStore(
  agentSessionId: string,
  items: readonly AgentSessionItemView[],
): AgentSessionItemView[] {
  const normalizedAgentSessionId = agentSessionId.trim();
  if (!normalizedAgentSessionId || items.length === 0) {
    return [];
  }

  let scopedItems: AgentSessionItemView[] | null = null;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    if (item.sessionId.trim() === normalizedAgentSessionId) {
      scopedItems?.push(item);
      continue;
    }

    if (!scopedItems) {
      scopedItems = items.slice(0, index) as AgentSessionItemView[];
    }
  }

  return scopedItems ?? (items as AgentSessionItemView[]);
}

function normalizeAgentSessionItemsForStore(
  agentSessionId: string,
  items: readonly AgentSessionItemView[],
): AgentSessionItemView[] {
  return deduplicateAgentSessionItemViews(
    filterAgentSessionItemsForStore(agentSessionId, items),
  );
}

interface CloneAgentSessionForStoreOptions {
  preserveEmptyItems?: boolean;
  projectId?: string;
}

function normalizeAgentSessionProjectScope(
  agentSession: AgentSessionView,
  projectId?: string,
): AgentSessionView {
  const normalizedProjectId = projectId?.trim() ?? '';
  if (normalizedProjectId && agentSession.projectId !== normalizedProjectId) {
    throw new Error(
      `Agent session ${agentSession.id} does not belong to Agents project ${normalizedProjectId}.`,
    );
  }
  return agentSession;
}

function cloneAgentSessionForStore(
  agentSession: AgentSessionView,
  existingAgentSession?: AgentSessionView,
  options: CloneAgentSessionForStoreOptions = {},
): AgentSessionView {
  const preserveEmptyItems = options.preserveEmptyItems ?? true;
  const projectScopedAgentSession = normalizeAgentSessionProjectScope(
    agentSession,
    options.projectId,
  );
  const incomingItems =
    projectScopedAgentSession.items.length > 0
      ? normalizeAgentSessionItemsForStore(
          projectScopedAgentSession.id,
          projectScopedAgentSession.items,
        )
      : (projectScopedAgentSession.items as AgentSessionItemView[]);
  const scopedAgentSession =
    incomingItems === projectScopedAgentSession.items
      ? projectScopedAgentSession
      : {
          ...projectScopedAgentSession,
          items: incomingItems,
        };
  const items =
    projectScopedAgentSession.items.length === 0
      ? preserveEmptyItems
        ? normalizeAgentSessionItemsForStore(
            projectScopedAgentSession.id,
            existingAgentSession?.items ?? [],
          )
        : []
      : incomingItems.length === 0
        ? []
        : existingAgentSession && canReuseAgentSessionItems(existingAgentSession, scopedAgentSession)
        ? existingAgentSession.items
        : incomingItems;

  const nextAgentSession = {
    ...scopedAgentSession,
    items,
  };

  return existingAgentSession &&
    areAgentSessionScalarsEqual(existingAgentSession, nextAgentSession) &&
    existingAgentSession.items === nextAgentSession.items
    ? existingAgentSession
    : nextAgentSession;
}

function compareAgentSessionsForStore(
  left: AgentSessionView,
  right: AgentSessionView,
): number {
  return (
    compareAgentSessionViewSortTimestamps(right, left) ||
    left.id.localeCompare(right.id)
  );
}

function sortAgentSessionsForStore(
  agentSessions: readonly AgentSessionView[],
): AgentSessionView[] {
  if (agentSessions.length < 2) {
    return agentSessions as AgentSessionView[];
  }

  for (let index = 1; index < agentSessions.length; index += 1) {
    if (compareAgentSessionsForStore(agentSessions[index - 1], agentSessions[index]) > 0) {
      return [...agentSessions].sort(compareAgentSessionsForStore);
    }
  }

  return agentSessions as AgentSessionView[];
}

function compareProjectsForStore(
  left: AgentProjectView,
  right: AgentProjectView,
): number {
  return compareWorkbenchProjectsByActivity(left, right);
}

function sortProjectsForStore(projects: readonly AgentProjectView[]): AgentProjectView[] {
  if (projects.length < 2) {
    return projects as AgentProjectView[];
  }

  for (let index = 1; index < projects.length; index += 1) {
    if (compareProjectsForStore(projects[index - 1], projects[index]) > 0) {
      return [...projects].sort(compareProjectsForStore);
    }
  }

  return projects as AgentProjectView[];
}

function reconcileProjectAgentSessionsForStore(
  projectId: string,
  incomingAgentSessions: readonly AgentSessionView[],
  existingAgentSessions: readonly AgentSessionView[],
): AgentSessionView[] {
  const existingAgentSessionsById = new Map(
    existingAgentSessions.map((agentSession) => [agentSession.id, agentSession]),
  );
  const nextAgentSessionsById = new Map<string, AgentSessionView>();

  incomingAgentSessions.forEach((agentSession) => {
    const mergedAgentSession = cloneAgentSessionForStore(
      agentSession,
      nextAgentSessionsById.get(agentSession.id) ??
        existingAgentSessionsById.get(agentSession.id),
      { projectId },
    );
    nextAgentSessionsById.set(agentSession.id, mergedAgentSession);
  });

  return sortAgentSessionsForStore(Array.from(nextAgentSessionsById.values()));
}

function mergeProjectForStore(
  existingProject: AgentProjectView | undefined,
  incomingProject: AgentProjectView,
): AgentProjectView {
  const incomingProjectAgentSessions =
    incomingProject.agentSessions.length === 0 &&
    (existingProject?.agentSessions.length ?? 0) > 0
      ? existingProject!.agentSessions
      : incomingProject.agentSessions;
  const nextAgentSessions = reconcileProjectAgentSessionsForStore(
    incomingProject.projectId,
    incomingProjectAgentSessions,
    existingProject?.agentSessions ?? [],
  );
  const nextProject = {
    ...incomingProject,
    agentSessions: nextAgentSessions,
  };

  return existingProject &&
    areProjectScalarsEqual(existingProject, nextProject) &&
    areCollectionsReferentiallyEqual(
      existingProject.agentSessions,
      nextProject.agentSessions,
    )
    ? existingProject
    : nextProject;
}

export function upsertProjectIntoCollection(
  projects: readonly AgentProjectView[],
  incomingProject: AgentProjectView,
): AgentProjectView[] {
  const existingProject = projects.find(
    (project) => project.projectId === incomingProject.projectId,
  );
  const mergedProject = mergeProjectForStore(existingProject, incomingProject);
  return reuseProjectCollectionIfUnchanged(
    projects,
    sortProjectsForStore([
      ...projects.filter((project) => project.projectId !== incomingProject.projectId),
      mergedProject,
    ]),
  );
}

export function mergeProjectsForStore(
  existingProjects: readonly AgentProjectView[],
  incomingProjects: readonly AgentProjectView[],
): AgentProjectView[] {
  const existingProjectsById = new Map(
    existingProjects.map((project) => [project.projectId, project]),
  );
  const nextProjectsById = new Map<string, AgentProjectView>();
  incomingProjects.forEach((project) => {
    const mergedProject = mergeProjectForStore(
      nextProjectsById.get(project.projectId) ?? existingProjectsById.get(project.projectId),
      project,
    );
    nextProjectsById.set(project.projectId, mergedProject);
  });
  return reuseProjectCollectionIfUnchanged(
    existingProjects,
    sortProjectsForStore(Array.from(nextProjectsById.values())),
  );
}

export function updateProjectInCollection(
  projects: readonly AgentProjectView[],
  projectId: string,
  updates: Partial<AgentProjectView>,
): AgentProjectView[] {
  const nextTimestamp = new Date().toISOString();
  return reuseProjectCollectionIfUnchanged(
    projects,
    sortProjectsForStore(
      projects.map((project) =>
        project.projectId === projectId
          ? {
              ...project,
              ...updates,
              agentSessions: sortAgentSessionsForStore(project.agentSessions),
              updatedAt: updates.updatedAt ?? nextTimestamp,
            }
          : project,
      ),
    ),
  );
}

export function removeProjectFromCollection(
  projects: readonly AgentProjectView[],
  projectId: string,
): AgentProjectView[] {
  return reuseProjectCollectionIfUnchanged(
    projects,
    sortProjectsForStore(projects.filter((project) => project.projectId !== projectId)),
  );
}

export function upsertAgentSessionIntoCollection(
  projects: readonly AgentProjectView[],
  projectId: string,
  agentSession: AgentSessionView,
): AgentProjectView[] {
  const projectIndex = projects.findIndex((project) => project.projectId === projectId);
  if (projectIndex < 0) {
    return projects as AgentProjectView[];
  }

  const nextTimestamp = new Date().toISOString();
  const project = projects[projectIndex]!;
  const existingAgentSessionIndex = project.agentSessions.findIndex(
    (candidateAgentSession) => candidateAgentSession.id === agentSession.id,
  );
  const existingAgentSession =
    existingAgentSessionIndex >= 0
      ? project.agentSessions[existingAgentSessionIndex]
      : undefined;
  const nextAgentSession = cloneAgentSessionForStore(
    agentSession,
    existingAgentSession,
    { preserveEmptyItems: false, projectId },
  );
  let unsortedAgentSessions: readonly AgentSessionView[];
  if (existingAgentSessionIndex >= 0) {
    if (project.agentSessions[existingAgentSessionIndex] === nextAgentSession) {
      unsortedAgentSessions = project.agentSessions;
    } else {
      const replacedAgentSessions = [...project.agentSessions];
      replacedAgentSessions[existingAgentSessionIndex] = nextAgentSession;
      unsortedAgentSessions = replacedAgentSessions;
    }
  } else {
    unsortedAgentSessions = [
      ...project.agentSessions,
      nextAgentSession,
    ];
  }
  const nextAgentSessions = sortAgentSessionsForStore(unsortedAgentSessions);
  const nextProject = {
    ...project,
    agentSessions: nextAgentSessions,
    updatedAt: agentSession.updatedAt || nextTimestamp,
  };
  const mergedProject =
    areProjectScalarsEqual(project, nextProject) &&
    project.agentSessions === nextProject.agentSessions
      ? project
      : nextProject;

  if (mergedProject === project) {
    return projects as AgentProjectView[];
  }

  const nextProjects = [...projects];
  nextProjects[projectIndex] = mergedProject;
  return reuseProjectCollectionIfUnchanged(
    projects,
    sortProjectsForStore(nextProjects),
  );
}

function finalizeAgentSessionForStore(
  agentSession: AgentSessionView,
): AgentSessionView {
  const items = normalizeAgentSessionItemsForStore(
    agentSession.id,
    agentSession.items,
  );
  const sortTimestamp = resolveAgentSessionViewSortTimestampString(agentSession);
  return {
    ...agentSession,
    items,
    sortTimestamp,
    displayTime: formatAgentSessionActivityDisplayTime({
      ...agentSession,
      sortTimestamp,
    }),
  };
}

export function updateAgentSessionInCollection(
  projects: readonly AgentProjectView[],
  projectId: string,
  agentSessionId: string,
  updater: (agentSession: AgentSessionView) => AgentSessionView,
): AgentProjectView[] {
  const projectIndex = projects.findIndex((project) => project.projectId === projectId);
  if (projectIndex < 0) {
    return projects as AgentProjectView[];
  }

  const project = projects[projectIndex]!;
  const currentAgentSessionIndex = project.agentSessions.findIndex(
    (candidateAgentSession) => candidateAgentSession.id === agentSessionId,
  );
  if (currentAgentSessionIndex < 0) {
    return projects as AgentProjectView[];
  }

  const currentAgentSession = project.agentSessions[currentAgentSessionIndex]!;
  const nextAgentSession = finalizeAgentSessionForStore(
    normalizeAgentSessionProjectScope(
      updater(normalizeAgentSessionProjectScope(currentAgentSession, projectId)),
      projectId,
    ),
  );
  let unsortedAgentSessions: readonly AgentSessionView[];
  if (project.agentSessions[currentAgentSessionIndex] === nextAgentSession) {
    unsortedAgentSessions = project.agentSessions;
  } else {
    const replacedAgentSessions = [...project.agentSessions];
    replacedAgentSessions[currentAgentSessionIndex] = nextAgentSession;
    unsortedAgentSessions = replacedAgentSessions;
  }
  const nextAgentSessions = sortAgentSessionsForStore(unsortedAgentSessions);
  const nextProject = {
    ...project,
    agentSessions: nextAgentSessions,
    updatedAt: nextAgentSession.updatedAt || project.updatedAt,
  };
  const mergedProject =
    areProjectScalarsEqual(project, nextProject) &&
    project.agentSessions === nextProject.agentSessions
      ? project
      : nextProject;

  if (mergedProject === project) {
    return projects as AgentProjectView[];
  }

  const nextProjects = [...projects];
  nextProjects[projectIndex] = mergedProject;
  return reuseProjectCollectionIfUnchanged(
    projects,
    sortProjectsForStore(nextProjects),
  );
}

export function removeAgentSessionFromCollection(
  projects: readonly AgentProjectView[],
  projectId: string,
  agentSessionId: string,
): AgentProjectView[] {
  const projectIndex = projects.findIndex((project) => project.projectId === projectId);
  if (projectIndex < 0) {
    return projects as AgentProjectView[];
  }

  const project = projects[projectIndex]!;
  const agentSessionIndex = project.agentSessions.findIndex(
    (agentSession) => agentSession.id === agentSessionId,
  );
  if (agentSessionIndex < 0) {
    return projects as AgentProjectView[];
  }

  const nextAgentSessions = [...project.agentSessions];
  nextAgentSessions.splice(agentSessionIndex, 1);
  const nextProjects = [...projects];
  nextProjects[projectIndex] = {
    ...project,
    agentSessions: nextAgentSessions,
  };

  return reuseProjectCollectionIfUnchanged(
    projects,
    sortProjectsForStore(nextProjects),
  );
}

export function getProjectsStore(scopeKey: string): ProjectsStore {
  let store = projectStoresByScopeKey.get(scopeKey);
  if (!store) {
    store = {
      inventoryVersion: 0,
      inflight: null,
      inflightKey: null,
      listeners: new Set(),
      snapshot: createProjectsStoreSnapshot(),
    };
    projectStoresByScopeKey.set(scopeKey, store);
  }

  return store;
}

function emitProjectsStoreSnapshot(store: ProjectsStore): void {
  const snapshot = store.snapshot;
  store.listeners.forEach((listener) => {
    listener(snapshot);
  });
}

export function updateProjectsStoreSnapshot(
  store: ProjectsStore,
  updater: (previousSnapshot: ProjectsStoreSnapshot) => ProjectsStoreSnapshot,
): void {
  const nextSnapshot = updater(store.snapshot);
  if (areProjectsStoreSnapshotsEqual(store.snapshot, nextSnapshot)) {
    return;
  }

  store.snapshot = nextSnapshot;
  emitProjectsStoreSnapshot(store);
}

export function mutateProjectsStore(
  userScope: string,
  updater: (projects: readonly AgentProjectView[]) => AgentProjectView[],
  options: { invalidatePagination?: boolean } = {},
): void {
  const store = getProjectsStore(buildProjectsStoreScopeKey(userScope));
  updateProjectsStoreSnapshot(store, (previousSnapshot) => {
    const nextProjects = updater(previousSnapshot.projects);
    if (
      previousSnapshot.error === null &&
      previousSnapshot.hasFetched &&
      areCollectionsReferentiallyEqual(previousSnapshot.projects, nextProjects)
    ) {
      return previousSnapshot;
    }

    if (options.invalidatePagination) {
      store.inventoryVersion += 1;
    }

    return {
      ...previousSnapshot,
      error: null,
      hasFetched: true,
      pageInfo: options.invalidatePagination ? null : previousSnapshot.pageInfo,
      projects: reuseProjectCollectionIfUnchanged(previousSnapshot.projects, nextProjects),
    };
  });
}

export function upsertAgentSessionIntoProjectsStore(
  projectId: string,
  agentSession: AgentSessionView,
  userScope?: string,
): void {
  if (!projectId.trim()) {
    return;
  }

  mutateProjectsStore(
    normalizeProjectsStoreUserScope(userScope),
    (projects) => upsertAgentSessionIntoCollection(projects, projectId, agentSession),
  );
}

export function upsertProjectIntoProjectsStore(
  project: AgentProjectView,
  userScope?: string,
): void {
  if (!project.projectId.trim()) {
    return;
  }

  mutateProjectsStore(
    normalizeProjectsStoreUserScope(userScope),
    (projects) => upsertProjectIntoCollection(projects, project),
  );
}

export function deleteProjectsStore(scopeKey: string): void {
  projectStoresByScopeKey.delete(scopeKey);
}
