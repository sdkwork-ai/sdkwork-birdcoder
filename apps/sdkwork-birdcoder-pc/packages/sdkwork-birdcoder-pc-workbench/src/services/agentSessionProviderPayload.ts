import {
  normalizeAgentSessionItemResources,
  type AgentSessionItemReasoningView,
  type AgentSessionItemResourceView,
  type AgentSessionItemView,
} from '@sdkwork/birdcoder-pc-contracts-commons';

const MAX_PROVIDER_PAYLOAD_NODES = 128;
const MAX_PROVIDER_TEXT_ITEMS = 32;
const MAX_PROVIDER_TEXT_CHARACTERS = 64_000;
const MAX_PROVIDER_REASONING_ITEMS = 32;
const MAX_PROVIDER_REASONING_CHARACTERS = 8_000;
const MAX_PROVIDER_SERIALIZED_INPUT_CHARACTERS = 64_000;

const PROVIDER_TOOL_BLOCK_TYPES = new Set([
  'mcp_tool_use',
  'server_tool_use',
  'tool',
  'tool_call_confirmation',
  'tool_call_request',
  'tool_call_response',
  'tool_result',
  'tool_use',
]);

const PROVIDER_PAYLOAD_CHILD_KEYS = [
  'contentBlock',
  'content_block',
  'delta',
  'event',
  'item',
  'message',
  'params',
  'part',
  'parts',
  'payload',
  'properties',
  'value',
] as const;

export interface AgentSessionProviderPayloadViewFields {
  consumesToolPayload: true;
  content?: string;
  reasoning?: AgentSessionItemReasoningView[];
  resources?: AgentSessionItemResourceView[];
  role?: AgentSessionItemView['role'];
  toolCalls?: unknown[];
}

