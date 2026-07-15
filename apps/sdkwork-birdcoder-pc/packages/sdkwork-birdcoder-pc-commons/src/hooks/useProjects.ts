import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { randomString } from '@sdkwork/utils/id';
import { DEFAULT_LIST_PAGE_SIZE } from '@sdkwork/utils/pagination';
import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderCodingSessionTurnIdeContext,
  BirdCoderProject,
} from '@sdkwork/birdcoder-pc-types';
import {
  areBirdCoderChatMessagesEquivalent,
  areBirdCoderChatMessagesLogicallyMatched,
  mergeBirdCoderComparableChatMessages,
  stringifyBirdCoderLongInteger,
} from '@sdkwork/birdcoder-pc-types';
import {
  canSubscribeBirdCoderWorkspaceRealtime,
  subscribeBirdCoderWorkspaceRealtime,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';
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
  BirdCoderServiceListPage,
  BirdCoderServicePageRequest,
  CreateCodingSessionOptions,
  CreateProjectOptions,
  UpdateCodingSessionOptions,
  UpdateProjectOptions,
} from '../services/interfaces/IProjectService.ts';
import {
  synchronizeProjectSessionsFromAuthority,
  synchronizeProjectsSessionsFromAuthority,
} from '../workbench/projectSessionSynchronization.ts';

export interface LoadMoreProjectSessionsResult {
  hasMore: boolean;
  loadedCount: number;
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
    : stringifyBirdCoderLongInteger(parsedTimestamp);
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
interface BirdCoderSendMessageOptions {
  metadata?: Record<string, unknown>;
}
const WORKSPACE_REALTIME_EVENT_DEDUP_LIMIT = 256;
const EMPTY_PROJECT_INVENTORY_MESSAGES: BirdCoderChatMessage[] = [];
const EMPTY_FILTERED_PROJECT_CODING_SESSIONS: BirdCoderCodingSession[] = [];
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

  const nextMessages = [...messages];
  nextMessages[matchingMessageIndex] = mergedMessage;
  return nextMessages;
}

function replaceCodingSessionMessageAtIndex(
  messages: readonly BirdCoderChatMessage[],
  messageIndex: number,
  nextMessage: BirdCoderChatMessage,
): BirdCoderChatMessage[] {
  if (
    messageIndex < 0 ||
    messageIndex >= messages.length ||
    messages[messageIndex] === nextMessage
  ) {
    return messages as BirdCoderChatMessage[];
  }

  const nextMessages = [...messages];
  nextMessages[messageIndex] = nextMessage;
  return nextMessages;
}

function replaceCodingSessionMessageById(
  messages: readonly BirdCoderChatMessage[],
  messageId: string,
  updates: Partial<BirdCoderChatMessage>,
): BirdCoderChatMessage[] {
  const messageIndex = messages.findIndex((message) => message.id === messageId);
  if (messageIndex < 0) {
    return messages as BirdCoderChatMessage[];
  }

  const existingMessage = messages[messageIndex]!;
  const nextMessage = {
    ...existingMessage,
    ...updates,
  };
  return areBirdCoderChatMessagesEquivalent(existingMessage, nextMessage)
    ? (messages as BirdCoderChatMessage[])
    : replaceCodingSessionMessageAtIndex(messages, messageIndex, nextMessage);
}

