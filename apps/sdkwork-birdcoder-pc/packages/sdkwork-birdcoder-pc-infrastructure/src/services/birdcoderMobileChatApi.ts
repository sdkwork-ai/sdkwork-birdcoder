import type { BirdCoderChatMessageRecord } from '@sdkwork/birdcoder-pc-types';
import { clampListPageSize } from '@sdkwork/utils/pagination';

import { getBirdCoderGeneratedAppSdkClient } from './sdkClients.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object';
}

function readItem<T>(payload: unknown): T {
  if (!isRecord(payload)) {
    return payload as T;
  }
  if (isRecord(payload.data) && 'item' in payload.data) {
    return payload.data.item as T;
  }
  if ('item' in payload) {
    return payload.item as T;
  }
  if ('data' in payload) {
    return payload.data as T;
  }
  return payload as T;
}

function readItems<T>(payload: unknown): T[] {
  if (!isRecord(payload)) {
    return [];
  }
  if (Array.isArray(payload.items)) {
    return payload.items as T[];
  }
  if (isRecord(payload.data) && Array.isArray(payload.data.items)) {
    return payload.data.items as T[];
  }
  return [];
}

interface ChatConversationSummary {
  id: string;
  title: string;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessageSummary {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: string;
}

function toChatMessageRecord(message: ChatMessageSummary): BirdCoderChatMessageRecord {
  return {
    id: message.id,
    role: message.role as BirdCoderChatMessageRecord['role'],
    content: message.content,
    createdAt: message.createdAt,
  };
}

export async function ensureBirdCoderMobileChatConversation(): Promise<string> {
  const client = getBirdCoderGeneratedAppSdkClient();
  const listed = await client.system.chat.conversations.list();
  const conversations = readItems<ChatConversationSummary>(listed);
  const existing = conversations[0];
  if (existing?.id) {
    return existing.id;
  }
  const created = await client.system.chat.conversations.create({});
  return readItem<ChatConversationSummary>(created).id;
}

export async function listBirdCoderMobileChatMessages(
  conversationId: string,
  options: { offset?: number; limit?: number } = {},
): Promise<BirdCoderChatMessageRecord[]> {
  const { offset, pageSize } = clampListPageSize(options.offset, options.limit);
  const client = getBirdCoderGeneratedAppSdkClient();
  const listed = await client.system.chat.conversations.messages.list(
    { conversationId },
    { offset, limit: pageSize },
  );
  return readItems<ChatMessageSummary>(listed).map(toChatMessageRecord);
}

export async function sendBirdCoderMobileChatMessage(
  conversationId: string,
  content: string,
): Promise<BirdCoderChatMessageRecord> {
  const client = getBirdCoderGeneratedAppSdkClient();
  const created = await client.system.chat.conversations.messages.create(
    { conversationId },
    { role: 'user', content },
  );
  return toChatMessageRecord(readItem<ChatMessageSummary>(created));
}
