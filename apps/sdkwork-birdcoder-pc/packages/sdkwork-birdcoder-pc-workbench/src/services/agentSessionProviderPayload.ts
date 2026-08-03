import {
  normalizeAgentSessionItemResources,
  resolveTaskProgressDisplayState,
  type AgentSessionItemReasoningView,
  type AgentSessionItemResourceView,
  type AgentSessionTaskProgressView,
  type AgentSessionItemView,
} from '@sdkwork/birdcoder-pc-contracts-commons';

const MAX_PROVIDER_PAYLOAD_NODES = 128;
const MAX_PROVIDER_TEXT_ITEMS = 32;
const MAX_PROVIDER_TEXT_CHARACTERS = 64_000;
const MAX_PROVIDER_REASONING_ITEMS = 32;
const MAX_PROVIDER_REASONING_CHARACTERS = 8_000;
const MAX_PROVIDER_SERIALIZED_INPUT_CHARACTERS = 64_000;

const PROVIDER_TOOL_BLOCK_TYPES = new Set([
  'approval_request',
  'collab_agent_tool_call',
  'command_execution',
  'dynamic_tool_call',
  'file_change',
  'function',
  'function_call',
  'function_call_output',
  'image_generation',
  'image_generation_call',
  'mcp_tool_call',
  'mcp_tool_use',
  'server_tool_use',
  'sleep',
  'sub_agent_activity',
  'tool',
  'tool_call',
  'tool_call_confirmation',
  'tool_call_request',
  'tool_call_response',
  'tool_result',
  'tool_use',
  'web_search',
  'web_search_call',
]);

const PROVIDER_HIDDEN_TRANSCRIPT_TYPES = new Set([
  'entered_review_mode',
  'exited_review_mode',
  'sleep',
]);

const PROVIDER_LIFECYCLE_ONLY_TYPES = new Set([
  'context_compaction',
]);

const PROVIDER_PAYLOAD_CHILD_KEYS = [
  'contentBlock',
  'content_block',
  'data',
  'delta',
  'event',
  'events',
  'item',
  'message',
  'params',
  'part',
  'parts',
  'payload',
  'properties',
  'response',
  'toolCalls',
  'tool_calls',
  'value',
] as const;

export interface AgentSessionProviderPayloadViewFields {
  consumesToolPayload: true;
  content?: string;
  messageCompleted?: boolean;
  messagePhase?: 'commentary' | 'final_answer';
  reasoning?: AgentSessionItemReasoningView[];
  resources?: AgentSessionItemResourceView[];
  role?: AgentSessionItemView['role'];
  taskProgress?: AgentSessionTaskProgressView;
  toolCalls?: unknown[];
}

export interface ResolveAgentSessionProviderPayloadOptions {
  completedAt?: string | null;
  createdAt: string;
  isStreaming?: boolean;
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

function readBoundedRawString(value: unknown, maxCharacters: number): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.length > maxCharacters
    ? value.slice(0, maxCharacters)
    : value;
}

function appendBoundedRawString(
  current: string,
  value: unknown,
  maxCharacters: number,
): string {
  if (typeof value !== 'string' || current.length >= maxCharacters) {
    return current;
  }
  return current + value.slice(0, maxCharacters - current.length);
}

interface OpenCodePartReplayState {
  partKeysByMessage: Map<string, Set<string>>;
  parts: Map<string, Record<string, unknown>>;
  removedMessages: Set<string>;
}

function openCodeMessageKey(sessionId: string, messageId: string): string {
  return `${sessionId}\u0000${messageId}`;
}

function openCodePartKey(sessionId: string, messageId: string, partId: string): string {
  return `${openCodeMessageKey(sessionId, messageId)}\u0000${partId}`;
}

function removeOpenCodePart(
  state: OpenCodePartReplayState,
  sessionId: string,
  messageId: string,
  partId: string,
): void {
  const messageKey = openCodeMessageKey(sessionId, messageId);
  const partKey = openCodePartKey(sessionId, messageId, partId);
  state.parts.delete(partKey);
  const partKeys = state.partKeysByMessage.get(messageKey);
  partKeys?.delete(partKey);
  if (partKeys?.size === 0) {
    state.partKeysByMessage.delete(messageKey);
  }
}

function removeOpenCodeMessage(
  state: OpenCodePartReplayState,
  sessionId: string,
  messageId: string,
): void {
  const messageKey = openCodeMessageKey(sessionId, messageId);
  for (const partKey of state.partKeysByMessage.get(messageKey) ?? []) {
    state.parts.delete(partKey);
  }
  state.partKeysByMessage.delete(messageKey);
  state.removedMessages.add(messageKey);
}

