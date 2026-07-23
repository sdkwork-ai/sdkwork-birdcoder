import type {
  AgentSessionView,
  BirdCoderProject,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import type { IProjectService } from '../services/interfaces/IProjectService.ts';
import {
  toAgentSessionView,
  requireAgentProjectId,
  type AgentSessionItemRecord,
  type AgentSessionRecord,
} from '../services/agentSessionViewModels.ts';

const AGENT_PAGE_SIZE = 200;
const DEFAULT_AGENT_REFRESH_TIMEOUT_MS = 30_000;
const MAX_AGENT_REFRESH_TIMEOUT_MS = 300_000;

export interface RefreshProjectSessionsOptions {
  agentSessionService: IAgentSessionService;
  projectId: string;
  projectService: IProjectService;
  refreshTimeoutMs?: number;
  workspaceId: string;
}

export interface ResolvedAgentSessionLocation {
  agentSession: AgentSessionView;
  project: BirdCoderProject;
}

export interface RefreshAgentSessionItemsOptions {
  agentSessionService: IAgentSessionService;
  agentSessionId: string;
  refreshTimeoutMs?: number;
  resolvedLocation?: ResolvedAgentSessionLocation;
  workspaceId?: string;
}

export interface RefreshProjectSessionsResult {
  sessionIds: string[];
  projectIds: string[];
  projects?: BirdCoderProject[];
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
  workspaceId?: string;
}

export interface AgentSessionItemsRefreshScope {
  agentSessionId: string;
  birdCoderProjectId: string;
  identityScope: string;
  workspaceId: string;
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
    normalizeRefreshScopePart(scope.workspaceId, 'Workspace id'),
    normalizeRefreshScopePart(scope.birdCoderProjectId, 'BirdCoder project id'),
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
  operation: () => Promise<T>,
  timeoutMs: number | undefined,
  label: string,
): Promise<T> {
  const resolvedTimeoutMs = normalizeRefreshTimeoutMs(timeoutMs);
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${label} timed out after ${resolvedTimeoutMs} ms.`));
    }, resolvedTimeoutMs);
  });
  return Promise.race([operation(), timeout]).finally(() => {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  });
}

async function loadSessionView(
  service: IAgentSessionService,
  session: AgentSessionRecord,
  project: Pick<BirdCoderProject, 'defaultAgentProjectId' | 'id' | 'workspaceId'>,
  items: readonly AgentSessionItemRecord[] = [],
): Promise<AgentSessionView> {
  const runtimeBindingPage = await service.listRuntimeBindings(
    session.sessionId,
    { page: 1, pageSize: 20 },
  );
  const currentBinding = runtimeBindingPage.items.find((binding) => binding.isCurrent);
  return toAgentSessionView(
    session,
    {
      agentProjectId: requireAgentProjectId(project),
      birdCoderProjectId: project.id,
      engineId: currentBinding?.providerId,
      modelId: currentBinding?.modelId,
      runtimeLocationId: currentBinding?.runtimeLocationId ?? undefined,
      workspaceId: project.workspaceId,
    },
    items,
  );
}

async function loadInitialSessionItems(
  service: IAgentSessionService,
  sessionId: string,
): Promise<AgentSessionItemRecord[]> {
  const page = await service.listSessionItems(sessionId, {
    page: 1,
    pageSize: AGENT_PAGE_SIZE,
  });
  return page.items;
}

async function refreshProjectSessionsWithoutTimeout({
  agentSessionService,
  projectId,
  projectService,
  workspaceId,
}: Omit<RefreshProjectSessionsOptions, 'refreshTimeoutMs'>): Promise<RefreshProjectSessionsResult> {
  const normalizedProjectId = projectId.trim();
  const normalizedWorkspaceId = workspaceId.trim();
  if (!normalizedProjectId || !normalizedWorkspaceId) {
    return {
      sessionIds: [],
      projectIds: [],
      source: 'agents',
      status: 'failed',
    };
  }

  const project = await projectService.getProjectById(normalizedProjectId);
  if (!project || project.workspaceId !== normalizedWorkspaceId) {
    return {
      sessionIds: [],
      projectIds: [],
      source: 'agents',
      status: 'failed',
    };
  }

  const agentProjectId = requireAgentProjectId(project);
  const sessionPage = await agentSessionService.listSessions({
    page: 1,
    pageSize: AGENT_PAGE_SIZE,
    projectId: agentProjectId,
  });
  const agentSessions = await Promise.all(
    sessionPage.items
      .filter((session) => session.projectId === agentProjectId)
      .map((session) => loadSessionView(agentSessionService, session, project)),
  );
  return {
    sessionIds: agentSessions.map((session) => session.id),
    projectIds: [normalizedProjectId],
    projects: [{ ...project, agentSessions }],
    source: 'agents',
    status: 'refreshed',
  };
}

export function refreshProjectSessions(
  options: RefreshProjectSessionsOptions,
): Promise<RefreshProjectSessionsResult> {
  const { refreshTimeoutMs, ...operationOptions } = options;
  return withAgentRefreshTimeout(
    () => refreshProjectSessionsWithoutTimeout(operationOptions),
    refreshTimeoutMs,
    'Refreshing Agents project sessions',
  );
}

async function refreshAgentSessionItemsWithoutTimeout({
  agentSessionService,
  agentSessionId,
  resolvedLocation,
  workspaceId,
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

  const session = await agentSessionService.getSession(normalizedSessionId);
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
  const projectId = project.id.trim();
  const agentProjectId = requireAgentProjectId(project);
  if (!projectId || session.projectId?.trim() !== agentProjectId) {
    return {
      agentSessionId: normalizedSessionId,
      itemCount: 0,
      projectId,
      source: 'agents',
      status: 'not-found',
    };
  }

  const items = await loadInitialSessionItems(agentSessionService, normalizedSessionId);
  const agentSession = await loadSessionView(
    agentSessionService,
    session,
    {
      ...project,
      workspaceId: project.workspaceId || workspaceId?.trim() || '',
    },
    items,
  );
  return {
    agentSessionId: normalizedSessionId,
    agentSession,
    itemCount: agentSession.items.length,
    projectId,
    source: 'agents',
    status: 'refreshed',
    workspaceId: project.workspaceId,
  };
}

export function refreshAgentSessionItems(
  options: RefreshAgentSessionItemsOptions,
): Promise<RefreshAgentSessionItemsResult> {
  const { refreshTimeoutMs, ...operationOptions } = options;
  return withAgentRefreshTimeout(
    () => refreshAgentSessionItemsWithoutTimeout(operationOptions),
    refreshTimeoutMs,
    'Refreshing Agents session items',
  );
}
