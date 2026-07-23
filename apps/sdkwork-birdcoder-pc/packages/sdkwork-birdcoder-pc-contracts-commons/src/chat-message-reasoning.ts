import type {
  AgentSessionItemReasoningView as AgentSessionItemReasoningView,
} from './agent-session-view.ts';

export type { AgentSessionItemReasoningView } from './agent-session-view.ts';

export const MAX_CHAT_MESSAGE_REASONING_ITEMS = 32;
export const MAX_CHAT_MESSAGE_REASONING_ID_CHARACTERS = 256;
export const MAX_CHAT_MESSAGE_REASONING_TITLE_CHARACTERS = 256;
export const MAX_CHAT_MESSAGE_REASONING_SUMMARY_CHARACTERS = 8_000;

const MAX_CHAT_MESSAGE_REASONING_TIMESTAMP_CHARACTERS = 64;
const MAX_CHAT_MESSAGE_REASONING_INPUT_ITEMS = 128;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBoundedString(value: unknown, maxCharacters: number): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  return normalized.length > maxCharacters
    ? normalized.slice(0, maxCharacters)
    : normalized;
}

function readTimestamp(value: unknown): string | undefined {
  const timestamp = readBoundedString(
    value,
    MAX_CHAT_MESSAGE_REASONING_TIMESTAMP_CHARACTERS,
  );
  if (!timestamp) {
    return undefined;
  }
  const parsedTimestamp = Date.parse(timestamp);
  return Number.isFinite(parsedTimestamp)
    ? new Date(parsedTimestamp).toISOString()
    : undefined;
}

function readDurationMs(value: unknown): number | undefined {
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value < 0
    || value > Number.MAX_SAFE_INTEGER
  ) {
    return undefined;
  }
  return Math.floor(value);
}

function normalizeReasoningItem(value: unknown): AgentSessionItemReasoningView | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = readBoundedString(value.id, MAX_CHAT_MESSAGE_REASONING_ID_CHARACTERS);
  const summary = readBoundedString(
    value.summary,
    MAX_CHAT_MESSAGE_REASONING_SUMMARY_CHARACTERS,
  );
  if (!id || !summary) {
    return null;
  }
  const title = readBoundedString(
    value.title,
    MAX_CHAT_MESSAGE_REASONING_TITLE_CHARACTERS,
  );
  const createdAt = readTimestamp(value.createdAt);
  const startedAt = readTimestamp(value.startedAt);
  const completedAt = readTimestamp(value.completedAt);
  const durationMs = readDurationMs(value.durationMs);
  return {
    id,
    summary,
    ...(title ? { title } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(completedAt ? { completedAt } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
  };
}

export function normalizeChatMessageReasoning(
  values: readonly unknown[] | undefined,
): AgentSessionItemReasoningView[] {
  if (!values || values.length === 0) {
    return [];
  }
  const order: string[] = [];
  const itemsById = new Map<string, AgentSessionItemReasoningView>();
  for (const value of values.slice(0, MAX_CHAT_MESSAGE_REASONING_INPUT_ITEMS)) {
    const item = normalizeReasoningItem(value);
    if (!item) {
      continue;
    }
    if (!itemsById.has(item.id)) {
      if (order.length >= MAX_CHAT_MESSAGE_REASONING_ITEMS) {
        continue;
      }
      order.push(item.id);
    }
    itemsById.set(item.id, item);
  }
  return order.flatMap((id) => {
    const item = itemsById.get(id);
    return item ? [item] : [];
  });
}

export function mergeChatMessageReasoning(
  ...sources: Array<readonly unknown[] | undefined>
): AgentSessionItemReasoningView[] {
  const order: string[] = [];
  const itemsById = new Map<string, AgentSessionItemReasoningView>();
  for (const source of sources) {
    for (const item of normalizeChatMessageReasoning(source)) {
      if (!itemsById.has(item.id)) {
        if (order.length >= MAX_CHAT_MESSAGE_REASONING_ITEMS) {
          continue;
        }
        order.push(item.id);
      }
      itemsById.set(item.id, item);
    }
  }
  return order.flatMap((id) => {
    const item = itemsById.get(id);
    return item ? [item] : [];
  });
}
