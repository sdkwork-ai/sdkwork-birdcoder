import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import {
  areBirdCoderChatMessagesEquivalent,
  buildBirdCoderSessionSynchronizationVersion,
  compareBirdCoderProjectsByActivity,
  compareBirdCoderSessionSortTimestamp,
  deduplicateBirdCoderComparableChatMessages,
  formatBirdCoderSessionActivityDisplayTime,
  resolveBirdCoderSessionSortTimestampString,
  stringifyBirdCoderApiJson,
} from '@sdkwork/birdcoder-types';

export interface ProjectsStoreSnapshot {
  error: string | null;
  hasFetched: boolean;
  isLoading: boolean;
  projects: BirdCoderProject[];
}

export interface ProjectsStoreRealtimeBinding {
  close(): void;
  reconnectAttempt: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  subscription: { close(): void } | null;
}

export interface ProjectsStore {
  inflight: Promise<BirdCoderProject[]> | null;
  listeners: Set<(snapshot: ProjectsStoreSnapshot) => void>;
  pendingRefreshTimer: ReturnType<typeof setTimeout> | null;
  realtime: ProjectsStoreRealtimeBinding | null;
  snapshot: ProjectsStoreSnapshot;
}

const projectStoresByScopeKey = new Map<string, ProjectsStore>();

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
    left.path === right.path &&
    left.sitePath === right.sitePath &&
    left.domainPrefix === right.domainPrefix &&
    left.ownerId === right.ownerId &&
    left.leaderId === right.leaderId &&
    left.createdByUserId === right.createdByUserId &&
    left.author === right.author &&
    left.fileId === right.fileId &&
    left.conversationId === right.conversationId &&
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

