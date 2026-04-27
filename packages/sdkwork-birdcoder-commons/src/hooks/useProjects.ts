import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderCodingSessionTurnIdeContext,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import {
  areBirdCoderChatMessagesEquivalent,
  areBirdCoderChatMessagesLogicallyMatched,
  mergeBirdCoderComparableChatMessages,
} from '@sdkwork/birdcoder-types';
import {
  canSubscribeBirdCoderWorkspaceRealtime,
  subscribeBirdCoderWorkspaceRealtime,
} from '@sdkwork/birdcoder-infrastructure-runtime';
import { useAuth } from '../context/AuthContext.ts';
import { useIDEServices } from '../context/IDEContext.ts';
import {
  buildProjectsStoreScopeKey,
  createProjectsStoreSnapshot,
  deleteProjectsStore,
  getProjectsStore,
  mergeProjectsForStore,
  mutateProjectsStore,
  normalizeProjectsStoreUserScope,
  removeCodingSessionFromCollection,
  removeProjectFromCollection,
  type ProjectsStore,
  type ProjectsStoreRealtimeBinding,
  type ProjectsStoreSnapshot,
  updateCodingSessionInCollection,
  updateProjectInCollection,
  updateProjectsStoreSnapshot,
  upsertCodingSessionIntoCollection,
  upsertProjectIntoCollection,
  upsertProjectIntoProjectsStore,
} from '../stores/projectsStore.ts';
import {
  applyWorkspaceRealtimeEventToProjects,
  isWorkspaceRealtimeEventSatisfiedByProjects,
} from '../stores/workspaceRealtime.ts';
import type {
  BirdCoderProjectMirrorSnapshot,
  CreateCodingSessionOptions,
  CreateProjectOptions,
  UpdateCodingSessionOptions,
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
    if (pattern[patternIndex] === value[valueIndex]) {
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

interface ProjectSearchInventoryCodingSessionEntry {
  codingSession: BirdCoderCodingSession;
  normalizedTitle: string;
}

interface ProjectSearchInventoryEntry {
  codingSessions: ProjectSearchInventoryCodingSessionEntry[];
  normalizedName: string;
  project: BirdCoderProject;
}

interface ScoredCodingSessionCandidate {
  codingSession: BirdCoderCodingSession;
  score: number;
}

interface ScoredProjectCandidate {
  project: BirdCoderProject;
  score: number;
}

type BirdCoderSendMessageContext = BirdCoderCodingSessionTurnIdeContext;
const WORKSPACE_REALTIME_EVENT_DEDUP_LIMIT = 256;
const EMPTY_PROJECT_INVENTORY_MESSAGES: BirdCoderChatMessage[] = [];
const EMPTY_FILTERED_PROJECT_CODING_SESSIONS: BirdCoderCodingSession[] = [];

function sanitizeCodingSessionMessageUpdates(
  updates: Partial<BirdCoderChatMessage>,
): Partial<BirdCoderChatMessage> {
  const {
    codingSessionId: _codingSessionId,
    createdAt: _createdAt,
    id: _id,
    role: _role,
    turnId: _turnId,
    ...editableUpdates
  } = updates;
  void _codingSessionId;
  void _createdAt;
  void _id;
  void _role;
  void _turnId;
  return editableUpdates;
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

function buildProjectSearchInventory(
  projects: readonly BirdCoderProject[],
): ProjectSearchInventoryEntry[] {
  return projects.map((project) => ({
    project,
    normalizedName: normalizeSearchValue(project.name),
    codingSessions: project.codingSessions.map((codingSession) => ({
      codingSession,
      normalizedTitle: normalizeSearchValue(codingSession.title),
    })),
  }));
}

function areCodingSessionListsIdentical(
  left: readonly BirdCoderCodingSession[],
  right: readonly BirdCoderCodingSession[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((codingSession, index) => codingSession === right[index]);
}

function compareScoredCodingSessions(
  left: ScoredCodingSessionCandidate,
  right: ScoredCodingSessionCandidate,
): number {
  return right.score - left.score;
}

function compareScoredProjects(
  left: ScoredProjectCandidate,
  right: ScoredProjectCandidate,
): number {
  return right.score - left.score;
}

function searchProjectsInventory(
  projectSearchInventory: readonly ProjectSearchInventoryEntry[],
  normalizedSearchQuery: string,
): BirdCoderProject[] {
  if (!normalizedSearchQuery) {
    return projectSearchInventory.map((entry) => entry.project);
  }

  const scoredProjects: ScoredProjectCandidate[] = [];

  for (const projectEntry of projectSearchInventory) {
    const projectScore = fuzzyScore(normalizedSearchQuery, projectEntry.normalizedName);
    let maxCodingSessionScore = 0;
    let scoredCodingSessions: ScoredCodingSessionCandidate[] | null = null;

    for (const codingSessionEntry of projectEntry.codingSessions) {
      const score = fuzzyScore(normalizedSearchQuery, codingSessionEntry.normalizedTitle);
      if (score <= 0) {
        continue;
      }

      maxCodingSessionScore = Math.max(maxCodingSessionScore, score);
      if (scoredCodingSessions === null) {
        scoredCodingSessions = [
          {
            codingSession: codingSessionEntry.codingSession,
            score,
          },
        ];
        continue;
      }

      scoredCodingSessions.push({
        codingSession: codingSessionEntry.codingSession,
        score,
      });
    }

    const totalScore = Math.max(projectScore, maxCodingSessionScore);
    if (totalScore <= 0) {
      continue;
    }

    let matchedProject = projectEntry.project;

    if (scoredCodingSessions && scoredCodingSessions.length > 0) {
      if (scoredCodingSessions.length > 1) {
        scoredCodingSessions.sort(compareScoredCodingSessions);
      }

      const filteredCodingSessions = scoredCodingSessions.map(
        (candidate) => candidate.codingSession,
      );
      if (!areCodingSessionListsIdentical(projectEntry.project.codingSessions, filteredCodingSessions)) {
        matchedProject = {
          ...projectEntry.project,
          codingSessions: filteredCodingSessions,
        };
      }
    } else if (projectScore > 0) {
      matchedProject = {
        ...projectEntry.project,
        codingSessions: EMPTY_FILTERED_PROJECT_CODING_SESSIONS,
      };
    }

    scoredProjects.push({
      project: matchedProject,
      score: totalScore,
    });
  }

  if (scoredProjects.length > 1) {
    scoredProjects.sort(compareScoredProjects);
  }

  return scoredProjects.map((candidate) => candidate.project);
}

function materializeProjectInventoryFromMirrorSnapshot(
  projectSnapshot: BirdCoderProjectMirrorSnapshot,
): BirdCoderProject {
  const { codingSessions, ...project } = projectSnapshot;
  return {
    ...project,
    codingSessions: codingSessions.map((codingSessionSnapshot) => {
      const {
        messageCount: _messageCount,
        nativeTranscriptUpdatedAt: _nativeTranscriptUpdatedAt,
        ...codingSession
      } = codingSessionSnapshot;
      return {
        ...codingSession,
        messages: EMPTY_PROJECT_INVENTORY_MESSAGES,
      };
    }),
  };
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
  const matchingMessageIndex = messages.findIndex((message) =>
    areBirdCoderChatMessagesEquivalent(message, incomingMessage) ||
    areBirdCoderChatMessagesLogicallyMatched(message, incomingMessage),
  );
  if (matchingMessageIndex < 0) {
    return [...messages, incomingMessage];
  }

  const existingMessage = messages[matchingMessageIndex]!;
  const mergedMessage = mergeBirdCoderComparableChatMessages(existingMessage, incomingMessage);
  if (mergedMessage === existingMessage) {
    return messages as BirdCoderChatMessage[];
  }

  return messages.map((message, index) =>
    index === matchingMessageIndex ? mergedMessage : message,
  );
}

function reconcileCodingSessionMessage(
  messages: readonly BirdCoderChatMessage[],
  optimisticMessageId: string,
  resolvedMessage: BirdCoderChatMessage,
): BirdCoderChatMessage[] {
  const optimisticMessageIndex = messages.findIndex(
    (message) => message.id === optimisticMessageId,
  );
  const messagesWithoutOptimistic = messages.filter(
    (message) => message.id !== optimisticMessageId,
  );
  const matchingResolvedMessageIndex = messagesWithoutOptimistic.findIndex((message) =>
    areBirdCoderChatMessagesEquivalent(message, resolvedMessage) ||
    areBirdCoderChatMessagesLogicallyMatched(message, resolvedMessage),
  );
  if (matchingResolvedMessageIndex >= 0) {
    const existingMessage = messagesWithoutOptimistic[matchingResolvedMessageIndex]!;
    const mergedMessage = mergeBirdCoderComparableChatMessages(existingMessage, resolvedMessage);
    if (mergedMessage === existingMessage) {
      return messagesWithoutOptimistic as BirdCoderChatMessage[];
    }

    return messagesWithoutOptimistic.map((message, index) =>
      index === matchingResolvedMessageIndex ? mergedMessage : message,
    );
  }

  if (
    optimisticMessageIndex < 0 ||
    optimisticMessageIndex >= messagesWithoutOptimistic.length
  ) {
    return [...messagesWithoutOptimistic, resolvedMessage];
  }

  return [
    ...messagesWithoutOptimistic.slice(0, optimisticMessageIndex),
    resolvedMessage,
    ...messagesWithoutOptimistic.slice(optimisticMessageIndex),
  ];
}

function buildOptimisticCodingSessionMessage(
  codingSessionId: string,
  content: string,
  context?: BirdCoderSendMessageContext,
): BirdCoderChatMessage {
  const createdAt = new Date().toISOString();
  const randomToken = Math.random().toString(36).slice(2, 10);
  return {
    id: `${codingSessionId}:optimistic:${createdAt}:${randomToken}`,
    codingSessionId,
    role: 'user',
    content,
    metadata: context ? { ideContext: structuredClone(context) } : undefined,
    createdAt,
    timestamp: Date.parse(createdAt),
  };
}

function removeCodingSessionMessageById(
  messages: readonly BirdCoderChatMessage[],
  messageId: string,
): BirdCoderChatMessage[] {
  const hasSameMessage = messages.some((message) => message.id === messageId);
  if (!hasSameMessage) {
    return messages as BirdCoderChatMessage[];
  }

  return messages.filter((message) => message.id !== messageId);
}

function findCodingSessionInCollection(
  projects: readonly BirdCoderProject[],
  projectId: string,
  codingSessionId: string,
): BirdCoderCodingSession | null {
  const project = projects.find((candidateProject) => candidateProject.id === projectId);
  if (!project) {
    return null;
  }

  return (
    project.codingSessions.find(
      (candidateCodingSession) => candidateCodingSession.id === codingSessionId,
    ) ?? null
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

async function readProjectInventoryForWorkspace(
  workspaceId: string,
  projectService: ReturnType<typeof useIDEServices>['projectService'],
): Promise<BirdCoderProject[]> {
  const projectMirrorReader = projectService.getProjectMirrorSnapshots?.bind(projectService);
  if (projectMirrorReader) {
    const projectSnapshots = await projectMirrorReader(workspaceId);
    if (Array.isArray(projectSnapshots)) {
      return projectSnapshots.map(materializeProjectInventoryFromMirrorSnapshot);
    }
  }

  return projectService.getProjects(workspaceId);
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

  const request = readProjectInventoryForWorkspace(workspaceId, projectService)
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
  deleteProjectsStore(scopeKey);
}

export interface UseProjectsOptions {
  enableRealtime?: boolean;
  fetchOnMount?: boolean;
  isActive?: boolean;
}

export function useProjects(workspaceId?: string, options?: UseProjectsOptions) {
  const { projectService } = useIDEServices();
  const { user } = useAuth();
  const normalizedUserScope = normalizeProjectsStoreUserScope(user?.id);
  const normalizedWorkspaceId = workspaceId?.trim() ?? '';
  const shouldEnableRealtime = options?.enableRealtime ?? true;
  const shouldFetchOnMount = options?.fetchOnMount ?? true;
  const isActive = options?.isActive ?? true;
  const storeScopeKey = normalizedWorkspaceId
    ? buildProjectsStoreScopeKey(normalizedUserScope, normalizedWorkspaceId)
    : '';
  const [storeSnapshot, setStoreSnapshot] = useState<ProjectsStoreSnapshot>(() =>
    storeScopeKey
      ? getProjectsStore(storeScopeKey).snapshot
      : createProjectsStoreSnapshot(),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    if (!normalizedWorkspaceId || !storeScopeKey) {
      setStoreSnapshot(createProjectsStoreSnapshot());
      return;
    }

    const store = getProjectsStore(storeScopeKey);
    setStoreSnapshot(store.snapshot);

    if (!isActive) {
      return;
    }

    const handleStoreChange = (nextSnapshot: ProjectsStoreSnapshot) => {
      startTransition(() => {
        setStoreSnapshot(nextSnapshot);
      });
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
    isActive,
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

  const projectSearchInventory = useMemo(() => buildProjectSearchInventory(storeSnapshot.projects), [storeSnapshot.projects]);
  const normalizedSearchQuery = useMemo(
    () => normalizeSearchValue(deferredSearchQuery),
    [deferredSearchQuery],
  );

  const filteredProjects = useMemo(() => {
    if (!normalizedSearchQuery) {
      return storeSnapshot.projects;
    }

    return searchProjectsInventory(projectSearchInventory, normalizedSearchQuery);
  }, [normalizedSearchQuery, projectSearchInventory, storeSnapshot.projects]);

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
    options: CreateCodingSessionOptions,
  ) => {
    try {
      const codingSession = await projectService.createCodingSession(projectId, title, {
        ...options,
        ...(normalizedWorkspaceId ? { workspaceId: normalizedWorkspaceId } : {}),
      });
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        upsertCodingSessionIntoCollection(projects, projectId, codingSession),
      );
      void resolveSynchronizedProjectSession(projectId, codingSession.id)
        .then((synchronizedProjectSession) => {
          if (synchronizedProjectSession?.project) {
            upsertProjectIntoProjectsStore(
              synchronizedProjectSession.project.workspaceId,
              synchronizedProjectSession.project,
              normalizedUserScope,
            );
          }
        });
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
    updates: UpdateCodingSessionOptions,
  ) => {
    try {
      await projectService.updateCodingSession(projectId, codingSessionId, updates);
      const updatedAt = new Date().toISOString();
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
      const synchronizedProjectSession = await resolveSynchronizedProjectSession(
        projectId,
        codingSession.id,
      );
      if (synchronizedProjectSession?.project) {
        upsertProjectIntoProjectsStore(
          synchronizedProjectSession.project.workspaceId,
          synchronizedProjectSession.project,
          normalizedUserScope,
        );
      } else {
        mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
          upsertCodingSessionIntoCollection(projects, projectId, codingSession),
        );
      }
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

  const resolveSynchronizedProjectSession = async (
    projectId: string,
    codingSessionId: string,
  ): Promise<{ codingSession: BirdCoderCodingSession | null; project: BirdCoderProject } | null> => {
    try {
      const refreshedProject = await projectService.getProjectById(projectId);
      if (!refreshedProject) {
        return null;
      }

      return {
        codingSession:
          refreshedProject.codingSessions.find(
            (candidateCodingSession) => candidateCodingSession.id === codingSessionId,
          ) ?? null,
        project: refreshedProject,
      };
    } catch (error) {
      console.error('Failed to rehydrate coding session after message mutation', error);
      return null;
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
      const editableUpdates = sanitizeCodingSessionMessageUpdates(updates);
      await projectService.editCodingSessionMessage(
        projectId,
        codingSessionId,
        messageId,
        editableUpdates,
      );
      const updatedAt = new Date().toISOString();
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        updateCodingSessionInCollection(projects, projectId, codingSessionId, (codingSession) => ({
          ...codingSession,
          messages: codingSession.messages.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  ...editableUpdates,
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
    const previousCodingSession = findCodingSessionInCollection(
      storeSnapshot.projects,
      projectId,
      codingSessionId,
    );
    const optimisticMessage = buildOptimisticCodingSessionMessage(
      codingSessionId,
      content,
      context,
    );
    mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
      updateCodingSessionInCollection(projects, projectId, codingSessionId, (codingSession) => ({
        ...codingSession,
        messages: appendCodingSessionMessageIfMissing(
          codingSession.messages,
          optimisticMessage,
        ),
        runtimeStatus: 'streaming',
        updatedAt: optimisticMessage.createdAt,
        lastTurnAt: optimisticMessage.createdAt,
        transcriptUpdatedAt: optimisticMessage.createdAt,
      })),
    );

    try {
      if (previousCodingSession && projectService.upsertCodingSession) {
        try {
          await projectService.upsertCodingSession(projectId, previousCodingSession);
        } catch (error) {
          console.warn(
            `Failed to synchronize coding session "${codingSessionId}" mirror before sending`,
            error,
          );
        }
      }

      const newMessage = await projectService.addCodingSessionMessage(projectId, codingSessionId, {
        role: 'user',
        content,
        metadata: context ? { ideContext: structuredClone(context) } : undefined,
      });
      const effectiveCodingSessionId = newMessage.codingSessionId.trim() || codingSessionId;
      if (effectiveCodingSessionId !== codingSessionId) {
        const synchronizedProjectSession = await resolveSynchronizedProjectSession(
          projectId,
          effectiveCodingSessionId,
        );
        if (synchronizedProjectSession?.project) {
          upsertProjectIntoProjectsStore(
            synchronizedProjectSession.project.workspaceId,
            synchronizedProjectSession.project,
            normalizedUserScope,
          );
        } else {
          mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
            updateCodingSessionInCollection(projects, projectId, codingSessionId, (codingSession) => ({
              ...codingSession,
              messages: removeCodingSessionMessageById(
                codingSession.messages,
                optimisticMessage.id,
              ),
              runtimeStatus: previousCodingSession?.runtimeStatus,
              updatedAt: previousCodingSession?.updatedAt ?? codingSession.updatedAt,
              lastTurnAt: previousCodingSession?.lastTurnAt,
              transcriptUpdatedAt:
                previousCodingSession?.transcriptUpdatedAt ?? codingSession.transcriptUpdatedAt,
            })),
          );
        }
        return newMessage;
      }
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        updateCodingSessionInCollection(projects, projectId, codingSessionId, (codingSession) => ({
          ...codingSession,
          messages: reconcileCodingSessionMessage(
            codingSession.messages,
            optimisticMessage.id,
            newMessage,
          ),
          runtimeStatus: 'streaming',
          updatedAt: newMessage.createdAt,
          lastTurnAt: newMessage.createdAt,
          transcriptUpdatedAt: newMessage.createdAt,
        })),
      );
      return newMessage;
    } catch (error: unknown) {
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        updateCodingSessionInCollection(projects, projectId, codingSessionId, (codingSession) => ({
          ...codingSession,
          messages: removeCodingSessionMessageById(
            codingSession.messages,
            optimisticMessage.id,
          ),
          runtimeStatus: previousCodingSession?.runtimeStatus,
          updatedAt: previousCodingSession?.updatedAt ?? codingSession.updatedAt,
          lastTurnAt: previousCodingSession?.lastTurnAt,
          transcriptUpdatedAt:
            previousCodingSession?.transcriptUpdatedAt ?? codingSession.transcriptUpdatedAt,
        })),
      );
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
