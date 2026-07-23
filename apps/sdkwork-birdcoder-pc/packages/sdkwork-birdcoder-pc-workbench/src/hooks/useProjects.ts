import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { randomString } from '@sdkwork/utils/id';
import { DEFAULT_LIST_PAGE_SIZE } from '@sdkwork/utils/pagination';
import type {
  AgentSessionItemView,
  AgentSessionView,
  BirdCoderProject,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  areAgentSessionItemsEquivalent,
  areAgentSessionItemsLogicallyMatched,
  mergeAgentSessionItemViews,
  stringifyWorkbenchLongInteger,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { useAuth } from '../context/AuthContext.ts';
import { buildBirdCoderAuthSessionInventoryScope } from '../context/authSessionScope.ts';
import { useIDEServices } from '../context/IDEContext.ts';
import {
  buildProjectsStoreScopeKey,
  createProjectsStoreSnapshot,
  deleteProjectsStore,
  getProjectsStore,
  mergeProjectsForStore,
  mutateProjectsStore,
  normalizeProjectsStoreUserScope,
  peekProjectsStore,
  removeAgentSessionFromCollection,
  removeProjectFromCollection,
  type ProjectsStore,
  type ProjectsStoreSnapshot,
  updateAgentSessionInCollection,
  updateProjectInCollection,
  updateProjectsStoreSnapshot,
  upsertAgentSessionIntoCollection,
  upsertProjectIntoCollection,
  upsertProjectIntoProjectsStore,
} from '../stores/projectsStore.ts';
import type {
  BirdCoderServiceListPage,
  BirdCoderServicePageRequest,
  CreateProjectOptions,
  UpdateProjectOptions,
} from '../services/interfaces/IProjectService.ts';
import {
  loadProjectAgentSessionPage,
  loadProjectsAgentSessionInventory,
  requireAgentProjectId,
  toAgentSessionItemView,
  toAgentSessionView,
} from '../services/agentSessionViewModels.ts';
import { useProjectRuntimeLocationExecutionId } from './useProjectRuntimeLocation.ts';
import type { WorkbenchAgentSessionTurnContext } from '../workbench/agentSessionCreation.ts';

export interface LoadMoreProjectSessionsResult {
  hasMore: boolean;
  loadedCount: number;
}

type CreateProjectAgentSessionOptions = Omit<
  CreateAgentSessionOptions,
  'runtimeLocationId'
>;

interface CreateAgentSessionOptions {
  engineId: AgentSessionView['engineId'];
  hostMode?: AgentSessionView['hostMode'];
  modelId: string;
  runtimeLocationId: string;
  workspaceId?: string;
}

interface UpdateAgentSessionOptions {
  archived?: boolean;
  hostMode?: AgentSessionView['hostMode'];
  pinned?: boolean;
  status?: AgentSessionView['status'];
  title?: string;
  unread?: boolean;
}

interface ProjectSessionLoadInflightEntry {
  promise: Promise<LoadMoreProjectSessionsResult>;
  targetCount: number;
}

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

function resolveMessageActivitySortTimestamp(timestamp: string): string | undefined {
  const parsedTimestamp = Date.parse(timestamp);
  return Number.isNaN(parsedTimestamp)
    ? undefined
    : stringifyWorkbenchLongInteger(parsedTimestamp);
}

type EditableAgentSessionItem = Omit<
  AgentSessionItemView,
  'sessionId' | 'createdAt' | 'id'
>;

interface ProjectSearchInventoryAgentSessionEntry {
  agentSession: AgentSessionView;
  normalizedTitle: string;
}

interface ProjectSearchInventoryEntry {
  agentSessions: ProjectSearchInventoryAgentSessionEntry[];
  normalizedName: string;
  project: BirdCoderProject;
}

interface ScoredAgentSessionCandidate {
  agentSession: AgentSessionView;
  score: number;
}

interface ScoredProjectCandidate {
  project: BirdCoderProject;
  score: number;
}

type BirdCoderSendMessageContext = WorkbenchAgentSessionTurnContext;
interface BirdCoderSendMessageOptions {
  metadata?: Record<string, unknown>;
}
const EMPTY_PROJECT_INVENTORY_MESSAGES: AgentSessionItemView[] = [];
const EMPTY_FILTERED_PROJECT_AGENT_SESSIONS: AgentSessionView[] = [];
const PROJECTS_FETCH_TIMEOUT_MS = 30_000;
const MAX_TARGET_PROJECT_RESOLUTION_PAGES = 20;

interface ProjectsFetchTimeoutBoundary {
  clear: () => void;
  promise: Promise<never>;
}

function createProjectsFetchTimeoutPromise(timeoutMs: number): ProjectsFetchTimeoutBoundary {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const promise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Timed out loading project inventory after ${timeoutMs} ms.`));
    }, timeoutMs);
  });

  return {
    clear: () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    },
    promise,
  };
}

function sanitizeAgentSessionItemUpdates(
  updates: Partial<AgentSessionItemView>,
): Partial<AgentSessionItemView> {
  const {
    sessionId: _sessionId,
    createdAt: _createdAt,
    id: _id,
    role: _role,
    turnId: _turnId,
    ...editableUpdates
  } = updates;
  void _sessionId;
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
    agentSessions: project.agentSessions.map((agentSession) => ({
      agentSession,
      normalizedTitle: normalizeSearchValue(agentSession.title),
    })),
  }));
}

function areAgentSessionListsIdentical(
  left: readonly AgentSessionView[],
  right: readonly AgentSessionView[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((agentSession, index) => agentSession === right[index]);
}

function compareScoredAgentSessions(
  left: ScoredAgentSessionCandidate,
  right: ScoredAgentSessionCandidate,
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
    let maxAgentSessionScore = 0;
    let scoredAgentSessions: ScoredAgentSessionCandidate[] | null = null;

    for (const agentSessionEntry of projectEntry.agentSessions) {
      const score = fuzzyScore(normalizedSearchQuery, agentSessionEntry.normalizedTitle);
      if (score <= 0) {
        continue;
      }

      maxAgentSessionScore = Math.max(maxAgentSessionScore, score);
      if (scoredAgentSessions === null) {
        scoredAgentSessions = [
          {
            agentSession: agentSessionEntry.agentSession,
            score,
          },
        ];
        continue;
      }

      scoredAgentSessions.push({
        agentSession: agentSessionEntry.agentSession,
        score,
      });
    }

    const totalScore = Math.max(projectScore, maxAgentSessionScore);
    if (totalScore <= 0) {
      continue;
    }

    let matchedProject = projectEntry.project;

    if (scoredAgentSessions && scoredAgentSessions.length > 0) {
      if (scoredAgentSessions.length > 1) {
        scoredAgentSessions.sort(compareScoredAgentSessions);
      }

      const filteredAgentSessions = scoredAgentSessions.map(
        (candidate) => candidate.agentSession,
      );
      if (!areAgentSessionListsIdentical(projectEntry.project.agentSessions, filteredAgentSessions)) {
        matchedProject = {
          ...projectEntry.project,
          agentSessions: filteredAgentSessions,
        };
      }
    } else if (projectScore > 0) {
      matchedProject = {
        ...projectEntry.project,
        agentSessions: EMPTY_FILTERED_PROJECT_AGENT_SESSIONS,
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

function normalizeProjectsForInventoryStore(
  projects: readonly BirdCoderProject[],
): BirdCoderProject[] {
  return projects.map((project) => {
    let hasTranscriptPayload = false;
    const normalizedAgentSessions = project.agentSessions.map((agentSession) => {
      if (agentSession.items.length === 0) {
        return agentSession;
      }

      hasTranscriptPayload = true;
      return {
        ...agentSession,
        items: agentSession.items.length > 0 ? EMPTY_PROJECT_INVENTORY_MESSAGES : agentSession.items,
      };
    });

    return hasTranscriptPayload
      ? {
          ...project,
          agentSessions: normalizedAgentSessions,
        }
      : project;
  });
}

function appendAgentSessionItemIfMissing(
  messages: readonly AgentSessionItemView[],
  incomingMessage: AgentSessionItemView,
): AgentSessionItemView[] {
  const matchingMessageIndex = messages.findIndex((message) =>
    areAgentSessionItemsEquivalent(message, incomingMessage) ||
    areAgentSessionItemsLogicallyMatched(message, incomingMessage),
  );
  if (matchingMessageIndex < 0) {
    return [...messages, incomingMessage];
  }

  const existingMessage = messages[matchingMessageIndex]!;
  const mergedMessage = mergeAgentSessionItemViews(existingMessage, incomingMessage);
  if (mergedMessage === existingMessage) {
    return messages as AgentSessionItemView[];
  }

  const nextMessages = [...messages];
  nextMessages[matchingMessageIndex] = mergedMessage;
  return nextMessages;
}

function replaceAgentSessionItemAtIndex(
  messages: readonly AgentSessionItemView[],
  messageIndex: number,
  nextMessage: AgentSessionItemView,
): AgentSessionItemView[] {
  if (
    messageIndex < 0 ||
    messageIndex >= messages.length ||
    messages[messageIndex] === nextMessage
  ) {
    return messages as AgentSessionItemView[];
  }

  const nextMessages = [...messages];
  nextMessages[messageIndex] = nextMessage;
  return nextMessages;
}

function replaceAgentSessionItemById(
  messages: readonly AgentSessionItemView[],
  messageId: string,
  updates: Partial<AgentSessionItemView>,
): AgentSessionItemView[] {
  const messageIndex = messages.findIndex((message) => message.id === messageId);
  if (messageIndex < 0) {
    return messages as AgentSessionItemView[];
  }

  const existingMessage = messages[messageIndex]!;
  const nextMessage = {
    ...existingMessage,
    ...updates,
  };
  return areAgentSessionItemsEquivalent(existingMessage, nextMessage)
    ? (messages as AgentSessionItemView[])
    : replaceAgentSessionItemAtIndex(messages, messageIndex, nextMessage);
}

function reconcileAgentSessionItem(
  messages: readonly AgentSessionItemView[],
  optimisticMessageId: string,
  resolvedMessage: AgentSessionItemView,
): AgentSessionItemView[] {
  const optimisticMessageIndex = messages.findIndex(
    (message) => message.id === optimisticMessageId,
  );
  const messagesWithoutOptimistic = removeAgentSessionItemById(
    messages,
    optimisticMessageId,
  );
  const matchingResolvedMessageIndex = messagesWithoutOptimistic.findIndex((message) =>
    areAgentSessionItemsEquivalent(message, resolvedMessage) ||
    areAgentSessionItemsLogicallyMatched(message, resolvedMessage),
  );
  if (matchingResolvedMessageIndex >= 0) {
    const existingMessage = messagesWithoutOptimistic[matchingResolvedMessageIndex]!;
    const mergedMessage = mergeAgentSessionItemViews(existingMessage, resolvedMessage);
    if (mergedMessage === existingMessage) {
      return messagesWithoutOptimistic as AgentSessionItemView[];
    }

    return replaceAgentSessionItemAtIndex(
      messagesWithoutOptimistic,
      matchingResolvedMessageIndex,
      mergedMessage,
    );
  }

  if (
    optimisticMessageIndex < 0 ||
    optimisticMessageIndex >= messagesWithoutOptimistic.length
  ) {
    return [...messagesWithoutOptimistic, resolvedMessage];
  }

  const nextMessages = [...messagesWithoutOptimistic];
  nextMessages.splice(optimisticMessageIndex, 0, resolvedMessage);
  return nextMessages;
}

function buildOptimisticAgentSessionItem(
  agentSessionId: string,
  content: string,
  context?: BirdCoderSendMessageContext,
  options?: BirdCoderSendMessageOptions,
): AgentSessionItemView {
  const createdAt = new Date().toISOString();
  const randomToken = randomString(8);
  return {
    id: `${agentSessionId}:optimistic:${createdAt}:${randomToken}`,
    sessionId: agentSessionId,
    role: 'user',
    content,
    metadata: buildSendMessageMetadata(context, options),
    createdAt,
    timestamp: Date.parse(createdAt),
  };
}

function buildSendMessageMetadata(
  context?: BirdCoderSendMessageContext,
  options?: BirdCoderSendMessageOptions,
): Record<string, unknown> | undefined {
  const metadata = options?.metadata
    ? structuredClone(options.metadata)
    : {};
  if (context) {
    metadata.ideContext = structuredClone(context);
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function removeAgentSessionItemById(
  messages: readonly AgentSessionItemView[],
  messageId: string,
): AgentSessionItemView[] {
  let nextMessages: AgentSessionItemView[] | null = null;
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!;
    if (message.id === messageId) {
      if (!nextMessages) {
        nextMessages = messages.slice(0, index) as AgentSessionItemView[];
      }
      continue;
    }

    nextMessages?.push(message);
  }

  return nextMessages ?? (messages as AgentSessionItemView[]);
}

function rollbackOptimisticAgentSessionItem(
  agentSession: AgentSessionView,
  previousAgentSession: AgentSessionView | null,
  optimisticMessage: AgentSessionItemView,
): AgentSessionView {
  const messages = removeAgentSessionItemById(
    agentSession.items,
    optimisticMessage.id,
  );
  const previousMessageIds = new Set(
    previousAgentSession?.items.map((message) => message.id) ?? [],
  );
  const hasConcurrentMessage = messages.some(
    (message) => !previousMessageIds.has(message.id),
  );
  const optimisticSortTimestamp = resolveMessageActivitySortTimestamp(
    optimisticMessage.createdAt,
  );
  const canRestoreOwnedActivity = !hasConcurrentMessage;

  return {
    ...agentSession,
    items: messages,
    runtimeStatus:
      canRestoreOwnedActivity && agentSession.runtimeStatus === 'streaming'
        ? previousAgentSession?.runtimeStatus
        : agentSession.runtimeStatus,
    updatedAt:
      canRestoreOwnedActivity && agentSession.updatedAt === optimisticMessage.createdAt
        ? previousAgentSession?.updatedAt ?? agentSession.updatedAt
        : agentSession.updatedAt,
    lastTurnAt:
      canRestoreOwnedActivity && agentSession.lastTurnAt === optimisticMessage.createdAt
        ? previousAgentSession?.lastTurnAt
        : agentSession.lastTurnAt,
    sortTimestamp:
      canRestoreOwnedActivity &&
      optimisticSortTimestamp !== undefined &&
      agentSession.sortTimestamp === optimisticSortTimestamp
        ? previousAgentSession?.sortTimestamp
        : agentSession.sortTimestamp,
    transcriptUpdatedAt:
      canRestoreOwnedActivity &&
      agentSession.transcriptUpdatedAt === optimisticMessage.createdAt
        ? previousAgentSession?.transcriptUpdatedAt
        : agentSession.transcriptUpdatedAt,
  };
}

function findAgentSessionInCollection(
  projects: readonly BirdCoderProject[],
  projectId: string,
  agentSessionId: string,
): AgentSessionView | null {
  const project = projects.find((candidateProject) => candidateProject.id === projectId);
  if (!project) {
    return null;
  }

  return (
    project.agentSessions.find(
      (candidateAgentSession) => candidateAgentSession.id === agentSessionId,
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

function readProjectInventoryPageForWorkspace(
  workspaceId: string,
  projectService: ReturnType<typeof useIDEServices>['projectService'],
  request: BirdCoderServicePageRequest,
): Promise<BirdCoderServiceListPage<BirdCoderProject>> {
  return projectService.getProjectsPage(workspaceId, request);
}

function readProjectInventoryPageForWorkspaceWithTimeout(
  workspaceId: string,
  projectService: ReturnType<typeof useIDEServices>['projectService'],
  request: BirdCoderServicePageRequest,
  timeoutMs: number = PROJECTS_FETCH_TIMEOUT_MS,
): Promise<BirdCoderServiceListPage<BirdCoderProject>> {
  const timeoutBoundary = createProjectsFetchTimeoutPromise(timeoutMs);
  return Promise.race([
    readProjectInventoryPageForWorkspace(workspaceId, projectService, request),
    timeoutBoundary.promise,
  ]).finally(() => {
    timeoutBoundary.clear();
  });
}

async function fetchProjectsForWorkspace(
  store: ProjectsStore,
  workspaceId: string,
  projectService: ReturnType<typeof useIDEServices>['projectService'],
  pageRequest: BirdCoderServicePageRequest,
  mode: 'append' | 'replace',
  agentSessionService: ReturnType<typeof useIDEServices>['agentSessionService'],
): Promise<BirdCoderProject[]> {
  const requestKey = `${mode}:${pageRequest.page}:${pageRequest.pageSize}`;
  if (store.inflight) {
    if (store.inflightKey === requestKey) {
      return store.inflight;
    }

    await store.inflight.catch(() => undefined);
    return fetchProjectsForWorkspace(
      store,
      workspaceId,
      projectService,
      pageRequest,
      mode,
      agentSessionService,
    );
  }

  updateProjectsStoreSnapshot(store, (previousSnapshot) => ({
    ...previousSnapshot,
    error: null,
    isLoading: true,
  }));

  const requestInventoryVersion = store.inventoryVersion;
  const request = readProjectInventoryPageForWorkspaceWithTimeout(
    workspaceId,
    projectService,
    pageRequest,
    PROJECTS_FETCH_TIMEOUT_MS,
  )
    .then(async (page) => {
      if (store.inventoryVersion !== requestInventoryVersion) {
        updateProjectsStoreSnapshot(store, (previousSnapshot) => ({
          ...previousSnapshot,
          isLoading: false,
          pageInfo: null,
        }));
        return store.snapshot.projects;
      }

      const fetchedProjects = normalizeProjectsForInventoryStore(page.items.filter(Boolean));
      const incomingProjects = await loadProjectsAgentSessionInventory(
        agentSessionService,
        fetchedProjects,
      );
      if (store.inventoryVersion !== requestInventoryVersion) {
        updateProjectsStoreSnapshot(store, (previousSnapshot) => ({
          ...previousSnapshot,
          isLoading: false,
          pageInfo: null,
        }));
        return store.snapshot.projects;
      }
      const nextProjects = mergeProjectsForStore(
        store.snapshot.projects,
        mode === 'append'
          ? [...store.snapshot.projects, ...incomingProjects]
          : incomingProjects,
      );
      updateProjectsStoreSnapshot(store, (previousSnapshot) => ({
        error: null,
        hasFetched: true,
        isLoading: false,
        pageInfo: page.pageInfo,
        projects: mergeProjectsForStore(
          previousSnapshot.projects,
          mode === 'append'
            ? [...previousSnapshot.projects, ...incomingProjects]
            : incomingProjects,
        ),
      }));
      return nextProjects;
    })
    .catch((error: unknown) => {
      // A local mutation may have invalidated this request while it
      // was in flight. In that case the failure belongs to the old inventory
      // generation and must not replace the current store error or loading
      // state. Keep propagating it so the request owner can observe failure.
      if (store.inventoryVersion !== requestInventoryVersion) {
        throw error;
      }

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
        store.inflightKey = null;
      }
    });

  store.inflight = request;
  store.inflightKey = requestKey;
  return request;
}

function disposeProjectsStoreIfUnused(scopeKey: string): void {
  const store = getProjectsStore(scopeKey);
  if (store.listeners.size > 0) {
    return;
  }

  // React cleans up changed subscriptions before mounting their replacements.
  // Defer eviction so a workspace preview store can become the active store in
  // that same effect flush without losing its in-flight request or snapshot.
  queueMicrotask(() => {
    if (store.listeners.size > 0 || peekProjectsStore(scopeKey) !== store) {
      return;
    }

    deleteProjectsStore(scopeKey);
  });
}

export interface UseProjectsOptions {
  fetchOnMount?: boolean;
  isActive?: boolean;
  limit?: number;
  offset?: number;
  targetProjectId?: string | null;
}

export function useProjects(workspaceId?: string, options?: UseProjectsOptions) {
  const { agentSessionService, projectService } = useIDEServices();
  const resolveProjectRuntimeLocationExecutionId = useProjectRuntimeLocationExecutionId();
  const { sessionRevision, user } = useAuth();
  const normalizedUserScope = normalizeProjectsStoreUserScope(
    buildBirdCoderAuthSessionInventoryScope(user?.id, sessionRevision),
  );
  const normalizedWorkspaceId = workspaceId?.trim() ?? '';
  const shouldFetchOnMount = options?.fetchOnMount ?? true;
  const isActive = options?.isActive ?? true;
  const pageRequest = useMemo<BirdCoderServicePageRequest>(
    () => {
      const pageSize = options?.limit ?? DEFAULT_LIST_PAGE_SIZE;
      const offset = options?.offset ?? 0;
      if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 200) {
        throw new Error('Project page size must be an integer between 1 and 200.');
      }
      if (!Number.isSafeInteger(offset) || offset < 0 || offset % pageSize !== 0) {
        throw new Error('Project offset must be a non-negative multiple of page size.');
      }
      return {
        page: offset / pageSize + 1,
        pageSize,
      };
    },
    [options?.limit, options?.offset],
  );
  const baseStoreScopeKey = normalizedWorkspaceId
    ? buildProjectsStoreScopeKey(normalizedUserScope, normalizedWorkspaceId)
    : '';
  const isDefaultPagination =
    pageRequest.pageSize === DEFAULT_LIST_PAGE_SIZE && pageRequest.page === 1;
  const storeScopeKey = baseStoreScopeKey && !isDefaultPagination
    ? `${baseStoreScopeKey}::page:${pageRequest.pageSize}:${pageRequest.page}`
    : baseStoreScopeKey;
  const [storeSnapshot, setStoreSnapshot] = useState<ProjectsStoreSnapshot>(() =>
    storeScopeKey
      ? getProjectsStore(storeScopeKey).snapshot
      : createProjectsStoreSnapshot(),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const projectSessionLoadInflightRef = useRef(
    new Map<string, ProjectSessionLoadInflightEntry>(),
  );

  useEffect(() => {
    if (!normalizedWorkspaceId || !storeScopeKey) {
      setStoreSnapshot(createProjectsStoreSnapshot());
      return;
    }

    if (!isActive) {
      setStoreSnapshot(createProjectsStoreSnapshot());
      return;
    }

    const store = getProjectsStore(storeScopeKey);
    setStoreSnapshot(store.snapshot);

    const handleStoreChange = (nextSnapshot: ProjectsStoreSnapshot) => {
      startTransition(() => {
        setStoreSnapshot(nextSnapshot);
      });
    };

    const hadActiveListeners = store.listeners.size > 0;
    store.listeners.add(handleStoreChange);
    if (
      shouldFetchOnMount &&
      (!store.snapshot.hasFetched ||
        (!!store.snapshot.error && store.snapshot.projects.length === 0 && !hadActiveListeners)) &&
      !store.inflight
    ) {
      void fetchProjectsForWorkspace(
        store,
        normalizedWorkspaceId,
        projectService,
        pageRequest,
        'replace',
        agentSessionService,
      ).catch(() => {
        // Error state is already propagated through the shared store snapshot.
      });
    }

    return () => {
      store.listeners.delete(handleStoreChange);
      disposeProjectsStoreIfUnused(storeScopeKey);
    };
  }, [
    normalizedWorkspaceId,
    agentSessionService,
    projectService,
    shouldFetchOnMount,
    isActive,
    storeScopeKey,
    pageRequest,
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
    return fetchProjectsForWorkspace(
      store,
      normalizedWorkspaceId,
      projectService,
      pageRequest,
      'replace',
      agentSessionService,
    );
  }, [
    agentSessionService,
    normalizedWorkspaceId,
    projectService,
    storeScopeKey,
    pageRequest,
  ]);

  const loadMoreProjects = useCallback(async () => {
    if (!normalizedWorkspaceId || !storeScopeKey) {
      return [];
    }

    const store = getProjectsStore(storeScopeKey);
    const pageInfo = store.snapshot.pageInfo;
    if (!pageInfo?.hasMore) {
      return store.snapshot.projects;
    }

    return fetchProjectsForWorkspace(
      store,
      normalizedWorkspaceId,
      projectService,
      {
        page: pageInfo.page + 1,
        pageSize: pageInfo.pageSize,
      },
      'append',
      agentSessionService,
    );
  }, [agentSessionService, normalizedWorkspaceId, projectService, storeScopeKey]);

  const loadMoreProjectSessions = useCallback(
    async (
      projectId: string,
      requestedCount: number,
    ): Promise<LoadMoreProjectSessionsResult> => {
      const normalizedProjectId = projectId.trim();
      const targetCount = Number.isFinite(requestedCount)
        ? Math.max(1, Math.min(200_000, Math.floor(requestedCount)))
        : 1;
      if (!normalizedWorkspaceId || !storeScopeKey || !normalizedProjectId) {
        return { hasMore: false, loadedCount: 0 };
      }

      while (true) {
        const existingEntry = projectSessionLoadInflightRef.current.get(normalizedProjectId);
        if (!existingEntry) {
          break;
        }
        if (existingEntry.targetCount >= targetCount) {
          return existingEntry.promise;
        }

        const existingResult = await existingEntry.promise;
        if (!existingResult.hasMore || existingResult.loadedCount >= targetCount) {
          return existingResult;
        }
        if (projectSessionLoadInflightRef.current.get(normalizedProjectId) === existingEntry) {
          projectSessionLoadInflightRef.current.delete(normalizedProjectId);
        }
      }

      const request = (async (): Promise<LoadMoreProjectSessionsResult> => {
        const store = getProjectsStore(storeScopeKey);
        let project = store.snapshot.projects.find((candidate) => candidate.id === normalizedProjectId);
        if (!project) {
          return {
            hasMore: false,
            loadedCount: 0,
          };
        }

        for (let attempt = 0; attempt < 2; attempt += 1) {
          const requestInventoryVersion = store.inventoryVersion;
          const synchronized = await loadProjectAgentSessionPage(
            agentSessionService,
            project,
            targetCount,
          );
          const currentProject = store.snapshot.projects.find(
            (candidate) => candidate.id === normalizedProjectId,
          );
          if (!currentProject) {
            return { hasMore: false, loadedCount: 0 };
          }

          if (
            store.inventoryVersion !== requestInventoryVersion ||
            currentProject !== project
          ) {
            project = currentProject;
            continue;
          }

          if (synchronized.project !== project) {
            upsertProjectIntoProjectsStore(
              synchronized.project.workspaceId,
              synchronized.project,
              normalizedUserScope,
            );
          }

          return {
            hasMore: synchronized.hasMore,
            loadedCount: synchronized.project.agentSessions.length,
          };
        }

        const currentProject = store.snapshot.projects.find(
          (candidate) => candidate.id === normalizedProjectId,
        );
        return {
          hasMore: currentProject !== undefined,
          loadedCount: currentProject?.agentSessions.length ?? 0,
        };
      })();

      const entry: ProjectSessionLoadInflightEntry = {
        promise: request,
        targetCount,
      };
      projectSessionLoadInflightRef.current.set(normalizedProjectId, entry);
      try {
        return await request;
      } finally {
        if (projectSessionLoadInflightRef.current.get(normalizedProjectId) === entry) {
          projectSessionLoadInflightRef.current.delete(normalizedProjectId);
        }
      }
    },
    [
      agentSessionService,
      normalizedUserScope,
      normalizedWorkspaceId,
      projectService,
      storeScopeKey,
    ],
  );

  useEffect(() => {
    if (
      !isActive ||
      !normalizedWorkspaceId ||
      !storeScopeKey ||
      !storeSnapshot.hasFetched ||
      storeSnapshot.isLoading ||
      storeSnapshot.error ||
      storeSnapshot.pageInfo !== null
    ) {
      return;
    }

    void fetchProjectsForWorkspace(
      getProjectsStore(storeScopeKey),
      normalizedWorkspaceId,
      projectService,
      {
        page: 1,
        pageSize: pageRequest.pageSize,
      },
      'replace',
      agentSessionService,
    ).catch(() => {
      // Error state is already propagated through the shared store snapshot.
    });
  }, [
    isActive,
    agentSessionService,
    normalizedWorkspaceId,
    pageRequest.pageSize,
    projectService,
    storeScopeKey,
    storeSnapshot.error,
    storeSnapshot.hasFetched,
    storeSnapshot.isLoading,
    storeSnapshot.pageInfo,
  ]);

  const normalizedTargetProjectId = options?.targetProjectId?.trim() ?? '';
  const [targetResolutionRevision, setTargetResolutionRevision] = useState(0);
  const targetResolutionStateRef = useRef({
    key: '',
    pagesRequested: 0,
    lookupStatus: 'idle' as 'idle' | 'pending' | 'found' | 'missing' | 'failed',
  });
  const targetResolutionKey = `${normalizedUserScope}\u0001${normalizedWorkspaceId}\u0001${normalizedTargetProjectId}`;
  if (targetResolutionStateRef.current.key !== targetResolutionKey) {
    targetResolutionStateRef.current = {
      key: targetResolutionKey,
      pagesRequested: 0,
      lookupStatus: 'idle',
    };
  }
  const targetResolutionBudgetExhausted =
    targetResolutionStateRef.current.pagesRequested >= MAX_TARGET_PROJECT_RESOLUTION_PAGES;
  const hasTargetProject = normalizedTargetProjectId
    ? storeSnapshot.projects.some((project) => project.id === normalizedTargetProjectId)
    : true;
  const isResolvingTargetProject = Boolean(
    normalizedTargetProjectId &&
      !hasTargetProject &&
      !storeSnapshot.error &&
      (
        targetResolutionStateRef.current.lookupStatus === 'idle' ||
        targetResolutionStateRef.current.lookupStatus === 'pending' ||
        (
          targetResolutionStateRef.current.lookupStatus === 'failed' &&
          !targetResolutionBudgetExhausted &&
          (
            !storeSnapshot.hasFetched ||
            storeSnapshot.pageInfo === null ||
            storeSnapshot.pageInfo.hasMore
          )
        )
      ),
  );

  useEffect(() => {
    const resolutionState = targetResolutionStateRef.current;
    if (
      !isActive ||
      !normalizedWorkspaceId ||
      !storeScopeKey ||
      !normalizedTargetProjectId ||
      !storeSnapshot.hasFetched ||
      storeSnapshot.error ||
      hasTargetProject ||
      resolutionState.lookupStatus !== 'idle'
    ) {
      return;
    }

    resolutionState.lookupStatus = 'pending';
    void projectService
      .getProjectById(normalizedTargetProjectId)
      .then((project) => {
        const currentState = targetResolutionStateRef.current;
        if (currentState.key !== targetResolutionKey) {
          return;
        }

        if (!project || project.workspaceId !== normalizedWorkspaceId) {
          currentState.lookupStatus = 'missing';
          setTargetResolutionRevision((revision) => revision + 1);
          return;
        }

        currentState.lookupStatus = 'found';
        const store = getProjectsStore(storeScopeKey);
        updateProjectsStoreSnapshot(store, (previousSnapshot) => ({
          ...previousSnapshot,
          projects: mergeProjectsForStore(
            previousSnapshot.projects,
            upsertProjectIntoCollection(previousSnapshot.projects, project),
          ),
        }));
        setTargetResolutionRevision((revision) => revision + 1);
      })
      .catch(() => {
        const currentState = targetResolutionStateRef.current;
        if (currentState.key !== targetResolutionKey) {
          return;
        }

        currentState.lookupStatus = 'failed';
        setTargetResolutionRevision((revision) => revision + 1);
      });
  }, [
    hasTargetProject,
    isActive,
    normalizedTargetProjectId,
    normalizedWorkspaceId,
    projectService,
    storeScopeKey,
    storeSnapshot.error,
    storeSnapshot.hasFetched,
    targetResolutionKey,
  ]);

  useEffect(() => {
    if (
      !isActive ||
      !storeSnapshot.hasFetched ||
      storeSnapshot.isLoading ||
      storeSnapshot.error ||
      !isResolvingTargetProject ||
      targetResolutionStateRef.current.lookupStatus !== 'failed' ||
      !storeSnapshot.pageInfo?.hasMore
    ) {
      return;
    }

    targetResolutionStateRef.current.pagesRequested += 1;
    void loadMoreProjects().catch(() => {
      // Error state is already propagated through the shared store snapshot.
    });
  }, [
    isActive,
    isResolvingTargetProject,
    loadMoreProjects,
    storeSnapshot.hasFetched,
    storeSnapshot.isLoading,
    storeSnapshot.error,
    storeSnapshot.pageInfo?.hasMore,
    targetResolutionRevision,
    targetResolutionBudgetExhausted,
  ]);

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
        { invalidatePagination: true },
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

  const createAgentSession = async (
    projectId: string,
    title: string,
    options: CreateProjectAgentSessionOptions,
  ) => {
    try {
      const project = storeSnapshot.projects.find((candidate) => candidate.id === projectId);
      if (!project) {
        throw new Error(`BirdCoder project ${projectId} is not loaded.`);
      }
      const agentProjectId = requireAgentProjectId(project);
      const runtimeLocationId = await resolveProjectRuntimeLocationExecutionId(
        projectId,
        'terminal',
        { allowFolderSelection: true },
      );
      const session = await agentSessionService.createSession({
        projectId: agentProjectId,
        sourceContextId: projectId,
        sourceContextKind: 'birdcoder-project',
        title,
      });
      await agentSessionService.createRuntimeBinding(session.sessionId, {
        runtimeLocationId,
        hostMode: options.hostMode ?? 'desktop',
        transportKind: 'sdk-stream',
        providerBindingId: options.engineId,
        modelId: options.modelId,
        providerId: options.engineId,
        requestedAt: new Date().toISOString(),
      });
      const agentSession = toAgentSessionView(session, {
        agentProjectId,
        birdCoderProjectId: projectId,
        engineId: options.engineId,
        modelId: options.modelId,
        runtimeLocationId,
        workspaceId: normalizedWorkspaceId,
      });
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        upsertAgentSessionIntoCollection(projects, projectId, agentSession),
      );
      return agentSession;
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
        { invalidatePagination: true },
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

  const updateProject = async (projectId: string, updates: UpdateProjectOptions) => {
    try {
      await projectService.updateProject(projectId, updates);
      const projectPatch: Partial<BirdCoderProject> = {
        ...(updates.name === undefined ? {} : { name: updates.name }),
        ...(updates.description === undefined ? {} : { description: updates.description }),
        ...(updates.status === undefined
          ? {}
          : { archived: updates.status === 'archived' }),
      };
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        updateProjectInCollection(projects, projectId, projectPatch),
        { invalidatePagination: true },
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
        { invalidatePagination: true },
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

  const renameAgentSession = async (
    projectId: string,
    agentSessionId: string,
    title: string,
  ) => {
    try {
      const updatedSession = await agentSessionService.updateSession(agentSessionId, { title });
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        updateAgentSessionInCollection(projects, projectId, agentSessionId, (agentSession) => ({
          ...agentSession,
          title: updatedSession.title?.trim() || title,
          updatedAt: updatedSession.updatedAt,
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

  const updateAgentSession = async (
    projectId: string,
    agentSessionId: string,
    updates: UpdateAgentSessionOptions,
  ) => {
    try {
      if (updates.hostMode !== undefined) {
        throw new Error('Session host mode is managed by the active Agents runtime binding.');
      }
      let session = await agentSessionService.getSession(agentSessionId);
      if (updates.title !== undefined) {
        session = await agentSessionService.updateSession(agentSessionId, {
          expectedVersion: session.version,
          title: updates.title,
        });
      }
      if (updates.status === 'completed') {
        session = await agentSessionService.closeSession(agentSessionId, session.version);
      } else if (
        updates.status !== undefined &&
        updates.status !== 'active' &&
        updates.status !== 'archived'
      ) {
        throw new Error(`Agents does not support changing a session to "${updates.status}".`);
      }
      if (
        updates.archived !== undefined ||
        updates.pinned !== undefined ||
        updates.unread !== undefined ||
        updates.status === 'archived'
      ) {
        await agentSessionService.updateSessionUserState(agentSessionId, {
          hidden: updates.archived ?? updates.status === 'archived',
          pinned: updates.pinned,
          markOpened: updates.unread === false ? true : undefined,
          lastReadItemSequence:
            updates.unread === undefined
              ? undefined
              : updates.unread
                ? '0'
                : session.lastItemSequence,
        });
      }
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        updateAgentSessionInCollection(projects, projectId, agentSessionId, (agentSession) => ({
          ...agentSession,
          ...updates,
          status: updates.status ?? agentSession.status,
          updatedAt: session.updatedAt,
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

  const forkAgentSession = async (
    projectId: string,
    agentSessionId: string,
    newTitle?: string,
  ) => {
    try {
      const project = storeSnapshot.projects.find((candidate) => candidate.id === projectId);
      if (!project) {
        throw new Error(`BirdCoder project ${projectId} is not loaded.`);
      }
      const agentProjectId = requireAgentProjectId(project);
      const [parentSession, parentTurnPage, runtimeBindingPage] = await Promise.all([
        agentSessionService.getSession(agentSessionId),
        agentSessionService.listTurns(agentSessionId, { page: 1, pageSize: 200 }),
        agentSessionService.listRuntimeBindings(agentSessionId, { page: 1, pageSize: 20 }),
      ]);
      const lastTurn = parentTurnPage.items.at(-1);
      if (parentSession.projectId?.trim() !== agentProjectId) {
        throw new Error(
          `Agent session ${agentSessionId} does not belong to Agents project ${agentProjectId}.`,
        );
      }
      const forkedSession = await agentSessionService.createSession({
        forkedFromTurnId: lastTurn?.turnId,
        parentSessionId: parentSession.sessionId,
        projectId: agentProjectId,
        sourceContextId: projectId,
        sourceContextKind: 'birdcoder-project',
        title: newTitle?.trim() || `${parentSession.title?.trim() || 'Session'} (fork)`,
      });
      const currentBinding = runtimeBindingPage.items.find((binding) => binding.isCurrent);
      if (currentBinding) {
        await agentSessionService.createRuntimeBinding(forkedSession.sessionId, {
          runtimeLocationId: currentBinding.runtimeLocationId ?? undefined,
          hostMode: currentBinding.hostMode,
          transportKind: currentBinding.transportKind,
          providerBindingId: currentBinding.providerBindingId,
          modelId: currentBinding.modelId,
          providerId: currentBinding.providerId,
          nativeParentSessionId: currentBinding.nativeSessionId ?? undefined,
          nativeForkedFromSessionId: currentBinding.nativeSessionId ?? undefined,
          requestedAt: new Date().toISOString(),
        });
      }
      const agentSession = toAgentSessionView(forkedSession, {
        agentProjectId,
        birdCoderProjectId: projectId,
        engineId: currentBinding?.providerId,
        modelId: currentBinding?.modelId,
        runtimeLocationId: currentBinding?.runtimeLocationId ?? undefined,
        workspaceId: normalizedWorkspaceId,
      });
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        upsertAgentSessionIntoCollection(projects, projectId, agentSession),
      );
      return agentSession;
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

  const deleteAgentSession = async (projectId: string, agentSessionId: string) => {
    try {
      await agentSessionService.deleteSession(agentSessionId);
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        removeAgentSessionFromCollection(projects, projectId, agentSessionId),
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

  const editAgentSessionItem = async (
    _projectId: string,
    _agentSessionId: string,
    _messageId: string,
    _updates: Partial<AgentSessionItemView>,
  ) => {
    throw new Error('Agents session items are immutable and cannot be edited in place.');
  };

  const deleteAgentSessionItem = async (
    _projectId: string,
    _agentSessionId: string,
    _messageId: string,
  ) => {
    throw new Error('Agents session items are immutable and cannot be deleted in place.');
  };

  const sendMessage = async (
    projectId: string,
    agentSessionId: string,
    content: string,
    context?: BirdCoderSendMessageContext,
    options?: BirdCoderSendMessageOptions,
  ) => {
    try {
      const selectedSession = findAgentSessionInCollection(
        storeScopeKey
          ? getProjectsStore(storeScopeKey).snapshot.projects
          : storeSnapshot.projects,
        projectId,
        agentSessionId,
      );
      const completed = await agentSessionService.submitTurn(agentSessionId, {
        content,
        contentType: 'text/plain',
        requestedModelId: selectedSession?.modelId,
        turnMode: 'interactive',
      });
      const newMessages = completed.items.map(toAgentSessionItemView);
      const activityAt = completed.turn.completedAt ?? completed.turn.updatedAt;
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        updateAgentSessionInCollection(projects, projectId, agentSessionId, (agentSession) => ({
          ...agentSession,
          items: newMessages.reduce(
            (messages, message) => appendAgentSessionItemIfMissing(messages, message),
            agentSession.items,
          ),
          runtimeStatus: completed.turn.status === 'failed' ? 'failed' : 'ready',
          updatedAt: activityAt,
          lastTurnAt: activityAt,
          sortTimestamp:
            resolveMessageActivitySortTimestamp(activityAt) ?? agentSession.sortTimestamp,
          transcriptUpdatedAt: activityAt,
        })),
      );
      return newMessages.find((message) => message.role === 'user') ?? newMessages.at(-1);
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
    hasFetched:
      storeSnapshot.hasFetched &&
      storeSnapshot.pageInfo !== null &&
      !isResolvingTargetProject,
    hasMore: storeSnapshot.pageInfo?.hasMore ?? false,
    projects: storeSnapshot.projects,
    isLoading: storeSnapshot.isLoading,
    isLoadingMore: storeSnapshot.isLoading && storeSnapshot.hasFetched,
    pageInfo: storeSnapshot.pageInfo,
    error: storeSnapshot.error,
    searchQuery,
    setSearchQuery,
    createProject,
    createAgentSession,
    renameProject,
    updateProject,
    deleteProject,
    renameAgentSession,
    updateAgentSession,
    forkAgentSession,
    deleteAgentSession,
    editAgentSessionItem,
    deleteAgentSessionItem,
    sendMessage,
    loadMoreProjects,
    loadMoreProjectSessions,
    refreshProjects,
  };
}