function reconcileCodingSessionMessage(
  messages: readonly BirdCoderChatMessage[],
  optimisticMessageId: string,
  resolvedMessage: BirdCoderChatMessage,
): BirdCoderChatMessage[] {
  const optimisticMessageIndex = messages.findIndex(
    (message) => message.id === optimisticMessageId,
  );
  const messagesWithoutOptimistic = removeCodingSessionMessageById(
    messages,
    optimisticMessageId,
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

    return replaceCodingSessionMessageAtIndex(
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

function buildOptimisticCodingSessionMessage(
  codingSessionId: string,
  content: string,
  context?: BirdCoderSendMessageContext,
  options?: BirdCoderSendMessageOptions,
): BirdCoderChatMessage {
  const createdAt = new Date().toISOString();
  const randomToken = randomString(8);
  return {
    id: `${codingSessionId}:optimistic:${createdAt}:${randomToken}`,
    codingSessionId,
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

function removeCodingSessionMessageById(
  messages: readonly BirdCoderChatMessage[],
  messageId: string,
): BirdCoderChatMessage[] {
  let nextMessages: BirdCoderChatMessage[] | null = null;
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!;
    if (message.id === messageId) {
      if (!nextMessages) {
        nextMessages = messages.slice(0, index) as BirdCoderChatMessage[];
      }
      continue;
    }

    nextMessages?.push(message);
  }

  return nextMessages ?? (messages as BirdCoderChatMessage[]);
}

function rollbackOptimisticCodingSessionMessage(
  codingSession: BirdCoderCodingSession,
  previousCodingSession: BirdCoderCodingSession | null,
  optimisticMessage: BirdCoderChatMessage,
): BirdCoderCodingSession {
  const messages = removeCodingSessionMessageById(
    codingSession.messages,
    optimisticMessage.id,
  );
  const previousMessageIds = new Set(
    previousCodingSession?.messages.map((message) => message.id) ?? [],
  );
  const hasConcurrentMessage = messages.some(
    (message) => !previousMessageIds.has(message.id),
  );
  const optimisticSortTimestamp = resolveMessageActivitySortTimestamp(
    optimisticMessage.createdAt,
  );
  const canRestoreOwnedActivity = !hasConcurrentMessage;

  return {
    ...codingSession,
    messages,
    runtimeStatus:
      canRestoreOwnedActivity && codingSession.runtimeStatus === 'streaming'
        ? previousCodingSession?.runtimeStatus
        : codingSession.runtimeStatus,
    updatedAt:
      canRestoreOwnedActivity && codingSession.updatedAt === optimisticMessage.createdAt
        ? previousCodingSession?.updatedAt ?? codingSession.updatedAt
        : codingSession.updatedAt,
    lastTurnAt:
      canRestoreOwnedActivity && codingSession.lastTurnAt === optimisticMessage.createdAt
        ? previousCodingSession?.lastTurnAt
        : codingSession.lastTurnAt,
    sortTimestamp:
      canRestoreOwnedActivity &&
      optimisticSortTimestamp !== undefined &&
      codingSession.sortTimestamp === optimisticSortTimestamp
        ? previousCodingSession?.sortTimestamp
        : codingSession.sortTimestamp,
    transcriptUpdatedAt:
      canRestoreOwnedActivity &&
      codingSession.transcriptUpdatedAt === optimisticMessage.createdAt
        ? previousCodingSession?.transcriptUpdatedAt
        : codingSession.transcriptUpdatedAt,
  };
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

function isRecoverableCodingSessionMirrorSendError(
  error: unknown,
  projectId: string,
  codingSessionId: string,
): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalizedMessage = message.toLowerCase();
  if (!normalizedMessage.includes('not found')) {
    return false;
  }

  const normalizedProjectId = projectId.trim().toLowerCase();
  const normalizedCodingSessionId = codingSessionId.trim().toLowerCase();
  return (
    (normalizedCodingSessionId.length > 0 &&
      normalizedMessage.includes(normalizedCodingSessionId)) ||
    normalizedMessage.includes('coding session projection') ||
    normalizedMessage.includes('coding session') ||
    normalizedMessage.includes('coding-session') ||
    (normalizedProjectId.length > 0 && normalizedMessage.includes(normalizedProjectId))
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
  mode: 'append' | 'replace' = 'replace',
  appRuntimeReadService?: ReturnType<typeof useIDEServices>['appRuntimeReadService'],
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
      appRuntimeReadService,
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
      let incomingProjects = fetchedProjects;
      if (appRuntimeReadService) {
        try {
          incomingProjects = await synchronizeProjectsSessionsFromAuthority({
            appRuntimeReadService,
            projects: fetchedProjects,
            projectService,
            workspaceId,
          });
        } catch (error) {
          console.warn('Failed to synchronize project session inventory from runtime authority', error);
        }
      }
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
      // A mutation or realtime event may have invalidated this request while it
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

function scheduleProjectsRefresh(
  scopeKey: string,
  workspaceId: string,
  projectService: ReturnType<typeof useIDEServices>['projectService'],
  appRuntimeReadService?: ReturnType<typeof useIDEServices>['appRuntimeReadService'],
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
    void fetchProjectsForWorkspace(
      store,
      normalizedWorkspaceId,
      projectService,
      {
        page: 1,
        pageSize: store.snapshot.pageInfo?.pageSize ?? DEFAULT_LIST_PAGE_SIZE,
      },
      'replace',
      appRuntimeReadService,
    ).catch(() => {
      // Error state is already propagated through the shared store snapshot.
    });
  }, trigger === 'realtime' ? 120 : 0);
}

function createProjectsStoreRealtimeBinding(
  scopeKey: string,
  workspaceId: string,
  store: ProjectsStore,
  projectService: ReturnType<typeof useIDEServices>['projectService'],
  appRuntimeReadService?: ReturnType<typeof useIDEServices>['appRuntimeReadService'],
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
          store.inventoryVersion += 1;
          updateProjectsStoreSnapshot(store, (previousSnapshot) => ({
            ...previousSnapshot,
            error: null,
            hasFetched: true,
            pageInfo: null,
            projects: nextProjects,
          }));
          }
          return;
        }

        if (isWorkspaceRealtimeEventSatisfiedByProjects(store.snapshot.projects, event)) {
          return;
        }

        scheduleProjectsRefresh(
          scopeKey,
          workspaceId,
          projectService,
          appRuntimeReadService,
          'realtime',
        );
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
  appRuntimeReadService?: ReturnType<typeof useIDEServices>['appRuntimeReadService'],
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
    appRuntimeReadService,
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
  limit?: number;
  offset?: number;
  targetProjectId?: string | null;
}

export function useProjects(workspaceId?: string, options?: UseProjectsOptions) {
  const { appRuntimeReadService, projectService } = useIDEServices();
  const { user } = useAuth();
  const normalizedUserScope = normalizeProjectsStoreUserScope(user?.id);
  const normalizedWorkspaceId = workspaceId?.trim() ?? '';
  const shouldEnableRealtime = options?.enableRealtime ?? true;
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
    if (shouldEnableRealtime) {
      ensureProjectsStoreRealtime(
        storeScopeKey,
        normalizedWorkspaceId,
        projectService,
        appRuntimeReadService,
      );
    }

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
        appRuntimeReadService,
      ).catch(() => {
        // Error state is already propagated through the shared store snapshot.
      });
    }

    return () => {
      store.listeners.delete(handleStoreChange);
      disposeProjectsStoreRealtimeIfUnused(storeScopeKey);
    };
  }, [
    normalizedWorkspaceId,
    appRuntimeReadService,
    projectService,
    shouldEnableRealtime,
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
      appRuntimeReadService,
    );
  }, [
    appRuntimeReadService,
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
      appRuntimeReadService,
    );
  }, [appRuntimeReadService, normalizedWorkspaceId, projectService, storeScopeKey]);

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
        if (!project || !appRuntimeReadService) {
          return {
            hasMore: false,
            loadedCount: project?.codingSessions.length ?? 0,
          };
        }

        for (let attempt = 0; attempt < 2; attempt += 1) {
          const requestInventoryVersion = store.inventoryVersion;
          const synchronized = await synchronizeProjectSessionsFromAuthority({
            appRuntimeReadService,
            project,
            projectService,
            // Keep one hidden sentinel row so the sidebar can distinguish
            // "exactly at the end" from "the next page has not been loaded".
            sessionLimit: Math.min(200_000, targetCount + 1),
          });
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
            hasMore: synchronized.hasMoreSessions,
            loadedCount: synchronized.loadedSessionCount,
          };
        }

        const currentProject = store.snapshot.projects.find(
          (candidate) => candidate.id === normalizedProjectId,
        );
        return {
          hasMore: currentProject !== undefined,
          loadedCount: currentProject?.codingSessions.length ?? 0,
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
      appRuntimeReadService,
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
      appRuntimeReadService,
    ).catch(() => {
      // Error state is already propagated through the shared store snapshot.
    });
  }, [
    isActive,
    appRuntimeReadService,
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

  const synchronizeProjectSessionInBackground = (
    projectId: string,
    codingSessionId: string,
    onMissingProject?: () => void,
  ): void => {
    void resolveSynchronizedProjectSession(projectId, codingSessionId)
      .then((synchronizedProjectSession) => {
        if (synchronizedProjectSession?.project) {
          upsertProjectIntoProjectsStore(
            synchronizedProjectSession.project.workspaceId,
            synchronizedProjectSession.project,
            normalizedUserScope,
          );
          return;
        }

        onMissingProject?.();
      });
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
          sortTimestamp:
            resolveMessageActivitySortTimestamp(newMessage.createdAt) ??
            codingSession.sortTimestamp,
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
          messages: replaceCodingSessionMessageById(
            codingSession.messages,
            messageId,
            editableUpdates,
          ),
          updatedAt,
          sortTimestamp:
            resolveMessageActivitySortTimestamp(updatedAt) ?? codingSession.sortTimestamp,
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
          messages: removeCodingSessionMessageById(
            codingSession.messages,
            messageId,
          ),
          updatedAt,
          sortTimestamp:
            resolveMessageActivitySortTimestamp(updatedAt) ?? codingSession.sortTimestamp,
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
    options?: BirdCoderSendMessageOptions,
  ) => {
    const sendProjects = storeScopeKey
      ? getProjectsStore(storeScopeKey).snapshot.projects
      : storeSnapshot.projects;
    const previousCodingSession = findCodingSessionInCollection(
      sendProjects,
      projectId,
      codingSessionId,
    );
    const optimisticMessage = buildOptimisticCodingSessionMessage(
      codingSessionId,
      content,
      context,
      options,
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
        sortTimestamp:
          resolveMessageActivitySortTimestamp(optimisticMessage.createdAt) ??
          codingSession.sortTimestamp,
        transcriptUpdatedAt: optimisticMessage.createdAt,
      })),
    );

    try {
      let preSendMirrorUpsert: Promise<void> | null = null;
      if (previousCodingSession && projectService.upsertCodingSession) {
        const previousProject = sendProjects.find(
          (candidateProject) => candidateProject.id === projectId,
        );
        const mirrorCodingSession = {
          ...previousCodingSession,
          projectId: previousCodingSession.projectId?.trim() || projectId,
          workspaceId:
            previousCodingSession.workspaceId?.trim() ||
            previousProject?.workspaceId?.trim() ||
            normalizedWorkspaceId,
        };
        preSendMirrorUpsert = projectService.upsertCodingSession(projectId, mirrorCodingSession).catch((error) => {
          console.warn(
            `Failed to synchronize coding session "${codingSessionId}" mirror before sending`,
            error,
          );
          throw error;
        });
        void preSendMirrorUpsert.catch(() => undefined);
      }

      let newMessage: BirdCoderChatMessage;
      try {
        newMessage = await projectService.addCodingSessionMessage(projectId, codingSessionId, {
          role: 'user',
          content,
          metadata: buildSendMessageMetadata(context, options),
        });
      } catch (error) {
        if (
          !preSendMirrorUpsert ||
          !isRecoverableCodingSessionMirrorSendError(error, projectId, codingSessionId)
        ) {
          throw error;
        }

        try {
          await preSendMirrorUpsert;
        } catch {
          throw error;
        }

        newMessage = await projectService.addCodingSessionMessage(projectId, codingSessionId, {
          role: 'user',
          content,
          metadata: buildSendMessageMetadata(context, options),
        });
      }
      const effectiveCodingSessionId = newMessage.codingSessionId.trim() || codingSessionId;
      if (effectiveCodingSessionId !== codingSessionId) {
        synchronizeProjectSessionInBackground(projectId, effectiveCodingSessionId, () => {
          mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
            updateCodingSessionInCollection(projects, projectId, codingSessionId, (codingSession) =>
              rollbackOptimisticCodingSessionMessage(
                codingSession,
                previousCodingSession,
                optimisticMessage,
              ),
            ),
          );
        });
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
        })),
      );
      return newMessage;
    } catch (error: unknown) {
      mutateProjectsStore(normalizedUserScope, normalizedWorkspaceId, (projects) =>
        updateCodingSessionInCollection(projects, projectId, codingSessionId, (codingSession) =>
          rollbackOptimisticCodingSessionMessage(
            codingSession,
            previousCodingSession,
            optimisticMessage,
          ),
        ),
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
    loadMoreProjects,
    loadMoreProjectSessions,
    refreshProjects,
  };
}
