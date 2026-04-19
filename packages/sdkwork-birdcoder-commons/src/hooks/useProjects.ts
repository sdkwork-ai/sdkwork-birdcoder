import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderCodingSessionTurnIdeContext,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import {
  buildBirdCoderSessionSynchronizationVersion,
  formatBirdCoderSessionActivityDisplayTime,
  resolveBirdCoderSessionSortTimestamp,
} from '@sdkwork/birdcoder-types';
import {
  canSubscribeBirdCoderWorkspaceRealtime,
  subscribeBirdCoderWorkspaceRealtime,
  type BirdCoderWorkspaceRealtimeSubscription,
} from '@sdkwork/birdcoder-infrastructure';
import { useAuth } from '../context/AuthContext.ts';
import { useIDEServices } from '../context/IDEContext.ts';
import {
  applyWorkspaceRealtimeEventToProjects,
  isWorkspaceRealtimeEventSatisfiedByProjects,
} from '../workbench/workspaceRealtime.ts';
import type {
  CreateCodingSessionOptions,
  CreateProjectOptions,
} from '../services/interfaces/IProjectService.ts';

function fuzzyScore(pattern: string, value: string): number {
  if (!pattern) {
    return 1;
  }
  if (!value) {
    return 0;
  }

  let patternIndex = 0;
  let valueIndex = 0;
  let score = 0;

  while (patternIndex < pattern.length && valueIndex < value.length) {
    if (pattern[patternIndex].toLowerCase() === value[valueIndex].toLowerCase()) {
      score += 10;
      if (patternIndex === valueIndex) {
        score += 5;
      }
      patternIndex += 1;
    }
    valueIndex += 1;
  }

  return patternIndex === pattern.length ? score : 0;
}

type EditableCodingSessionMessage = Omit<
  BirdCoderChatMessage,
  'codingSessionId' | 'createdAt' | 'id'
>;

type BirdCoderSendMessageContext = BirdCoderCodingSessionTurnIdeContext;

interface ProjectsStoreSnapshot {
  error: string | null;
  hasFetched: boolean;
  isLoading: boolean;
  projects: BirdCoderProject[];
}

interface ProjectsStore {
  inflight: Promise<BirdCoderProject[]> | null;
  listeners: Set<(snapshot: ProjectsStoreSnapshot) => void>;
  pendingRefreshTimer: ReturnType<typeof setTimeout> | null;
  realtime: ProjectsStoreRealtimeBinding | null;
  snapshot: ProjectsStoreSnapshot;
}

interface ProjectsStoreRealtimeBinding {
  close(): void;
  reconnectAttempt: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  subscription: BirdCoderWorkspaceRealtimeSubscription | null;
}

const projectStoresByScopeKey = new Map<string, ProjectsStore>();
const WORKSPACE_REALTIME_EVENT_DEDUP_LIMIT = 256;
const EMPTY_PROJECT_INVENTORY_MESSAGES: BirdCoderChatMessage[] = [];

function normalizeProjectsStoreUserScope(userId: string | null | undefined): string {
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
  return normalizedUserId || 'anonymous';
}

function buildProjectsStoreScopeKey(userScope: string, workspaceId: string): string {
  return `${normalizeProjectsStoreUserScope(userScope)}::${workspaceId.trim()}`;
}

function createProjectsStoreSnapshot(): ProjectsStoreSnapshot {
  return {
    error: null,
    hasFetched: false,
    isLoading: false,
    projects: [],
  };
}

