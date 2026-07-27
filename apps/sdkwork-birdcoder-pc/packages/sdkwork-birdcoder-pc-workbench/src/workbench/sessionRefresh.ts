import type {
  AgentSessionItemView,
  AgentSessionPageInfoView,
  AgentSessionView,
  AgentProjectView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { deduplicateAgentSessionItemViews } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import type { IProjectService } from '../services/interfaces/IProjectService.ts';
import {
  loadCompleteProjectAgentSessionInventory,
  loadAgentSessionView,
  toAgentSessionItemView,
  type AgentSessionItemRecord,
  type AgentSessionRecord,
} from '../services/agentSessionViewModels.ts';

const AGENT_SESSION_ITEM_PAGE_SIZE = 20;
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
  agentSession: AgentSessionView;
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
  return items
    .slice()
    .sort((left, right) => {
      const leftSequence = BigInt(left.sequence);
      const rightSequence = BigInt(right.sequence);
      return leftSequence === rightSequence ? 0 : leftSequence < rightSequence ? -1 : 1;
    })
    .map(toAgentSessionItemView);
}

function mergeLatestSessionItems(
  existingItems: readonly AgentSessionItemView[],
  latestItems: readonly AgentSessionItemView[],
): AgentSessionItemView[] {
  return deduplicateAgentSessionItemViews([...existingItems, ...latestItems]);
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

async function refreshProjectSessionsWithoutTimeout({
  agentSessionService,
  projectId,
  projectService,
  signal,
}: Omit<RefreshProjectSessionsOptions, 'refreshTimeoutMs'>): Promise<RefreshProjectSessionsResult> {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    return {
      sessionIds: [],
      projectIds: [],
      source: 'agents',
      status: 'failed',
    };
  }

  const project = await projectService.getProjectById(normalizedProjectId);
  if (!project || project.projectId !== normalizedProjectId) {
    return {
      sessionIds: [],
      projectIds: [],
      source: 'agents',
      status: 'failed',
    };
  }

  const synchronizedProject = await loadCompleteProjectAgentSessionInventory(
    agentSessionService,
    project,
    signal,
  );
  return {
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

  const session = await agentSessionService.getSession(normalizedSessionId, { signal });
  const projectId = project.projectId.trim();
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
        items: mergeLatestSessionItems(
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