function replayOpenCodeMessageEvent(
  record: Record<string, unknown>,
  state: OpenCodePartReplayState,
): boolean {
  const type = normalizeProviderPayloadType(record.type);
  if (![
    'message_part_delta',
    'message_part_removed',
    'message_part_updated',
    'message_removed',
    'message_updated',
  ].includes(type)) {
    return false;
  }
  const properties = readRecord(record.properties);
  if (!properties) {
    return false;
  }

  if (type === 'message_updated') {
    const info = readRecord(properties.info);
    const sessionId = readBoundedString(
      info?.sessionID ?? properties.sessionID,
      256,
    );
    const messageId = readBoundedString(info?.id, 256);
    const aggregateSessionId = readBoundedString(properties.sessionID, 256);
    if (sessionId && messageId && (!aggregateSessionId || aggregateSessionId === sessionId)) {
      state.removedMessages.delete(openCodeMessageKey(sessionId, messageId));
    }
    return true;
  }

  const sessionId = readBoundedString(properties.sessionID, 256);
  if (type === 'message_removed') {
    const messageId = readBoundedString(properties.messageID, 256);
    if (sessionId && messageId) {
      removeOpenCodeMessage(state, sessionId, messageId);
    }
    return true;
  }

  if (type === 'message_part_updated') {
    const part = readRecord(properties.part);
    const partSessionId = readBoundedString(part?.sessionID, 256);
    const messageId = readBoundedString(part?.messageID, 256);
    const partId = readBoundedString(part?.id, 256);
    if (!part) {
      return true;
    }
    if (!partSessionId || !messageId || !partId) {
      return false;
    }
    const resolvedSessionId = sessionId || partSessionId;
    if (
      (sessionId && sessionId !== partSessionId)
      || state.removedMessages.has(openCodeMessageKey(resolvedSessionId, messageId))
    ) {
      return true;
    }
    const messageKey = openCodeMessageKey(resolvedSessionId, messageId);
    const partKey = openCodePartKey(resolvedSessionId, messageId, partId);
    state.parts.set(partKey, part);
    const partKeys = state.partKeysByMessage.get(messageKey) ?? new Set<string>();
    partKeys.add(partKey);
    state.partKeysByMessage.set(messageKey, partKeys);
    return true;
  }

  const messageId = readBoundedString(properties.messageID, 256);
  const partId = readBoundedString(properties.partID, 256);
  if (!sessionId || !messageId || !partId) {
    return true;
  }
  if (type === 'message_part_removed') {
    removeOpenCodePart(state, sessionId, messageId, partId);
    return true;
  }

  const field = readBoundedString(properties.field, 256);
  if (!field || typeof properties.delta !== 'string') {
    return true;
  }
  const partKey = openCodePartKey(sessionId, messageId, partId);
  const part = state.parts.get(partKey);
  if (!part || state.removedMessages.has(openCodeMessageKey(sessionId, messageId))) {
    return true;
  }
  const current = part[field];
  const currentText = current === undefined || current === null
    ? ''
    : typeof current === 'string'
      ? current
      : String(current);
  state.parts.set(partKey, {
    ...part,
    [field]: appendBoundedRawString(
      currentText,
      properties.delta,
      MAX_PROVIDER_TEXT_CHARACTERS,
    ),
  });
  return true;
}

function normalizeProviderPayloadType(value: unknown): string {
  return readBoundedString(value, 128)
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .toLowerCase()
    .replace(/[./\-\s]+/gu, '_');
}

function resolveProviderPayloadType(record: Record<string, unknown>): string {
  const params = readRecord(record.params);
  if (normalizeProviderPayloadType(record.method) === 'event' && params?.type !== undefined) {
    return normalizeProviderPayloadType(params.type);
  }
  return normalizeProviderPayloadType(
    record.type ?? record.method ?? record.sessionUpdate,
  );
}

function resolveProviderEnvelopePayload(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const params = readRecord(record.params);
  return readRecord(params?.payload)
    ?? readRecord(record.payload)
    ?? params
    ?? readRecord(record.properties)
    ?? record;
}

interface ProviderEventEnvelope {
  payload: Record<string, unknown>;
  type: string;
}

function resolveProviderEventEnvelope(
  record: Record<string, unknown>,
): ProviderEventEnvelope | null {
  const params = readRecord(record.params);
  const isJsonRpcEvent = normalizeProviderPayloadType(record.method) === 'event'
    && params !== null;
  const type = normalizeProviderPayloadType(
    isJsonRpcEvent ? params.type : record.type,
  );
  if (!type) {
    return null;
  }
  const payload = isJsonRpcEvent
    ? readRecord(params.payload) ?? params
    : readRecord(record.payload) ?? record;
  return { payload, type };
}

