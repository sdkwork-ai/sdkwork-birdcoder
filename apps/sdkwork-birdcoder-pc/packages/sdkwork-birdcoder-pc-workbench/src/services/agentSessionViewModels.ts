import type {
  AgentSessionPageInfoView,
  AgentSessionItemView,
  AgentSessionView,
  AgentProjectView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  formatAgentSessionDisplayTime,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import {
  findWorkbenchCodeEngineDefinitionForAgentId,
  loadWorkbenchCodeEngineCatalog,
  resolveWorkbenchCodeEngineForRuntimeBinding,
} from '../workbench/codeEngineCatalog.ts';

export type AgentSessionRecord = Awaited<
  ReturnType<IAgentSessionService['getSession']>
>;
export type AgentSessionItemRecord = Awaited<
  ReturnType<IAgentSessionService['listSessionItems']>
>['items'][number];
export type AgentSessionUserStateRecord = Awaited<
  ReturnType<IAgentSessionService['getSessionUserState']>
>;

export interface AgentSessionViewContext {
  projectId: string;
  engineId?: string;
  modelId?: string;
  providerId?: string;
  providerBindingId?: string;
  hostMode?: AgentSessionView['hostMode'];
  transportKind?: string;
  nativeSessionId?: string;
  runtimeLocationId?: string;
  runtimeBindingStatus?: 'active' | 'deactivated' | 'failed' | 'deleted';
  runtimeBindingUpdatedAt?: string;
  userState?: AgentSessionUserStateRecord | null;
  itemPageInfo?: AgentSessionPageInfoView;
}

export interface ProjectAgentSessionPage {
  hasMore: boolean;
  project: AgentProjectView;
}

const PROJECT_SESSION_PAGE_SIZE = 20;
const PROJECT_SESSION_INVENTORY_CONCURRENCY = 6;
const MAX_COMPLETE_PROJECT_SESSION_COUNT = 200_000;

function normalizePageInfo(
  pageInfo: Awaited<ReturnType<IAgentSessionService['listSessions']>>['pageInfo'],
  requestedPage: number,
  requestedPageSize: number,
): AgentSessionPageInfoView {
  if (pageInfo.mode !== 'offset') {
    throw new Error('Agents session inventory must use offset pagination.');
  }
  const page = pageInfo.page ?? requestedPage;
  const pageSize = pageInfo.pageSize ?? requestedPageSize;
  if (page !== requestedPage) {
    throw new Error(
      `Agents session inventory returned page ${page} while page ${requestedPage} was requested.`,
    );
  }
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 200) {
    throw new Error('Agents session inventory returned an invalid page size.');
  }
  return {
    hasMore: pageInfo.hasMore === true,
    page,
    pageSize,
  };
}

async function mapWithConcurrency<TInput, TOutput>(
  inputs: readonly TInput[],
  concurrency: number,
  worker: (input: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  const results = new Array<TOutput>(inputs.length);
  let nextIndex = 0;
  const workerCount = Math.min(inputs.length, Math.max(1, Math.trunc(concurrency)));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < inputs.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(inputs[index]!, index);
    }
  }));
  return results;
}

function mergeAgentSessions(
  existing: readonly AgentSessionView[],
  incoming: readonly AgentSessionView[],
): AgentSessionView[] {
  const sessionsById = new Map(existing.map((session) => [session.id, session]));
  for (const session of incoming) {
    sessionsById.set(session.id, session);
  }
  return [...sessionsById.values()];
}

function resolveItemRole(
  kind: AgentSessionItemRecord['kind'],
): AgentSessionItemView['role'] {
  if (kind === 'user_input') {
    return 'user';
  }
  if (kind === 'tool_call' || kind === 'tool_result') {
    return 'tool';
  }
  if (kind === 'system_instruction' || kind === 'status_notice' || kind === 'error_notice') {
    return 'system';
  }
  return 'assistant';
}

