import type { FileChange } from './file-change.ts';
import type { ChatMessageViewSource } from './chat-message-view.ts';
import { mergeChatMessageReasoning } from './chat-message-reasoning.ts';
import {
  normalizeChatMessageCommand,
  normalizeChatMessageToolResult,
  normalizeChatMessageToolCalls,
  type ChatMessageToolCall,
} from './chat-message-tool-calls.ts';

const FILE_UPDATE_SUMMARY_HEADER_PATTERN = /^(?:Success\.\s+)?Updated the following files:\s*$/i;
const FILE_UPDATE_SUMMARY_ENTRY_PATTERN = /^([A-Z?]{1,2})\s+(.+)$/;

export interface ActivityFileChangeView extends FileChange {
  lineImpactKnown?: boolean;
  updateStatus?: string;
}

export interface ChatTurnActivitySummary {
  commands: readonly NonNullable<ChatMessageViewSource['commands']>[number][];
  fileChanges: readonly NonNullable<ChatMessageViewSource['fileChanges']>[number][];
}

export interface ComposeChatTranscriptActivityOptions {
  engineId?: string;
}

function isTurnReplyMessage(message: ChatMessageViewSource): boolean {
  return message.role === 'assistant' || message.role === 'planner' || message.role === 'reviewer';
}

const TERMINAL_TOOL_CALL_STATUSES = new Set<NonNullable<ChatMessageToolCall['status']>>([
  'cancelled',
  'error',
  'success',
]);

const TOOL_RESULT_TYPE_PATTERN = /(?:_output|_result)$/u;
const TRANSCRIPT_FALLBACK_TOOL_CALL_ID_PREFIX = 'birdcoder-fallback';

function resolveMergedToolCallStatus(
  previous: ChatMessageToolCall['status'],
  incoming: ChatMessageToolCall['status'],
): ChatMessageToolCall['status'] {
  if (previous === 'cancelled' || incoming === 'cancelled') {
    return 'cancelled';
  }
  if (!incoming) {
    return previous;
  }
  if (!previous || TERMINAL_TOOL_CALL_STATUSES.has(incoming)) {
    return incoming;
  }
  return TERMINAL_TOOL_CALL_STATUSES.has(previous) ? previous : incoming;
}

function isToolResultType(type: string): boolean {
  return TOOL_RESULT_TYPE_PATTERN.test(type.trim().toLowerCase().replace(/[.\s-]+/gu, '_'));
}

function resolveMergedToolCallType(previousType: string, incomingType: string): string {
  if (isToolResultType(previousType) && !isToolResultType(incomingType)) {
    return incomingType;
  }
  if (!isToolResultType(previousType) && isToolResultType(incomingType)) {
    return previousType;
  }
  return previousType || incomingType;
}

function mergeNormalizedToolCallArguments(previous: string, incoming: string): string {
  if (!incoming.trim()) {
    return previous;
  }
  if (!previous.trim()) {
    return incoming;
  }
  try {
    const previousValue: unknown = JSON.parse(previous);
    const incomingValue: unknown = JSON.parse(incoming);
    if (
      previousValue
      && incomingValue
      && typeof previousValue === 'object'
      && typeof incomingValue === 'object'
      && !Array.isArray(previousValue)
      && !Array.isArray(incomingValue)
    ) {
      return JSON.stringify({
        ...(previousValue as Record<string, unknown>),
        ...(incomingValue as Record<string, unknown>),
      }, null, 2);
    }
  } catch {
    // Preserve the latest provider value when either side is not structured JSON.
  }
  return incoming;
}

function mergeNormalizedToolCall(
  previous: ChatMessageToolCall | undefined,
  incoming: ChatMessageToolCall,
): ChatMessageToolCall {
  if (!previous) {
    return incoming;
  }

  return {
    ...previous,
    ...incoming,
    arguments: mergeNormalizedToolCallArguments(previous.arguments, incoming.arguments),
    kind: incoming.kind && incoming.kind !== 'other' ? incoming.kind : previous.kind,
    name: incoming.name !== 'tool' ? incoming.name : previous.name,
    status: resolveMergedToolCallStatus(previous.status, incoming.status),
    type: resolveMergedToolCallType(previous.type, incoming.type),
    ...(incoming.command?.trim() || previous.command?.trim()
      ? { command: incoming.command?.trim() || previous.command }
      : {}),
    ...(incoming.durationMs !== undefined || previous.durationMs !== undefined
      ? { durationMs: incoming.durationMs ?? previous.durationMs }
      : {}),
    ...(incoming.output?.trim() || previous.output?.trim()
      ? { output: incoming.output?.trim() ? incoming.output : previous.output }
      : {}),
    ...(incoming.presentation || previous.presentation
      ? { presentation: incoming.presentation ?? previous.presentation }
      : {}),
    ...(incoming.serverName?.trim() || previous.serverName?.trim()
      ? { serverName: incoming.serverName?.trim() || previous.serverName }
      : {}),
    ...(incoming.target?.trim() || previous.target?.trim()
      ? { target: incoming.target?.trim() || previous.target }
      : {}),
    ...(incoming.title?.trim() || previous.title?.trim()
      ? { title: incoming.title?.trim() || previous.title }
      : {}),
  };
}

