import type {
  AgentSessionItemView,
  AgentSessionPageInfoView,
  AgentSessionView,
  AgentProjectView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  deduplicateAgentSessionItemViews,
  mergeLatestAgentSessionItems,
} from '@sdkwork/birdcoder-pc-contracts-commons';
export { mergeLatestAgentSessionItems } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import type { IProjectService } from '../services/interfaces/IProjectService.ts';
import {
  loadAgentSessionView,
  toAgentSessionViewFromActivitySummary,
  toAgentSessionTranscriptItemViews,
  type AgentSessionActivitySummaryRecord,
  type AgentSessionItemRecord,
  type AgentSessionRecord,
} from '../services/agentSessionViewModels.ts';
import {
  canApplyAgentSessionTombstone,
  canCommitAgentSessionToProjectsStore,
  recordAgentSessionTombstoneInProjectsStore,
  removeAgentSessionFromCollection,
  updateAgentSessionInCollection,
  upsertAgentSessionIntoCollection,
  upsertProjectIntoCollection,
} from '../stores/projectsStore.ts';
import {
  normalizeAgentSessionActivityCursor,
  shouldApplyAgentSessionActivitySummary,
  validateAgentSessionActivitySummary,
} from './workspaceSessionInboxSync.ts';

const AGENT_SESSION_ITEM_PAGE_SIZE = 20;
const PROJECT_SESSION_ACTIVITY_PAGE_SIZE = 200;
const DEFAULT_AGENT_REFRESH_TIMEOUT_MS = 30_000;
const MAX_AGENT_REFRESH_TIMEOUT_MS = 300_000;

export interface RefreshProjectSessionsOptions {
  agentSessionService: IAgentSessionService;
  projectId: string;
  projectService: IProjectService;
  refreshTimeoutMs?: number;
  signal?: AbortSignal;
}

export interface ResolvedAgentSessionLocation {
  agentSession?: AgentSessionView;
  project: AgentProjectView;
}

export interface RefreshAgentSessionItemsOptions {
  agentSessionService: IAgentSessionService;
  agentSessionId: string;
  refreshTimeoutMs?: number;
  resolvedLocation?: ResolvedAgentSessionLocation;
  signal?: AbortSignal;
}

export interface LoadEarlierAgentSessionItemsOptions {
  agentSessionService: IAgentSessionService;
  agentSession: AgentSessionView;
  refreshTimeoutMs?: number;
  signal?: AbortSignal;
}

export interface RefreshProjectSessionsResult {
  deletedSessionIds: string[];
  deletedSessionTombstones: AgentSessionView[];
  sessionIds: string[];
  projectIds: string[];
  projects?: AgentProjectView[];
  source: 'agents';
  status: 'failed' | 'refreshed';
}

export interface RefreshAgentSessionItemsResult {
  agentSessionId: string;
  agentSession?: AgentSessionView;
  itemCount: number;
  projectId: string;
  source: 'agents';
  status: 'failed' | 'not-found' | 'refreshed';
}

export interface LoadEarlierAgentSessionItemsResult {
  agentSession: AgentSessionView;
  loadedItemCount: number;
  projectId: string;
  source: 'agents';
  status: 'complete' | 'loaded';
}

export interface AgentSessionItemsRefreshScope {
  agentSessionId: string;
  identityScope: string;
  projectId: string;
}

