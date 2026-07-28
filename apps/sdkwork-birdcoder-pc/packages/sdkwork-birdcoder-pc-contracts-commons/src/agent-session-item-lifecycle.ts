import type {
  AgentSessionItemLifecycleEventKind,
  AgentSessionItemLifecycleEventView,
  AgentSessionItemTokenUsageView,
} from './agent-session-view.ts';

export type {
  AgentSessionItemLifecycleEventKind,
  AgentSessionItemLifecycleEventView,
  AgentSessionItemTokenUsageView,
} from './agent-session-view.ts';

export const MAX_AGENT_SESSION_ITEM_LIFECYCLE_EVENTS = 32;

const MAX_LIFECYCLE_INPUT_EVENTS = 128;
const MAX_LIFECYCLE_ID_CHARACTERS = 256;
const MAX_LIFECYCLE_DETAIL_CHARACTERS = 8_000;
const MAX_LIFECYCLE_REASON_CHARACTERS = 1_000;
const MAX_LIFECYCLE_SERIALIZED_RECORD_CHARACTERS = 64_000;
const MAX_LIFECYCLE_TIMESTAMP_CHARACTERS = 64;
const PROVIDER_CAMEL_CASE_MESSAGE_IDENTIFIER_KEY = ['message', 'Id'].join('');
const LIFECYCLE_EVENT_KINDS = new Set<AgentSessionItemLifecycleEventKind>([
  'started', 'completed', 'retrying', 'compacted', 'checkpoint', 'blocked',
  'stopped', 'cancelled', 'failed',
]);

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readStructuredRecord(value: unknown): Record<string, unknown> | null {
  const record = readRecord(value);
  if (record) {
    return record;
  }
  if (typeof value !== 'string' || value.length > MAX_LIFECYCLE_SERIALIZED_RECORD_CHARACTERS) {
    return null;
  }
  try {
    return readRecord(JSON.parse(value));
  } catch {
    return null;
  }
}

function readBoundedString(value: unknown, maxCharacters: number): string {
  if (typeof value !== 'string') {
    return '';
  }
  const normalized = value.trim();
  return normalized.length > maxCharacters
    ? normalized.slice(0, maxCharacters)
    : normalized;
}

function normalizeProtocolType(value: unknown): string {
  return readBoundedString(value, 128)
    .toLowerCase()
    .replace(/[.\-\s]+/gu, '_');
}

function readFiniteNonNegativeNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return value;
}

function readInteger(value: unknown): number | undefined {
  const number = readFiniteNonNegativeNumber(value);
  return number === undefined ? undefined : Math.floor(number);
}