function readProviderEventPayload(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const params = readRecord(record.params);
  return readRecord(record.data)
    ?? readRecord(record.payload)
    ?? readRecord(params?.payload)
    ?? params
    ?? readRecord(record.properties)
    ?? record;
}

function resolveProviderQuestionRecord(
  record: Record<string, unknown>,
): Record<string, unknown> | null {
  const event = resolveProviderEventEnvelope(record);
  if (!event || !['clarify_request', 'clarify_expire'].includes(event.type)) {
    return null;
  }
  const requestId = readBoundedString(
    event.payload.request_id ?? event.payload.requestId,
    256,
  );
  if (!requestId) {
    return null;
  }
  if (event.type === 'clarify_expire') {
    return {
      id: requestId,
      name: 'question',
      output: { reason: 'expired', requestId },
      requiresResponse: false,
      status: 'cancelled',
      type: 'tool_result',
    };
  }

  const question = readBoundedString(
    event.payload.question ?? event.payload.prompt,
    MAX_PROVIDER_TEXT_CHARACTERS,
  );
  if (!question) {
    return null;
  }
  const choices = Array.isArray(event.payload.choices)
    ? event.payload.choices.slice(0, MAX_PROVIDER_TEXT_ITEMS).flatMap((choice) => {
        const label = readBoundedString(choice, MAX_PROVIDER_TEXT_CHARACTERS);
        return label ? [{ label }] : [];
      })
    : [];
  const multiple = event.payload.multi_select === true
    || event.payload.multiSelect === true;
  return {
    arguments: {
      questions: [{
        id: requestId,
        question,
        ...(choices.length > 0 ? { options: choices } : {}),
        ...(multiple ? { multiple: true } : {}),
        custom: true,
      }],
    },
    id: requestId,
    name: 'question',
    requiresResponse: true,
    status: 'waiting',
    type: 'tool_call',
  };
}

function resolveProviderToolLifecycleRecord(
  record: Record<string, unknown>,
): Record<string, unknown> | null {
  const recordType = resolveProviderPayloadType(record);
  const jsonRpcParams = normalizeProviderPayloadType(record.method) === 'event'
    ? readRecord(record.params)
    : null;
  const directTuiEventType = ['tool_start', 'tool_complete'].includes(recordType)
    ? recordType
    : '';
  const tuiEventType = normalizeProviderPayloadType(jsonRpcParams?.type)
    || directTuiEventType;
  const isTuiToolEvent = ['tool_start', 'tool_complete'].includes(tuiEventType);
  const eventType = normalizeProviderPayloadType(record.event);
  const stream = normalizeProviderPayloadType(record.stream);
  const isWrappedToolEvent = isTuiToolEvent
    || stream === 'tool'
    || eventType === 'hermes_tool_progress';
  const payload = isTuiToolEvent
    ? readRecord(jsonRpcParams?.payload)
      ?? readRecord(record.payload)
      ?? record
    : isWrappedToolEvent
      ? readProviderEventPayload(record)
      : record;
  const phase = isTuiToolEvent
    ? tuiEventType === 'tool_complete' ? 'completed' : 'started'
    : normalizeProviderPayloadType(payload.phase ?? payload.status);
  const directType = resolveProviderPayloadType(payload);
  const explicitToolCallId = readBoundedString(
    payload.toolCallId
      ?? payload.tool_call_id
      ?? payload.tool_id
      ?? payload.callId
      ?? payload.call_id,
    256,
  );
  const isDirectToolEvent = Boolean(explicitToolCallId)
    && [
      '',
      'function',
      'function_call',
      'function_call_output',
      'tool',
      'tool_call',
      'tool_progress',
      'tool_result',
    ].includes(directType);
  if (
    (!isWrappedToolEvent && !isDirectToolEvent)
    || ![
      'complete',
      'completed',
      'done',
      'error',
      'failed',
      'in_progress',
      'result',
      'running',
      'start',
      'started',
      'update',
    ]
      .includes(phase)
  ) {
    return null;
  }

  const toolCallId = readBoundedString(
    explicitToolCallId || payload.id,
    256,
  );
  const name = readBoundedString(payload.name ?? payload.tool ?? payload.toolName, 256);
  if (!toolCallId) {
    return null;
  }

  const errorValue = payload.error
    ?? payload.toolErrorSummary
    ?? payload.tool_error_summary;
  const hasErrorValue = errorValue !== undefined
    && errorValue !== null
    && (typeof errorValue !== 'string' || errorValue.trim().length > 0);
  const isError = payload.isError === true
    || hasErrorValue
    || ['error', 'failed'].includes(phase);
  const isTerminal = isError || ['completed', 'complete', 'done', 'result'].includes(phase);
  const context = readBoundedString(payload.context, MAX_PROVIDER_TEXT_CHARACTERS);
  const argumentsValue = payload.args
    ?? payload.arguments
    ?? payload.input
    ?? (payload.args_text !== undefined ? readStructuredValue(payload.args_text) : undefined)
    ?? (context ? { context } : undefined);
  const outputValue = payload.result
    ?? payload.result_text
    ?? payload.summary
    ?? payload.partialResult
    ?? payload.output;
  const resultText = readBoundedRawString(
    payload.result_text,
    MAX_PROVIDER_TEXT_CHARACTERS,
  );
  const inlineDiff = readBoundedRawString(
    payload.inline_diff ?? payload.inlineDiff,
    MAX_PROVIDER_TEXT_CHARACTERS,
  );
  const supplementalResults: unknown[] = [];
  if (
    payload.result !== undefined
    && resultText.trim()
    && (typeof payload.result !== 'string' || payload.result !== resultText)
  ) {
    supplementalResults.push({ text: resultText, type: 'text' });
  }
  if (inlineDiff.trim()) {
    supplementalResults.push({ diff: inlineDiff, type: 'diff' });
  }
  const existingAttachments = Array.isArray(payload.attachments)
    ? payload.attachments
    : payload.attachments === undefined
      ? []
      : [payload.attachments];
  const durationSeconds = typeof payload.duration_s === 'number'
    && Number.isFinite(payload.duration_s)
    && payload.duration_s >= 0
    ? payload.duration_s
    : undefined;
  return {
    ...payload,
    id: toolCallId,
    ...(name ? { name } : {}),
    type: isTerminal ? 'tool_result' : 'tool_call',
    status: isError ? 'failed' : isTerminal ? 'completed' : 'running',
    ...(context ? { title: context } : {}),
    ...(argumentsValue !== undefined ? { arguments: argumentsValue } : {}),
    ...(outputValue !== undefined ? { output: outputValue } : {}),
    ...(supplementalResults.length > 0
      ? { attachments: [...existingAttachments, ...supplementalResults] }
      : {}),
    ...(isError && errorValue !== undefined ? { error: errorValue } : {}),
    ...(durationSeconds !== undefined ? { durationMs: Math.round(durationSeconds * 1_000) } : {}),
    ...(record.runId !== undefined ? { providerRunId: record.runId } : {}),
    ...(record.seq !== undefined ? { providerSequence: record.seq } : {}),
    ...(record.ts !== undefined ? { providerTimestamp: record.ts } : {}),
  };
}