function resolveItemContent(item: AgentSessionItemRecord): string {
  const content = item.content?.trim();
  if (content) {
    return content;
  }
  const structuredContent = item.toolResult ?? item.toolArguments;
  if (structuredContent) {
    return JSON.stringify(structuredContent, null, 2);
  }
  return item.toolName?.trim() ?? '';
}

function resolveSessionStatus(
  status: AgentSessionRecord['status'],
): AgentSessionView['status'] {
  if (status === 'archived') {
    return 'archived';
  }
  if (status === 'closed') {
    return 'completed';
  }
  return 'active';
}

export function toAgentSessionItemView(
  item: AgentSessionItemRecord,
): AgentSessionItemView {
  return {
    id: item.itemId,
    sessionId: item.sessionId,
    turnId: item.turnId ?? undefined,
    role: resolveItemRole(item.kind),
    content: resolveItemContent(item),
    metadata: {
      agentItemKind: item.kind,
      agentItemSequence: item.sequence,
      agentItemStatus: item.status,
      contentType: item.contentType,
      inputTokens: item.inputTokens,
      outputTokens: item.outputTokens,
      parentItemId: item.parentItemId ?? undefined,
      providerId: item.providerId ?? undefined,
      modelId: item.modelId ?? undefined,
    },
    createdAt: item.createdAt,
    timestamp: Date.parse(item.createdAt),
    name: item.toolName ?? undefined,
    tool_call_id: item.toolCallId ?? undefined,
  };
}

export function toAgentSessionView(
  session: AgentSessionRecord,
  context: AgentSessionViewContext,
  items: readonly AgentSessionItemRecord[] = [],
): AgentSessionView {
  const projectId = context.projectId.trim();
  if (!projectId || session.projectId?.trim() !== projectId) {
    throw new Error(
      `Agent session ${session.sessionId} does not belong to Agents project ${projectId}.`,
    );
  }
  const activityAt = session.lastItemAt ?? session.updatedAt;
  const parsedActivityAt = Date.parse(activityAt);
  const sessionItems = items
    .slice()
    .sort((left, right) => {
      const leftSequence = BigInt(left.sequence);
      const rightSequence = BigInt(right.sequence);
      return leftSequence === rightSequence ? 0 : leftSequence < rightSequence ? -1 : 1;
    })
    .map(toAgentSessionItemView);
  return {
    id: session.sessionId,
    agentId: session.agentId,
    projectId,
    runtimeLocationId: context.runtimeLocationId,
    title: context.userState?.customTitle?.trim() || session.title?.trim() || 'Untitled session',
    status: resolveSessionStatus(session.status),
    hostMode: context.hostMode ?? 'web',
    engineId: context.engineId?.trim() || context.providerId?.trim() || 'unknown',
    modelId: context.modelId?.trim() || 'auto',
    providerId: context.providerId?.trim() || 'unknown',
    providerBindingId: context.providerBindingId?.trim() || undefined,
    transportKind: context.transportKind?.trim() || undefined,
    nativeSessionId: context.nativeSessionId?.trim() || undefined,
    runtimeStatus: session.status === 'closed' || session.status === 'archived'
      ? 'completed'
      : context.runtimeBindingStatus === 'failed'
        ? 'failed'
        : 'ready',
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastTurnAt: session.lastItemAt,
    lastMessageAt: session.lastItemAt,
    lastRuntimeEventAt: context.runtimeBindingUpdatedAt,
    sortTimestamp: String(Number.isNaN(parsedActivityAt) ? 0 : parsedActivityAt),
    transcriptUpdatedAt: session.lastItemAt ?? null,
    serverVersion: session.version,
    lastItemSequence: session.lastItemSequence,
    lastReadItemSequence: context.userState?.lastReadItemSequence,
    displayTime: formatAgentSessionDisplayTime(activityAt, session.createdAt),
    pinned: Boolean(context.userState?.pinnedAt),
    archived: session.status === 'archived' || Boolean(context.userState?.hiddenAt),
    unread:
      context.userState?.lastReadItemSequence !== undefined
      && context.userState.lastReadItemSequence !== session.lastItemSequence,
    itemPageInfo: context.itemPageInfo,
    items: sessionItems,
  };
}