function readTranscriptToolCalls(
  message: ChatMessageViewSource,
  options: ComposeChatTranscriptActivityOptions,
): ChatMessageToolCall[] {
  const fallbackIdentity = message.id.trim()
    || `${message.turnId?.trim() ?? 'turn'}:${message.createdAt}`;
  const calls = normalizeChatMessageToolCalls(message.tool_calls, {
    ...options,
    fallbackIdPrefix: `${TRANSCRIPT_FALLBACK_TOOL_CALL_ID_PREFIX}:${fallbackIdentity}:tool`,
  });
  if (message.role !== 'tool') {
    return calls;
  }
  if (calls.length > 0) {
    return calls;
  }

  const metadata = typeof message.metadata === 'object' && message.metadata !== null
    ? message.metadata as Record<string, unknown>
    : null;
  const result = normalizeChatMessageToolResult({
    content: message.content,
    id: message.tool_call_id,
    name: message.name,
    status: metadata?.is_error === true ? 'error' : undefined,
  }, options);
  return result ? [result] : calls;
}

function readTranscriptCommandKey(
  command: NonNullable<ChatMessageViewSource['commands']>[number],
  index: number,
  messageIdentity: string,
): string {
  if (typeof command !== 'object' || command === null) {
    return `command-${index}`;
  }

  const record = command as { command?: unknown; kind?: unknown; toolCallId?: unknown };
  const toolCallId = typeof record.toolCallId === 'string' ? record.toolCallId.trim() : '';
  const commandText = typeof record.command === 'string' ? record.command.trim() : '';
  const kind = typeof record.kind === 'string' ? record.kind : '';
  return toolCallId || `${messageIdentity}\u0001${commandText}\u0001${kind}\u0001${index}`;
}

interface TranscriptTurnToolEntry<TMessage extends ChatMessageViewSource> {
  calls: ChatMessageToolCall[];
  callsWereRewritten: boolean;
  index: number;
  isCollapsible: boolean;
  message: TMessage;
}

function normalizeToolIdentityName(name: string): string {
  return name.trim().toLowerCase().replace(/[.\s-]+/gu, '_') || 'tool';
}

function isFallbackToolCallId(id: string): boolean {
  return id.startsWith(`${TRANSCRIPT_FALLBACK_TOOL_CALL_ID_PREFIX}:`);
}

function correlateGeminiFallbackToolCallIds<TMessage extends ChatMessageViewSource>(
  entries: TranscriptTurnToolEntry<TMessage>[],
  turnId: string,
  engineId?: string,
): boolean {
  if (engineId?.trim().toLowerCase() !== 'gemini') {
    return false;
  }

  let callsWereRewritten = false;
  const requestIdsByName = new Map<string, string[]>();
  for (const entry of entries) {
    entry.calls = entry.calls.map((call) => {
      if (!isFallbackToolCallId(call.id) || isToolResultType(call.type)) {
        return call;
      }
      const normalizedName = normalizeToolIdentityName(call.name);
      const requestIds = requestIdsByName.get(normalizedName) ?? [];
      const id = `birdcoder-gemini:${turnId}:${normalizedName}:${requestIds.length + 1}`;
      requestIds.push(id);
      requestIdsByName.set(normalizedName, requestIds);
      entry.callsWereRewritten = true;
      callsWereRewritten = true;
      return { ...call, id };
    });
  }

  const resultCountByName = new Map<string, number>();
  for (const entry of entries) {
    entry.calls = entry.calls.map((call) => {
      if (!isFallbackToolCallId(call.id) || !isToolResultType(call.type)) {
        return call;
      }
      const normalizedName = normalizeToolIdentityName(call.name);
      const resultIndex = resultCountByName.get(normalizedName) ?? 0;
      resultCountByName.set(normalizedName, resultIndex + 1);
      const requestId = requestIdsByName.get(normalizedName)?.[resultIndex];
      entry.callsWereRewritten = true;
      callsWereRewritten = true;
      return {
        ...call,
        id: requestId ?? `birdcoder-gemini:${turnId}:${normalizedName}:result-${resultIndex + 1}`,
      };
    });
  }
  return callsWereRewritten;
}

function readCanonicalToolCallTaskId(call: ChatMessageToolCall): string {
  if (!call.arguments.trim()) {
    return '';
  }
  try {
    const value = JSON.parse(call.arguments) as unknown;
    if (typeof value !== 'object' || value === null) {
      return '';
    }
    const record = value as Record<string, unknown>;
    const taskId = record.taskId ?? record.task_id;
    return typeof taskId === 'string' ? taskId.trim() : '';
  } catch {
    return '';
  }
}