function resolveProviderApprovalRecord(
  record: Record<string, unknown>,
): Record<string, unknown> | null {
  const eventType = normalizeProviderPayloadType(
    record.event ?? record.method ?? record.type,
  );
  if (
    eventType !== 'session_approval'
    && eventType !== 'exec_approval_requested'
    && eventType !== 'exec_approval_resolved'
  ) {
    return null;
  }

  const payload = readProviderEventPayload(record);
  if (eventType === 'session_approval') {
    const approval = readRecord(payload.approval) ?? payload;
    const presentation = readRecord(approval.presentation) ?? {};
    const approvalId = readBoundedString(approval.id, 256);
    if (!approvalId) {
      return null;
    }
    const approvalStatus = normalizeProviderPayloadType(approval.status ?? payload.phase);
    const decision = readBoundedString(
      approval.decision
        ?? (approvalStatus === 'allowed'
          ? 'allowed'
          : approvalStatus === 'denied'
            ? 'denied'
            : undefined),
      128,
    );
    const isPending = approvalStatus === 'pending';
    const isCancelled = ['cancelled', 'canceled', 'denied'].includes(approvalStatus);
    const status = isPending
      ? 'waiting'
      : isCancelled
        ? 'cancelled'
        : approvalStatus === 'allowed'
          ? 'completed'
          : 'failed';
    const presentationKind = readBoundedString(presentation.kind, 128) || 'provider';
    const commandText = readBoundedString(
      presentation.commandPreview ?? presentation.commandText,
      MAX_PROVIDER_TEXT_CHARACTERS,
    );
    const description = readBoundedString(
      presentation.description ?? presentation.title ?? commandText,
      MAX_PROVIDER_TEXT_CHARACTERS,
    );
    const detail = readBoundedString(
      presentation.detail ?? presentation.warningText ?? approval.reason,
      MAX_PROVIDER_TEXT_CHARACTERS,
    );
    return {
      ...approval,
      action: readBoundedString(presentation.toolName, 256) || commandText || presentationKind,
      arguments: presentation,
      ...(decision ? { decision } : {}),
      ...(description ? { message: description } : {}),
      ...(detail ? { detail } : {}),
      id: approvalId,
      name: `${presentationKind}_approval`,
      requiresResponse: isPending,
      status,
      type: 'approval_request',
    };
  }

  const request = readRecord(payload.request) ?? {};
  const approvalId = readBoundedString(payload.id, 256);
  if (!approvalId) {
    return null;
  }
  const isRequested = eventType === 'exec_approval_requested';
  const decision = readBoundedString(payload.decision, 128);
  const command = readBoundedString(request.command, MAX_PROVIDER_TEXT_CHARACTERS);
  const warning = readBoundedString(request.warningText, MAX_PROVIDER_TEXT_CHARACTERS);
  return {
    ...payload,
    ...(isRequested ? { action: command || 'exec', arguments: request } : {}),
    ...(decision ? { decision } : {}),
    ...(isRequested && (warning || command) ? { message: warning || command } : {}),
    id: approvalId,
    name: 'exec_approval',
    requiresResponse: isRequested,
    status: isRequested
      ? 'waiting'
      : ['deny', 'denied'].includes(normalizeProviderPayloadType(decision))
        ? 'cancelled'
        : 'completed',
    type: 'approval_request',
  };
}

