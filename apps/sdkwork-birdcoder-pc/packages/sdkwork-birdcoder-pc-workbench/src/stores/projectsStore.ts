import type {
  AgentSessionItemView,
  AgentSessionView,
  BirdCoderProject,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  areAgentSessionItemsEquivalent,
  buildAgentSessionViewSynchronizationVersion,
  compareWorkbenchProjectsByActivity,
  compareAgentSessionViewSortTimestamps,
  deduplicateAgentSessionItemViews,
  formatAgentSessionActivityDisplayTime,
  resolveAgentSessionViewSortTimestampString,
  stringifyBirdCoderApiJson,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { BirdCoderServiceOffsetPageInfo } from '../services/interfaces/IProjectService.ts';

export interface ProjectsStoreSnapshot {
  error: string | null;
  hasFetched: boolean;
  isLoading: boolean;
  pageInfo: BirdCoderServiceOffsetPageInfo | null;
  projects: BirdCoderProject[];
}

export interface ProjectsStore {
  inventoryVersion: number;
  inflight: Promise<BirdCoderProject[]> | null;
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
  workspaceId: string,
): string {
  return `${normalizeProjectsStoreUserScope(userScope)}::${workspaceId.trim()}`;
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
  left: BirdCoderProject,
  right: BirdCoderProject,
): boolean {
  return (
    left.id === right.id &&
    left.uuid === right.uuid &&
    left.tenantId === right.tenantId &&
    left.organizationId === right.organizationId &&
    left.defaultAgentProjectId === right.defaultAgentProjectId &&
    left.dataScope === right.dataScope &&
    left.workspaceId === right.workspaceId &&
    left.workspaceUuid === right.workspaceUuid &&
    left.userId === right.userId &&
    left.parentId === right.parentId &&
    left.parentUuid === right.parentUuid &&
    stringifyBirdCoderApiJson(left.parentMetadata ?? null) ===
      stringifyBirdCoderApiJson(right.parentMetadata ?? null) &&
    left.code === right.code &&
    left.title === right.title &&
    left.name === right.name &&
    left.description === right.description &&
    left.domainPrefix === right.domainPrefix &&
    left.ownerId === right.ownerId &&
    left.leaderId === right.leaderId &&
    left.createdByUserId === right.createdByUserId &&
    left.author === right.author &&
    left.fileId === right.fileId &&
    left.type === right.type &&
    stringifyBirdCoderApiJson(left.coverImage ?? null) ===
      stringifyBirdCoderApiJson(right.coverImage ?? null) &&
    left.startTime === right.startTime &&
    left.endTime === right.endTime &&
    left.budgetAmount === right.budgetAmount &&
    left.isTemplate === right.isTemplate &&
    left.viewerRole === right.viewerRole &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    left.archived === right.archived
  );
}

function areAgentSessionScalarsEqual(
  left: AgentSessionView,
  right: AgentSessionView,
): boolean {
  return (
    left.id === right.id &&
    left.workspaceId === right.workspaceId &&
    left.birdCoderProjectId === right.birdCoderProjectId &&
    left.agentProjectId === right.agentProjectId &&
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
  previousProjects: readonly BirdCoderProject[],
  nextProjects: readonly BirdCoderProject[],
): BirdCoderProject[] {
  return areCollectionsReferentiallyEqual(previousProjects, nextProjects)
    ? (previousProjects as BirdCoderProject[])
    : [...nextProjects];
}

function buildAgentSessionStoreVersion(
  agentSession: AgentSessionView,
  itemCount: number = agentSession.items.length,
): string {
  return buildAgentSessionViewSynchronizationVersion(agentSession, itemCount);
}

function areAgentSessionItemCollectionsEquivalent(
  leftMessages: readonly AgentSessionItemView[],
  rightMessages: readonly AgentSessionItemView[],
): boolean {
  if (leftMessages === rightMessages) {
    return true;
  }

  if (leftMessages.length !== rightMessages.length) {
    return false;
  }

  return leftMessages.every((message, index) =>
    areAgentSessionItemsEquivalent(message, rightMessages[index]!),
  );
}

function canReuseAgentSessionItems(
  existingAgentSession: AgentSessionView,
  incomingAgentSession: AgentSessionView,
): boolean {
  const existingMessages = existingAgentSession.items;
  const incomingMessages = incomingAgentSession.items;

  if (incomingMessages.length === 0) {
    return existingMessages.length > 0;
  }

  if (existingMessages.length !== incomingMessages.length) {
    return false;
  }

  if (
    buildAgentSessionStoreVersion(existingAgentSession, existingMessages.length) !==
    buildAgentSessionStoreVersion(incomingAgentSession, incomingMessages.length)
  ) {
    return false;
  }

  return areAgentSessionItemCollectionsEquivalent(existingMessages, incomingMessages);
}

function filterAgentSessionItemsForStore(
  agentSessionId: string,
  messages: readonly AgentSessionItemView[],
): AgentSessionItemView[] {
  const normalizedAgentSessionId = agentSessionId.trim();
  if (!normalizedAgentSessionId || messages.length === 0) {
    return [];
  }

  let scopedMessages: AgentSessionItemView[] | null = null;
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!;
    if (message.sessionId.trim() === normalizedAgentSessionId) {
      scopedMessages?.push(message);
      continue;
    }

    if (!scopedMessages) {
      scopedMessages = messages.slice(0, index) as AgentSessionItemView[];
    }
  }

  return scopedMessages ?? (messages as AgentSessionItemView[]);
}

function normalizeAgentSessionItemsForStore(
  agentSessionId: string,
  messages: readonly AgentSessionItemView[],
): AgentSessionItemView[] {
  return deduplicateAgentSessionItemViews(
    filterAgentSessionItemsForStore(agentSessionId, messages),
  );
}

interface CloneAgentSessionForStoreOptions {
  preserveEmptyMessages?: boolean;
  birdCoderProjectId?: string;
}

function normalizeAgentSessionProjectScope(
  agentSession: AgentSessionView,
  birdCoderProjectId?: string,
): AgentSessionView {
  const normalizedProjectId = birdCoderProjectId?.trim() ?? '';
  if (normalizedProjectId && agentSession.birdCoderProjectId !== normalizedProjectId) {
    throw new Error(
      `Agent session ${agentSession.id} does not belong to BirdCoder project ${normalizedProjectId}.`,
    );
  }
  return agentSession;
}

function cloneAgentSessionForStore(
  agentSession: AgentSessionView,
  existingAgentSession?: AgentSessionView,
  options: CloneAgentSessionForStoreOptions = {},
): AgentSessionView {
  const preserveEmptyMessages = options.preserveEmptyMessages ?? true;
  const projectScopedAgentSession = normalizeAgentSessionProjectScope(
    agentSession,
    options.birdCoderProjectId,
  );
  const incomingMessages =
    projectScopedAgentSession.items.length > 0
      ? normalizeAgentSessionItemsForStore(
          projectScopedAgentSession.id,
          projectScopedAgentSession.items,
        )
      : (projectScopedAgentSession.items as AgentSessionItemView[]);
  const scopedAgentSession =
    incomingMessages === projectScopedAgentSession.items
      ? projectScopedAgentSession
      : {
          ...projectScopedAgentSession,
          items: incomingMessages,
        };
  const messages =
    projectScopedAgentSession.items.length === 0
      ? preserveEmptyMessages
        ? normalizeAgentSessionItemsForStore(
            projectScopedAgentSession.id,
            existingAgentSession?.items ?? [],
          )
        : []
      : incomingMessages.length === 0
        ? []
        : existingAgentSession && canReuseAgentSessionItems(existingAgentSession, scopedAgentSession)
        ? existingAgentSession.items
        : incomingMessages;

  const nextAgentSession = {
    ...scopedAgentSession,
    items: messages,
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
  left: BirdCoderProject,
  right: BirdCoderProject,
): number {
  return compareWorkbenchProjectsByActivity(left, right);
}

function sortProjectsForStore(projects: readonly BirdCoderProject[]): BirdCoderProject[] {
  if (projects.length < 2) {
    return projects as BirdCoderProject[];
  }

  for (let index = 1; index < projects.length; index += 1) {
    if (compareProjectsForStore(projects[index - 1], projects[index]) > 0) {
      return [...projects].sort(compareProjectsForStore);
    }
  }

  return projects as BirdCoderProject[];
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
      { birdCoderProjectId: projectId },
    );
    nextAgentSessionsById.set(agentSession.id, mergedAgentSession);
  });

  return sortAgentSessionsForStore(Array.from(nextAgentSessionsById.values()));
}