function areCodingSessionScalarsEqual(
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

function buildCodingSessionStoreVersion(
  codingSession: BirdCoderCodingSession,
  messageCount: number = codingSession.messages.length,
): string {
  return buildBirdCoderSessionSynchronizationVersion(codingSession, messageCount);
}

function areCodingSessionMessageCollectionsEquivalent(
  leftMessages: readonly BirdCoderChatMessage[],
  rightMessages: readonly BirdCoderChatMessage[],
): boolean {
  if (leftMessages === rightMessages) {
    return true;
  }

  if (leftMessages.length !== rightMessages.length) {
    return false;
  }

  return leftMessages.every((message, index) =>
    areBirdCoderChatMessagesEquivalent(message, rightMessages[index]!),
  );
}

function canReuseCodingSessionMessages(
  existingCodingSession: BirdCoderCodingSession,
  incomingCodingSession: BirdCoderCodingSession,
): boolean {
  const existingMessages = existingCodingSession.messages;
  const incomingMessages = incomingCodingSession.messages;

  if (incomingMessages.length === 0) {
    return existingMessages.length > 0;
  }

  if (existingMessages.length !== incomingMessages.length) {
    return false;
  }

  if (
    buildCodingSessionStoreVersion(existingCodingSession, existingMessages.length) !==
    buildCodingSessionStoreVersion(incomingCodingSession, incomingMessages.length)
  ) {
    return false;
  }

  return areCodingSessionMessageCollectionsEquivalent(existingMessages, incomingMessages);
}

function filterCodingSessionMessagesForStore(
  codingSessionId: string,
  messages: readonly BirdCoderChatMessage[],
): BirdCoderChatMessage[] {
  const normalizedCodingSessionId = codingSessionId.trim();
  if (!normalizedCodingSessionId || messages.length === 0) {
    return [];
  }

  const scopedMessages = messages.filter(
    (message) => message.codingSessionId.trim() === normalizedCodingSessionId,
  );
  return scopedMessages.length === messages.length
    ? (messages as BirdCoderChatMessage[])
    : scopedMessages;
}

function normalizeCodingSessionMessagesForStore(
  codingSessionId: string,
  messages: readonly BirdCoderChatMessage[],
): BirdCoderChatMessage[] {
  return deduplicateBirdCoderComparableChatMessages(
    filterCodingSessionMessagesForStore(codingSessionId, messages),
  );
}

interface CloneCodingSessionForStoreOptions {
  preserveEmptyMessages?: boolean;
}

function cloneCodingSessionForStore(
  codingSession: BirdCoderCodingSession,
  existingCodingSession?: BirdCoderCodingSession,
  options: CloneCodingSessionForStoreOptions = {},
): BirdCoderCodingSession {
  const preserveEmptyMessages = options.preserveEmptyMessages ?? true;
  const incomingMessages =
    codingSession.messages.length > 0
      ? normalizeCodingSessionMessagesForStore(
          codingSession.id,
          codingSession.messages,
        )
      : (codingSession.messages as BirdCoderChatMessage[]);
  const scopedCodingSession =
    incomingMessages === codingSession.messages
      ? codingSession
      : {
          ...codingSession,
          messages: incomingMessages,
        };
  const messages =
    codingSession.messages.length === 0
      ? preserveEmptyMessages
        ? normalizeCodingSessionMessagesForStore(
            codingSession.id,
            existingCodingSession?.messages ?? [],
          )
        : []
      : incomingMessages.length === 0
        ? []
        : existingCodingSession && canReuseCodingSessionMessages(existingCodingSession, scopedCodingSession)
        ? existingCodingSession.messages
        : incomingMessages;

  const nextCodingSession = {
    ...scopedCodingSession,
    messages,
  };

  return existingCodingSession &&
    areCodingSessionScalarsEqual(existingCodingSession, nextCodingSession) &&
    existingCodingSession.messages === nextCodingSession.messages
    ? existingCodingSession
    : nextCodingSession;
}

function compareCodingSessionsForStore(
  left: BirdCoderCodingSession,
  right: BirdCoderCodingSession,
): number {
  return (
    compareBirdCoderSessionSortTimestamp(right, left) ||
    left.id.localeCompare(right.id)
  );
}

function sortCodingSessionsForStore(
  codingSessions: readonly BirdCoderCodingSession[],
): BirdCoderCodingSession[] {
  if (codingSessions.length < 2) {
    return codingSessions as BirdCoderCodingSession[];
  }

  for (let index = 1; index < codingSessions.length; index += 1) {
    if (compareCodingSessionsForStore(codingSessions[index - 1], codingSessions[index]) > 0) {
      return [...codingSessions].sort(compareCodingSessionsForStore);
    }
  }

  return codingSessions as BirdCoderCodingSession[];
}

function compareProjectsForStore(
  left: BirdCoderProject,
  right: BirdCoderProject,
): number {
  return compareBirdCoderProjectsByActivity(left, right);
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

function reconcileProjectCodingSessionsForStore(
  incomingCodingSessions: readonly BirdCoderCodingSession[],
  existingCodingSessions: readonly BirdCoderCodingSession[],
): BirdCoderCodingSession[] {
  const existingCodingSessionsById = new Map(
    existingCodingSessions.map((codingSession) => [codingSession.id, codingSession]),
  );

  return sortCodingSessionsForStore(
    incomingCodingSessions.map((codingSession) =>
      cloneCodingSessionForStore(
        codingSession,
        existingCodingSessionsById.get(codingSession.id),
      ),
    ),
  );
}

function mergeProjectForStore(
  existingProject: BirdCoderProject | undefined,
  incomingProject: BirdCoderProject,
): BirdCoderProject {
  const incomingProjectCodingSessions =
    incomingProject.codingSessions.length === 0 &&
    (existingProject?.codingSessions.length ?? 0) > 0
      ? existingProject!.codingSessions
      : incomingProject.codingSessions;
  const nextCodingSessions = reconcileProjectCodingSessionsForStore(
    incomingProjectCodingSessions,
    existingProject?.codingSessions ?? [],
  );
  const nextProject = {
    ...incomingProject,
    codingSessions: nextCodingSessions,
  };

  return existingProject &&
    areProjectScalarsEqual(existingProject, nextProject) &&
    areCollectionsReferentiallyEqual(
      existingProject.codingSessions,
      nextProject.codingSessions,
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
  return reuseProjectCollectionIfUnchanged(
    existingProjects,
    sortProjectsForStore(
      incomingProjects.map((project) =>
        mergeProjectForStore(existingProjectsById.get(project.id), project),
      ),
    ),
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
              codingSessions: sortCodingSessionsForStore(project.codingSessions),
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

export function upsertCodingSessionIntoCollection(
  projects: readonly BirdCoderProject[],
  projectId: string,
  codingSession: BirdCoderCodingSession,
): BirdCoderProject[] {
  const nextTimestamp = new Date().toISOString();
  return reuseProjectCollectionIfUnchanged(
    projects,
    sortProjectsForStore(
      projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        const nextCodingSessions = sortCodingSessionsForStore([
          ...project.codingSessions.filter(
            (candidateCodingSession) => candidateCodingSession.id !== codingSession.id,
          ),
          cloneCodingSessionForStore(
            codingSession,
            project.codingSessions.find(
              (candidateCodingSession) => candidateCodingSession.id === codingSession.id,
            ),
            { preserveEmptyMessages: false },
          ),
        ]);

        return {
          ...project,
          codingSessions: nextCodingSessions,
          updatedAt: codingSession.updatedAt || nextTimestamp,
        };
      }),
    ),
  );
}

function finalizeCodingSessionForStore(
  codingSession: BirdCoderCodingSession,
): BirdCoderCodingSession {
  const messages = normalizeCodingSessionMessagesForStore(
    codingSession.id,
    codingSession.messages,
  );
  const sortTimestamp = resolveBirdCoderSessionSortTimestampString(codingSession);
  return {
    ...codingSession,
    messages,
    sortTimestamp,
    displayTime: formatBirdCoderSessionActivityDisplayTime({
      ...codingSession,
      sortTimestamp,
    }),
  };
}

export function updateCodingSessionInCollection(
  projects: readonly BirdCoderProject[],
  projectId: string,
  codingSessionId: string,
  updater: (codingSession: BirdCoderCodingSession) => BirdCoderCodingSession,
): BirdCoderProject[] {
  return reuseProjectCollectionIfUnchanged(
    projects,
    sortProjectsForStore(
      projects.map((project) => {
        if (project.id !== projectId) {
          return project;
        }

        const currentCodingSession = project.codingSessions.find(
          (candidateCodingSession) => candidateCodingSession.id === codingSessionId,
        );
        if (!currentCodingSession) {
          return project;
        }

        const nextCodingSession = finalizeCodingSessionForStore(
          updater(currentCodingSession),
        );
        const nextCodingSessions = sortCodingSessionsForStore([
          ...project.codingSessions.filter(
            (candidateCodingSession) => candidateCodingSession.id !== codingSessionId,
          ),
          nextCodingSession,
        ]);

        return {
          ...project,
          codingSessions: nextCodingSessions,
          updatedAt: nextCodingSession.updatedAt || project.updatedAt,
        };
      }),
    ),
  );
}

export function removeCodingSessionFromCollection(
  projects: readonly BirdCoderProject[],
  projectId: string,
  codingSessionId: string,
): BirdCoderProject[] {
  return reuseProjectCollectionIfUnchanged(
    projects,
    sortProjectsForStore(
      projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              codingSessions: project.codingSessions.filter(
                (codingSession) => codingSession.id !== codingSessionId,
              ),
            }
          : project,
      ),
    ),
  );
}

export function getProjectsStore(scopeKey: string): ProjectsStore {
  let store = projectStoresByScopeKey.get(scopeKey);
  if (!store) {
    store = {
      inflight: null,
      listeners: new Set(),
      pendingRefreshTimer: null,
      realtime: null,
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

    return {
      ...previousSnapshot,
      error: null,
      hasFetched: true,
      projects: reuseProjectCollectionIfUnchanged(previousSnapshot.projects, nextProjects),
    };
  });
}

export function upsertCodingSessionIntoProjectsStore(
  workspaceId: string,
  projectId: string,
  codingSession: BirdCoderCodingSession,
  userScope?: string,
): void {
  const normalizedWorkspaceId = workspaceId.trim();
  if (!normalizedWorkspaceId) {
    return;
  }

  mutateProjectsStore(
    normalizeProjectsStoreUserScope(userScope),
    normalizedWorkspaceId,
    (projects) => upsertCodingSessionIntoCollection(projects, projectId, codingSession),
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