function areProjectScalarsEqual(left: BirdCoderProject, right: BirdCoderProject): boolean {
  return (
    left.id === right.id &&
    left.uuid === right.uuid &&
    left.tenantId === right.tenantId &&
    left.organizationId === right.organizationId &&
    left.workspaceId === right.workspaceId &&
    left.workspaceUuid === right.workspaceUuid &&
    left.code === right.code &&
    left.title === right.title &&
    left.name === right.name &&
    left.description === right.description &&
    left.path === right.path &&
    left.ownerId === right.ownerId &&
    left.leaderId === right.leaderId &&
    left.createdByUserId === right.createdByUserId &&
    left.author === right.author &&
    left.type === right.type &&
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

function areCollectionsReferentiallyEqual<TValue>(
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

function reuseProjectCollectionIfUnchanged(
  previousProjects: readonly BirdCoderProject[],
  nextProjects: readonly BirdCoderProject[],
): BirdCoderProject[] {
  return areCollectionsReferentiallyEqual(previousProjects, nextProjects)
    ? (previousProjects as BirdCoderProject[])
    : [...nextProjects];
}

function normalizeProjectsForInventoryStore(
  projects: readonly BirdCoderProject[],
): BirdCoderProject[] {
  return projects.map((project) => {
    let hasTranscriptPayload = false;
    const normalizedCodingSessions = project.codingSessions.map((codingSession) => {
      if (codingSession.messages.length === 0) {
        return codingSession;
      }

      hasTranscriptPayload = true;
      return {
        ...codingSession,
        messages: codingSession.messages.length > 0 ? EMPTY_PROJECT_INVENTORY_MESSAGES : codingSession.messages,
      };
    });

    return hasTranscriptPayload
      ? {
          ...project,
          codingSessions: normalizedCodingSessions,
        }
      : project;
  });
}

function appendCodingSessionMessageIfMissing(
  messages: readonly BirdCoderChatMessage[],
  incomingMessage: BirdCoderChatMessage,
): BirdCoderChatMessage[] {
  const hasSameMessage = messages.some(
    (message) =>
      message.id === incomingMessage.id ||
      (message.turnId === incomingMessage.turnId &&
        message.role === incomingMessage.role &&
        message.content === incomingMessage.content &&
        message.createdAt === incomingMessage.createdAt),
  );
  if (hasSameMessage) {
    return messages as BirdCoderChatMessage[];
  }

  return [...messages, structuredClone(incomingMessage)];
}

function buildCodingSessionStoreVersion(
  codingSession: BirdCoderCodingSession,
  messageCount: number = codingSession.messages.length,
): string {
  return buildBirdCoderSessionSynchronizationVersion(codingSession, messageCount);
}

function areChatMessageReuseBoundariesEqual(
  left: BirdCoderChatMessage,
  right: BirdCoderChatMessage,
): boolean {
  return (
    left.id === right.id &&
    left.codingSessionId === right.codingSessionId &&
    left.turnId === right.turnId &&
    left.role === right.role &&
    left.content === right.content &&
    left.createdAt === right.createdAt &&
    left.timestamp === right.timestamp &&
    left.name === right.name &&
    left.tool_call_id === right.tool_call_id
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

  return (
    areChatMessageReuseBoundariesEqual(existingMessages[0], incomingMessages[0]) &&
    areChatMessageReuseBoundariesEqual(
      existingMessages[existingMessages.length - 1],
      incomingMessages[incomingMessages.length - 1],
    )
  );
}

function cloneCodingSessionForStore(
  codingSession: BirdCoderCodingSession,
  existingCodingSession?: BirdCoderCodingSession,
): BirdCoderCodingSession {
  const messages =
    codingSession.messages.length === 0
      ? existingCodingSession?.messages ?? []
      : existingCodingSession && canReuseCodingSessionMessages(existingCodingSession, codingSession)
        ? existingCodingSession.messages
        : codingSession.messages as BirdCoderChatMessage[];

  const nextCodingSession = {
    ...codingSession,
    messages,
  };

  return existingCodingSession &&
    areCodingSessionScalarsEqual(existingCodingSession, nextCodingSession) &&
    existingCodingSession.messages === nextCodingSession.messages
    ? existingCodingSession
    : nextCodingSession;
}

function resolveTimestampValue(value: string | undefined): number {
  if (typeof value !== 'string') {
    return 0;
  }

  const parsedValue = Date.parse(value);
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
}

function compareCodingSessionsForStore(
  left: BirdCoderCodingSession,
  right: BirdCoderCodingSession,
): number {
  return (
    resolveBirdCoderSessionSortTimestamp(right) -
      resolveBirdCoderSessionSortTimestamp(left) ||
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

function compareProjectsForStore(left: BirdCoderProject, right: BirdCoderProject): number {
  return (
    resolveTimestampValue(right.updatedAt) - resolveTimestampValue(left.updatedAt) ||
    left.id.localeCompare(right.id)
  );
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
    incomingProject.codingSessions.length === 0 && (existingProject?.codingSessions.length ?? 0) > 0
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

function upsertProjectIntoCollection(
  projects: readonly BirdCoderProject[],
  incomingProject: BirdCoderProject,
): BirdCoderProject[] {
  const existingProject = projects.find((project) => project.id === incomingProject.id);
  const mergedProject = mergeProjectForStore(existingProject, incomingProject);
  return reuseProjectCollectionIfUnchanged(projects, sortProjectsForStore([
    ...projects.filter((project) => project.id !== incomingProject.id),
    mergedProject,
  ]));
}

function mergeProjectsForStore(
  existingProjects: readonly BirdCoderProject[],
  incomingProjects: readonly BirdCoderProject[],
): BirdCoderProject[] {
  const existingProjectsById = new Map(
    existingProjects.map((project) => [project.id, project]),
  );
  return reuseProjectCollectionIfUnchanged(existingProjects, sortProjectsForStore(
    incomingProjects.map((project) =>
      mergeProjectForStore(existingProjectsById.get(project.id), project),
    ),
  ));
}

function updateProjectInCollection(
  projects: readonly BirdCoderProject[],
  projectId: string,
  updates: Partial<BirdCoderProject>,
): BirdCoderProject[] {
  const nextTimestamp = new Date().toISOString();
  return reuseProjectCollectionIfUnchanged(projects, sortProjectsForStore(
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
  ));
}

function removeProjectFromCollection(
  projects: readonly BirdCoderProject[],
  projectId: string,
): BirdCoderProject[] {
  return reuseProjectCollectionIfUnchanged(
    projects,
    sortProjectsForStore(projects.filter((project) => project.id !== projectId)),
  );
}

function upsertCodingSessionIntoCollection(
  projects: readonly BirdCoderProject[],
  projectId: string,
  codingSession: BirdCoderCodingSession,
): BirdCoderProject[] {
  const nextTimestamp = new Date().toISOString();
  return reuseProjectCollectionIfUnchanged(projects, sortProjectsForStore(
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
        ),
      ]);

      return {
        ...project,
        codingSessions: nextCodingSessions,
        updatedAt: codingSession.updatedAt || nextTimestamp,
      };
    }),
  ));
}

function finalizeCodingSessionForStore(
  codingSession: BirdCoderCodingSession,
): BirdCoderCodingSession {
  const sortTimestamp = resolveBirdCoderSessionSortTimestamp(codingSession);
  return {
    ...codingSession,
    sortTimestamp,
    displayTime: formatBirdCoderSessionActivityDisplayTime({
      ...codingSession,
      sortTimestamp,
    }),
  };
}

function updateCodingSessionInCollection(
  projects: readonly BirdCoderProject[],
  projectId: string,
  codingSessionId: string,
  updater: (codingSession: BirdCoderCodingSession) => BirdCoderCodingSession,
): BirdCoderProject[] {
  return reuseProjectCollectionIfUnchanged(projects, sortProjectsForStore(
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
  ));
}

function removeCodingSessionFromCollection(
  projects: readonly BirdCoderProject[],
  projectId: string,
  codingSessionId: string,
): BirdCoderProject[] {
  return reuseProjectCollectionIfUnchanged(projects, sortProjectsForStore(
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
  ));
}

function getProjectsStore(scopeKey: string): ProjectsStore {
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

function updateProjectsStoreSnapshot(
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

function mutateProjectsStore(
  userScope: string,
  workspaceId: string,
  updater: (projects: readonly BirdCoderProject[]) => BirdCoderProject[],
): void {
  const normalizedWorkspaceId = workspaceId.trim();
  if (!normalizedWorkspaceId) {
    return;
  }

  const store = getProjectsStore(buildProjectsStoreScopeKey(userScope, normalizedWorkspaceId));
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

  mutateProjectsStore(normalizeProjectsStoreUserScope(userScope), normalizedWorkspaceId, (projects) =>
    upsertCodingSessionIntoCollection(projects, projectId, codingSession),
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

  mutateProjectsStore(normalizeProjectsStoreUserScope(userScope), normalizedWorkspaceId, (projects) =>
    upsertProjectIntoCollection(projects, project),
  );
}

function setProjectsStoreError(store: ProjectsStore, message: string): void {
  updateProjectsStoreSnapshot(store, (previousSnapshot) => ({
    ...previousSnapshot,
    error: message,
    hasFetched: true,
    isLoading: false,
  }));
}

function clearProjectsStorePendingRefresh(store: ProjectsStore): void {
  if (store.pendingRefreshTimer === null) {
    return;
  }

  clearTimeout(store.pendingRefreshTimer);
  store.pendingRefreshTimer = null;
}

async function fetchProjectsForWorkspace(
  store: ProjectsStore,
  workspaceId: string,
  projectService: ReturnType<typeof useIDEServices>['projectService'],
): Promise<BirdCoderProject[]> {
  if (store.inflight) {
    return store.inflight;
  }

  updateProjectsStoreSnapshot(store, (previousSnapshot) => ({
    ...previousSnapshot,
    error: null,
    isLoading: true,
  }));

  const request = projectService
    .getProjects(workspaceId)
    .then((projects) => {
      updateProjectsStoreSnapshot(store, (previousSnapshot) => ({
        error: null,
        hasFetched: true,
        isLoading: false,
        // Project inventory is authoritative from the database/server. Preserve
        // object identity for unchanged project records, but do not keep
        // projects that are absent from the latest authoritative result.
        projects: mergeProjectsForStore(
          previousSnapshot.projects,
          normalizeProjectsForInventoryStore(projects.filter(Boolean)),
        ),
      }));
      return projects;
    })
    .catch((error: unknown) => {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to fetch projects';
      setProjectsStoreError(store, message);
      throw error;
    })
    .finally(() => {
      if (store.inflight === request) {
        store.inflight = null;
      }
    });

  store.inflight = request;
  return request;
}

function scheduleProjectsRefresh(
  scopeKey: string,
  workspaceId: string,
  projectService: ReturnType<typeof useIDEServices>['projectService'],
  trigger: 'local-mutation' | 'realtime' = 'local-mutation',
): void {
  const normalizedWorkspaceId = workspaceId.trim();
  if (!normalizedWorkspaceId) {
    return;
  }

  const store = getProjectsStore(scopeKey);
  if (trigger === 'local-mutation' && store.realtime !== null) {
    return;
  }

  clearProjectsStorePendingRefresh(store);
  store.pendingRefreshTimer = setTimeout(() => {
    store.pendingRefreshTimer = null;
    void fetchProjectsForWorkspace(store, normalizedWorkspaceId, projectService).catch(() => {
      // Error state is already propagated through the shared store snapshot.
    });
  }, trigger === 'realtime' ? 120 : 0);
}

function createProjectsStoreRealtimeBinding(
  scopeKey: string,
  workspaceId: string,
  store: ProjectsStore,
  projectService: ReturnType<typeof useIDEServices>['projectService'],
): ProjectsStoreRealtimeBinding | null {
  if (!canSubscribeBirdCoderWorkspaceRealtime()) {
    return null;
  }

  const binding: ProjectsStoreRealtimeBinding = {
    close() {
      if (binding.reconnectTimer !== null) {
        clearTimeout(binding.reconnectTimer);
        binding.reconnectTimer = null;
      }
      binding.subscription?.close();
      binding.subscription = null;
      if (store.realtime === binding) {
        store.realtime = null;
      }
    },
    reconnectAttempt: 0,
    reconnectTimer: null,
    subscription: null,
  };
  const seenEventIds = new Set<string>();
  const eventIdQueue: string[] = [];

  const rememberEventId = (eventId: string): void => {
    if (seenEventIds.has(eventId)) {
      return;
    }

    seenEventIds.add(eventId);
    eventIdQueue.push(eventId);

    while (eventIdQueue.length > WORKSPACE_REALTIME_EVENT_DEDUP_LIMIT) {
      const evictedEventId = eventIdQueue.shift();
      if (evictedEventId) {
        seenEventIds.delete(evictedEventId);
      }
    }
  };

  const scheduleReconnect = () => {
    if (store.listeners.size === 0 || store.realtime !== binding) {
      binding.close();
      return;
    }

    if (binding.reconnectTimer !== null) {
      return;
    }

    binding.reconnectTimer = setTimeout(() => {
      binding.reconnectTimer = null;
      connect();
    }, Math.min(5_000, 400 * (binding.reconnectAttempt + 1)));
  };

  const connect = () => {
    if (store.realtime !== binding) {
      return;
    }

    const subscription = subscribeBirdCoderWorkspaceRealtime({
      onClose: () => {
        binding.subscription = null;
        binding.reconnectAttempt += 1;
        scheduleReconnect();
      },
      onError: () => {
        // Close events drive reconnects. Error payloads are informational only here.
      },
      onEvent: (event) => {
        const normalizedEventId = event.eventId.trim();
        if (normalizedEventId) {
          if (seenEventIds.has(normalizedEventId)) {
            return;
          }
          rememberEventId(normalizedEventId);
        }

        const nextProjects = applyWorkspaceRealtimeEventToProjects(
          store.snapshot.projects,
          event,
        );
        if (nextProjects !== null) {
          if (nextProjects !== store.snapshot.projects) {
            updateProjectsStoreSnapshot(store, (previousSnapshot) => ({
              ...previousSnapshot,
              error: null,
              hasFetched: true,
              projects: nextProjects,
            }));
          }
          return;
        }

        if (isWorkspaceRealtimeEventSatisfiedByProjects(store.snapshot.projects, event)) {
          return;
        }

        scheduleProjectsRefresh(scopeKey, workspaceId, projectService, 'realtime');
      },
      onOpen: () => {
        binding.reconnectAttempt = 0;
      },
      workspaceId,
    });

    if (!subscription) {
      binding.close();
      return;
    }

    binding.subscription = subscription;
  };

  connect();
  return binding;
}

function ensureProjectsStoreRealtime(
  scopeKey: string,
  workspaceId: string,
  projectService: ReturnType<typeof useIDEServices>['projectService'],
): void {
  const normalizedWorkspaceId = workspaceId.trim();
  if (!normalizedWorkspaceId) {
    return;
  }

  const store = getProjectsStore(scopeKey);
  if (store.realtime !== null) {
    return;
  }

  store.realtime = createProjectsStoreRealtimeBinding(
    scopeKey,
    normalizedWorkspaceId,
    store,
    projectService,
  );
}

function disposeProjectsStoreRealtimeIfUnused(scopeKey: string): void {
  const store = getProjectsStore(scopeKey);
  if (store.listeners.size > 0) {
    return;
  }

  clearProjectsStorePendingRefresh(store);
  store.realtime?.close();
  projectStoresByScopeKey.delete(scopeKey);
}

export interface UseProjectsOptions {
  enableRealtime?: boolean;
  fetchOnMount?: boolean;
}

export function useProjects(workspaceId?: string, options?: UseProjectsOptions) {
  const { projectService } = useIDEServices();
  const { user } = useAuth();
  const normalizedUserScope = normalizeProjectsStoreUserScope(user?.id);
  const normalizedWorkspaceId = workspaceId?.trim() ?? '';
  const shouldEnableRealtime = options?.enableRealtime ?? true;
  const shouldFetchOnMount = options?.fetchOnMount ?? true;
  const storeScopeKey = normalizedWorkspaceId
    ? buildProjectsStoreScopeKey(normalizedUserScope, normalizedWorkspaceId)
    : '';
  const [storeSnapshot, setStoreSnapshot] = useState<ProjectsStoreSnapshot>(() =>
    storeScopeKey
      ? getProjectsStore(storeScopeKey).snapshot
      : createProjectsStoreSnapshot(),
  );
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!normalizedWorkspaceId || !storeScopeKey) {
      setStoreSnapshot(createProjectsStoreSnapshot());
      return;
    }

    const store = getProjectsStore(storeScopeKey);
    setStoreSnapshot(store.snapshot);

    const handleStoreChange = (nextSnapshot: ProjectsStoreSnapshot) => {
      setStoreSnapshot(nextSnapshot);
    };

    const hadActiveListeners = store.listeners.size > 0;
    store.listeners.add(handleStoreChange);
    if (shouldEnableRealtime) {
      ensureProjectsStoreRealtime(storeScopeKey, normalizedWorkspaceId, projectService);
    }

    if (
      shouldFetchOnMount &&
      (!store.snapshot.hasFetched ||
        (!!store.snapshot.error && store.snapshot.projects.length === 0 && !hadActiveListeners)) &&
      !store.inflight
    ) {
      void fetchProjectsForWorkspace(store, normalizedWorkspaceId, projectService).catch(() => {
        // Error state is already propagated through the shared store snapshot.
      });
    }

    return () => {
      store.listeners.delete(handleStoreChange);
      disposeProjectsStoreRealtimeIfUnused(storeScopeKey);
    };
  }, [
    normalizedWorkspaceId,
    projectService,
    shouldEnableRealtime,
    shouldFetchOnMount,
    storeScopeKey,
  ]);

  const refreshProjects = useCallback(async () => {
    if (!normalizedWorkspaceId || !storeScopeKey) {
      const emptySnapshot = createProjectsStoreSnapshot();
      setStoreSnapshot(emptySnapshot);
      return emptySnapshot.projects;
    }

    const store = getProjectsStore(storeScopeKey);
    await projectService.invalidateProjectReadCache?.({
      workspaceId: normalizedWorkspaceId,
    });
    return fetchProjectsForWorkspace(store, normalizedWorkspaceId, projectService);
  }, [normalizedWorkspaceId, projectService, storeScopeKey]);

  const filteredProjects = useMemo(() => {
    const projects = storeSnapshot.projects;
    if (!searchQuery.trim()) {
      return projects;
    }

    const query = searchQuery.trim();

    return projects
      .map((project) => {
        const projectScore = fuzzyScore(query, project.name);
        const scoredCodingSessions = project.codingSessions
          .map((codingSession) => ({
            codingSession,
            score: fuzzyScore(query, codingSession.title),
          }))
          .filter((candidate) => candidate.score > 0)
          .sort((left, right) => right.score - left.score);
        const maxCodingSessionScore =
          scoredCodingSessions.length > 0 ? scoredCodingSessions[0].score : 0;
        const totalScore = Math.max(projectScore, maxCodingSessionScore);

        if (totalScore === 0) {
          return null;
        }

        return {
          project: {
            ...project,
            codingSessions: scoredCodingSessions.map((candidate) => candidate.codingSession),
          },
          score: totalScore,
        };
      })
      .filter(Boolean)
      .sort((left, right) => right!.score - left!.score)
      .map((candidate) => candidate!.project);
  }, [searchQuery, storeSnapshot.projects]);

  const createProject = async (name: string, options?: CreateProjectOptions) => {
    if (!normalizedWorkspaceId) {
      const message = 'Workspace ID is required to create a project';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
      throw new Error(message);
    }

    try {
      const newProject = await projectService.createProject(normalizedWorkspaceId, name, options);
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        upsertProjectIntoCollection(projects, newProject),
      );
      return newProject;
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to create project';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
      throw error;
    }
  };

  const createCodingSession = async (
    projectId: string,
    title: string,
    options?: CreateCodingSessionOptions,
  ) => {
    try {
      const codingSession = await projectService.createCodingSession(projectId, title, options);
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        upsertCodingSessionIntoCollection(projects, projectId, codingSession),
      );
      return codingSession;
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to create coding session';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
      throw error;
    }
  };

  const renameProject = async (projectId: string, name: string) => {
    try {
      await projectService.renameProject(projectId, name);
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        updateProjectInCollection(projects, projectId, { name }),
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to rename project';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
    }
  };

  const updateProject = async (projectId: string, updates: Partial<BirdCoderProject>) => {
    try {
      await projectService.updateProject(projectId, updates);
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        updateProjectInCollection(projects, projectId, updates),
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to update project';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      await projectService.deleteProject(projectId);
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        removeProjectFromCollection(projects, projectId),
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to delete project';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
    }
  };

  const renameCodingSession = async (
    projectId: string,
    codingSessionId: string,
    title: string,
  ) => {
    try {
      await projectService.renameCodingSession(projectId, codingSessionId, title);
      const updatedAt = new Date().toISOString();
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        updateCodingSessionInCollection(projects, projectId, codingSessionId, (codingSession) => ({
          ...codingSession,
          title,
            updatedAt,
        })),
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to rename coding session';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
    }
  };

  const updateCodingSession = async (
    projectId: string,
    codingSessionId: string,
    updates: Partial<BirdCoderCodingSession>,
  ) => {
    try {
      await projectService.updateCodingSession(projectId, codingSessionId, updates);
      const updatedAt = updates.updatedAt ?? new Date().toISOString();
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        updateCodingSessionInCollection(projects, projectId, codingSessionId, (codingSession) => ({
          ...codingSession,
          ...updates,
            updatedAt,
        })),
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to update coding session';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
    }
  };

  const forkCodingSession = async (
    projectId: string,
    codingSessionId: string,
    newTitle?: string,
  ) => {
    try {
      const codingSession = await projectService.forkCodingSession(
        projectId,
        codingSessionId,
        newTitle,
      );
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        upsertCodingSessionIntoCollection(projects, projectId, codingSession),
      );
      return codingSession;
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to fork coding session';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
      throw error;
    }
  };

  const deleteCodingSession = async (projectId: string, codingSessionId: string) => {
    try {
      await projectService.deleteCodingSession(projectId, codingSessionId);
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        removeCodingSessionFromCollection(projects, projectId, codingSessionId),
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to delete coding session';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
    }
  };

  const addCodingSessionMessage = async (
    projectId: string,
    codingSessionId: string,
    message: EditableCodingSessionMessage,
  ) => {
    try {
      const newMessage = await projectService.addCodingSessionMessage(
        projectId,
        codingSessionId,
        message,
      );
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        updateCodingSessionInCollection(projects, projectId, codingSessionId, (codingSession) => ({
          ...codingSession,
          messages: appendCodingSessionMessageIfMissing(
            codingSession.messages,
            newMessage,
          ),
          updatedAt: newMessage.createdAt,
          lastTurnAt: newMessage.createdAt,
          transcriptUpdatedAt: newMessage.createdAt,
        })),
      );
      return newMessage;
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to add message';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
      throw error;
    }
  };

  const editCodingSessionMessage = async (
    projectId: string,
    codingSessionId: string,
    messageId: string,
    updates: Partial<BirdCoderChatMessage>,
  ) => {
    try {
      await projectService.editCodingSessionMessage(
        projectId,
        codingSessionId,
        messageId,
        updates,
      );
      const updatedAt = new Date().toISOString();
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        updateCodingSessionInCollection(projects, projectId, codingSessionId, (codingSession) => ({
          ...codingSession,
          messages: codingSession.messages.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  ...structuredClone(updates),
                }
              : message,
          ),
          updatedAt,
          lastTurnAt: updatedAt,
          transcriptUpdatedAt: updatedAt,
        })),
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to edit message';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
      throw error;
    }
  };

  const deleteCodingSessionMessage = async (
    projectId: string,
    codingSessionId: string,
    messageId: string,
  ) => {
    try {
      await projectService.deleteCodingSessionMessage(projectId, codingSessionId, messageId);
      const updatedAt = new Date().toISOString();
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        updateCodingSessionInCollection(projects, projectId, codingSessionId, (codingSession) => ({
          ...codingSession,
          messages: codingSession.messages.filter((message) => message.id !== messageId),
          updatedAt,
          lastTurnAt: updatedAt,
          transcriptUpdatedAt: updatedAt,
        })),
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to delete message';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
      throw error;
    }
  };

  const sendMessage = async (
    projectId: string,
    codingSessionId: string,
    content: string,
    context?: BirdCoderSendMessageContext,
  ) => {
    try {
      const newMessage = await projectService.addCodingSessionMessage(projectId, codingSessionId, {
        role: 'user',
        content,
        metadata: context ? { ideContext: structuredClone(context) } : undefined,
      });
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        updateCodingSessionInCollection(projects, projectId, codingSessionId, (codingSession) => ({
          ...codingSession,
          messages: appendCodingSessionMessageIfMissing(
            codingSession.messages,
            newMessage,
          ),
          updatedAt: newMessage.createdAt,
          lastTurnAt: newMessage.createdAt,
          transcriptUpdatedAt: newMessage.createdAt,
        })),
      );
      return newMessage;
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to send message';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
      throw error;
    }
  };

  return {
    filteredProjects,
    hasFetched: storeSnapshot.hasFetched,
    projects: storeSnapshot.projects,
    isLoading: storeSnapshot.isLoading,
    error: storeSnapshot.error,
    searchQuery,
    setSearchQuery,
    createProject,
    createCodingSession,
    renameProject,
    updateProject,
    deleteProject,
    renameCodingSession,
    updateCodingSession,
    forkCodingSession,
    deleteCodingSession,
    addCodingSessionMessage,
    editCodingSessionMessage,
    deleteCodingSessionMessage,
    sendMessage,
    refreshProjects,
  };
}
