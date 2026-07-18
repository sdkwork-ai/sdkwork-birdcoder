export type {
  BirdCoderChatMessageToolCall as ChatMessageToolCall,
} from '@sdkwork/birdcoder-chat-contracts';
import type { BirdCoderChatMessageToolCall as ChatMessageToolCall } from '@sdkwork/birdcoder-chat-contracts';

function readNonEmptyString(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : '';
}

function readToolCallRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readToolCallFunction(value: unknown): Record<string, unknown> | null {
  const record = readToolCallRecord(value);
  if (!record) {
    return null;
  }

  return readToolCallRecord(record.function);
}

function formatToolCallArguments(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value === undefined || value === null) {
    return '';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function resolveToolCallName(record: Record<string, unknown>): string | null {
  const directName = readNonEmptyString(record.name)
    || readNonEmptyString(record.toolName)
    || readNonEmptyString(record.tool_name);
  if (directName) {
    return directName;
  }

  const functionRecord = readToolCallFunction(record);
  if (!functionRecord) {
    return null;
  }

  return readNonEmptyString(functionRecord.name);
}

function resolveToolCallArguments(record: Record<string, unknown>): string {
  if ('arguments' in record) {
    return formatToolCallArguments(record.arguments);
  }

  if ('input' in record) {
    return formatToolCallArguments(record.input);
  }

  const functionRecord = readToolCallFunction(record);
  if (!functionRecord) {
    return '';
  }

  return formatToolCallArguments(functionRecord.arguments);
}

function resolveToolCallId(record: Record<string, unknown>, index: number): string {
  return readNonEmptyString(record.id)
    || readNonEmptyString(record.tool_call_id)
    || readNonEmptyString(record.toolCallId)
    || `tool-call-${index + 1}`;
}

function resolveToolCallType(record: Record<string, unknown>): string {
  return readNonEmptyString(record.type) || 'function';
}

export function projectChatMessageToolCall(
  value: unknown,
  index: number,
): ChatMessageToolCall | null {
  if (typeof value === 'string') {
    const content = value.trim();
    if (!content) {
      return null;
    }

    return {
      id: `tool-call-${index + 1}`,
      type: 'function',
      name: 'tool',
      arguments: content,
    };
  }

  const record = readToolCallRecord(value);
  if (!record) {
    return null;
  }

  const name = resolveToolCallName(record);
  const argumentsText = resolveToolCallArguments(record);
  if (!name && !argumentsText) {
    return null;
  }

  return {
    id: resolveToolCallId(record, index),
    type: resolveToolCallType(record),
    name: name ?? 'tool',
    arguments: argumentsText,
  };
}

export function projectChatMessageToolCalls(
  toolCalls: readonly unknown[] | undefined,
): ChatMessageToolCall[] {
  if (!toolCalls || toolCalls.length === 0) {
    return [];
  }

  return toolCalls.flatMap((toolCall, index) => {
    const projected = projectChatMessageToolCall(toolCall, index);
    return projected ? [projected] : [];
  });
}