function correlateClaudeTaskToolCallIds<TMessage extends ChatMessageViewSource>(
  entries: TranscriptTurnToolEntry<TMessage>[],
  engineId?: string,
): void {
  if (engineId?.trim().toLowerCase() !== 'claude-code') {
    return;
  }

  const toolUseIdByTaskId = new Map<string, string>();
  for (const entry of entries) {
    for (const call of entry.calls) {
      const taskId = readCanonicalToolCallTaskId(call);
      if (taskId && call.id !== taskId) {
        toolUseIdByTaskId.set(taskId, call.id);
      }
    }
  }

  if (toolUseIdByTaskId.size === 0) {
    return;
  }
  for (const entry of entries) {
    entry.calls = entry.calls.map((call) => {
      const toolUseId = toolUseIdByTaskId.get(call.id);
      if (!toolUseId || toolUseId === call.id) {
        return call;
      }
      entry.callsWereRewritten = true;
      return { ...call, id: toolUseId };
    });
  }
}

function collectTranscriptTurnToolEntries<TMessage extends ChatMessageViewSource>(
  messages: readonly TMessage[],
  messageIndexes: readonly number[],
  scopeId: string,
  options: ComposeChatTranscriptActivityOptions,
): TranscriptTurnToolEntry<TMessage>[] {
  const entries = messageIndexes.map((index) => {
    const message = messages[index]!;
    const calls = readTranscriptToolCalls(message, options);
    return {
      calls,
      callsWereRewritten: false,
      index,
      isCollapsible: isCollapsibleToolActivityMessage(message, calls),
      message,
    };
  });
  correlateGeminiFallbackToolCallIds(entries, scopeId, options.engineId);
  correlateClaudeTaskToolCallIds(entries, options.engineId);
  return entries;
}

function resolveTranscriptMessageScopeIds(
  messages: readonly ChatMessageViewSource[],
): string[] {
  const fallbackEpochBySessionId = new Map<string, number>();
  const scopeIds: string[] = [];
  for (const message of messages) {
    const turnId = message.turnId?.trim() ?? '';
    if (turnId) {
      scopeIds.push(`turn:${turnId}`);
      continue;
    }

    const sessionId = message.sessionId.trim() || 'transcript';
    let epoch = fallbackEpochBySessionId.get(sessionId) ?? 0;
    if (message.role === 'user') {
      epoch += 1;
      fallbackEpochBySessionId.set(sessionId, epoch);
    }
    scopeIds.push(`session:${sessionId}:user-epoch:${epoch}`);
  }
  return scopeIds;
}

function isCollapsibleToolActivityMessage(
  message: ChatMessageViewSource,
  calls: readonly ChatMessageToolCall[],
): boolean {
  if (message.role === 'tool') {
    return true;
  }
  if (!isTurnReplyMessage(message)) {
    return false;
  }

  return !resolveVisibleAssistantMessageContent(message).trim() && (
    calls.length > 0 ||
    (message.commands?.length ?? 0) > 0 ||
    (message.fileChanges?.length ?? 0) > 0 ||
    Boolean(message.taskProgress)
  );
}

/**
 * Folds provider tool-use/progress/result lifecycles into their first ordered
 * transcript slot while keeping renderer code independent of provider formats.
 */