export function mergeAgentSessionRecordIntoView(
  existing: AgentSessionView,
  session: AgentSessionRecord,
): AgentSessionView {
  if (session.projectId?.trim() !== existing.projectId || session.sessionId !== existing.id) {
    throw new Error(`Agents session ${session.sessionId} does not match the loaded Session Inbox entry.`);
  }
  const didAppendItem = session.lastItemSequence !== existing.lastItemSequence;
  const activityAt = session.lastItemAt ?? session.updatedAt;
  const parsedActivityAt = Date.parse(activityAt);
  return {
    ...existing,
    agentId: session.agentId,
    status: resolveSessionStatus(session.status),
    runtimeStatus:
      session.status === 'closed' || session.status === 'archived'
        ? 'completed'
        : didAppendItem && existing.runtimeStatus === 'failed'
          ? 'ready'
          : existing.runtimeStatus,
    updatedAt: session.updatedAt,
    lastTurnAt: session.lastItemAt,
    lastMessageAt: session.lastItemAt,
    sortTimestamp: String(Number.isNaN(parsedActivityAt) ? 0 : parsedActivityAt),
    transcriptUpdatedAt: session.lastItemAt ?? null,
    serverVersion: session.version,
    lastItemSequence: session.lastItemSequence,
    unread:
      existing.lastReadItemSequence !== undefined
        ? existing.lastReadItemSequence !== session.lastItemSequence
        : existing.unread,
    archived: session.status === 'archived' || existing.archived,
    displayTime: formatAgentSessionDisplayTime(activityAt, session.createdAt),
  };
}

export async function loadAgentSessionView(
  agentSessionService: IAgentSessionService,
  session: AgentSessionRecord,
  projectId: string,
  items: readonly AgentSessionItemRecord[] = [],
  itemPageInfo?: AgentSessionPageInfoView,
  signal?: AbortSignal,
): Promise<AgentSessionView> {
  const [runtimeBindingPage, userState] = await Promise.all([
    agentSessionService.listRuntimeBindings(
      session.sessionId,
      { page: 1, pageSize: 20 },
      { signal },
    ),
    agentSessionService.getSessionUserState(session.sessionId, { signal }),
  ]);
  const currentBinding = runtimeBindingPage.items.find((binding) => binding.isCurrent);
  const engine = currentBinding
    ? resolveWorkbenchCodeEngineForRuntimeBinding(currentBinding)
    : null;
  return toAgentSessionView(session, {
    projectId,
    engineId: engine?.id ?? currentBinding?.providerId,
    modelId: currentBinding?.modelId,
    providerId: currentBinding?.providerId,
    providerBindingId: currentBinding?.providerBindingId,
    hostMode:
      currentBinding?.hostMode === 'desktop' || currentBinding?.hostMode === 'server'
        ? currentBinding.hostMode
        : 'web',
    transportKind: currentBinding?.transportKind,
    nativeSessionId: currentBinding?.nativeSessionId ?? undefined,
    runtimeLocationId: currentBinding?.runtimeLocationId ?? undefined,
    runtimeBindingStatus: currentBinding?.status,
    runtimeBindingUpdatedAt: currentBinding?.updatedAt,
    userState,
    itemPageInfo,
  }, items);
}

async function loadNativeHistorySessionInventoryView(
  session: AgentSessionRecord,
  projectId: string,
): Promise<AgentSessionView | null> {
  if (session.sourceContextKind?.trim() !== 'provider_native_session') {
    return null;
  }
  const engine = findWorkbenchCodeEngineDefinitionForAgentId(session.agentId)
    ?? (await loadWorkbenchCodeEngineCatalog()).find(
      (candidate) => candidate.agentId === session.agentId,
    )
    ?? null;
  if (!engine) {
    return null;
  }
  const model = engine.models.find((candidate) => candidate.id === engine.defaultModelId)
    ?? engine.models[0];
  return toAgentSessionView(session, {
    projectId,
    engineId: engine.id,
    hostMode: 'server',
    modelId: model?.id,
    providerBindingId: model?.bindingId || engine.bindingId,
    providerId: model?.providerId,
    transportKind: 'native-history',
  });
}