function normalizeRefreshScopePart(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required for Agents session item refresh.`);
  }
  return normalized;
}

export function buildAgentSessionItemsRefreshScopeKey(
  scope: AgentSessionItemsRefreshScope,
): string {
  return [
    normalizeRefreshScopePart(scope.identityScope, 'Identity scope'),
    normalizeRefreshScopePart(scope.projectId, 'Agents project id'),
    normalizeRefreshScopePart(scope.agentSessionId, 'Agent session id'),
  ].join('\u0001');
}

function normalizeRefreshTimeoutMs(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined) {
    return DEFAULT_AGENT_REFRESH_TIMEOUT_MS;
  }
  if (
    !Number.isSafeInteger(timeoutMs)
    || timeoutMs <= 0
    || timeoutMs > MAX_AGENT_REFRESH_TIMEOUT_MS
  ) {
    throw new RangeError(
      `Agents refresh timeout must be an integer between 1 and ${MAX_AGENT_REFRESH_TIMEOUT_MS} ms.`,
    );
  }
  return timeoutMs;
}

function withAgentRefreshTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number | undefined,
  label: string,
  externalSignal?: AbortSignal,
): Promise<T> {
  const resolvedTimeoutMs = normalizeRefreshTimeoutMs(timeoutMs);
  const controller = new AbortController();
  const externalAbortSignal = externalSignal;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let externalAbortHandler: (() => void) | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      const error = new Error(`${label} timed out after ${resolvedTimeoutMs} ms.`);
      controller.abort(error);
      reject(error);
    }, resolvedTimeoutMs);
  });
  const aborted = new Promise<never>((_resolve, reject) => {
    if (!externalAbortSignal) {
      return;
    }
    if (externalAbortSignal.aborted) {
      controller.abort(externalAbortSignal.reason);
      reject(externalAbortSignal.reason ?? new Error('Request aborted.'));
      return;
    }
    externalAbortHandler = () => {
      controller.abort(externalAbortSignal.reason);
      reject(externalAbortSignal.reason ?? new Error('Request aborted.'));
    };
    externalAbortSignal.addEventListener('abort', externalAbortHandler, { once: true });
  });
  return Promise.race([operation(controller.signal), timeout, aborted]).finally(() => {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
    if (externalAbortHandler) {
      externalAbortSignal?.removeEventListener('abort', externalAbortHandler);
    }
  });
}

function normalizeOffsetPageInfo(
  pageInfo: Awaited<ReturnType<IAgentSessionService['listSessions']>>['pageInfo'],
  requestedPage: number,
  requestedPageSize: number,
  label: string,
): AgentSessionPageInfoView {
  const page = pageInfo.page ?? requestedPage;
  const pageSize = pageInfo.pageSize ?? requestedPageSize;
  if (pageInfo.mode !== 'offset' || page !== requestedPage) {
    throw new Error(`${label} returned pagination metadata for an unexpected page.`);
  }
  if (pageSize !== requestedPageSize) {
    throw new Error(`${label} returned page size ${pageSize} while ${requestedPageSize} was requested.`);
  }
  return { hasMore: pageInfo.hasMore === true, page, pageSize };
}

function validateLoadedItemPageInfo(
  pageInfo: AgentSessionPageInfoView,
  label: string,
): AgentSessionPageInfoView {
  if (!Number.isSafeInteger(pageInfo.page) || pageInfo.page < 1) {
    throw new Error(`${label} has an invalid current page.`);
  }
  if (pageInfo.pageSize !== AGENT_SESSION_ITEM_PAGE_SIZE) {
    throw new Error(
      `${label} has page size ${pageInfo.pageSize}; expected ${AGENT_SESSION_ITEM_PAGE_SIZE}.`,
    );
  }
  return pageInfo;
}

function normalizeSessionItemRecords(
  items: readonly AgentSessionItemRecord[],
): AgentSessionItemView[] {
  const sortedItems = items
    .slice()
    .sort((left, right) => {
      const leftSequence = BigInt(left.sequence);
      const rightSequence = BigInt(right.sequence);
      return leftSequence === rightSequence ? 0 : leftSequence < rightSequence ? -1 : 1;
    });
  return toAgentSessionTranscriptItemViews(sortedItems);
}

function latestTimestamp(
  left: string | undefined,
  right: string | undefined,
): string | undefined;
function latestTimestamp(
  left: string | null | undefined,
  right: string | null | undefined,
): string | null | undefined;
function latestTimestamp(
  left: string | null | undefined,
  right: string | null | undefined,
): string | null | undefined {
  const leftTimestamp = left ? Date.parse(left) : Number.NaN;
  const rightTimestamp = right ? Date.parse(right) : Number.NaN;
  if (Number.isNaN(leftTimestamp)) {
    return right;
  }
  if (Number.isNaN(rightTimestamp)) {
    return left;
  }
  return rightTimestamp > leftTimestamp ? right : left;
}

function shouldRetainObservedRuntimeStatus(
  current: AgentSessionView,
  refreshed: AgentSessionView,
): boolean {
  if (refreshed.status === 'completed' || refreshed.status === 'archived') {
    return false;
  }
  if (
    refreshed.runtimeStatus !== undefined
    && refreshed.runtimeStatus !== 'ready'
  ) {
    return false;
  }
  return current.runtimeStatus !== undefined && current.runtimeStatus !== 'ready';
}

/**
 * Reconciles an authority refresh at commit time. The current Store value can
 * contain stream deltas that arrived after the read started, so it is the merge
 * base rather than the request-start snapshot.
 */
export function mergeRefreshedAgentSessionIntoCurrent(
  current: AgentSessionView,
  refreshed: AgentSessionView,
): AgentSessionView {
  if (current.id !== refreshed.id || current.projectId !== refreshed.projectId) {
    throw new Error('Refreshed Agents session does not match the current Store identity.');
  }

  const retainedCurrentActivity = current.activity !== undefined && (
    refreshed.activity === undefined
    || !shouldApplyAgentSessionActivitySummary(refreshed.activity, current.activity)
  );
  const activity = retainedCurrentActivity ? current.activity : refreshed.activity;
  const isTerminalRefresh = refreshed.status === 'completed' || refreshed.status === 'archived';

  return {
    ...refreshed,
    activity,
    runtimeStatus: retainedCurrentActivity && !isTerminalRefresh
      ? current.runtimeStatus
      : shouldRetainObservedRuntimeStatus(current, refreshed)
      ? current.runtimeStatus
      : refreshed.runtimeStatus,
    lastAttentionAt: latestTimestamp(current.lastAttentionAt, refreshed.lastAttentionAt),
    lastMessageAt: latestTimestamp(current.lastMessageAt, refreshed.lastMessageAt),
    lastRuntimeEventAt: latestTimestamp(
      current.lastRuntimeEventAt,
      refreshed.lastRuntimeEventAt,
    ),
    lastTurnAt: latestTimestamp(current.lastTurnAt, refreshed.lastTurnAt),
    lastUserActivityAt: latestTimestamp(
      current.lastUserActivityAt,
      refreshed.lastUserActivityAt,
    ),
    transcriptUpdatedAt: latestTimestamp(
      current.transcriptUpdatedAt,
      refreshed.transcriptUpdatedAt,
    ),
    itemPageInfo: refreshed.itemPageInfo ?? current.itemPageInfo,
    items: mergeLatestAgentSessionItems(current.items, refreshed.items),
  };
}

export function applyProjectSessionActivityRefresh(
  projects: readonly AgentProjectView[],
  refreshedProject: AgentProjectView,
  deletedSessionIds: readonly string[],
  options: {
    deletedSessionTombstones?: readonly AgentSessionView[];
    scopeKey?: string;
  } = {},
): AgentProjectView[] {
  const refreshedSessionIds = new Set(
    refreshedProject.agentSessions.map((session) => session.id),
  );
  const deletedIds = new Set<string>();
  const tombstonesById = new Map(
    (options.deletedSessionTombstones ?? []).map((session) => [session.id, session]),
  );
  for (const value of deletedSessionIds) {
    const sessionId = value.trim();
    if (!sessionId) {
      throw new Error('Deleted Agents Session identity must not be blank.');
    }
    if (refreshedSessionIds.has(sessionId)) {
      throw new Error('Agents Session activity refresh contains conflicting live and deleted rows.');
    }
    deletedIds.add(sessionId);
    const tombstone = tombstonesById.get(sessionId);
    if (options.scopeKey && tombstone) {
      const version = tombstone.activity?.versions.session ?? tombstone.serverVersion;
      if (!version) {
        throw new Error('Deleted Agents Session tombstone is missing its Session version.');
      }
      recordAgentSessionTombstoneInProjectsStore(
        options.scopeKey,
        refreshedProject.projectId,
        sessionId,
        version,
      );
    }
  }

  let nextProjects = upsertProjectIntoCollection(projects, {
    ...refreshedProject,
    // The activity head is bounded and therefore never replaces full inventory.
    agentSessions: [],
  });
  for (const sessionId of deletedIds) {
    const currentSession = nextProjects
      .find((project) => project.projectId === refreshedProject.projectId)
      ?.agentSessions.find((session) => session.id === sessionId);
    const tombstone = tombstonesById.get(sessionId);
    if (
      currentSession
      && tombstone
      && !canApplyAgentSessionTombstone(currentSession, tombstone)
    ) {
      continue;
    }
    nextProjects = removeAgentSessionFromCollection(
      nextProjects,
      refreshedProject.projectId,
      sessionId,
    );
  }
  for (const refreshedSession of refreshedProject.agentSessions) {
    if (
      options.scopeKey
      && !canCommitAgentSessionToProjectsStore(
        options.scopeKey,
        refreshedProject.projectId,
        refreshedSession,
      )
    ) {
      continue;
    }
    const currentSession = nextProjects
      .find((project) => project.projectId === refreshedProject.projectId)
      ?.agentSessions.find((session) => session.id === refreshedSession.id);
    nextProjects = currentSession
      ? updateAgentSessionInCollection(
          nextProjects,
          refreshedProject.projectId,
          refreshedSession.id,
          (session) => mergeRefreshedAgentSessionIntoCurrent(session, refreshedSession),
        )
      : upsertAgentSessionIntoCollection(
          nextProjects,
          refreshedProject.projectId,
          refreshedSession,
        );
  }
  return nextProjects;
}

function prependHistoricalSessionItems(
  existingItems: readonly AgentSessionItemView[],
  historicalItems: readonly AgentSessionItemView[],
): AgentSessionItemView[] {
  return deduplicateAgentSessionItemViews([...historicalItems, ...existingItems]);
}

async function loadSessionView(
  service: IAgentSessionService,
  session: AgentSessionRecord,
  project: Pick<AgentProjectView, 'projectId'>,
  items: readonly AgentSessionItemRecord[] = [],
  itemPageInfo?: AgentSessionPageInfoView,
  signal?: AbortSignal,
): Promise<AgentSessionView> {
  return loadAgentSessionView(
    service,
    session,
    project.projectId,
    items,
    itemPageInfo,
    signal,
  );
}

async function loadSessionItemPage(
  service: IAgentSessionService,
  sessionId: string,
  requestedPage: number,
  signal: AbortSignal,
): Promise<{
  items: AgentSessionItemRecord[];
  pageInfo: AgentSessionPageInfoView;
}> {
  const page = await service.listSessionItems(sessionId, {
    page: requestedPage,
    pageSize: AGENT_SESSION_ITEM_PAGE_SIZE,
    sort: '-sequence',
  }, { signal });
  const pageInfo = normalizeOffsetPageInfo(
    page.pageInfo,
    requestedPage,
    AGENT_SESSION_ITEM_PAGE_SIZE,
    'Agents session item list',
  );
  if (page.items.length > pageInfo.pageSize) {
    throw new Error('Agents session item list exceeded its declared page size.');
  }
  if (page.items.length === 0 && pageInfo.hasMore) {
    throw new Error('Agents session item list returned an empty page with hasMore=true.');
  }
  return {
    items: page.items,
    pageInfo,
  };
}

function normalizeProjectActivitySummaries(
  summaries: readonly AgentSessionActivitySummaryRecord[],
  project: AgentProjectView,
): {
  deletedSessionIds: string[];
  deletedSessionTombstones: AgentSessionView[];
  sessions: AgentSessionView[];
} {
  const deletedSessionIds: string[] = [];
  const deletedSessionTombstones: AgentSessionView[] = [];
  const sessions: AgentSessionView[] = [];
  const seenSessionIds = new Set<string>();
  for (const summary of summaries) {
    validateAgentSessionActivitySummary(summary, project);
    const sessionId = summary.session.sessionId.trim();
    if (seenSessionIds.has(sessionId)) {
      throw new Error('Agents project Session activity page contains a duplicate Session identity.');
    }
    seenSessionIds.add(sessionId);
    if (summary.presentationPhase === 'deleted' || summary.session.deletedAt) {
      deletedSessionIds.push(sessionId);
      deletedSessionTombstones.push(toAgentSessionViewFromActivitySummary(summary));
      continue;
    }
    sessions.push(toAgentSessionViewFromActivitySummary(summary));
  }
  return { deletedSessionIds, deletedSessionTombstones, sessions };
}

async function loadProjectSessionActivityHead(
  agentSessionService: IAgentSessionService,
  project: AgentProjectView,
  signal?: AbortSignal,
): Promise<{
  deletedSessionIds: string[];
  deletedSessionTombstones: AgentSessionView[];
  sessions: AgentSessionView[];
}> {
  const page = await agentSessionService.listSessionActivitySummaries({
    pageSize: PROJECT_SESSION_ACTIVITY_PAGE_SIZE,
    projectId: project.projectId,
  }, { signal });
  signal?.throwIfAborted();

  const nextCursor = normalizeAgentSessionActivityCursor(
    page.pageInfo.nextCursor,
    'next cursor',
  );
  if (
    page.pageInfo.mode !== 'cursor'
    || page.pageInfo.pageSize !== PROJECT_SESSION_ACTIVITY_PAGE_SIZE
    || typeof page.pageInfo.hasMore !== 'boolean'
    || page.items.length > PROJECT_SESSION_ACTIVITY_PAGE_SIZE
  ) {
    throw new Error('Agents project Session activity snapshot returned invalid pagination metadata.');
  }
  if (page.pageInfo.hasMore && (page.items.length === 0 || !nextCursor)) {
    throw new Error('Agents project Session activity snapshot returned a non-progressing cursor page.');
  }
  if (!page.pageInfo.hasMore && nextCursor) {
    throw new Error('Agents project Session activity snapshot returned an unexpected terminal cursor.');
  }
  return normalizeProjectActivitySummaries(page.items, project);
}

async function refreshProjectSessionsWithoutTimeout({
  agentSessionService,
  projectId,
  projectService,
  signal,
}: Omit<RefreshProjectSessionsOptions, 'refreshTimeoutMs'>): Promise<RefreshProjectSessionsResult> {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    return {
      deletedSessionIds: [],
      deletedSessionTombstones: [],
      sessionIds: [],
      projectIds: [],
      source: 'agents',
      status: 'failed',
    };
  }

  const project = await projectService.getProjectById(normalizedProjectId);
  if (
    !project
    || project.projectId !== normalizedProjectId
    || project.status === 'deleted'
  ) {
    return {
      deletedSessionIds: [],
      deletedSessionTombstones: [],
      sessionIds: [],
      projectIds: [],
      source: 'agents',
      status: 'failed',
    };
  }

  const snapshot = await loadProjectSessionActivityHead(
    agentSessionService,
    project,
    signal,
  );
  const synchronizedProject: AgentProjectView = {
    ...project,
    agentSessions: snapshot.sessions,
  };
  return {
    deletedSessionIds: snapshot.deletedSessionIds,
    deletedSessionTombstones: snapshot.deletedSessionTombstones,
    sessionIds: synchronizedProject.agentSessions.map((session) => session.id),
    projectIds: [normalizedProjectId],
    projects: [synchronizedProject],
    source: 'agents',
    status: 'refreshed',
  };
}

export function refreshProjectSessions(
  options: RefreshProjectSessionsOptions,
): Promise<RefreshProjectSessionsResult> {
  const { refreshTimeoutMs, signal, ...operationOptions } = options;
  return withAgentRefreshTimeout(
    (timeoutSignal) => refreshProjectSessionsWithoutTimeout({
      ...operationOptions,
      signal: timeoutSignal,
    }),
    refreshTimeoutMs,
    'Refreshing Agents project sessions',
    signal,
  );
}

function isAgentSessionNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as {
    message?: unknown;
    response?: { status?: unknown };
    status?: unknown;
    statusCode?: unknown;
  };
  const status = candidate.status ?? candidate.statusCode ?? candidate.response?.status;
  if (status === 404) {
    return true;
  }
  return (
    typeof candidate.message === 'string' &&
    /(?:agent\s+)?session\s+not\s+found/iu.test(candidate.message)
  );
}

async function refreshAgentSessionItemsWithoutTimeout({
  agentSessionService,
  agentSessionId,
  resolvedLocation,
  signal,
}: Omit<RefreshAgentSessionItemsOptions, 'refreshTimeoutMs'>): Promise<RefreshAgentSessionItemsResult> {
  const normalizedSessionId = agentSessionId.trim();
  if (!normalizedSessionId) {
    return {
      agentSessionId: normalizedSessionId,
      itemCount: 0,
      projectId: '',
      source: 'agents',
      status: 'not-found',
    };
  }

  const project = resolvedLocation?.project;
  if (!project) {
    return {
      agentSessionId: normalizedSessionId,
      itemCount: 0,
      projectId: '',
      source: 'agents',
      status: 'failed',
    };
  }

  const projectId = project.projectId.trim();
  let session: Awaited<ReturnType<IAgentSessionService['getSession']>>;
  try {
    session = await agentSessionService.getSession(normalizedSessionId, { signal });
  } catch (error) {
    if (isAgentSessionNotFoundError(error)) {
      return {
        agentSessionId: normalizedSessionId,
        itemCount: 0,
        projectId,
        source: 'agents',
        status: 'not-found',
      };
    }
    throw error;
  }
  if (!projectId || session.projectId?.trim() !== projectId) {
    return {
      agentSessionId: normalizedSessionId,
      itemCount: 0,
      projectId,
      source: 'agents',
      status: 'not-found',
    };
  }

  const itemPage = await loadSessionItemPage(
    agentSessionService,
    normalizedSessionId,
    1,
    signal ?? new AbortController().signal,
  );
  const refreshedAgentSession = await loadSessionView(
    agentSessionService,
    session,
    project,
    itemPage.items,
    itemPage.pageInfo,
    signal,
  );
  const existingAgentSession = resolvedLocation?.agentSession;
  const existingPageInfo = existingAgentSession?.itemPageInfo;
  const itemPageInfo = existingPageInfo?.pageSize === AGENT_SESSION_ITEM_PAGE_SIZE
    ? {
        ...existingPageInfo,
        hasMore: existingPageInfo.page > 1
          ? existingPageInfo.hasMore
          : itemPage.pageInfo.hasMore,
      }
    : itemPage.pageInfo;
  const agentSession = existingAgentSession
    ? {
        ...refreshedAgentSession,
        itemPageInfo,
        items: mergeLatestAgentSessionItems(
          existingAgentSession.items,
          refreshedAgentSession.items,
        ),
      }
    : refreshedAgentSession;
  return {
    agentSessionId: normalizedSessionId,
    agentSession,
    itemCount: agentSession.items.length,
    projectId,
    source: 'agents',
    status: 'refreshed',
  };
}

export function refreshAgentSessionItems(
  options: RefreshAgentSessionItemsOptions,
): Promise<RefreshAgentSessionItemsResult> {
  const { refreshTimeoutMs, signal, ...operationOptions } = options;
  return withAgentRefreshTimeout(
    (timeoutSignal) => refreshAgentSessionItemsWithoutTimeout({
      ...operationOptions,
      signal: timeoutSignal,
    }),
    refreshTimeoutMs,
    'Refreshing Agents session items',
    signal,
  );
}

async function loadEarlierAgentSessionItemsWithoutTimeout({
  agentSessionService,
  agentSession,
  signal,
}: Omit<LoadEarlierAgentSessionItemsOptions, 'refreshTimeoutMs'>): Promise<LoadEarlierAgentSessionItemsResult> {
  const normalizedSessionId = agentSession.id.trim();
  const projectId = agentSession.projectId.trim();
  if (!normalizedSessionId || !projectId) {
    throw new Error('Agents Session and Project ids are required to load earlier messages.');
  }

  const currentPageInfo = agentSession.itemPageInfo;
  if (!currentPageInfo || !currentPageInfo.hasMore) {
    return {
      agentSession,
      loadedItemCount: 0,
      projectId,
      source: 'agents',
      status: 'complete',
    };
  }

  const validatedPageInfo = validateLoadedItemPageInfo(
    currentPageInfo,
    'Loaded Agents session item list',
  );
  const requestedPage = validatedPageInfo.page + 1;
  if (!Number.isSafeInteger(requestedPage)) {
    throw new Error('Loaded Agents session item list cannot advance beyond the current page.');
  }

  const itemPage = await loadSessionItemPage(
    agentSessionService,
    normalizedSessionId,
    requestedPage,
    signal ?? new AbortController().signal,
  );
  const historicalItems = normalizeSessionItemRecords(itemPage.items);
  const items = prependHistoricalSessionItems(agentSession.items, historicalItems);
  return {
    agentSession: {
      ...agentSession,
      itemPageInfo: itemPage.pageInfo,
      items,
    },
    loadedItemCount: Math.max(0, items.length - agentSession.items.length),
    projectId,
    source: 'agents',
    status: 'loaded',
  };
}

export function loadEarlierAgentSessionItems(
  options: LoadEarlierAgentSessionItemsOptions,
): Promise<LoadEarlierAgentSessionItemsResult> {
  const { refreshTimeoutMs, signal, ...operationOptions } = options;
  return withAgentRefreshTimeout(
    (timeoutSignal) => loadEarlierAgentSessionItemsWithoutTimeout({
      ...operationOptions,
      signal: timeoutSignal,
    }),
    refreshTimeoutMs,
    'Loading earlier Agents session items',
    signal,
  );
}
