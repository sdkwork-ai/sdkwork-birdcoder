import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { randomString, uuid } from '@sdkwork/utils/id';
import { DEFAULT_LIST_PAGE_SIZE } from '@sdkwork/utils/pagination';
import type {
  AgentSessionItemView,
  AgentSessionItemResourceView,
  AgentSessionView,
  AgentProjectView,
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
  filterProjectsForInventoryStore,
  getProjectsStore,
  mergeProjectsForStore,
  mutateProjectsStoreByScopeKey,
  normalizeProjectsStoreUserScope,
  peekProjectsStore,
  removeAgentSessionFromCollection,
  removeProjectFromProjectsStore,
  type ProjectsStore,
  type ProjectsStoreSnapshot,
  updateAgentSessionInCollection,
  updateProjectInCollection,
  updateProjectsStoreSnapshot,
  upsertAgentSessionIntoCollection,
  upsertProjectIntoProjectsStoreByScopeKey,
  upsertProjectIntoCollection,
} from '../stores/projectsStore.ts';
import type {
  AgentProjectPageRequest,
  AgentProjectViewPage,
  CreateProjectOptions,
  ImportProjectOptions,
  UpdateProjectOptions,
} from '../services/interfaces/IProjectService.ts';
import {
  loadProjectAgentSessionPage,
  normalizeProjectAgentSessionTargetCount,
  toAgentSessionTranscriptItemViews,
  toAgentSessionView,
} from '../services/agentSessionViewModels.ts';
import {
  updateAgentSessionUserState,
  type AgentSessionUserStateUpdate,
} from '../services/agentSessionUserStateUpdate.ts';
import type { WorkbenchAgentSessionTurnContext } from '../workbench/agentSessionCreation.ts';
import type { WorkbenchAgentTurnDriveRef } from '../chat/agentTurnInputQueueStore.ts';
import { createBoundAgentSession } from '../workbench/agentSessionProvisioning.ts';
import { createAgentTurnStreamPresentation } from '../workbench/agentTurnStreamPresentation.ts';
import { useWorkspaceSessionInboxSynchronization } from './useWorkspaceSessionInboxSynchronization.ts';
import {
  invalidateWorkspaceSessionInboxSynchronization,
} from '../workbench/workspaceSessionInboxCoordinator.ts';

export interface LoadMoreProjectSessionsResult {
  hasMore: boolean;
  loadedCount: number;
}

interface CreateProjectAgentSessionOptions {
  agentId: AgentSessionView['agentId'];
  engineId: AgentSessionView['engineId'];
  hostMode?: AgentSessionView['hostMode'];
  modelId: string;
  providerBindingId: string;
  providerId: string;
}

interface UpdateAgentSessionOptions extends AgentSessionUserStateUpdate {
  hostMode?: AgentSessionView['hostMode'];
  title?: string;
}