export function composeChatTranscriptActivity<TMessage extends ChatMessageViewSource>(
  messages: readonly TMessage[],
  options: ComposeChatTranscriptActivityOptions = {},
): TMessage[] {
  const scopeIds = resolveTranscriptMessageScopeIds(messages);
  const messageIndexesByScopeId = new Map<string, number[]>();
  for (let index = 0; index < messages.length; index += 1) {
    const scopeId = scopeIds[index]!;
    const scopeMessageIndexes = messageIndexesByScopeId.get(scopeId) ?? [];
    scopeMessageIndexes.push(index);
    messageIndexesByScopeId.set(scopeId, scopeMessageIndexes);
  }

  const entriesByMessageIndex = new Map<number, TranscriptTurnToolEntry<TMessage>>();
  for (const [scopeId, messageIndexes] of messageIndexesByScopeId) {
    for (const entry of collectTranscriptTurnToolEntries(
      messages,
      messageIndexes,
      scopeId,
      options,
    )) {
      entriesByMessageIndex.set(entry.index, entry);
    }
  }

  const normalizedMessages: TMessage[] = [];
  const callSlotIndexByScopeAndId = new Map<string, number>();
  const slotCallsByIndex = new Map<number, Map<string, ChatMessageToolCall>>();
  const dirtySlotIndexes = new Set<number>();
  const slotCommandsByIndex = new Map<
    number,
    Map<string, NonNullable<ChatMessageViewSource['commands']>[number]>
  >();
  const slotFileChangesByIndex = new Map<
    number,
    Map<string, NonNullable<ChatMessageViewSource['fileChanges']>[number]>
  >();
  const slotResourcesByIndex = new Map<
    number,
    Map<string, NonNullable<ChatMessageViewSource['resources']>[number]>
  >();
  const slotReasoningByIndex = new Map<number, TMessage['reasoning']>();
  const slotTaskProgressByIndex = new Map<number, TMessage['taskProgress']>();
  let previousActivitySlotIndex: number | undefined;
  let previousActivityScopeId = '';
  let didNormalizeActivity = false;

  const callKey = (scopeId: string, callId: string): string => `${scopeId}\u0001${callId}`;
  const readResourceKey = (
    resource: NonNullable<ChatMessageViewSource['resources']>[number],
    index: number,
    messageIdentity: string,
  ): string => {
    const id = typeof resource === 'object' && resource !== null && 'id' in resource
      && typeof resource.id === 'string'
      ? resource.id.trim()
      : '';
    return id || `${messageIdentity}\u0001resource\u0001${index}`;
  };
  const mergeIntoSlot = (
    slotIndex: number,
    incoming: TMessage,
    calls: readonly ChatMessageToolCall[],
    incomingCommands: readonly NonNullable<ChatMessageViewSource['commands']>[number][],
    includeAncillary: boolean,
  ): void => {
    const previous = normalizedMessages[slotIndex]!;
    const callsById = slotCallsByIndex.get(slotIndex) ?? new Map<string, ChatMessageToolCall>();
    for (const call of calls) {
      callsById.set(call.id, mergeNormalizedToolCall(callsById.get(call.id), call));
    }
    slotCallsByIndex.set(slotIndex, callsById);
    if (incomingCommands.length > 0) {
      let commandsByKey = slotCommandsByIndex.get(slotIndex);
      if (!commandsByKey) {
        commandsByKey = new Map();
        (previous.commands ?? []).forEach((command, index) => {
          commandsByKey!.set(readTranscriptCommandKey(command, index, previous.id), command);
        });
        slotCommandsByIndex.set(slotIndex, commandsByKey);
      }
      incomingCommands.forEach((command, index) => {
        commandsByKey.set(readTranscriptCommandKey(command, index, incoming.id), command);
      });
    }
    if (includeAncillary && (incoming.fileChanges?.length ?? 0) > 0) {
      let fileChangesByPath = slotFileChangesByIndex.get(slotIndex);
      if (!fileChangesByPath) {
        fileChangesByPath = new Map();
        for (const fileChange of previous.fileChanges ?? []) {
          if (typeof fileChange === 'object' && fileChange !== null) {
            const path = (fileChange as FileChange).path;
            if (typeof path === 'string' && path.trim()) {
              fileChangesByPath.set(normalizeActivityFileChangePathKey(path), fileChange);
            }
          }
        }
        slotFileChangesByIndex.set(slotIndex, fileChangesByPath);
      }
      for (const fileChange of incoming.fileChanges ?? []) {
        if (typeof fileChange === 'object' && fileChange !== null) {
          const path = (fileChange as FileChange).path;
          if (typeof path === 'string' && path.trim()) {
            fileChangesByPath.set(normalizeActivityFileChangePathKey(path), fileChange);
          }
        }
      }
    }
    if (includeAncillary && (incoming.resources?.length ?? 0) > 0) {
      let resourcesByKey = slotResourcesByIndex.get(slotIndex);
      if (!resourcesByKey) {
        resourcesByKey = new Map();
        (previous.resources ?? []).forEach((resource, index) => {
          resourcesByKey!.set(readResourceKey(resource, index, previous.id), resource);
        });
        slotResourcesByIndex.set(slotIndex, resourcesByKey);
      }
      incoming.resources?.forEach((resource, index) => {
        resourcesByKey.set(readResourceKey(resource, index, incoming.id), resource);
      });
    }
    if (includeAncillary && (incoming.reasoning?.length ?? 0) > 0) {
      const reasoning = mergeChatMessageReasoning(
        slotReasoningByIndex.get(slotIndex) ?? previous.reasoning,
        incoming.reasoning,
      );
      slotReasoningByIndex.set(slotIndex, reasoning.length > 0 ? reasoning : undefined);
    }
    if (includeAncillary && incoming.taskProgress) {
      slotTaskProgressByIndex.set(slotIndex, incoming.taskProgress);
    }
    dirtySlotIndexes.add(slotIndex);
    didNormalizeActivity = true;
  };

  for (let messageIndex = 0; messageIndex < messages.length; messageIndex += 1) {
    const message = messages[messageIndex]!;
    const scopeId = scopeIds[messageIndex]!;
    const fallbackCalls = entriesByMessageIndex.has(messageIndex)
      ? []
      : readTranscriptToolCalls(message, options);
    const fallbackEntry = entriesByMessageIndex.get(messageIndex) ?? {
      calls: fallbackCalls,
      callsWereRewritten: false,
      index: messageIndex,
      isCollapsible: isCollapsibleToolActivityMessage(message, fallbackCalls),
      message,
    };
    const callsById = new Map<string, ChatMessageToolCall>();
    for (const call of fallbackEntry.calls) {
      callsById.set(call.id, mergeNormalizedToolCall(callsById.get(call.id), call));
    }
    const calls = [...callsById.values()];

    if (!fallbackEntry.isCollapsible) {
      previousActivitySlotIndex = undefined;
      previousActivityScopeId = '';
      const hasDuplicateLifecycle = calls.length < fallbackEntry.calls.length;
      const retainedCalls: ChatMessageToolCall[] = [];
      let routedCallToPriorSlot = false;
      for (const call of calls) {
        const existingSlot = callSlotIndexByScopeAndId.get(callKey(scopeId, call.id));
        if (existingSlot === undefined) {
          retainedCalls.push(call);
        } else {
          mergeIntoSlot(existingSlot, message, [call], [], false);
          routedCallToPriorSlot = true;
        }
      }
      const outputIndex = normalizedMessages.length;
      const mustNormalizeCalls = hasDuplicateLifecycle
        || fallbackEntry.callsWereRewritten
        || routedCallToPriorSlot;
      normalizedMessages.push(mustNormalizeCalls
        ? {
            ...message,
            tool_calls: retainedCalls.length > 0 ? retainedCalls : undefined,
          } as TMessage
        : message);
      if (mustNormalizeCalls) {
        didNormalizeActivity = true;
      }
      if (retainedCalls.length > 0) {
        slotCallsByIndex.set(
          outputIndex,
          new Map(retainedCalls.map((call) => [call.id, call])),
        );
        for (const call of retainedCalls) {
          callSlotIndexByScopeAndId.set(callKey(scopeId, call.id), outputIndex);
        }
      }
      continue;
    }

    const callsBySlot = new Map<number, ChatMessageToolCall[]>();
    const unassignedCalls: ChatMessageToolCall[] = [];
    for (const call of calls) {
      const existingSlot = callSlotIndexByScopeAndId.get(callKey(scopeId, call.id));
      if (existingSlot === undefined) {
        unassignedCalls.push(call);
      } else {
        const slotCalls = callsBySlot.get(existingSlot) ?? [];
        slotCalls.push(call);
        callsBySlot.set(existingSlot, slotCalls);
      }
    }

    const contiguousSlotIndex: number | undefined = previousActivityScopeId === scopeId
      ? previousActivitySlotIndex
      : undefined;
    let activitySlotIndex: number | undefined;
    let createdActivitySlot = false;
    if (unassignedCalls.length > 0 || calls.length === 0) {
      const selectedActivitySlotIndex = contiguousSlotIndex ?? normalizedMessages.length;
      activitySlotIndex = selectedActivitySlotIndex;
      createdActivitySlot = contiguousSlotIndex === undefined;
      const activityCalls = callsBySlot.get(selectedActivitySlotIndex) ?? [];
      activityCalls.push(...unassignedCalls);
      callsBySlot.set(selectedActivitySlotIndex, activityCalls);
      for (const call of unassignedCalls) {
        callSlotIndexByScopeAndId.set(callKey(scopeId, call.id), selectedActivitySlotIndex);
      }
    }

    const existingSlotIndexes = [...callsBySlot.keys()];
    const primarySlotIndex = activitySlotIndex ?? existingSlotIndexes[0];
    const commandsBySlot = new Map<number, NonNullable<ChatMessageViewSource['commands']>[number][]>();
    for (const command of message.commands ?? []) {
      const commandRecord = typeof command === 'object' && command !== null
        ? command as { toolCallId?: unknown }
        : null;
      const toolCallId = typeof commandRecord?.toolCallId === 'string'
        ? commandRecord.toolCallId.trim()
        : '';
      const commandSlot = toolCallId
        ? callSlotIndexByScopeAndId.get(callKey(scopeId, toolCallId)) ?? primarySlotIndex
        : primarySlotIndex;
      if (commandSlot !== undefined) {
        const slotCommands = commandsBySlot.get(commandSlot) ?? [];
        slotCommands.push(command);
        commandsBySlot.set(commandSlot, slotCommands);
      }
    }

    for (const [slotIndex, slotCalls] of callsBySlot) {
      const slotCommands = commandsBySlot.get(slotIndex) ?? [];
      if (createdActivitySlot && slotIndex === activitySlotIndex) {
        const ownsAllCalls = slotCalls.length === calls.length;
        const ownsAllCommands = slotCommands.length === (message.commands?.length ?? 0);
        const canRetainMessage = ownsAllCalls
          && ownsAllCommands
          && !fallbackEntry.callsWereRewritten
          && calls.length === fallbackEntry.calls.length;
        const slotMessage = canRetainMessage
          ? message
          : {
              ...message,
              tool_calls: slotCalls.length > 0 ? slotCalls : undefined,
              commands: slotCommands.length > 0 ? slotCommands : undefined,
              ...(slotIndex === primarySlotIndex
                ? {}
                : {
                    fileChanges: undefined,
                    reasoning: undefined,
                    resources: undefined,
                    taskProgress: undefined,
                  }),
            } as TMessage;
        normalizedMessages.push(slotMessage);
        slotCallsByIndex.set(slotIndex, new Map(slotCalls.map((call) => [call.id, call])));
        if (!canRetainMessage) {
          didNormalizeActivity = true;
        }
      } else {
        mergeIntoSlot(
          slotIndex,
          message,
          slotCalls,
          slotCommands,
          slotIndex === primarySlotIndex,
        );
      }
    }

    if (activitySlotIndex !== undefined) {
      previousActivitySlotIndex = activitySlotIndex;
      previousActivityScopeId = scopeId;
    } else if (contiguousSlotIndex === undefined) {
      previousActivitySlotIndex = undefined;
      previousActivityScopeId = '';
    }
    if (!createdActivitySlot) {
      didNormalizeActivity = true;
    }
  }

  for (const slotIndex of dirtySlotIndexes) {
    const previous = normalizedMessages[slotIndex]!;
    const callsById = slotCallsByIndex.get(slotIndex);
    const commandsByKey = slotCommandsByIndex.get(slotIndex);
    const fileChangesByPath = slotFileChangesByIndex.get(slotIndex);
    const resourcesByKey = slotResourcesByIndex.get(slotIndex);
    normalizedMessages[slotIndex] = {
      ...previous,
      ...(callsById?.size ? { tool_calls: [...callsById.values()] } : {}),
      ...(commandsByKey?.size ? { commands: [...commandsByKey.values()] } : {}),
      ...(fileChangesByPath?.size ? { fileChanges: [...fileChangesByPath.values()] } : {}),
      ...(slotReasoningByIndex.has(slotIndex)
        ? { reasoning: slotReasoningByIndex.get(slotIndex) }
        : {}),
      ...(resourcesByKey?.size ? { resources: [...resourcesByKey.values()] } : {}),
      ...(slotTaskProgressByIndex.has(slotIndex)
        ? { taskProgress: slotTaskProgressByIndex.get(slotIndex) }
        : {}),
    };
  }

  return didNormalizeActivity ? normalizedMessages : messages as TMessage[];
}