function readFirstNumber(
  record: Record<string, unknown> | null,
  keys: readonly string[],
): number | undefined {
  if (!record) {
    return undefined;
  }
  for (const key of keys) {
    const value = readFiniteNonNegativeNumber(record[key]);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function readFirstString(
  record: Record<string, unknown> | null,
  keys: readonly string[],
  maxCharacters: number,
): string {
  if (!record) {
    return '';
  }
  for (const key of keys) {
    const value = readBoundedString(record[key], maxCharacters);
    if (value) {
      return value;
    }
  }
  return '';
}

function unwrapProtocolRecord(value: unknown): Record<string, unknown> | null {
  const record = readStructuredRecord(value);
  if (!record) {
    return null;
  }

  let unwrapped = record;
  for (let depth = 0; depth < 4; depth += 1) {
    let nestedRecord: Record<string, unknown> | null = null;
    for (const key of [
      'item', 'part', 'contentBlock', 'content_block', 'event',
      'output', 'result', 'toolResult', 'tool_result',
    ]) {
      const nested = readStructuredRecord(unwrapped[key]);
      if (nested && nested !== unwrapped) {
        nestedRecord = nested;
        break;
      }
    }
    if (!nestedRecord) {
      return unwrapped;
    }
    unwrapped = { ...unwrapped, ...nestedRecord };
  }
  return unwrapped;
}

function readUsage(record: Record<string, unknown>): AgentSessionItemTokenUsageView | undefined {
  const value = readRecord(record.value);
  const usage = readRecord(record.usage)
    ?? readRecord(record.tokens)
    ?? readRecord(record.usageMetadata)
    ?? readRecord(record.usage_metadata)
    ?? readRecord(value?.usageMetadata)
    ?? readRecord(value?.usage_metadata);
  if (!usage) {
    return undefined;
  }
  const cache = readRecord(usage.cache);
  const inputTokens = readFirstNumber(usage, [
    'input', 'inputTokens', 'input_tokens', 'promptTokenCount', 'prompt_token_count',
  ]);
  const outputTokens = readFirstNumber(usage, [
    'output', 'outputTokens', 'output_tokens', 'candidatesTokenCount', 'candidates_token_count',
  ]);
  const reasoningTokens = readFirstNumber(usage, [
    'reasoning', 'reasoningTokens', 'reasoning_tokens', 'reasoningOutputTokens',
    'reasoning_output_tokens', 'thoughtsTokenCount', 'thoughts_token_count',
  ]);
  const cacheReadTokens = readFirstNumber(usage, [
    'cacheRead', 'cache_read', 'cacheReadTokens', 'cachedInputTokens', 'cached_input_tokens',
    'cachedContentTokenCount', 'cached_content_token_count',
  ]) ?? readFirstNumber(cache, ['read']);
  const cacheWriteTokens = readFirstNumber(usage, [
    'cacheWrite', 'cache_write', 'cacheWriteTokens', 'cacheWriteInputTokens',
    'cache_write_input_tokens',
  ]) ?? readFirstNumber(cache, ['write']);
  const totalTokens = readFirstNumber(usage, [
    'total', 'totalTokens', 'total_tokens', 'totalTokenCount', 'total_token_count',
  ]);
  if (
    inputTokens === undefined
    && outputTokens === undefined
    && reasoningTokens === undefined
    && cacheReadTokens === undefined
    && cacheWriteTokens === undefined
    && totalTokens === undefined
  ) {
    return undefined;
  }
  return {
    ...(inputTokens !== undefined ? { inputTokens: Math.floor(inputTokens) } : {}),
    ...(outputTokens !== undefined ? { outputTokens: Math.floor(outputTokens) } : {}),
    ...(reasoningTokens !== undefined ? { reasoningTokens: Math.floor(reasoningTokens) } : {}),
    ...(cacheReadTokens !== undefined ? { cacheReadTokens: Math.floor(cacheReadTokens) } : {}),
    ...(cacheWriteTokens !== undefined ? { cacheWriteTokens: Math.floor(cacheWriteTokens) } : {}),
    ...(totalTokens !== undefined ? { totalTokens: Math.floor(totalTokens) } : {}),
  };
}

function readErrorMessage(value: unknown, depth = 0): string {
  if (depth >= 4) {
    return '';
  }
  const direct = readBoundedString(value, MAX_LIFECYCLE_DETAIL_CHARACTERS);
  if (direct) {
    return direct;
  }
  const record = readRecord(value);
  if (!record) {
    return '';
  }
  const message = readFirstString(
    record,
    ['message', 'detail', 'reason', 'systemMessage', 'system_message', 'responseBody'],
    MAX_LIFECYCLE_DETAIL_CHARACTERS,
  );
  if (message) {
    return message;
  }
  for (const key of ['data', 'error', 'value']) {
    const nested = readErrorMessage(record[key], depth + 1);
    if (nested) {
      return nested;
    }
  }
  return '';
}

function readLifecycleKind(
  record: Record<string, unknown>,
): AgentSessionItemLifecycleEventKind | null {
  const type = normalizeProtocolType(record.type);
  const subtype = normalizeProtocolType(record.subtype);
  if (type === 'step_start' || type === 'turn_started') return 'started';
  if (type === 'step_finish' || type === 'turn_completed' || type === 'finished') return 'completed';
  if (type === 'retry' || type === 'rate_limit_event') return 'retrying';
  if (
    type === 'compaction'
    || type === 'chat_compressed'
    || (type === 'system' && subtype === 'compact_boundary')
  ) return 'compacted';
  if (type === 'snapshot') return 'checkpoint';
  if (type === 'agent_execution_blocked' || type === 'context_window_will_overflow') return 'blocked';
  if (type === 'agent_execution_stopped' || type === 'max_session_turns' || type === 'loop_detected') {
    return 'stopped';
  }
  if (type === 'user_cancelled' || type === 'cancelled' || type === 'canceled') return 'cancelled';
  if (type === 'turn_failed' || type === 'invalid_stream') return 'failed';
  const isClaudeResult = type === 'result' && (
    Boolean(subtype)
    || typeof record.duration_ms === 'number'
    || typeof record.duration_api_ms === 'number'
    || typeof record.num_turns === 'number'
    || typeof record.is_error === 'boolean'
    || typeof record.total_cost_usd === 'number'
    || readRecord(record.usage) !== null
  );
  if (isClaudeResult) {
    return record.is_error === true || subtype.startsWith('error_') ? 'failed' : 'completed';
  }
  if (type === 'error' && ('error' in record || 'message' in record || 'value' in record)) {
    return 'failed';
  }
  return null;
}

function readTimestamp(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
  }
  const timestamp = readBoundedString(value, MAX_LIFECYCLE_TIMESTAMP_CHARACTERS);
  if (!timestamp) {
    return undefined;
  }
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function readDurationMs(record: Record<string, unknown>): number | undefined {
  const direct = readFirstNumber(record, ['durationMs', 'duration_ms']);
  if (direct !== undefined) {
    return Math.floor(direct);
  }
  const time = readRecord(record.time);
  const startedAt = readFirstNumber(time, ['start', 'startedAt', 'started_at']);
  const completedAt = readFirstNumber(time, ['end', 'completedAt', 'completed_at']);
  return startedAt !== undefined && completedAt !== undefined && completedAt >= startedAt
    ? Math.floor(completedAt - startedAt)
    : undefined;
}

function readCompressionDetail(record: Record<string, unknown>): string {
  const value = readRecord(record.value) ?? record;
  const originalTokens = readFirstNumber(value, [
    'originalTokenCount', 'original_token_count', 'preTokens', 'pre_tokens',
  ]);
  const newTokens = readFirstNumber(value, ['newTokenCount', 'new_token_count']);
  if (originalTokens !== undefined && newTokens !== undefined) {
    return `${Math.floor(originalTokens)} -> ${Math.floor(newTokens)} tokens`;
  }
  if (originalTokens !== undefined) {
    return `${Math.floor(originalTokens)} tokens before compaction`;
  }
  return record.overflow === true ? 'Context overflow triggered compaction' : '';
}

function readLifecycleDetail(
  record: Record<string, unknown>,
  kind: AgentSessionItemLifecycleEventKind,
): string {
  const value = readRecord(record.value);
  if (kind === 'compacted') {
    return readCompressionDetail(record);
  }
  if (kind === 'checkpoint') {
    return readFirstString(record, ['snapshot'], 512);
  }
  if (kind === 'failed') {
    return readErrorMessage(record.error ?? record.value ?? record);
  }
  if (kind === 'blocked' || kind === 'stopped' || kind === 'cancelled') {
    return readFirstString(
      value ?? record,
      ['reason', 'systemMessage', 'system_message', 'message'],
      MAX_LIFECYCLE_DETAIL_CHARACTERS,
    );
  }
  if (kind === 'retrying') {
    return readErrorMessage(record.error ?? value ?? record);
  }
  return readFirstString(
    value ?? record,
    ['reason', 'finishReason', 'finish_reason', 'stopReason', 'stop_reason'],
    MAX_LIFECYCLE_REASON_CHARACTERS,
  );
}

function normalizeLifecycleEvent(
  value: unknown,
  index: number,
): AgentSessionItemLifecycleEventView | null {
  const record = unwrapProtocolRecord(value);
  if (!record) {
    return null;
  }
  const canonicalKind = normalizeProtocolType(record.kind) as AgentSessionItemLifecycleEventKind;
  const kind = LIFECYCLE_EVENT_KINDS.has(canonicalKind)
    ? canonicalKind
    : readLifecycleKind(record);
  if (!kind) {
    return null;
  }
  const id = readFirstString(
    record,
    ['id', 'uuid', 'eventId', 'event_id', 'messageID', PROVIDER_CAMEL_CASE_MESSAGE_IDENTIFIER_KEY],
    MAX_LIFECYCLE_ID_CHARACTERS,
  ) || `lifecycle-${kind}-${index + 1}`;
  const detail = readBoundedString(record.detail, MAX_LIFECYCLE_DETAIL_CHARACTERS)
    || readLifecycleDetail(record, kind);
  const attempt = readInteger(record.attempt);
  const retryAt = readTimestamp(record.next ?? record.retryAt ?? record.retry_at);
  const durationMs = readDurationMs(record);
  const cost = readFirstNumber(record, ['cost', 'totalCostUsd', 'total_cost_usd']);
  const usage = readUsage(record);
  const automatic = typeof record.auto === 'boolean' ? record.auto : undefined;
  return {
    id,
    kind,
    ...(detail ? { detail } : {}),
    ...(attempt !== undefined ? { attempt } : {}),
    ...(retryAt ? { retryAt } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(cost !== undefined ? { cost } : {}),
    ...(usage ? { usage } : {}),
    ...(automatic !== undefined ? { automatic } : {}),
  };
}

function mergeLifecycleEvents(
  current: AgentSessionItemLifecycleEventView,
  incoming: AgentSessionItemLifecycleEventView,
): AgentSessionItemLifecycleEventView {
  const usage = current.usage || incoming.usage
    ? { ...current.usage, ...incoming.usage }
    : undefined;
  return {
    ...current,
    ...incoming,
    ...(usage ? { usage } : {}),
  };
}

export function isAgentSessionItemLifecycleRecord(value: unknown): boolean {
  return normalizeLifecycleEvent(value, 0) !== null;
}

export function normalizeAgentSessionItemLifecycleEvents(
  values: readonly unknown[] | undefined,
): AgentSessionItemLifecycleEventView[] {
  if (!values?.length) {
    return [];
  }
  const order: string[] = [];
  const eventsById = new Map<string, AgentSessionItemLifecycleEventView>();
  values.slice(0, MAX_LIFECYCLE_INPUT_EVENTS).forEach((value, index) => {
    const event = normalizeLifecycleEvent(value, index);
    if (!event) {
      return;
    }
    if (!eventsById.has(event.id)) {
      if (order.length >= MAX_AGENT_SESSION_ITEM_LIFECYCLE_EVENTS) {
        return;
      }
      order.push(event.id);
    }
    const current = eventsById.get(event.id);
    eventsById.set(event.id, current ? mergeLifecycleEvents(current, event) : event);
  });
  return order.flatMap((id) => {
    const event = eventsById.get(id);
    return event ? [event] : [];
  });
}