function mergeProjectForStore(
  existingProject: BirdCoderProject | undefined,
  incomingProject: BirdCoderProject,
): BirdCoderProject {
  const incomingProjectAgentSessions =
    incomingProject.agentSessions.length === 0 &&
    (existingProject?.agentSessions.length ?? 0) > 0
      ? existingProject!.agentSessions
      : incomingProject.agentSessions;
  const nextAgentSessions = reconcileProjectAgentSessionsForStore(
    incomingProject.id,
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
  projects: readonly BirdCoderProject[],
  incomingProject: BirdCoderProject,
): BirdCoderProject[] {
  const existingProject = projects.find((project) => project.id === incomingProject.id);
  const mergedProject = mergeProjectForStore(existingProject, incomingProject);
  return reuseProjectCollectionIfUnchanged(
    projects,
    sortProjectsForStore([
      ...projects.filter((project) => project.id !== incomingProject.id),
      mergedProject,
    ]),
  );
}

export function mergeProjectsForStore(
  existingProjects: readonly BirdCoderProject[],
  incomingProjects: readonly BirdCoderProject[],
): BirdCoderProject[] {
  const existingProjectsById = new Map(
    existingProjects.map((project) => [project.id, project]),
  );
  const nextProjectsById = new Map<string, BirdCoderProject>();
  incomingProjects.forEach((project) => {
    const mergedProject = mergeProjectForStore(
      nextProjectsById.get(project.id) ?? existingProjectsById.get(project.id),
      project,
    );
    nextProjectsById.set(project.id, mergedProject);
  });
  return reuseProjectCollectionIfUnchanged(
    existingProjects,
    sortProjectsForStore(Array.from(nextProjectsById.values())),
  );
}

export function updateProjectInCollection(
  projects: readonly BirdCoderProject[],
  projectId: string,
  updates: Partial<BirdCoderProject>,
): BirdCoderProject[] {
  const nextTimestamp = new Date().toISOString();
  return reuseProjectCollectionIfUnchanged(
    projects,
    sortProjectsForStore(
      projects.map((project) =>
        project.id === projectId
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
  projects: readonly BirdCoderProject[],
  projectId: string,
): BirdCoderProject[] {
  return reuseProjectCollectionIfUnchanged(
    projects,
    sortProjectsForStore(projects.filter((project) => project.id !== projectId)),
  );
}

export function upsertAgentSessionIntoCollection(
  projects: readonly BirdCoderProject[],
  projectId: string,
  agentSession: AgentSessionView,
): BirdCoderProject[] {
  const projectIndex = projects.findIndex((project) => project.id === projectId);
  if (projectIndex < 0) {
    return projects as BirdCoderProject[];
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
    { preserveEmptyMessages: false, birdCoderProjectId: projectId },
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
    return projects as BirdCoderProject[];
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
  const messages = normalizeAgentSessionItemsForStore(
    agentSession.id,
    agentSession.items,
  );
  const sortTimestamp = resolveAgentSessionViewSortTimestampString(agentSession);
  return {
    ...agentSession,
    items: messages,
    sortTimestamp,
    displayTime: formatAgentSessionActivityDisplayTime({
      ...agentSession,
      sortTimestamp,
    }),
  };
}

export function updateAgentSessionInCollection(
  projects: readonly BirdCoderProject[],
  projectId: string,
  agentSessionId: string,
  updater: (agentSession: AgentSessionView) => AgentSessionView,
): BirdCoderProject[] {
  const projectIndex = projects.findIndex((project) => project.id === projectId);
  if (projectIndex < 0) {
    return projects as BirdCoderProject[];
  }

  const project = projects[projectIndex]!;
  const currentAgentSessionIndex = project.agentSessions.findIndex(
    (candidateAgentSession) => candidateAgentSession.id === agentSessionId,
  );
  if (currentAgentSessionIndex < 0) {
    return projects as BirdCoderProject[];
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
    return projects as BirdCoderProject[];
  }

  const nextProjects = [...projects];
  nextProjects[projectIndex] = mergedProject;
  return reuseProjectCollectionIfUnchanged(
    projects,
    sortProjectsForStore(nextProjects),
  );
}

export function removeAgentSessionFromCollection(
  projects: readonly BirdCoderProject[],
  projectId: string,
  agentSessionId: string,
): BirdCoderProject[] {
  const projectIndex = projects.findIndex((project) => project.id === projectId);
  if (projectIndex < 0) {
    return projects as BirdCoderProject[];
  }

  const project = projects[projectIndex]!;
  const agentSessionIndex = project.agentSessions.findIndex(
    (agentSession) => agentSession.id === agentSessionId,
  );
  if (agentSessionIndex < 0) {
    return projects as BirdCoderProject[];
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
  workspaceId: string,
  updater: (projects: readonly BirdCoderProject[]) => BirdCoderProject[],
  options: { invalidatePagination?: boolean } = {},
): void {
  const normalizedWorkspaceId = workspaceId.trim();
  if (!normalizedWorkspaceId) {
    return;
  }

  const store = getProjectsStore(
    buildProjectsStoreScopeKey(userScope, normalizedWorkspaceId),
  );
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
  workspaceId: string,
  projectId: string,
  agentSession: AgentSessionView,
  userScope?: string,
): void {
  const normalizedWorkspaceId = workspaceId.trim();
  if (!normalizedWorkspaceId) {
    return;
  }

  mutateProjectsStore(
    normalizeProjectsStoreUserScope(userScope),
    normalizedWorkspaceId,
    (projects) => upsertAgentSessionIntoCollection(projects, projectId, agentSession),
  );
}

export function upsertProjectIntoProjectsStore(
  workspaceId: string,
  project: BirdCoderProject,
  userScope?: string,
): void {
  const normalizedWorkspaceId = workspaceId.trim();
  if (!normalizedWorkspaceId) {
    return;
  }

  mutateProjectsStore(
    normalizeProjectsStoreUserScope(userScope),
    normalizedWorkspaceId,
    (projects) => upsertProjectIntoCollection(projects, project),
  );
}

export function deleteProjectsStore(scopeKey: string): void {
  projectStoresByScopeKey.delete(scopeKey);
}