interface FileUpdateSummaryBlock {
  endLineIndex: number;
  fileChanges: ActivityFileChangeView[];
  startLineIndex: number;
}

function normalizeFileUpdateSummaryPath(path: string): string {
  return path.trim().replace(/^["'`]+|["'`]+$/g, '');
}

function parseFileUpdateSummaryEntry(line: string): ActivityFileChangeView | null {
  const match = FILE_UPDATE_SUMMARY_ENTRY_PATTERN.exec(line.trim());
  if (!match) {
    return null;
  }

  const statusToken = match[1] ?? '';
  const path = normalizeFileUpdateSummaryPath(match[2] ?? '');
  if (!path) {
    return null;
  }

  return {
    path,
    additions: 0,
    deletions: 0,
    lineImpactKnown: false,
    updateStatus: statusToken,
  };
}

function parseFileUpdateSummaryBlock(
  lines: readonly string[],
  startLineIndex: number,
): FileUpdateSummaryBlock | null {
  const fileChanges: ActivityFileChangeView[] = [];
  let endLineIndex = startLineIndex;

  for (let lineIndex = startLineIndex + 1; lineIndex < lines.length; lineIndex += 1) {
    const currentLine = lines[lineIndex]?.trim() ?? '';
    if (!currentLine) {
      endLineIndex = lineIndex;
      break;
    }

    if (FILE_UPDATE_SUMMARY_HEADER_PATTERN.test(currentLine)) {
      endLineIndex = lineIndex - 1;
      break;
    }

    const fileChange = parseFileUpdateSummaryEntry(currentLine);
    if (!fileChange) {
      endLineIndex = lineIndex - 1;
      break;
    }

    fileChanges.push(fileChange);
    endLineIndex = lineIndex;
  }

  return fileChanges.length > 0
    ? { endLineIndex, fileChanges, startLineIndex }
    : null;
}

export function parseFileUpdateSummaryContent(content: string): ActivityFileChangeView[] {
  if (!content.trim()) {
    return [];
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const fileChanges: ActivityFileChangeView[] = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    if (!FILE_UPDATE_SUMMARY_HEADER_PATTERN.test(lines[lineIndex]?.trim() ?? '')) {
      continue;
    }

    const summaryBlock = parseFileUpdateSummaryBlock(lines, lineIndex);
    if (!summaryBlock) {
      continue;
    }

    fileChanges.push(...summaryBlock.fileChanges);
    lineIndex = summaryBlock.endLineIndex;
  }

  return fileChanges;
}

function normalizeActivityFileChangePathKey(path: string): string {
  return normalizeFileUpdateSummaryPath(path).replace(/\\/g, '/');
}

function readActivityCommandKey(
  command: unknown,
  index: number,
  messageIdentity: string,
): string | null {
  if (typeof command !== 'object' || command === null) {
    return null;
  }

  const record = command as Record<string, unknown>;
  const commandText = typeof record.command === 'string' ? record.command.trim() : '';
  if (!commandText) {
    return null;
  }

  const toolCallId = typeof record.toolCallId === 'string' ? record.toolCallId.trim() : '';
  const kind = typeof record.kind === 'string' ? record.kind.trim() : '';
  return toolCallId || `${messageIdentity}\u0001${commandText}\u0001${kind}\u0001${index}`;
}

type ChatTurnActivitySummaryIndex = ReadonlyMap<ChatMessageViewSource, ChatTurnActivitySummary | null>;

const chatTurnActivitySummaryCache = new WeakMap<
  object,
  Map<string, ChatTurnActivitySummaryIndex>
>();

function buildChatTurnActivitySummaryIndex(
  messages: readonly ChatMessageViewSource[],
  options: ComposeChatTranscriptActivityOptions,
): ChatTurnActivitySummaryIndex {
  const messageIndexesByTurnId = new Map<string, number[]>();
  for (let index = 0; index < messages.length; index += 1) {
    const turnId = messages[index]?.turnId?.trim() ?? '';
    if (!turnId) {
      continue;
    }
    const messageIndexes = messageIndexesByTurnId.get(turnId) ?? [];
    messageIndexes.push(index);
    messageIndexesByTurnId.set(turnId, messageIndexes);
  }

  const summaryIndex = new Map<ChatMessageViewSource, ChatTurnActivitySummary | null>();
  const indexedMessages = new Set<ChatMessageViewSource>();
  for (const [turnId, messageIndexes] of messageIndexesByTurnId) {
    const toolEntries = collectTranscriptTurnToolEntries(
      messages,
      messageIndexes,
      turnId,
      options,
    );
    for (const entry of toolEntries) {
      const { index, message: candidate } = entry;
      indexedMessages.add(candidate);
      const fileChangesByPath = new Map<
        string,
        NonNullable<ChatMessageViewSource['fileChanges']>[number]
      >();
      const commandsByKey = new Map<
        string,
        NonNullable<ChatMessageViewSource['commands']>[number]
      >();
      const toolCallsById = new Map<string, ChatMessageToolCall>();

      for (const fileChange of candidate.fileChanges ?? []) {
        if (typeof fileChange !== 'object' || fileChange === null) {
          continue;
        }
        const path = (fileChange as FileChange).path;
        if (typeof path !== 'string' || !path.trim()) {
          continue;
        }
        fileChangesByPath.set(normalizeActivityFileChangePathKey(path), fileChange);
      }

      for (const toolCall of entry.calls) {
        toolCallsById.set(
          toolCall.id,
          mergeNormalizedToolCall(toolCallsById.get(toolCall.id), toolCall),
        );
      }

      for (let commandIndex = 0; commandIndex < (candidate.commands?.length ?? 0); commandIndex += 1) {
        const command = candidate.commands?.[commandIndex];
        const commandKey = readActivityCommandKey(
          command,
          commandIndex,
          candidate.id || String(index),
        );
        if (commandKey) {
          commandsByKey.set(commandKey, command!);
        }
      }

      for (const toolCall of toolCallsById.values()) {
        const normalizedCommand = normalizeChatMessageCommand(toolCall);
        if (normalizedCommand) {
          commandsByKey.set(normalizedCommand.toolCallId, normalizedCommand);
        }
      }

      summaryIndex.set(
        candidate,
        fileChangesByPath.size === 0 && commandsByKey.size === 0
        ? null
        : {
            commands: [...commandsByKey.values()],
            fileChanges: [...fileChangesByPath.values()],
          },
      );
    }
  }

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!;
    if (indexedMessages.has(message)) {
      continue;
    }
    const calls = readTranscriptToolCalls(message, options);
    const commandsByKey = new Map<string, NonNullable<ChatMessageViewSource['commands']>[number]>();
    const fileChangesByPath = new Map<
      string,
      NonNullable<ChatMessageViewSource['fileChanges']>[number]
    >();
    for (let commandIndex = 0; commandIndex < (message.commands?.length ?? 0); commandIndex += 1) {
      const command = message.commands?.[commandIndex];
      const key = readActivityCommandKey(command, commandIndex, message.id || String(index));
      if (key) {
        commandsByKey.set(key, command!);
      }
    }
    for (const call of calls) {
      const command = normalizeChatMessageCommand(call);
      if (command) {
        commandsByKey.set(command.toolCallId, command);
      }
    }
    for (const fileChange of message.fileChanges ?? []) {
      if (typeof fileChange === 'object' && fileChange !== null) {
        const path = (fileChange as FileChange).path;
        if (typeof path === 'string' && path.trim()) {
          fileChangesByPath.set(normalizeActivityFileChangePathKey(path), fileChange);
        }
      }
    }
    summaryIndex.set(
      message,
      commandsByKey.size === 0 && fileChangesByPath.size === 0
        ? null
        : {
            commands: [...commandsByKey.values()],
            fileChanges: [...fileChangesByPath.values()],
          },
    );
  }

  return summaryIndex;
}

function resolveChatTurnActivitySummaryIndex(
  messages: readonly ChatMessageViewSource[],
  options: ComposeChatTranscriptActivityOptions,
): ChatTurnActivitySummaryIndex {
  const cacheKey = options.engineId?.trim().toLowerCase() ?? '';
  const cachedByEngine = chatTurnActivitySummaryCache.get(messages);
  const cachedIndex = cachedByEngine?.get(cacheKey);
  if (cachedIndex) {
    return cachedIndex;
  }

  const summaryIndex = buildChatTurnActivitySummaryIndex(messages, options);
  const nextCachedByEngine = cachedByEngine ?? new Map<string, ChatTurnActivitySummaryIndex>();
  nextCachedByEngine.set(cacheKey, summaryIndex);
  if (!cachedByEngine) {
    chatTurnActivitySummaryCache.set(messages, nextCachedByEngine);
  }
  return summaryIndex;
}

/**
 * Resolves only the activity owned by this ordered transcript slot. A stable
 * message array is indexed once, then each rendered row is an O(1) lookup.
 */
export function resolveChatTurnActivitySummary(
  messages: readonly ChatMessageViewSource[],
  message: ChatMessageViewSource,
  options: ComposeChatTranscriptActivityOptions = {},
): ChatTurnActivitySummary | null {
  return resolveChatTurnActivitySummaryIndex(messages, options).get(message) ?? null;
}

export function resolveActivityFileChangeViews(
  message: ChatMessageViewSource,
): ActivityFileChangeView[] {
  const structuredFileChanges = (message.fileChanges ?? [])
    .filter((fileChange): fileChange is FileChange => {
      if (typeof fileChange !== 'object' || fileChange === null) {
        return false;
      }

      const path = (fileChange as FileChange).path;
      return typeof path === 'string' && path.trim().length > 0;
    })
    .map<ActivityFileChangeView>((fileChange) => ({
      ...fileChange,
      lineImpactKnown: fileChange.lineImpactKnown ?? true,
    }));
  const parsedFileChanges = parseFileUpdateSummaryContent(message.content).map<ActivityFileChangeView>(
    (fileChange) => ({
      ...fileChange,
      lineImpactKnown: false,
    }),
  );

  if (structuredFileChanges.length === 0) {
    return parsedFileChanges;
  }
  if (parsedFileChanges.length === 0) {
    return structuredFileChanges;
  }

  const fileChangesByPath = new Map<string, ActivityFileChangeView>();
  for (const fileChange of parsedFileChanges) {
    fileChangesByPath.set(normalizeActivityFileChangePathKey(fileChange.path), fileChange);
  }
  for (const fileChange of structuredFileChanges) {
    fileChangesByPath.set(normalizeActivityFileChangePathKey(fileChange.path), fileChange);
  }

  return [...fileChangesByPath.values()];
}

export function stripFileUpdateSummaryContent(content: string): string {
  if (!content.trim()) {
    return content;
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  let didStripSummaryBlock = false;
  const remainingLines: string[] = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const currentLine = lines[lineIndex] ?? '';
    if (!FILE_UPDATE_SUMMARY_HEADER_PATTERN.test(currentLine.trim())) {
      remainingLines.push(currentLine);
      continue;
    }

    const summaryBlock = parseFileUpdateSummaryBlock(lines, lineIndex);
    if (!summaryBlock) {
      remainingLines.push(currentLine);
      continue;
    }

    didStripSummaryBlock = true;
    lineIndex = summaryBlock.endLineIndex;
  }

  return didStripSummaryBlock ? remainingLines.join('\n').trim() : content;
}

export function shouldHideMessageContentAsFileUpdateSummary(
  content: string,
  activityFileChanges: readonly FileChange[] | undefined,
): boolean {
  if (!activityFileChanges || activityFileChanges.length === 0) {
    return false;
  }

  const strippedContent = stripFileUpdateSummaryContent(content);
  return strippedContent.length === 0;
}

export function resolveVisibleAssistantMessageContent(
  message: ChatMessageViewSource,
): string {
  const activityFileChanges = resolveActivityFileChangeViews(message);
  const strippedContent = stripFileUpdateSummaryContent(message.content).trim();

  if (shouldHideMessageContentAsFileUpdateSummary(message.content, activityFileChanges)) {
    return '';
  }

  if (activityFileChanges.length > 0) {
    const contentLines = message.content
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (
      contentLines.length === 1 &&
      FILE_UPDATE_SUMMARY_HEADER_PATTERN.test(contentLines[0] ?? '')
    ) {
      return '';
    }
  }

  return strippedContent || message.content;
}

export function resolveMessageCopyContent(message: ChatMessageViewSource): string {
  if (message.role === 'user') {
    return message.content;
  }

  return resolveVisibleAssistantMessageContent(message);
}

export function resolveVisibleMarkdownBlockContent(
  message: ChatMessageViewSource,
): string {
  if (message.role === 'user') {
    return message.content;
  }

  return resolveVisibleAssistantMessageContent(message);
}

export function hasParsedFileUpdateSummary(content: string): boolean {
  if (!content.trim()) {
    return false;
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  return lines.some((line) => FILE_UPDATE_SUMMARY_HEADER_PATTERN.test(line.trim()));
}