function providerToolLifecycleRank(record: Record<string, unknown>): number {
  const phase = normalizeProviderPayloadType(record.phase);
  const status = normalizeProviderPayloadType(record.status);
  const type = normalizeProviderPayloadType(record.type);
  if (
    ['completed', 'error', 'failed', 'success', 'cancelled', 'canceled'].includes(status)
    || ['result', 'terminal', 'resolved'].includes(phase)
    || ['function_call_output', 'tool_result'].includes(type)
  ) {
    return 3;
  }
  if (phase === 'update') {
    return 2;
  }
  return 1;
}

function mergeProviderToolRecords(
  previous: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  return providerToolLifecycleRank(incoming) >= providerToolLifecycleRank(previous)
    ? { ...previous, ...incoming }
    : { ...incoming, ...previous };
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

  const summaryParts = readStringArray(payload.summary);
  const contentParts = Array.isArray(payload.summary)
    ? []
    : readStringArray(payload.content);
  const summary = readBoundedString(
    payload.thinking ?? payload.text ?? payload.delta,
    MAX_PROVIDER_REASONING_CHARACTERS,
  ) || [...summaryParts, ...contentParts]
    .join('\n')
    .slice(0, MAX_PROVIDER_REASONING_CHARACTERS);
  return summary ? { summary, title: '' } : null;
}

function readHookPromptText(record: Record<string, unknown>): string {
  const payload = resolveProviderEnvelopePayload(record);
  if (!Array.isArray(payload.fragments)) {
    return '';
  }
  return payload.fragments
    .slice(0, MAX_PROVIDER_TEXT_ITEMS)
    .flatMap((fragment) => {
      const text = readBoundedString(
        readRecord(fragment)?.text,
        MAX_PROVIDER_TEXT_CHARACTERS,
      );
      return text ? [text] : [];
    })
    .join(' | ')
    .slice(0, MAX_PROVIDER_TEXT_CHARACTERS);
}

function resolveCodexMessagePhase(value: unknown): 'commentary' | 'final_answer' | undefined {
  return value === 'commentary' || value === 'final_answer' ? value : undefined;
}

const CODEX_MEMORY_CITATION_OPEN_TAG = '<oai-mem-citation>';

function truncateCodexOpenMemoryCitation(value: string): string {
  let citationIndex = value.indexOf(CODEX_MEMORY_CITATION_OPEN_TAG);
  if (citationIndex < 0) {
    return value;
  }

  let cursor = 0;
  while (cursor < value.length) {
    const delimiterStart = value.indexOf('`', cursor);
    if (delimiterStart < 0) {
      break;
    }
    let escapeCount = 0;
    while (value[delimiterStart - escapeCount - 1] === '\\') {
      escapeCount += 1;
    }
    if (escapeCount % 2 === 1) {
      cursor = delimiterStart + 1;
      continue;
    }

    let contentStart = delimiterStart + 1;
    while (value[contentStart] === '`') {
      contentStart += 1;
    }
    const delimiter = value.slice(delimiterStart, contentStart);
    let delimiterEnd = value.indexOf(delimiter, contentStart);
    while (
      delimiterEnd >= 0
      && (
        value[delimiterEnd - 1] === '`'
        || value[delimiterEnd + delimiter.length] === '`'
      )
    ) {
      delimiterEnd = value.indexOf(delimiter, delimiterEnd + delimiter.length);
    }
    if (delimiterEnd < 0) {
      cursor = contentStart;
      continue;
    }
    if (
      citationIndex >= contentStart
      && citationIndex < delimiterEnd
      && value.slice(contentStart, delimiterEnd).trim() === CODEX_MEMORY_CITATION_OPEN_TAG
    ) {
      citationIndex = value.indexOf(
        CODEX_MEMORY_CITATION_OPEN_TAG,
        citationIndex + CODEX_MEMORY_CITATION_OPEN_TAG.length,
      );
    }
    cursor = delimiterEnd + delimiter.length;
  }
  return citationIndex < 0 ? value : value.slice(0, citationIndex);
}