export interface ResolveAgentSessionProviderPayloadOptions {
  completedAt?: string | null;
  createdAt: string;
  itemId: string;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readStructuredValue(value: unknown): unknown {
  if (
    typeof value !== 'string'
    || value.length > MAX_PROVIDER_SERIALIZED_INPUT_CHARACTERS
  ) {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
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

function normalizeProviderPayloadType(value: unknown): string {
  return readBoundedString(value, 128)
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .toLowerCase()
    .replace(/[./\-\s]+/gu, '_');
}

function resolveProviderPayloadType(record: Record<string, unknown>): string {
  return normalizeProviderPayloadType(
    record.type ?? record.method ?? record.sessionUpdate,
  );
}

function resolveProviderEnvelopePayload(
  record: Record<string, unknown>,
): Record<string, unknown> {
  return readRecord(record.params)
    ?? readRecord(record.properties)
    ?? record;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.slice(0, MAX_PROVIDER_TEXT_ITEMS).flatMap((item) => {
    const text = readBoundedString(item, MAX_PROVIDER_REASONING_CHARACTERS);
    return text ? [text] : [];
  });
}

function readReasoningSummary(
  record: Record<string, unknown>,
  type: string,
): { summary: string; title: string } | null {
  const payload = resolveProviderEnvelopePayload(record);
  if (type === 'thought') {
    const value = readRecord(payload.value);
    const title = readBoundedString(value?.subject, 256);
    const description = readBoundedString(
      value?.description ?? payload.value,
      MAX_PROVIDER_REASONING_CHARACTERS,
    );
    return description || title
      ? { summary: description || title, title }
      : null;
  }

  const summaryParts = [
    ...readStringArray(payload.summary),
    ...readStringArray(payload.content),
  ];
  const summary = readBoundedString(
    payload.thinking ?? payload.text ?? payload.delta,
    MAX_PROVIDER_REASONING_CHARACTERS,
  ) || summaryParts.join('\n').slice(0, MAX_PROVIDER_REASONING_CHARACTERS);
  return summary ? { summary, title: '' } : null;
}

function resolveProviderFileResource(
  record: Record<string, unknown>,
  index: number,
  type = resolveProviderPayloadType(record),
): unknown {
  const mimeType = readBoundedString(record.mime ?? record.mimeType, 128);
  const name = readBoundedString(record.filename ?? record.fileName ?? record.name, 256);
  const url = readBoundedString(record.url ?? record.uri, 4_096);
  const source = readRecord(record.source);
  const path = readBoundedString(source?.path ?? record.path, 4_096);
  const kind = type === 'image_view' || mimeType.startsWith('image/')
    ? 'image'
    : mimeType.startsWith('audio/')
      ? 'audio'
      : 'file';
  const canUseUri = /^(?:drive|file|https?):\/\//iu.test(url);
  return {
    id: readBoundedString(record.id, 256) || `provider-file-${index + 1}`,
    kind,
    ...(name ? { name } : {}),
    ...(path ? { path } : {}),
    ...(canUseUri ? { uri: url } : {}),
    ...(kind === 'image' || kind === 'audio' ? { mediaSource: url } : {}),
    ...(mimeType ? { mimeType } : {}),
    ...(source ? {
      origin: {
        kind: normalizeProviderPayloadType(source.type) || 'file',
        ...(readBoundedString(source.path, 4_096) ? { path: readBoundedString(source.path, 4_096) } : {}),
        ...(readBoundedString(source.uri, 4_096) ? { uri: readBoundedString(source.uri, 4_096) } : {}),
        ...(readBoundedString(source.clientName, 256)
          ? { clientName: readBoundedString(source.clientName, 256) }
          : {}),
      },
    } : {}),
  };
}

function readProviderContentText(
  record: Record<string, unknown>,
  type: string,
): string {
  const payload = resolveProviderEnvelopePayload(record);
  if (
    type === 'agent_message'
    || type === 'agent_message_delta'
    || type === 'item_agent_message_delta'
    || type === 'item_plan_delta'
    || type === 'message_part_delta'
    || type === 'plan'
    || type === 'response_output_text_delta'
    || type === 'text'
    || type === 'text_delta'
    || type === 'output_text'
  ) {
    return readBoundedString(payload.text ?? payload.delta, MAX_PROVIDER_TEXT_CHARACTERS);
  }
  if (type === 'content' || type === 'citation' || type === 'model_info') {
    return readBoundedString(payload.value, MAX_PROVIDER_TEXT_CHARACTERS);
  }
  if (type === 'gemini' || type === 'gemini_content') {
    return readBoundedString(payload.content ?? payload.text, MAX_PROVIDER_TEXT_CHARACTERS);
  }
  if (type === 'message' && normalizeProviderPayloadType(payload.role) === 'assistant') {
    return readBoundedString(payload.content, MAX_PROVIDER_TEXT_CHARACTERS);
  }
  return '';
}

export function resolveAgentSessionProviderPayload(
  values: readonly unknown[],
  options: ResolveAgentSessionProviderPayloadOptions,
): AgentSessionProviderPayloadViewFields | null {
  const contentItems: string[] = [];
  const contentKeys = new Set<string>();
  const reasoningItems: AgentSessionItemReasoningView[] = [];
  const reasoningKeys = new Set<string>();
  const resourceInputs: unknown[] = [];
  const toolCalls: unknown[] = [];
  const toolCallKeys = new Set<string>();
  const pendingValues: unknown[] = [];
  const visitedRecords = new WeakSet<object>();
  let consumed = false;
  let retainedContentCharacters = 0;
  let pendingValueIndex = 0;

  const enqueueValue = (value: unknown): void => {
    if (pendingValues.length >= MAX_PROVIDER_PAYLOAD_NODES) {
      return;
    }
    pendingValues.push(readStructuredValue(value));
  };
  const enqueueValues = (nextValues: readonly unknown[]): void => {
    for (const value of nextValues) {
      enqueueValue(value);
      if (pendingValues.length >= MAX_PROVIDER_PAYLOAD_NODES) {
        return;
      }
    }
  };
  enqueueValues(values);

  const appendContent = (value: string): void => {
    if (
      !value
      || contentItems.length >= MAX_PROVIDER_TEXT_ITEMS
      || retainedContentCharacters >= MAX_PROVIDER_TEXT_CHARACTERS
    ) {
      return;
    }
    const remainingCharacters = MAX_PROVIDER_TEXT_CHARACTERS - retainedContentCharacters;
    const bounded = value.slice(0, remainingCharacters).trim();
    if (!bounded || contentKeys.has(bounded)) {
      return;
    }
    contentKeys.add(bounded);
    contentItems.push(bounded);
    retainedContentCharacters += bounded.length;
  };

  while (pendingValueIndex < pendingValues.length) {
    const value = pendingValues[pendingValueIndex];
    pendingValueIndex += 1;
    if (Array.isArray(value)) {
      enqueueValues(value);
      continue;
    }
    const record = readRecord(value);
    if (!record || visitedRecords.has(record)) {
      continue;
    }
    visitedRecords.add(record);

    const type = resolveProviderPayloadType(record);
    if (PROVIDER_TOOL_BLOCK_TYPES.has(type)) {
      const callId = readBoundedString(
        record.id ?? record.callID ?? record.callId ?? record.tool_use_id,
        256,
      );
      const key = callId || `${type}:${toolCalls.length}`;
      if (!toolCallKeys.has(key)) {
        toolCallKeys.add(key);
        toolCalls.push(record);
      }
      const state = readRecord(record.state);
      if (Array.isArray(state?.attachments)) {
        enqueueValues(state.attachments);
      }
      consumed = true;
      continue;
    }

    const contentText = readProviderContentText(record, type);
    if (contentText) {
      appendContent(contentText);
      consumed = true;
    }

    if (
      type === 'reasoning'
      || type === 'reasoning_delta'
      || type === 'reasoning_summary_text_delta'
      || type === 'item_reasoning_summary_text_delta'
      || type === 'item_reasoning_text_delta'
      || type === 'thinking'
      || type === 'thinking_delta'
      || type === 'thought'
    ) {
      const reasoning = readReasoningSummary(record, type);
      if (reasoning && reasoningItems.length < MAX_PROVIDER_REASONING_ITEMS) {
        const recordId = readBoundedString(record.id, 256);
        const key = recordId || `${type}:${reasoning.summary}`;
        if (!reasoningKeys.has(key)) {
          reasoningKeys.add(key);
          const completedAt = options.completedAt?.trim() || undefined;
          reasoningItems.push({
            id: recordId || `${options.itemId}:provider-reasoning:${reasoningItems.length + 1}`,
            summary: reasoning.summary,
            ...(reasoning.title ? { title: reasoning.title } : {}),
            createdAt: options.createdAt,
            startedAt: options.createdAt,
            ...(completedAt ? { completedAt } : {}),
          });
        }
      }
      consumed = true;
    }

    if (type === 'file' || type === 'image_view') {
      resourceInputs.push(resolveProviderFileResource(record, resourceInputs.length, type));
      consumed = true;
    }

    for (const key of PROVIDER_PAYLOAD_CHILD_KEYS) {
      const child = record[key];
      if (child !== undefined && child !== null) {
        enqueueValue(child);
      }
    }
    const role = normalizeProviderPayloadType(record.role);
    if (
      Array.isArray(record.content)
      && (type === 'assistant' || type === 'message' || role === 'assistant')
    ) {
      enqueueValues(record.content);
    }
  }

  const resources = normalizeAgentSessionItemResources(resourceInputs);
  if (!consumed && resources.length === 0) {
    return null;
  }
  const hasAssistantContent = contentItems.length > 0
    || reasoningItems.length > 0
    || resources.length > 0;
  return {
    consumesToolPayload: true,
    ...(contentItems.length > 0 ? { content: contentItems.join('\n\n') } : {}),
    ...(reasoningItems.length > 0 ? { reasoning: reasoningItems } : {}),
    ...(resources.length > 0 ? { resources } : {}),
    ...(hasAssistantContent ? { role: 'assistant' } : {}),
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
  };
}
