import {
  completeAgentTurn,
  type AgentSessionItemRecord,
  type AgentSessionRecord,
  type CreateAgentTurnRequest,
  type SdkworkAppClient as AgentsAppClient,
} from '@sdkwork/agents-app-sdk';
import { sha256Hash } from '@sdkwork/utils/crypto';
import { uuid } from '@sdkwork/utils/id';
import {
  DEFAULT_LIST_PAGE_SIZE,
  MAX_LIST_PAGE_SIZE,
  normalizeOffsetListQuery,
} from '@sdkwork/utils/pagination';

import { getBirdCoderH5AgentsAppClient } from './dependencySdkClients.ts';

export const BIRDCODER_ASSISTANT_AGENT_ID = 'agent.birdcoder';

export type BirdCoderAgentSessionItemRole = 'user' | 'assistant' | 'system';

export interface BirdCoderAssistantSessionView {
  sessionId: string;
  itemCount: number;
}

export interface BirdCoderAssistantSessionItemPage {
  items: BirdCoderAgentSessionItemView[];
  pageInfo: {
    hasMore: boolean;
    mode: 'cursor';
    nextCursor: string | null;
    pageSize: number;
  };
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

export interface BirdCoderAssistantSessionItemListOptions
  extends BirdCoderAssistantSessionServiceOptions {
  cursor?: string;
  pageSize?: number;
}

export interface BirdCoderAssistantTurnOptions
  extends BirdCoderAssistantSessionServiceOptions {
  driveRefs?: CreateAgentTurnRequest['driveRefs'];
}

const SESSION_ITEM_CURSOR_MAX_LENGTH = 2_048;

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

function normalizeSessionItemListOptions(
  options: BirdCoderAssistantSessionItemListOptions,
) {
  const pageSize = options.pageSize ?? DEFAULT_LIST_PAGE_SIZE;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_LIST_PAGE_SIZE) {
    throw new Error('BirdCoder assistant Session Item page size must be between 1 and 200.');
  }
  const cursor = options.cursor;
  if (
    cursor !== undefined
    && (
      cursor.length < 1
      || cursor.length > SESSION_ITEM_CURSOR_MAX_LENGTH
      || cursor.trim() !== cursor
    )
  ) {
    throw new Error('BirdCoder assistant Session Item cursor must be between 1 and 2048 characters.');
  }
  return { cursor, pageSize };
}

function normalizeSessionItemPage(
  page: Awaited<ReturnType<AgentsAppClient['ai']['agents']['sessionItems']['list']>>,
  request: ReturnType<typeof normalizeSessionItemListOptions>,
): BirdCoderAssistantSessionItemPage {
  const { pageInfo } = page;
  if (pageInfo.mode !== 'cursor') {
    throw new Error('BirdCoder assistant Session Item list must use cursor pagination.');
  }
  if (pageInfo.pageSize !== request.pageSize) {
    throw new Error('BirdCoder assistant Session Item list returned an unexpected page size.');
  }
  if (typeof pageInfo.hasMore !== 'boolean') {
    throw new Error('BirdCoder assistant Session Item list omitted its continuation state.');
  }
  const nextCursor = pageInfo.nextCursor;
  if (
    pageInfo.hasMore
    && (
      typeof nextCursor !== 'string'
      || nextCursor.length < 1
      || nextCursor.length > SESSION_ITEM_CURSOR_MAX_LENGTH
      || nextCursor.trim() !== nextCursor
      || nextCursor === request.cursor
    )
  ) {
    throw new Error('BirdCoder assistant Session Item list returned a non-progressing cursor.');
  }
  if (!pageInfo.hasMore && nextCursor !== null) {
    throw new Error('BirdCoder assistant Session Item terminal page must return a null cursor.');
  }
  const items = page.items
    .map(toSessionItemView)
    .filter((item) => item.content.length > 0)
    .sort((left, right) => {
      const leftSequence = BigInt(left.sequence);
      const rightSequence = BigInt(right.sequence);
      return leftSequence < rightSequence ? -1 : leftSequence > rightSequence ? 1 : 0;
    });
  return {
    items,
    pageInfo: {
      hasMore: pageInfo.hasMore,
      mode: 'cursor',
      nextCursor: nextCursor ?? null,
      pageSize: request.pageSize,
    },
  };
}

export async function ensureBirdCoderAssistantSession(
  options: BirdCoderAssistantSessionServiceOptions = {},
): Promise<BirdCoderAssistantSessionView> {
  const agentId = resolveAgentId(options.agentId);
  const client = resolveClient(options);
  const { page_size: pageSize } = normalizeOffsetListQuery();
  let page = 1;

  for (;;) {
    const listed = await client.ai.agents.sessions.list(agentId, { page, pageSize });
    const existing = listed.items.find(isReusableAssistantSession);
    if (existing) {
      return toAssistantSessionView(existing);
    }

    const hasMore = listed.pageInfo.hasMore
      ?? (listed.pageInfo.totalPages === undefined
        ? undefined
        : page < listed.pageInfo.totalPages);
    if (hasMore === false) {
      break;
    }
    if (hasMore !== true) {
      throw new Error('Agents session pagination response is missing a usable continuation state.');
    }
    page += 1;
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
  options: BirdCoderAssistantSessionItemListOptions = {},
): Promise<BirdCoderAssistantSessionItemPage> {
  const normalizedSessionId = sessionId.trim();
  if (!normalizedSessionId) {
    throw new Error('BirdCoder assistant sessionId is required.');
  }
  const request = normalizeSessionItemListOptions(options);
  const listed = await resolveClient(options).ai.agents.sessionItems.list(
    resolveAgentId(options.agentId),
    normalizedSessionId,
    {
      cursor: request.cursor,
      pageSize: request.pageSize,
      sort: '-sequence',
    },
  );
  return normalizeSessionItemPage(listed, request);
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
  return completed.items.map(toSessionItemView).filter((item) => item.content.length > 0);
}