function stripCodexExternalAgentToolBlocks(value: string): string {
  const output: string[] = [];
  let openBlockKind: 'call' | 'result' | null = null;
  for (const line of value.split(/\r?\n/gu)) {
    const trimmedLine = line.trim();
    if (openBlockKind) {
      const closingMatch = /^\[\/external_agent_tool_(call|result)\]$/u.exec(trimmedLine);
      if (closingMatch?.[1] === openBlockKind) {
        openBlockKind = null;
      }
      continue;
    }
    const openingMatch = /^\[external_agent_tool_(call|result)(?::[^\]]*)?\]$/u.exec(trimmedLine);
    if (openingMatch) {
      openBlockKind = openingMatch[1] as 'call' | 'result';
      continue;
    }
    output.push(line);
  }
  return output.join('\n').replace(/\n{3,}/gu, '\n\n').trim();
}

function stripCodexAgentMessageMarkup(value: string, isStreaming: boolean): string {
  const closedCitationPattern =
    /<oai-mem-citation>(?:(?!<oai-mem-citation>).)*?<\/oai-mem-citation>/gsu;
  let content = truncateCodexOpenMemoryCitation(value.replace(closedCitationPattern, ''));
  const partialTagIndex = isStreaming ? content.lastIndexOf('<') : -1;
  if (
    partialTagIndex >= 0
    && CODEX_MEMORY_CITATION_OPEN_TAG.startsWith(content.slice(partialTagIndex))
  ) {
    content = content.slice(0, partialTagIndex);
  }
  const trimmedStart = content.trimStart();
  if (
    content.trim() === '<EXTERNAL SESSION IMPORTED>'
    || trimmedStart.startsWith('[external tool call:')
    || trimmedStart.startsWith('[external tool result]')
    || trimmedStart.startsWith('[external tool result:')
  ) {
    return '';
  }
  return stripCodexExternalAgentToolBlocks(content);
}

function normalizeCodexAgentMessageText(
  value: string,
  phase: 'commentary' | 'final_answer' | undefined,
  isStreaming: boolean,
): string {
  let content = value;
  if (phase === 'final_answer') {
    const completeEnvelope = /^<!\[CDATA\[ ([\s\S]*) \]\]>$/u.exec(content);
    if (completeEnvelope) {
      content = completeEnvelope[1] ?? '';
    } else if (isStreaming && content.startsWith('<![CDATA[ ')) {
      content = content.slice('<![CDATA[ '.length);
    }
  }
  return stripCodexAgentMessageMarkup(content, isStreaming);
}

