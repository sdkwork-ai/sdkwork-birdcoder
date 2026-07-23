import {
  completeAgentTurn,
  type AgentSessionItemRecord,
  type AgentSessionRecord,
  type CreateAgentTurnRequest,
  type SdkworkAppClient as AgentsAppClient,
} from '@sdkwork/agents-app-sdk';
import { sha256Hash } from '@sdkwork/utils/crypto';
import { uuid } from '@sdkwork/utils/id';
import { normalizeOffsetListQuery } from '@sdkwork/utils/pagination';

import { getBirdCoderH5AgentsAppClient } from './dependencySdkClients.ts';

export const BIRDCODER_ASSISTANT_AGENT_ID = 'agent.birdcoder';

export type BirdCoderAgentSessionItemRole = 'user' | 'assistant' | 'system';

export interface BirdCoderAssistantSessionView {
  sessionId: string;
  itemCount: number;
}

export interface BirdCoderAgentSessionItemView {
  itemId: string;
  sessionId: string;
  kind: AgentSessionItemRecord['kind'];
  role: BirdCoderAgentSessionItemRole;
  content: string;
  sequence: string;
  createdAt: string;
}

export interface BirdCoderAssistantSessionServiceOptions {
  agentId?: string;
  client?: AgentsAppClient;
}

export interface BirdCoderAssistantTurnOptions
  extends BirdCoderAssistantSessionServiceOptions {
  driveRefs?: CreateAgentTurnRequest['driveRefs'];
}

function resolveAgentId(value?: string): string {
  return value?.trim() || BIRDCODER_ASSISTANT_AGENT_ID;
}

function resolveClient(options: BirdCoderAssistantSessionServiceOptions): AgentsAppClient {
  return options.client ?? getBirdCoderH5AgentsAppClient();
}

function hashPayload(value: unknown): string {
  return `sha256:${sha256Hash(JSON.stringify(value))}`;
}

function toSafeItemCount(value: string): number {
  const itemCount = Number(value);
  if (!Number.isSafeInteger(itemCount) || itemCount < 0) {
    throw new Error('Agents session returned an invalid itemCount.');
  }
  return itemCount;
}

function toAssistantSessionView(session: AgentSessionRecord): BirdCoderAssistantSessionView {
  const sessionId = session.sessionId.trim();
  if (!sessionId) {
    throw new Error('Agents session response is missing sessionId.');
  }
  return {
    sessionId,
    itemCount: toSafeItemCount(session.itemCount),
  };
}

function resolveSessionItemRole(
  kind: AgentSessionItemRecord['kind'],
): BirdCoderAgentSessionItemRole {
  if (kind === 'user_input') {
    return 'user';
  }
  if (kind === 'system_instruction' || kind === 'status_notice' || kind === 'error_notice') {
    return 'system';
  }
  return 'assistant';
}

function resolveSessionItemContent(item: AgentSessionItemRecord): string {
  const content = item.content?.trim();
  if (content) {
    return content;
  }
  if (item.toolName?.trim()) {
    return item.toolName.trim();
  }
  const structuredContent = item.toolResult ?? item.toolArguments;
  return structuredContent ? JSON.stringify(structuredContent, null, 2) : '';
}

function toSessionItemView(item: AgentSessionItemRecord): BirdCoderAgentSessionItemView {
  return {
    itemId: item.itemId,
    sessionId: item.sessionId,
    kind: item.kind,
    role: resolveSessionItemRole(item.kind),
    content: resolveSessionItemContent(item),
    sequence: item.sequence,
    createdAt: item.createdAt,
  };
}

function isReusableAssistantSession(session: AgentSessionRecord): boolean {
  return session.sessionKind === 'assistant'
    && (session.status === 'active' || session.status === 'idle');
}

export async function ensureBirdCoderAssistantSession(
  options: BirdCoderAssistantSessionServiceOptions = {},
): Promise<BirdCoderAssistantSessionView> {
  const agentId = resolveAgentId(options.agentId);
  const client = resolveClient(options);
  const { page, page_size: pageSize } = normalizeOffsetListQuery();
  const listed = await client.ai.agents.sessions.list(agentId, { page, pageSize });
  const existing = listed.items.find(isReusableAssistantSession);
  if (existing) {
    return toAssistantSessionView(existing);
  }

  const requestedAt = new Date().toISOString();
  const sessionPayload = {
    sessionKind: 'assistant' as const,
    entrySurface: 'h5' as const,
    sourceModule: 'sdkwork-birdcoder',
  };
  const created = await client.ai.agents.sessions.create(agentId, {
    ...sessionPayload,
    idempotencyKey: uuid(),
    payloadHash: hashPayload(sessionPayload),
    requestedAt,
  });
  return toAssistantSessionView(created);
}

export async function listBirdCoderAssistantSessionItems(
  sessionId: string,
  options: BirdCoderAssistantSessionServiceOptions & {
    page?: number;
    pageSize?: number;
  } = {},
): Promise<BirdCoderAgentSessionItemView[]> {
  const normalizedSessionId = sessionId.trim();
  if (!normalizedSessionId) {
    throw new Error('BirdCoder assistant sessionId is required.');
  }
  const { page, page_size: pageSize } = normalizeOffsetListQuery({
    page: options.page,
    page_size: options.pageSize,
  });
  const listed = await resolveClient(options).ai.agents.sessionItems.list(
    resolveAgentId(options.agentId),
    normalizedSessionId,
    { page, pageSize },
  );
  return listed.items.map(toSessionItemView).filter((item) => item.content.length > 0);
}

export async function submitBirdCoderAssistantTurn(
  sessionId: string,
  content: string,
  options: BirdCoderAssistantTurnOptions = {},
): Promise<BirdCoderAgentSessionItemView[]> {
  const normalizedSessionId = sessionId.trim();
  const normalizedContent = content.trim();
  if (!normalizedSessionId) {
    throw new Error('BirdCoder assistant sessionId is required.');
  }
  if (!normalizedContent) {
    throw new Error('BirdCoder assistant turn content is required.');
  }

  const idempotencyKey = uuid();
  const payload = {
    content: normalizedContent,
    contentType: 'text/plain',
    driveRefs: options.driveRefs ?? [],
    turnMode: 'interactive' as const,
  };
  const completed = await completeAgentTurn(
    resolveClient(options),
    resolveAgentId(options.agentId),
    normalizedSessionId,
    {
      ...payload,
      idempotencyKey,
      payloadHash: hashPayload(payload),
      clientRequestId: idempotencyKey,
      requestedAt: new Date().toISOString(),
    },
  );
  return completed.item.items.map(toSessionItemView).filter((item) => item.content.length > 0);
}
