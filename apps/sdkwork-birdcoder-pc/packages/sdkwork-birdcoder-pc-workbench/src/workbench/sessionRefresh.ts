import type {
  AgentSessionPageInfoView,
  AgentSessionView,
  AgentProjectView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import type { IProjectService } from '../services/interfaces/IProjectService.ts';
import {
  toAgentSessionView,
  type AgentSessionItemRecord,
  type AgentSessionRecord,
} from '../services/agentSessionViewModels.ts';

const AGENT_SESSION_PAGE_SIZE = 20;
const AGENT_SESSION_ITEM_PAGE_SIZE = 200;
const RUNTIME_BINDING_LOOKUP_CONCURRENCY = 8;
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

async function mapWithConcurrency<TInput, TOutput>(
  inputs: readonly TInput[],
  concurrency: number,
  signal: AbortSignal,
  worker: (input: TInput) => Promise<TOutput>,
): Promise<TOutput[]> {
  const results = new Array<TOutput>(inputs.length);
  let nextIndex = 0;
  const workerCount = Math.min(inputs.length, Math.max(1, Math.trunc(concurrency)));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < inputs.length) {
      signal.throwIfAborted();
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(inputs[index]!);
    }
  }));
  return results;
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
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 200) {
    throw new Error(`${label} returned an invalid page size.`);
  }
  return { hasMore: pageInfo.hasMore === true, page, pageSize };
}

async function loadSessionView(
  service: IAgentSessionService,
  session: AgentSessionRecord,
  project: Pick<AgentProjectView, 'projectId'>,
  items: readonly AgentSessionItemRecord[] = [],
  itemPageInfo?: AgentSessionPageInfoView,
  signal?: AbortSignal,
): Promise<AgentSessionView> {
  const runtimeBindingPage = await service.listRuntimeBindings(
    session.sessionId,
    { page: 1, pageSize: 20 },
    { signal },
  );
  const currentBinding = runtimeBindingPage.items.find((binding) => binding.isCurrent);
  return toAgentSessionView(
    session,
    {
      projectId: project.projectId,
      engineId: currentBinding?.providerId,
      modelId: currentBinding?.modelId,
      runtimeLocationId: currentBinding?.runtimeLocationId ?? undefined,
      itemPageInfo,
    },
    items,
  );
}

async function loadInitialSessionItems(
  service: IAgentSessionService,
  sessionId: string,
  signal: AbortSignal,
): Promise<{
  items: AgentSessionItemRecord[];
  pageInfo: AgentSessionPageInfoView;
}> {
  const page = await service.listSessionItems(sessionId, {
    page: 1,
    pageSize: AGENT_SESSION_ITEM_PAGE_SIZE,
    sort: '-sequence',
  }, { signal });
  const pageInfo = normalizeOffsetPageInfo(
    page.pageInfo,
    1,
    AGENT_SESSION_ITEM_PAGE_SIZE,
    'Agents session item list',
  );
  if (page.items.length > pageInfo.pageSize) {
    throw new Error('Agents session item list exceeded its declared page size.');
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

  const sessionPage = await agentSessionService.listSessions({
    page: 1,
    pageSize: AGENT_SESSION_PAGE_SIZE,
    projectId: normalizedProjectId,
  }, { signal });
  const pageInfo = normalizeOffsetPageInfo(
    sessionPage.pageInfo,
    1,
    AGENT_SESSION_PAGE_SIZE,
    'Agents project session list',
  );
  if (sessionPage.items.length > pageInfo.pageSize) {
    throw new Error('Agents project session list exceeded its declared page size.');
  }
  const scopedSessions = sessionPage.items.filter(
    (session) => session.projectId === normalizedProjectId,
  );
  const agentSessions = await mapWithConcurrency(
    scopedSessions,
    RUNTIME_BINDING_LOOKUP_CONCURRENCY,
    signal ?? new AbortController().signal,
    (session) => loadSessionView(agentSessionService, session, project, [], undefined, signal),
  );
  return {
    sessionIds: agentSessions.map((session) => session.id),
    projectIds: [normalizedProjectId],
    projects: [{ ...project, agentSessionPageInfo: pageInfo, agentSessions }],
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

  const itemPage = await loadInitialSessionItems(
    agentSessionService,
    normalizedSessionId,
    signal ?? new AbortController().signal,
  );
  const agentSession = await loadSessionView(
    agentSessionService,
    session,
    project,
    itemPage.items,
    itemPage.pageInfo,
    signal,
  );
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