function resolveCodexMemoryCitationResources(
  record: Record<string, unknown>,
  itemId: string,
): unknown[] {
  const citation = readRecord(record.memoryCitation ?? record.memory_citation);
  if (!citation || !Array.isArray(citation.entries)) {
    return [];
  }
  return citation.entries.slice(0, 32).flatMap((entry, index) => {
    const citationEntry = readRecord(entry);
    const path = readBoundedString(citationEntry?.path, 4_096);
    if (!citationEntry || !path) {
      return [];
    }
    const lineStart = typeof citationEntry.lineStart === 'number'
      ? citationEntry.lineStart
      : citationEntry.line_start;
    const lineEnd = typeof citationEntry.lineEnd === 'number'
      ? citationEntry.lineEnd
      : citationEntry.line_end;
    const note = readBoundedString(citationEntry.note, 4_000);
    return [{
      id: `${itemId}:memory-citation:${index + 1}`,
      kind: 'citation',
      path,
      ...(note ? { description: note } : {}),
      origin: {
        kind: 'file',
        path,
        ...(typeof lineStart === 'number' ? { lineStart } : {}),
        ...(typeof lineEnd === 'number' ? { lineEnd } : {}),
      },
      citation: {
        ...(typeof lineStart === 'number' ? { lineStart } : {}),
        ...(typeof lineEnd === 'number' ? { lineEnd } : {}),
        ...(note ? { note } : {}),
      },
    }];
  });
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
  const toolCallIndexByKey = new Map<string, number>();
  const pendingValues: unknown[] = [];
  const visitedRecords = new WeakSet<object>();
  let consumed = false;
  let retainedContentCharacters = 0;
  let pendingValueIndex = 0;
  let taskProgress: AgentSessionTaskProgressView | undefined;
  let contentRole: AgentSessionItemView['role'] = 'assistant';
  let providerContentDelta = '';
  let providerContentSnapshot: string | undefined;
  let providerReasoningDelta = '';
  let providerReasoningSnapshot = '';
  let hasAgentMessage = false;
  let messagePhase: AgentSessionProviderPayloadViewFields['messagePhase'];
  const openCodeReplayState: OpenCodePartReplayState = {
    partKeysByMessage: new Map(),
    parts: new Map(),
    removedMessages: new Set(),
  };
  let openCodePartsQueued = false;

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

  while (
    pendingValueIndex < pendingValues.length
    || (!openCodePartsQueued && openCodeReplayState.parts.size > 0)
  ) {
    if (pendingValueIndex >= pendingValues.length) {
      openCodePartsQueued = true;
      enqueueValues([...openCodeReplayState.parts.values()]);
      continue;
    }
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

    if (replayOpenCodeMessageEvent(record, openCodeReplayState)) {
      consumed = true;
      continue;
    }

    const providerEvent = resolveProviderEventEnvelope(record);
    if (providerEvent) {
      if (providerEvent.type === 'message_delta') {
        providerContentDelta = appendBoundedRawString(
          providerContentDelta,
          providerEvent.payload.text ?? providerEvent.payload.rendered,
          MAX_PROVIDER_TEXT_CHARACTERS,
        );
        consumed = true;
        continue;
      }
      if (providerEvent.type === 'message_complete') {
        const snapshotValue = typeof providerEvent.payload.text === 'string'
          ? providerEvent.payload.text
          : providerEvent.payload.rendered;
        if (typeof snapshotValue === 'string') {
          providerContentSnapshot = readBoundedRawString(
            snapshotValue,
            MAX_PROVIDER_TEXT_CHARACTERS,
          );
        }
        if (!providerReasoningDelta.trim() && !providerReasoningSnapshot.trim()) {
          providerReasoningSnapshot = readBoundedRawString(
            providerEvent.payload.reasoning,
            MAX_PROVIDER_REASONING_CHARACTERS,
          );
        }
        consumed = true;
        continue;
      }
      if (providerEvent.type === 'reasoning_delta') {
        providerReasoningDelta = appendBoundedRawString(
          providerReasoningDelta,
          providerEvent.payload.text,
          MAX_PROVIDER_REASONING_CHARACTERS,
        );
        consumed = true;
        continue;
      }
      if (providerEvent.type === 'reasoning_available') {
        if (!providerReasoningDelta.trim() && !providerReasoningSnapshot.trim()) {
          providerReasoningSnapshot = readBoundedRawString(
            providerEvent.payload.text,
            MAX_PROVIDER_REASONING_CHARACTERS,
          );
        }
        consumed = true;
        continue;
      }
      if (
        providerEvent.type === 'message_start'
        || providerEvent.type === 'message_interim'
        || providerEvent.type === 'status_update'
        || providerEvent.type === 'error'
      ) {
        consumed = true;
        continue;
      }
      if (providerEvent.type === 'approval_request') {
        consumed = true;
        continue;
      }
    }

    const projectedQuestionRecord = resolveProviderQuestionRecord(record);
    if (
      providerEvent
      && ['clarify_request', 'clarify_expire'].includes(providerEvent.type)
      && !projectedQuestionRecord
    ) {
      consumed = true;
      continue;
    }
    const projectedToolRecord = projectedQuestionRecord
      ?? resolveProviderApprovalRecord(record)
      ?? resolveProviderToolLifecycleRecord(record)
      ?? record;
    const type = resolveProviderPayloadType(projectedToolRecord);
    const role = normalizeProviderPayloadType(projectedToolRecord.role);
    if (PROVIDER_HIDDEN_TRANSCRIPT_TYPES.has(type)) {
      consumed = true;
      continue;
    }
    if (PROVIDER_LIFECYCLE_ONLY_TYPES.has(type)) {
      consumed = true;
      continue;
    }
    if (type === 'hook_prompt') {
      const prompt = readHookPromptText(record);
      if (prompt) {
        appendContent(prompt);
        contentRole = 'user';
      }
      consumed = true;
      continue;
    }
    if (type === 'turn_plan_updated') {
      const payload = resolveProviderEnvelopePayload(record);
      const displayState = resolveTaskProgressDisplayState(
        payload as unknown as AgentSessionTaskProgressView,
      );
      if (displayState) {
        taskProgress = {
          completed: displayState.completed,
          items: displayState.items,
          total: displayState.total,
        };
      }
      appendContent(readBoundedString(payload.explanation, MAX_PROVIDER_TEXT_CHARACTERS));
      consumed = true;
    }
    const roleToolCallId = readBoundedString(
      projectedToolRecord.callID
        ?? projectedToolRecord.callId
        ?? projectedToolRecord.call_id
        ?? projectedToolRecord.tool_call_id
        ?? projectedToolRecord.toolCallId
        ?? projectedToolRecord.tool_id
        ?? projectedToolRecord.tool_use_id
        ?? projectedToolRecord.toolUseId
        ?? projectedToolRecord.id,
      256,
    );
    if (type === 'approval_request' && !roleToolCallId) {
      consumed = true;
      continue;
    }
    if (
      PROVIDER_TOOL_BLOCK_TYPES.has(type)
      || (
        Boolean(roleToolCallId)
        && (role === 'tool' || role === 'tool_result')
      )
    ) {
      const callId = roleToolCallId;
      const key = callId || `${type}:${toolCalls.length}`;
      const existingIndex = toolCallIndexByKey.get(key);
      if (existingIndex === undefined) {
        toolCallIndexByKey.set(key, toolCalls.length);
        toolCalls.push(projectedToolRecord);
      } else {
        const existing = readRecord(toolCalls[existingIndex]);
        toolCalls[existingIndex] = existing
          ? mergeProviderToolRecords(existing, projectedToolRecord)
          : projectedToolRecord;
      }
      const state = readRecord(projectedToolRecord.state);
      if (Array.isArray(state?.attachments)) {
        enqueueValues(state.attachments);
      }
      consumed = true;
      continue;
    }

    const payload = resolveProviderEnvelopePayload(record);
    const itemMessagePhase = type === 'agent_message'
      ? resolveCodexMessagePhase(payload.phase)
      : undefined;
    if (itemMessagePhase) {
      messagePhase = itemMessagePhase;
    }
    if (type === 'agent_message') {
      hasAgentMessage = true;
      resourceInputs.push(...resolveCodexMemoryCitationResources(payload, options.itemId));
    }
    const rawContentText = readProviderContentText(record, type);
    const contentText = type === 'agent_message'
      ? normalizeCodexAgentMessageText(
          rawContentText,
          itemMessagePhase,
          options.isStreaming === true,
        )
      : rawContentText;
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
    if (Array.isArray(record.content)) {
      if (type === 'assistant' || type === 'message' || role === 'assistant') {
        enqueueValues(record.content);
      } else if (role === 'user' || role === 'tool' || role === 'tool_result') {
        enqueueValues(record.content.filter((contentBlock) => {
          const contentRecord = readRecord(contentBlock);
          return Boolean(
            contentRecord
            && PROVIDER_TOOL_BLOCK_TYPES.has(resolveProviderPayloadType(contentRecord)),
          );
        }));
      }
    }
  }

  appendContent(
    providerContentSnapshot !== undefined
      ? providerContentSnapshot
      : providerContentDelta,
  );
  const providerReasoning = (
    providerReasoningDelta.trim()
      ? providerReasoningDelta
      : providerReasoningSnapshot
  ).trim();
  if (
    providerReasoning
    && reasoningItems.length < MAX_PROVIDER_REASONING_ITEMS
  ) {
    const completedAt = options.completedAt?.trim() || undefined;
    reasoningItems.push({
      id: `${options.itemId}:provider-reasoning:${reasoningItems.length + 1}`,
      summary: providerReasoning,
      createdAt: options.createdAt,
      startedAt: options.createdAt,
      ...(completedAt ? { completedAt } : {}),
    });
  }

  const resources = normalizeAgentSessionItemResources(resourceInputs);
  if (!consumed && resources.length === 0) {
    return null;
  }
  const hasAssistantContent = contentItems.length > 0
    || reasoningItems.length > 0
    || resources.length > 0
    || taskProgress !== undefined;
  return {
    consumesToolPayload: true,
    ...(contentItems.length > 0 ? { content: contentItems.join('\n\n') } : {}),
    ...(hasAgentMessage ? { messageCompleted: options.isStreaming !== true } : {}),
    ...(messagePhase ? { messagePhase } : {}),
    ...(reasoningItems.length > 0 ? { reasoning: reasoningItems } : {}),
    ...(resources.length > 0 ? { resources } : {}),
    ...(hasAssistantContent ? { role: contentRole } : {}),
    ...(taskProgress ? { taskProgress } : {}),
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
  };
}