interface ProjectSessionLoadInflightEntry {
  controller: AbortController;
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

function resolveAgentSessionItemActivitySortTimestamp(timestamp: string): string | undefined {
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
  project: AgentProjectView;
}

interface ScoredAgentSessionCandidate {
  agentSession: AgentSessionView;
  score: number;
}

interface ScoredProjectCandidate {
  project: AgentProjectView;
  score: number;
}

type WorkbenchAgentTurnSubmissionContext = WorkbenchAgentSessionTurnContext;
interface WorkbenchAgentTurnSubmissionOptions {
  driveRefs?: readonly WorkbenchAgentTurnDriveRef[];
  metadata?: Record<string, unknown>;
}
const EMPTY_PROJECT_INVENTORY_ITEMS: AgentSessionItemView[] = [];
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
  projects: readonly AgentProjectView[],
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
): AgentProjectView[] {
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
  projects: readonly AgentProjectView[],
): AgentProjectView[] {
  return projects.map((project) => {
    let hasTranscriptPayload = false;
    const normalizedAgentSessions = project.agentSessions.map((agentSession) => {
      if (agentSession.items.length === 0) {
        return agentSession;
      }

      hasTranscriptPayload = true;
      return {
        ...agentSession,
        items: agentSession.items.length > 0 ? EMPTY_PROJECT_INVENTORY_ITEMS : agentSession.items,
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
  items: readonly AgentSessionItemView[],
  incomingItem: AgentSessionItemView,
): AgentSessionItemView[] {
  const matchingItemIndex = items.findIndex((item) =>
    areAgentSessionItemsEquivalent(item, incomingItem) ||
    areAgentSessionItemsLogicallyMatched(item, incomingItem),
  );
  if (matchingItemIndex < 0) {
    return [...items, incomingItem];
  }

  const existingItem = items[matchingItemIndex]!;
  const mergedItem = mergeAgentSessionItemViews(existingItem, incomingItem);
  if (mergedItem === existingItem) {
    return items as AgentSessionItemView[];
  }

  const nextItems = [...items];
  nextItems[matchingItemIndex] = mergedItem;
  return nextItems;
}

function replaceAgentSessionItemAtIndex(
  items: readonly AgentSessionItemView[],
  itemIndex: number,
  nextItem: AgentSessionItemView,
): AgentSessionItemView[] {
  if (
    itemIndex < 0 ||
    itemIndex >= items.length ||
    items[itemIndex] === nextItem
  ) {
    return items as AgentSessionItemView[];
  }

  const nextItems = [...items];
  nextItems[itemIndex] = nextItem;
  return nextItems;
}

function replaceAgentSessionItemById(
  items: readonly AgentSessionItemView[],
  sessionItemId: string,
  updates: Partial<AgentSessionItemView>,
): AgentSessionItemView[] {
  const itemIndex = items.findIndex((item) => item.id === sessionItemId);
  if (itemIndex < 0) {
    return items as AgentSessionItemView[];
  }

  const existingItem = items[itemIndex]!;
  const nextItem = {
    ...existingItem,
    ...updates,
  };
  return areAgentSessionItemsEquivalent(existingItem, nextItem)
    ? (items as AgentSessionItemView[])
    : replaceAgentSessionItemAtIndex(items, itemIndex, nextItem);
}

function reconcileAgentSessionItem(
  items: readonly AgentSessionItemView[],
  optimisticItemId: string,
  resolvedItem: AgentSessionItemView,
): AgentSessionItemView[] {
  const optimisticItemIndex = items.findIndex(
    (item) => item.id === optimisticItemId,
  );
  const itemsWithoutOptimistic = removeAgentSessionItemById(
    items,
    optimisticItemId,
  );
  const matchingResolvedItemIndex = itemsWithoutOptimistic.findIndex((item) =>
    areAgentSessionItemsEquivalent(item, resolvedItem) ||
    areAgentSessionItemsLogicallyMatched(item, resolvedItem),
  );
  if (matchingResolvedItemIndex >= 0) {
    const existingItem = itemsWithoutOptimistic[matchingResolvedItemIndex]!;
    const mergedItem = mergeAgentSessionItemViews(existingItem, resolvedItem);
    if (mergedItem === existingItem) {
      return itemsWithoutOptimistic as AgentSessionItemView[];
    }

    return replaceAgentSessionItemAtIndex(
      itemsWithoutOptimistic,
      matchingResolvedItemIndex,
      mergedItem,
    );
  }

  if (
    optimisticItemIndex < 0 ||
    optimisticItemIndex >= itemsWithoutOptimistic.length
  ) {
    return [...itemsWithoutOptimistic, resolvedItem];
  }

  const nextItems = [...itemsWithoutOptimistic];
  nextItems.splice(optimisticItemIndex, 0, resolvedItem);
  return nextItems;
}

function buildOptimisticAgentSessionItem(
  agentSessionId: string,
  content: string,
  turnId: string,
  context?: WorkbenchAgentTurnSubmissionContext,
  options?: WorkbenchAgentTurnSubmissionOptions,
): AgentSessionItemView {
  const createdAt = new Date().toISOString();
  const randomToken = randomString(8);
  const submissionMetadata = buildAgentTurnSubmissionMetadata(context, options);
  const resources = options?.driveRefs?.map((driveRef): AgentSessionItemResourceView => ({
    id: driveRef.driveNodeId,
    kind: driveRef.resourceRole === 'attachment' ? 'file' : driveRef.resourceRole,
    uri: `drive://spaces/${encodeURIComponent(driveRef.driveSpaceId)}/nodes/${encodeURIComponent(driveRef.driveNodeId)}`,
  }));
  return {
    id: `${agentSessionId}:optimistic:${createdAt}:${randomToken}`,
    sessionId: agentSessionId,
    turnId,
    role: 'user',
    content,
    metadata: {
      ...submissionMetadata,
      optimistic: true,
      transient: true,
    },
    ...(resources?.length ? { resources } : {}),
    createdAt,
    timestamp: Date.parse(createdAt),
  };
}

function buildStreamingAgentSessionItem(
  optimisticItem: AgentSessionItemView,
): AgentSessionItemView {
  return {
    id: `${optimisticItem.id}:assistant-stream`,
    sessionId: optimisticItem.sessionId,
    turnId: optimisticItem.turnId,
    role: 'assistant',
    content: '',
    metadata: { transient: true },
    createdAt: optimisticItem.createdAt,
    timestamp: optimisticItem.timestamp,
  };
}

function buildAgentTurnSubmissionMetadata(
  context?: WorkbenchAgentTurnSubmissionContext,
  options?: WorkbenchAgentTurnSubmissionOptions,
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
  items: readonly AgentSessionItemView[],
  sessionItemId: string,
): AgentSessionItemView[] {
  let nextItems: AgentSessionItemView[] | null = null;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    if (item.id === sessionItemId) {
      if (!nextItems) {
        nextItems = items.slice(0, index) as AgentSessionItemView[];
      }
      continue;
    }

    nextItems?.push(item);
  }

  return nextItems ?? (items as AgentSessionItemView[]);
}

function rollbackOptimisticAgentSessionItems(
  agentSession: AgentSessionView,
  previousAgentSession: AgentSessionView | null,
  optimisticItem: AgentSessionItemView,
  streamingItemId: string,
): AgentSessionView {
  const items = removeAgentSessionItemById(
    removeAgentSessionItemById(agentSession.items, optimisticItem.id),
    streamingItemId,
  );
  const previousItemIds = new Set(
    previousAgentSession?.items.map((item) => item.id) ?? [],
  );
  const hasConcurrentItem = items.some(
    (item) => !previousItemIds.has(item.id),
  );
  const optimisticSortTimestamp = resolveAgentSessionItemActivitySortTimestamp(
    optimisticItem.createdAt,
  );
  const canRestoreOwnedActivity = !hasConcurrentItem;

  return {
    ...agentSession,
    items: items,
    runtimeStatus:
      canRestoreOwnedActivity && agentSession.runtimeStatus === 'streaming'
        ? previousAgentSession?.runtimeStatus
        : agentSession.runtimeStatus,
    updatedAt:
      canRestoreOwnedActivity && agentSession.updatedAt === optimisticItem.createdAt
        ? previousAgentSession?.updatedAt ?? agentSession.updatedAt
        : agentSession.updatedAt,
    lastTurnAt:
      canRestoreOwnedActivity && agentSession.lastTurnAt === optimisticItem.createdAt
        ? previousAgentSession?.lastTurnAt
        : agentSession.lastTurnAt,
    lastMessageAt:
      canRestoreOwnedActivity && agentSession.lastMessageAt === optimisticItem.createdAt
        ? previousAgentSession?.lastMessageAt
        : agentSession.lastMessageAt,
    lastUserActivityAt:
      canRestoreOwnedActivity && agentSession.lastUserActivityAt === optimisticItem.createdAt
        ? previousAgentSession?.lastUserActivityAt
        : agentSession.lastUserActivityAt,
    sortTimestamp:
      canRestoreOwnedActivity &&
      optimisticSortTimestamp !== undefined &&
      agentSession.sortTimestamp === optimisticSortTimestamp
        ? previousAgentSession?.sortTimestamp
        : agentSession.sortTimestamp,
    transcriptUpdatedAt:
      canRestoreOwnedActivity &&
      agentSession.transcriptUpdatedAt === optimisticItem.createdAt
        ? previousAgentSession?.transcriptUpdatedAt
        : agentSession.transcriptUpdatedAt,
  };
}

function findAgentSessionInCollection(
  projects: readonly AgentProjectView[],
  projectId: string,
  agentSessionId: string,
): AgentSessionView | null {
  const project = projects.find(
    (candidateProject) => candidateProject.projectId === projectId,
  );
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

function readProjectInventoryPage(
  projectService: ReturnType<typeof useIDEServices>['projectService'],
  request: AgentProjectPageRequest,
): Promise<AgentProjectViewPage> {
  return projectService.getProjectsPage(request);
}

function readProjectInventoryPageWithTimeout(
  projectService: ReturnType<typeof useIDEServices>['projectService'],
  request: AgentProjectPageRequest,
  timeoutMs: number = PROJECTS_FETCH_TIMEOUT_MS,
): Promise<AgentProjectViewPage> {
  const timeoutBoundary = createProjectsFetchTimeoutPromise(timeoutMs);
  return Promise.race([
    readProjectInventoryPage(projectService, request),
    timeoutBoundary.promise,
  ]).finally(() => {
    timeoutBoundary.clear();
  });
}

async function fetchProjects(
  store: ProjectsStore,
  projectService: ReturnType<typeof useIDEServices>['projectService'],
  pageRequest: AgentProjectPageRequest,
  mode: 'append' | 'replace',
): Promise<AgentProjectView[]> {
  const requestKey = `${mode}:${pageRequest.page}:${pageRequest.pageSize}`;
  if (store.inflight) {
    if (store.inflightKey === requestKey) {
      return store.inflight;
    }

    await store.inflight.catch(() => undefined);
    return fetchProjects(
      store,
      projectService,
      pageRequest,
      mode,
    );
  }

  updateProjectsStoreSnapshot(store, (previousSnapshot) => ({
    ...previousSnapshot,
    error: null,
    isLoading: true,
  }));

  const requestInventoryVersion = store.inventoryVersion;
  const request = readProjectInventoryPageWithTimeout(
    projectService,
    pageRequest,
    PROJECTS_FETCH_TIMEOUT_MS,
  )
    .then((page) => {
      if (store.inventoryVersion !== requestInventoryVersion) {
        updateProjectsStoreSnapshot(store, (previousSnapshot) => ({
          ...previousSnapshot,
          isLoading: false,
          pageInfo: null,
        }));
        return store.snapshot.projects;
      }

      const incomingProjects = normalizeProjectsForInventoryStore(
        filterProjectsForInventoryStore(store, page.items.filter(Boolean)),
      );
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
  // Defer eviction so a replacement subscriber can reuse in-flight inventory.
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
  workspaceId?: string | null;
}

export function useProjects(options?: UseProjectsOptions) {
  const { agentSessionService, projectService } = useIDEServices();
  const { sessionRevision, user } = useAuth();
  const normalizedUserScope = normalizeProjectsStoreUserScope(
    buildBirdCoderAuthSessionInventoryScope(user?.id, sessionRevision),
  );
  const shouldFetchOnMount = options?.fetchOnMount ?? true;
  const isActive = options?.isActive ?? true;
  const workspaceId = options?.workspaceId?.trim() ?? '';
  const pageRequest = useMemo<AgentProjectPageRequest>(
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
        workspaceId,
      };
    },
    [options?.limit, options?.offset, workspaceId],
  );
  const baseStoreScopeKey = workspaceId
    ? buildProjectsStoreScopeKey(normalizedUserScope, workspaceId)
    : '';
  const invalidateWorkspaceSessionInbox = useCallback(() => {
    if (!workspaceId) {
      return Promise.resolve();
    }
    return invalidateWorkspaceSessionInboxSynchronization({
      userScope: normalizedUserScope,
      workspaceId,
    });
  }, [normalizedUserScope, workspaceId]);
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
  useWorkspaceSessionInboxSynchronization({
    agentSessionService,
    isActive: isActive && isDefaultPagination && storeSnapshot.hasFetched,
    userScope: normalizedUserScope,
    workspaceId,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const projectSessionLoadInflightRef = useRef(
    new Map<string, ProjectSessionLoadInflightEntry>(),
  );

  useEffect(() => {
    const abortInflightSessionLoads = () => {
      for (const entry of projectSessionLoadInflightRef.current.values()) {
        entry.controller.abort(new DOMException(
          'Project Session inventory loading stopped.',
          'AbortError',
        ));
      }
      projectSessionLoadInflightRef.current.clear();
    };
    if (!isActive || !storeScopeKey) {
      abortInflightSessionLoads();
    }
    return abortInflightSessionLoads;
  }, [isActive, storeScopeKey]);

  useEffect(() => {
    if (!storeScopeKey) {
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
      void fetchProjects(
        store,
        projectService,
        pageRequest,
        'replace',
      ).catch(() => {
        // Error state is already propagated through the shared store snapshot.
      });
    }

    return () => {
      store.listeners.delete(handleStoreChange);
      disposeProjectsStoreIfUnused(storeScopeKey);
    };
  }, [
    projectService,
    shouldFetchOnMount,
    isActive,
    storeScopeKey,
    pageRequest,
  ]);

  const refreshProjects = useCallback(async () => {
    if (!storeScopeKey) {
      const emptySnapshot = createProjectsStoreSnapshot();
      setStoreSnapshot(emptySnapshot);
      return emptySnapshot.projects;
    }

    const store = getProjectsStore(storeScopeKey);
    return fetchProjects(
      store,
      projectService,
      pageRequest,
      'replace',
    );
  }, [
    projectService,
    storeScopeKey,
    pageRequest,
  ]);

  const loadMoreProjects = useCallback(async () => {
    if (!storeScopeKey) {
      return [];
    }

    const store = getProjectsStore(storeScopeKey);
    const pageInfo = store.snapshot.pageInfo;
    if (!pageInfo?.hasMore) {
      return store.snapshot.projects;
    }

    return fetchProjects(
      store,
      projectService,
      {
        page: (pageInfo.page ?? 1) + 1,
        pageSize: pageInfo.pageSize ?? pageRequest.pageSize,
        workspaceId,
      },
      'append',
    );
  }, [pageRequest.pageSize, projectService, storeScopeKey, workspaceId]);

  const loadMoreProjectSessions = useCallback(
    async (
      projectId: string,
      requestedCount: number,
    ): Promise<LoadMoreProjectSessionsResult> => {
      const normalizedProjectId = projectId.trim();
      const targetCount = normalizeProjectAgentSessionTargetCount(requestedCount);
      if (!storeScopeKey || !normalizedProjectId) {
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

      const controller = new AbortController();
      const request = (async (): Promise<LoadMoreProjectSessionsResult> => {
        const store = getProjectsStore(storeScopeKey);
        let project = store.snapshot.projects.find(
          (candidate) => candidate.projectId === normalizedProjectId,
        );
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
            controller.signal,
          );
          const currentProject = store.snapshot.projects.find(
            (candidate) => candidate.projectId === normalizedProjectId,
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
            upsertProjectIntoProjectsStoreByScopeKey(storeScopeKey, synchronized.project);
          }

          return {
            hasMore: synchronized.hasMore,
            loadedCount: synchronized.project.agentSessions.length,
          };
        }

        const currentProject = store.snapshot.projects.find(
          (candidate) => candidate.projectId === normalizedProjectId,
        );
        return {
          hasMore: currentProject !== undefined,
          loadedCount: currentProject?.agentSessions.length ?? 0,
        };
      })();

      const entry: ProjectSessionLoadInflightEntry = {
        controller,
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
      projectService,
      storeScopeKey,
    ],
  );

  useEffect(() => {
    if (
      !isActive ||
      !storeScopeKey ||
      !storeSnapshot.hasFetched ||
      storeSnapshot.isLoading ||
      storeSnapshot.error ||
      storeSnapshot.pageInfo !== null
    ) {
      return;
    }

    void fetchProjects(
      getProjectsStore(storeScopeKey),
      projectService,
      {
        page: 1,
        pageSize: pageRequest.pageSize,
        workspaceId,
      },
      'replace',
    ).catch(() => {
      // Error state is already propagated through the shared store snapshot.
    });
  }, [
    isActive,
    pageRequest.pageSize,
    projectService,
    storeScopeKey,
    storeSnapshot.error,
    storeSnapshot.hasFetched,
    storeSnapshot.isLoading,
    storeSnapshot.pageInfo,
    workspaceId,
  ]);

  const normalizedTargetProjectId = options?.targetProjectId?.trim() ?? '';
  const [targetResolutionRevision, setTargetResolutionRevision] = useState(0);
  const targetResolutionStateRef = useRef({
    key: '',
    pagesRequested: 0,
    lookupStatus: 'idle' as 'idle' | 'pending' | 'found' | 'missing' | 'failed',
  });
  const targetResolutionKey = `${normalizedUserScope}\u0001${workspaceId}\u0001${normalizedTargetProjectId}`;
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
    ? storeSnapshot.projects.some((project) => project.projectId === normalizedTargetProjectId)
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

        const store = getProjectsStore(storeScopeKey);
        if (
          !project ||
          project.workspaceId !== workspaceId ||
          filterProjectsForInventoryStore(store, [project]).length === 0
        ) {
          currentState.lookupStatus = 'missing';
          setTargetResolutionRevision((revision) => revision + 1);
          return;
        }

        currentState.lookupStatus = 'found';
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
    try {
      if (!workspaceId) {
        throw new Error('Select a Workspace before creating a Project.');
      }
      const newProject = await projectService.createProject(name, {
        ...options,
        workspaceId,
      });
      mutateProjectsStoreByScopeKey(baseStoreScopeKey, (projects) =>
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

  const ensureProject = async (name: string) => {
    if (!workspaceId) {
      throw new Error('Select a Workspace before importing a Project.');
    }
    const normalizedName = normalizeSearchValue(name);
    if (!normalizedName) {
      throw new Error('Project name is required.');
    }
    const loadedProject = storeSnapshot.projects.find(
      (project) => normalizeSearchValue(project.name) === normalizedName,
    );
    const existingProject = loadedProject
      ?? await projectService.getProjectByName(workspaceId, name);
    if (existingProject) {
      mutateProjectsStoreByScopeKey(baseStoreScopeKey, (projects) =>
        upsertProjectIntoCollection(projects, existingProject),
      );
      return {
        projectId: existingProject.projectId,
        reusedExistingProject: true,
      };
    }

    try {
      const createdProject = await createProject(name);
      return {
        projectId: createdProject.projectId,
        reusedExistingProject: false,
      };
    } catch (createError) {
      const concurrentlyCreatedProject = await projectService
        .getProjectByName(workspaceId, name)
        .catch(() => null);
      if (!concurrentlyCreatedProject) {
        throw createError;
      }
      mutateProjectsStoreByScopeKey(baseStoreScopeKey, (projects) =>
        upsertProjectIntoCollection(projects, concurrentlyCreatedProject),
      );
      return {
        projectId: concurrentlyCreatedProject.projectId,
        reusedExistingProject: true,
      };
    }
  };

  const importProject = async (
    options: Omit<ImportProjectOptions, 'workspaceId'>,
  ) => {
    try {
      if (!workspaceId) {
        throw new Error('Select a Workspace before importing a Project.');
      }
      const importedProject = await projectService.importProject({
        ...options,
        workspaceId,
      });
      mutateProjectsStoreByScopeKey(baseStoreScopeKey, (projects) =>
        upsertProjectIntoCollection(projects, importedProject),
        { invalidatePagination: true },
      );
      return importedProject;
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to import project';
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
      const project = storeSnapshot.projects.find(
        (candidate) => candidate.projectId === projectId,
      );
      if (!project) {
        throw new Error(`Agents project ${projectId} is not loaded.`);
      }
      const { runtimeBinding, session } = await createBoundAgentSession({
        createSession: () => agentSessionService.createSession({
          agentId: options.agentId,
          projectId: project.projectId,
          sourceContextId: project.projectId,
          sourceContextKind: 'agent-project',
          title,
        }),
        createRuntimeBinding: (createdSession) =>
          agentSessionService.createRuntimeBinding(createdSession.sessionId, {
            hostMode: options.hostMode ?? 'web',
            transportKind: 'sdk-stream',
            providerBindingId: options.providerBindingId,
            modelId: options.modelId,
            providerId: options.providerId,
            requestedAt: new Date().toISOString(),
          }),
        deleteCreatedSession: (createdSession) =>
          agentSessionService.deleteSession(createdSession.sessionId),
      });
      const agentSession = toAgentSessionView(session, {
        projectId: project.projectId,
        engineId: options.engineId,
        modelId: options.modelId,
        providerId: options.providerId,
        providerBindingId: options.providerBindingId,
        runtimeBindingId: runtimeBinding.runtimeBindingId,
        hostMode: options.hostMode ?? 'web',
        transportKind: 'sdk-stream',
      });
      mutateProjectsStoreByScopeKey(baseStoreScopeKey, (projects) =>
        upsertAgentSessionIntoCollection(projects, project.projectId, agentSession),
      );
      void invalidateWorkspaceSessionInbox();
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
      mutateProjectsStoreByScopeKey(baseStoreScopeKey, (projects) =>
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
      const projectPatch: Partial<AgentProjectView> = {
        ...(updates.name === undefined ? {} : { name: updates.name }),
        ...(updates.description === undefined ? {} : { description: updates.description }),
      };
      mutateProjectsStoreByScopeKey(baseStoreScopeKey, (projects) =>
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

  const archiveProject = async (projectId: string) => {
    try {
      await projectService.archiveProject(projectId);
      mutateProjectsStoreByScopeKey(baseStoreScopeKey, (projects) =>
        updateProjectInCollection(projects, projectId, { status: 'archived' }),
        { invalidatePagination: true },
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to archive project';
      updateProjectsStoreSnapshot(getProjectsStore(storeScopeKey), (previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
      throw error;
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      await projectService.deleteProject(projectId);
      removeProjectFromProjectsStore(baseStoreScopeKey, projectId);
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to remove project';
      setStoreSnapshot((previousSnapshot) => ({
        ...previousSnapshot,
        error: message,
      }));
      throw error;
    }
  };

  const renameAgentSession = async (
    projectId: string,
    agentSessionId: string,
    title: string,
  ) => {
    try {
      const updatedSession = await agentSessionService.updateSession(agentSessionId, { title });
      mutateProjectsStoreByScopeKey(baseStoreScopeKey, (projects) =>
        updateAgentSessionInCollection(projects, projectId, agentSessionId, (agentSession) => ({
          ...agentSession,
          title: updatedSession.title?.trim() || title,
          updatedAt: updatedSession.updatedAt,
        })),
      );
      void invalidateWorkspaceSessionInbox();
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
        const userState = await updateAgentSessionUserState(
          agentSessionService,
          agentSessionId,
          session,
          updates,
        );
        mutateProjectsStoreByScopeKey(baseStoreScopeKey, (projects) =>
          updateAgentSessionInCollection(projects, projectId, agentSessionId, (agentSession) => ({
            ...agentSession,
            pinned: Boolean(userState.pinnedAt),
            archived: session.status === 'archived' || Boolean(userState.hiddenAt),
            lastReadItemSequence: userState.lastReadItemSequence,
            unread:
              userState.lastReadItemSequence !== undefined
              && userState.lastReadItemSequence !== session.lastItemSequence,
          })),
        );
      }
      mutateProjectsStoreByScopeKey(baseStoreScopeKey, (projects) =>
        updateAgentSessionInCollection(projects, projectId, agentSessionId, (agentSession) => ({
          ...agentSession,
          ...updates,
          status: updates.status ?? agentSession.status,
          updatedAt: session.updatedAt,
        })),
      );
      void invalidateWorkspaceSessionInbox();
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
      const project = storeSnapshot.projects.find(
        (candidate) => candidate.projectId === projectId,
      );
      if (!project) {
        throw new Error(`Agents project ${projectId} is not loaded.`);
      }
      const [parentSession, parentTurnPage, runtimeBindingPage] = await Promise.all([
        agentSessionService.getSession(agentSessionId),
        agentSessionService.listTurns(agentSessionId, {
          page: 1,
          pageSize: 1,
          sort: '-sequence',
        }),
        agentSessionService.listRuntimeBindings(agentSessionId, { page: 1, pageSize: 20 }),
      ]);
      const lastTurn = parentTurnPage.items[0];
      if (parentSession.projectId?.trim() !== project.projectId) {
        throw new Error(
          `Agent session ${agentSessionId} does not belong to Agents project ${project.projectId}.`,
        );
      }
      const currentBinding = runtimeBindingPage.items.find((binding) => binding.isCurrent);
      const createForkedSession = () => agentSessionService.createSession({
        agentId: parentSession.agentId,
        forkedFromTurnId: lastTurn?.turnId,
        parentSessionId: parentSession.sessionId,
        projectId: project.projectId,
        sourceContextId: project.projectId,
        sourceContextKind: 'agent-project',
        title: newTitle?.trim() || `${parentSession.title?.trim() || 'Session'} (fork)`,
      });
      const provisionedFork = currentBinding
        ? await createBoundAgentSession({
            createSession: createForkedSession,
            createRuntimeBinding: (createdSession) =>
              agentSessionService.createRuntimeBinding(createdSession.sessionId, {
                runtimeLocationId: currentBinding.runtimeLocationId ?? undefined,
                hostMode: currentBinding.hostMode,
                transportKind: currentBinding.transportKind,
                providerBindingId: currentBinding.providerBindingId,
                modelId: currentBinding.modelId,
                providerId: currentBinding.providerId,
                providerParentSessionId: currentBinding.providerSessionId ?? undefined,
                providerForkedFromSessionId: currentBinding.providerSessionId ?? undefined,
                requestedAt: new Date().toISOString(),
              }),
            deleteCreatedSession: (createdSession) =>
              agentSessionService.deleteSession(createdSession.sessionId),
          })
        : {
            runtimeBinding: null,
            session: await createForkedSession(),
          };
      const forkedSession = provisionedFork.session;
      const forkedRuntimeBinding = provisionedFork.runtimeBinding ?? currentBinding;
      const agentSession = toAgentSessionView(forkedSession, {
        projectId: project.projectId,
        engineId: project.agentSessions.find((candidate) => candidate.id === agentSessionId)?.engineId,
        modelId: forkedRuntimeBinding?.modelId,
        providerId: forkedRuntimeBinding?.providerId,
        providerBindingId: forkedRuntimeBinding?.providerBindingId,
        runtimeBindingId: forkedRuntimeBinding?.runtimeBindingId,
        hostMode:
          forkedRuntimeBinding?.hostMode === 'desktop'
          || forkedRuntimeBinding?.hostMode === 'server'
          ? forkedRuntimeBinding.hostMode
          : 'web',
        transportKind: forkedRuntimeBinding?.transportKind,
        providerSessionId: forkedRuntimeBinding?.providerSessionId ?? undefined,
        runtimeLocationId: forkedRuntimeBinding?.runtimeLocationId ?? undefined,
        runtimeBindingStatus: forkedRuntimeBinding?.status,
      });
      mutateProjectsStoreByScopeKey(baseStoreScopeKey, (projects) =>
        upsertAgentSessionIntoCollection(projects, project.projectId, agentSession),
      );
      void invalidateWorkspaceSessionInbox();
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
      mutateProjectsStoreByScopeKey(baseStoreScopeKey, (projects) =>
        removeAgentSessionFromCollection(projects, projectId, agentSessionId),
      );
      void invalidateWorkspaceSessionInbox();
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

  const updateAgentSessionRuntimeStatus = useCallback((
    projectId: string,
    agentSessionId: string,
    runtimeStatus: AgentSessionView['runtimeStatus'],
  ) => {
    const activityAt = new Date().toISOString();
    mutateProjectsStoreByScopeKey(baseStoreScopeKey, (projects) =>
      updateAgentSessionInCollection(projects, projectId, agentSessionId, (agentSession) => {
        if (agentSession.runtimeStatus === runtimeStatus) {
          return agentSession;
        }
        const requiresAttention =
          runtimeStatus === 'awaiting_approval' || runtimeStatus === 'awaiting_user';
        return {
          ...agentSession,
          runtimeStatus,
          lastRuntimeEventAt: activityAt,
          lastAttentionAt: requiresAttention ? activityAt : agentSession.lastAttentionAt,
        };
      }),
    );
  }, [baseStoreScopeKey]);

  const editAgentSessionItem = async (
    _projectId: string,
    _agentSessionId: string,
    _sessionItemId: string,
    _updates: Partial<AgentSessionItemView>,
  ) => {
    throw new Error('Agents session items are immutable and cannot be edited in place.');
  };

  const deleteAgentSessionItem = async (
    _projectId: string,
    _agentSessionId: string,
    _sessionItemId: string,
  ) => {
    throw new Error('Agents session items are immutable and cannot be deleted in place.');
  };

  const submitAgentTurnInput = async (
    projectId: string,
    agentSessionId: string,
    content: string,
    context?: WorkbenchAgentTurnSubmissionContext,
    options?: WorkbenchAgentTurnSubmissionOptions,
  ) => {
    const selectedSession = findAgentSessionInCollection(
      storeScopeKey
        ? getProjectsStore(storeScopeKey).snapshot.projects
        : storeSnapshot.projects,
      projectId,
      agentSessionId,
    );
    if (!selectedSession) {
      throw new Error(`Agent session ${agentSessionId} is not loaded for project ${projectId}.`);
    }
    const runtimeBindingId = selectedSession.runtimeBindingId?.trim();
    if (!runtimeBindingId) {
      throw new Error(
        `Agent session ${agentSessionId} does not have an active runtime binding.`,
      );
    }

    const turnId = `turn.${uuid()}`;
    const optimisticItem = buildOptimisticAgentSessionItem(
      agentSessionId,
      content,
      turnId,
      context,
      options,
    );
    const streamingItem = buildStreamingAgentSessionItem(optimisticItem);
    const streamPresentation = createAgentTurnStreamPresentation((assistantContent) => {
      mutateProjectsStoreByScopeKey(baseStoreScopeKey, (projects) =>
        updateAgentSessionInCollection(projects, projectId, agentSessionId, (agentSession) => {
          const items = appendAgentSessionItemIfMissing(
            agentSession.items,
            streamingItem,
          );
          return {
            ...agentSession,
            items: replaceAgentSessionItemById(items, streamingItem.id, {
              content: assistantContent,
            }),
          };
        }),
      );
    });
    let didAuthorityAcceptTurn = false;
    let shouldPreserveOptimisticTurn = false;
    let previousAgentSession: AgentSessionView | null = null;
    mutateProjectsStoreByScopeKey(baseStoreScopeKey, (projects) =>
      updateAgentSessionInCollection(projects, projectId, agentSessionId, (agentSession) => {
        previousAgentSession = agentSession;
        return {
          ...agentSession,
          items: appendAgentSessionItemIfMissing(agentSession.items, optimisticItem),
          runtimeStatus: 'streaming',
          updatedAt: optimisticItem.createdAt,
          lastTurnAt: optimisticItem.createdAt,
          lastMessageAt: optimisticItem.createdAt,
          lastUserActivityAt: optimisticItem.createdAt,
          sortTimestamp:
            resolveAgentSessionItemActivitySortTimestamp(optimisticItem.createdAt)
            ?? agentSession.sortTimestamp,
          transcriptUpdatedAt: optimisticItem.createdAt,
        };
      }),
    );
    try {
      const completed = await agentSessionService.submitTurn(agentSessionId, {
        content,
        contentType: 'text/plain',
        ...(options?.driveRefs?.length ? { driveRefs: [...options.driveRefs] } : {}),
        requestedModelId: selectedSession.modelId === 'auto'
          ? undefined
          : selectedSession.modelId,
        runtimeBindingId,
        turnId,
        turnMode: 'interactive',
      }, {
        agentId: selectedSession.agentId,
        onAccepted: () => {
          didAuthorityAcceptTurn = true;
          shouldPreserveOptimisticTurn = true;
          void invalidateWorkspaceSessionInbox();
        },
        onDeliveryUncertain: () => {
          shouldPreserveOptimisticTurn = true;
          void invalidateWorkspaceSessionInbox();
        },
        onDelta: ({ content: assistantContent }) => {
          streamPresentation.update(assistantContent);
        },
      });
      streamPresentation.close();
      const submittedItems = toAgentSessionTranscriptItemViews(
        completed.items,
        selectedSession,
      );
      const activityAt = completed.turn.completedAt ?? completed.turn.updatedAt;
      mutateProjectsStoreByScopeKey(baseStoreScopeKey, (projects) =>
        updateAgentSessionInCollection(projects, projectId, agentSessionId, (agentSession) => {
          const resolvedUserItem = submittedItems.find((item) => item.role === 'user');
          const itemsWithoutStream = removeAgentSessionItemById(
            agentSession.items,
            streamingItem.id,
          );
          const reconciledItems = resolvedUserItem
            ? reconcileAgentSessionItem(itemsWithoutStream, optimisticItem.id, resolvedUserItem)
            : removeAgentSessionItemById(itemsWithoutStream, optimisticItem.id);
          return {
            ...agentSession,
            items: submittedItems.reduce(
              (items, item) => appendAgentSessionItemIfMissing(items, item),
              reconciledItems,
            ),
            runtimeStatus:
              completed.turn.status === 'failed' || completed.turn.status === 'cancelled'
                ? 'failed'
                : 'ready',
            updatedAt: activityAt,
            lastTurnAt: activityAt,
            lastMessageAt: activityAt,
            lastUserActivityAt: activityAt,
            sortTimestamp:
              resolveAgentSessionItemActivitySortTimestamp(activityAt) ?? agentSession.sortTimestamp,
            transcriptUpdatedAt: activityAt,
          };
        }),
      );
      if (didAuthorityAcceptTurn) {
        void invalidateWorkspaceSessionInbox();
      }
      return submittedItems.find((item) => item.role === 'user') ?? submittedItems.at(-1);
    } catch (error: unknown) {
      streamPresentation.close();
      if (!shouldPreserveOptimisticTurn) {
        mutateProjectsStoreByScopeKey(baseStoreScopeKey, (projects) =>
          updateAgentSessionInCollection(projects, projectId, agentSessionId, (agentSession) =>
            rollbackOptimisticAgentSessionItems(
              agentSession,
              previousAgentSession,
              optimisticItem,
              streamingItem.id,
            ),
          ),
        );
      }
      if (shouldPreserveOptimisticTurn) {
        void invalidateWorkspaceSessionInbox();
      }
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
    ensureProject,
    importProject,
    createAgentSession,
    renameProject,
    updateProject,
    archiveProject,
    deleteProject,
    renameAgentSession,
    updateAgentSession,
    updateAgentSessionRuntimeStatus,
    forkAgentSession,
    deleteAgentSession,
    editAgentSessionItem,
    deleteAgentSessionItem,
    submitAgentTurnInput,
    loadMoreProjects,
    loadMoreProjectSessions,
    refreshProjects,
  };
}