export async function loadProjectAgentSessionPage(
  agentSessionService: IAgentSessionService,
  project: AgentProjectView,
  requestedCount: number,
  signal?: AbortSignal,
): Promise<ProjectAgentSessionPage> {
  signal?.throwIfAborted();
  const targetCount = Math.max(1, Math.min(200_000, Math.trunc(requestedCount)));
  const projectId = project.projectId;
  const currentPageInfo = project.agentSessionPageInfo;
  if (
    project.agentSessions.length >= targetCount
    || (currentPageInfo && !currentPageInfo.hasMore)
  ) {
    return {
      hasMore: project.agentSessions.length > targetCount || currentPageInfo?.hasMore === true,
      project,
    };
  }

  const requestedPage = currentPageInfo ? currentPageInfo.page + 1 : 1;
  const sessionPage = await agentSessionService.listSessions({
    page: requestedPage,
    pageSize: PROJECT_SESSION_PAGE_SIZE,
    projectId,
  }, { signal });
  const pageInfo = normalizePageInfo(
    sessionPage.pageInfo,
    requestedPage,
    PROJECT_SESSION_PAGE_SIZE,
  );
  if (sessionPage.items.length > pageInfo.pageSize) {
    throw new Error('Agents session inventory exceeded its declared page size.');
  }
  if (sessionPage.items.length === 0 && pageInfo.hasMore) {
    throw new Error('Agents session inventory returned an empty page with hasMore=true.');
  }
  const visibleSessions = await mapWithConcurrency(
    sessionPage.items.filter((session) => session.projectId === projectId),
    PROJECT_SESSION_INVENTORY_CONCURRENCY,
    async (session) => {
      const nativeHistoryView = await loadNativeHistorySessionInventoryView(session, projectId);
      return nativeHistoryView ?? loadAgentSessionView(
        agentSessionService,
        session,
        projectId,
        [],
        undefined,
        signal,
      );
    },
  );
  signal?.throwIfAborted();
  const agentSessions = requestedPage === 1
    ? visibleSessions
    : mergeAgentSessions(project.agentSessions, visibleSessions);
  return {
    hasMore: agentSessions.length > targetCount || pageInfo.hasMore,
    project: {
      ...project,
      agentSessionPageInfo: pageInfo,
      agentSessions,
    },
  };
}

export async function loadCompleteProjectAgentSessionInventory(
  agentSessionService: IAgentSessionService,
  project: AgentProjectView,
  signal?: AbortSignal,
): Promise<AgentProjectView> {
  const {
    agentSessionPageInfo: _discardedPageInfo,
    ...projectWithoutSessionPageInfo
  } = project;
  let synchronizedProject: AgentProjectView = {
    ...projectWithoutSessionPageInfo,
    agentSessions: [],
  };

  while (true) {
    signal?.throwIfAborted();
    if (synchronizedProject.agentSessions.length >= MAX_COMPLETE_PROJECT_SESSION_COUNT) {
      throw new Error(
        `Agents project session inventory exceeded the supported ${MAX_COMPLETE_PROJECT_SESSION_COUNT} records.`,
      );
    }

    const nextPage = await loadProjectAgentSessionPage(
      agentSessionService,
      synchronizedProject,
      synchronizedProject.agentSessions.length + PROJECT_SESSION_PAGE_SIZE,
      signal,
    );
    synchronizedProject = nextPage.project;
    if (!synchronizedProject.agentSessionPageInfo?.hasMore) {
      return synchronizedProject;
    }
  }
}

export async function loadProjectsAgentSessionInventory(
  agentSessionService: IAgentSessionService,
  projects: readonly AgentProjectView[],
  signal?: AbortSignal,
): Promise<AgentProjectView[]> {
  return mapWithConcurrency(
    projects,
    PROJECT_SESSION_INVENTORY_CONCURRENCY,
    (project) => loadCompleteProjectAgentSessionInventory(
      agentSessionService,
      project,
      signal,
    ),
  );
}
