import type {
  AgentSessionItemView,
  AgentSessionView,
  BirdCoderProject,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  formatAgentSessionDisplayTime,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

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
  agentProjectId: string;
  birdCoderProjectId: string;
  engineId?: string;
  modelId?: string;
  runtimeLocationId?: string;
  userState?: AgentSessionUserStateRecord | null;
  workspaceId: string;
}

export interface ProjectAgentSessionPage {
  hasMore: boolean;
  project: BirdCoderProject;
}

export function requireAgentProjectId(
  project: Pick<BirdCoderProject, 'defaultAgentProjectId' | 'id'>,
): string {
  const agentProjectId = project.defaultAgentProjectId.trim();
  if (
    !agentProjectId.startsWith('project.')
    || /[\u0000-\u001f\u007f]/u.test(agentProjectId)
  ) {
    throw new Error(
      `BirdCoder project ${project.id} has no valid canonical Agents project reference.`,
    );
  }
  return agentProjectId;
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
  const agentProjectId = context.agentProjectId.trim();
  const birdCoderProjectId = context.birdCoderProjectId.trim();
  if (!birdCoderProjectId) {
    throw new Error('BirdCoder project id is required for an agent session view.');
  }
  if (!agentProjectId || session.projectId?.trim() !== agentProjectId) {
    throw new Error(
      `Agent session ${session.sessionId} does not belong to Agents project ${agentProjectId}.`,
    );
  }
  const activityAt = session.lastItemAt ?? session.updatedAt;
  const parsedActivityAt = Date.parse(activityAt);
  const messages = items
    .slice()
    .sort((left, right) => {
      const leftSequence = BigInt(left.sequence);
      const rightSequence = BigInt(right.sequence);
      return leftSequence === rightSequence ? 0 : leftSequence < rightSequence ? -1 : 1;
    })
    .map(toAgentSessionItemView);
  return {
    id: session.sessionId,
    workspaceId: context.workspaceId,
    birdCoderProjectId,
    agentProjectId,
    runtimeLocationId: context.runtimeLocationId,
    title: context.userState?.customTitle?.trim() || session.title?.trim() || 'Untitled session',
    status: resolveSessionStatus(session.status),
    hostMode: 'desktop',
    engineId: context.engineId?.trim() || 'codex',
    modelId: context.modelId?.trim() || 'auto',
    runtimeStatus: session.status === 'closed' || session.status === 'archived'
      ? 'completed'
      : 'ready',
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastTurnAt: session.lastItemAt,
    sortTimestamp: String(Number.isNaN(parsedActivityAt) ? 0 : parsedActivityAt),
    transcriptUpdatedAt: session.lastItemAt ?? null,
    displayTime: formatAgentSessionDisplayTime(activityAt, session.createdAt),
    pinned: Boolean(context.userState?.pinnedAt),
    archived: session.status === 'archived' || Boolean(context.userState?.hiddenAt),
    unread: context.userState?.lastReadItemSequence !== session.lastItemSequence,
    items: messages,
  };
}

export async function loadProjectAgentSessionPage(
  agentSessionService: IAgentSessionService,
  project: BirdCoderProject,
  requestedCount: number,
): Promise<ProjectAgentSessionPage> {
  const pageSize = Math.max(1, Math.min(200, Math.trunc(requestedCount)));
  const agentProjectId = requireAgentProjectId(project);
  const sessionPage = await agentSessionService.listSessions({
    page: 1,
    pageSize,
    projectId: agentProjectId,
  });
  const visibleSessions = sessionPage.items
    .filter((session) => session.projectId === agentProjectId)
    .map((session) => toAgentSessionView(session, {
      agentProjectId,
      birdCoderProjectId: project.id,
      workspaceId: project.workspaceId,
    }));
  return {
    hasMore: sessionPage.pageInfo.hasMore === true,
    project: {
      ...project,
      agentSessions: visibleSessions,
    },
  };
}

export async function loadProjectsAgentSessionInventory(
  agentSessionService: IAgentSessionService,
  projects: readonly BirdCoderProject[],
  requestedCount = 20,
): Promise<BirdCoderProject[]> {
  return Promise.all(
    projects.map(async (project) =>
      (await loadProjectAgentSessionPage(agentSessionService, project, requestedCount)).project,
    ),
  );
}
