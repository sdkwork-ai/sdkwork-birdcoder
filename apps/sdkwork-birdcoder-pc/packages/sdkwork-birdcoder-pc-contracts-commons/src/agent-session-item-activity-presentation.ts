import type { FileChange } from './file-change.ts';
import type { AgentSessionItemViewSource } from './agent-session-view.ts';
import { mergeAgentSessionItemReasoning } from './agent-session-item-reasoning.ts';
import {
  normalizeAgentSessionCommand,
  normalizeAgentSessionItemToolResult,
  normalizeAgentSessionItemToolCalls,
  type AgentSessionItemToolCallView,
} from './agent-session-item-tool-calls.ts';

const FILE_UPDATE_SUMMARY_HEADER_PATTERN = /^(?:Success\.\s+)?Updated the following files:\s*$/i;
const FILE_UPDATE_SUMMARY_ENTRY_PATTERN = /^([A-Z?]{1,2})\s+(.+)$/;

export interface AgentSessionActivityFileChangeView extends FileChange {
  lineImpactKnown?: boolean;
  updateStatus?: string;
}

export interface AgentTurnActivityPresentation {
  commands: readonly NonNullable<AgentSessionItemViewSource['commands']>[number][];
  fileChanges: readonly NonNullable<AgentSessionItemViewSource['fileChanges']>[number][];
}

export interface ComposeAgentSessionTranscriptActivityOptions {
  engineId?: string;
}

function isAgentTurnReplyItem(item: AgentSessionItemViewSource): boolean {
  return item.role === 'assistant' || item.role === 'planner' || item.role === 'reviewer';
}

const TERMINAL_TOOL_CALL_STATUSES = new Set<NonNullable<AgentSessionItemToolCallView['status']>>([
  'cancelled',
  'error',
  'success',
]);

const TOOL_RESULT_TYPE_PATTERN = /(?:_output|_result)$/u;
const TRANSCRIPT_FALLBACK_TOOL_CALL_ID_PREFIX = 'birdcoder-fallback';

function resolveMergedToolCallStatus(
  previous: AgentSessionItemToolCallView['status'],
  incoming: AgentSessionItemToolCallView['status'],
): AgentSessionItemToolCallView['status'] {
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
  previous: AgentSessionItemToolCallView | undefined,
  incoming: AgentSessionItemToolCallView,
): AgentSessionItemToolCallView {
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
  item: AgentSessionItemViewSource,
  options: ComposeAgentSessionTranscriptActivityOptions,
): AgentSessionItemToolCallView[] {
  const fallbackIdentity = item.id.trim()
    || `${item.turnId?.trim() ?? 'turn'}:${item.createdAt}`;
  const calls = normalizeAgentSessionItemToolCalls(item.tool_calls, {
    ...options,
    fallbackIdPrefix: `${TRANSCRIPT_FALLBACK_TOOL_CALL_ID_PREFIX}:${fallbackIdentity}:tool`,
  });
  if (item.role !== 'tool') {
    return calls;
  }
  if (calls.length > 0) {
    return calls;
  }

  const metadata = typeof item.metadata === 'object' && item.metadata !== null
    ? item.metadata as Record<string, unknown>
    : null;
  const result = normalizeAgentSessionItemToolResult({
    content: item.content,
    id: item.tool_call_id,
    name: item.name,
    status: metadata?.is_error === true ? 'error' : undefined,
  }, options);
  return result ? [result] : calls;
}

function readTranscriptCommandKey(
  command: NonNullable<AgentSessionItemViewSource['commands']>[number],
  index: number,
  sessionItemIdentity: string,
): string {
  if (typeof command !== 'object' || command === null) {
    return `command-${index}`;
  }

  const record = command as { command?: unknown; kind?: unknown; toolCallId?: unknown };
  const toolCallId = typeof record.toolCallId === 'string' ? record.toolCallId.trim() : '';
  const commandText = typeof record.command === 'string' ? record.command.trim() : '';
  const kind = typeof record.kind === 'string' ? record.kind : '';
  return toolCallId || `${sessionItemIdentity}\u0001${commandText}\u0001${kind}\u0001${index}`;
}

interface TranscriptTurnToolEntry<TItem extends AgentSessionItemViewSource> {
  calls: AgentSessionItemToolCallView[];
  callsWereRewritten: boolean;
  index: number;
  isCollapsible: boolean;
  item: TItem;
}

function normalizeToolIdentityName(name: string): string {
  return name.trim().toLowerCase().replace(/[.\s-]+/gu, '_') || 'tool';
}

function isFallbackToolCallId(id: string): boolean {
  return id.startsWith(`${TRANSCRIPT_FALLBACK_TOOL_CALL_ID_PREFIX}:`);
}

function correlateGeminiFallbackToolCallIds<TItem extends AgentSessionItemViewSource>(
  entries: TranscriptTurnToolEntry<TItem>[],
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

function readCanonicalToolCallTaskId(call: AgentSessionItemToolCallView): string {
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

function correlateClaudeTaskToolCallIds<TItem extends AgentSessionItemViewSource>(
  entries: TranscriptTurnToolEntry<TItem>[],
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

function collectTranscriptTurnToolEntries<TItem extends AgentSessionItemViewSource>(
  items: readonly TItem[],
  sessionItemIndexes: readonly number[],
  scopeId: string,
  options: ComposeAgentSessionTranscriptActivityOptions,
): TranscriptTurnToolEntry<TItem>[] {
  const entries = sessionItemIndexes.map((index) => {
    const item = items[index]!;
    const calls = readTranscriptToolCalls(item, options);
    return {
      calls,
      callsWereRewritten: false,
      index,
      isCollapsible: isCollapsibleToolActivityItem(item, calls),
      item,
    };
  });
  correlateGeminiFallbackToolCallIds(entries, scopeId, options.engineId);
  correlateClaudeTaskToolCallIds(entries, options.engineId);
  return entries;
}

function resolveAgentSessionItemScopeIds(
  items: readonly AgentSessionItemViewSource[],
): string[] {
  const fallbackEpochBySessionId = new Map<string, number>();
  const scopeIds: string[] = [];
  for (const item of items) {
    const turnId = item.turnId?.trim() ?? '';
    if (turnId) {
      scopeIds.push(`turn:${turnId}`);
      continue;
    }

    const sessionId = item.sessionId.trim() || 'transcript';
    let epoch = fallbackEpochBySessionId.get(sessionId) ?? 0;
    if (item.role === 'user') {
      epoch += 1;
      fallbackEpochBySessionId.set(sessionId, epoch);
    }
    scopeIds.push(`session:${sessionId}:user-epoch:${epoch}`);
  }
  return scopeIds;
}

function isCollapsibleToolActivityItem(
  item: AgentSessionItemViewSource,
  calls: readonly AgentSessionItemToolCallView[],
): boolean {
  if (item.role === 'tool') {
    return true;
  }
  if (!isAgentTurnReplyItem(item)) {
    return false;
  }

  return !resolveVisibleAssistantSessionItemContent(item).trim() && (
    calls.length > 0 ||
    (item.commands?.length ?? 0) > 0 ||
    (item.fileChanges?.length ?? 0) > 0 ||
    Boolean(item.taskProgress)
  );
}

/**
 * Folds provider tool-use/progress/result lifecycles into their first ordered
 * transcript slot while keeping renderer code independent of provider formats.
 */
export function composeAgentSessionTranscriptActivity<TItem extends AgentSessionItemViewSource>(
  items: readonly TItem[],
  options: ComposeAgentSessionTranscriptActivityOptions = {},
): TItem[] {
  const scopeIds = resolveAgentSessionItemScopeIds(items);
  const sessionItemIndexesByScopeId = new Map<string, number[]>();
  for (let index = 0; index < items.length; index += 1) {
    const scopeId = scopeIds[index]!;
    const scopeItemIndexes = sessionItemIndexesByScopeId.get(scopeId) ?? [];
    scopeItemIndexes.push(index);
    sessionItemIndexesByScopeId.set(scopeId, scopeItemIndexes);
  }

  const entriesByItemIndex = new Map<number, TranscriptTurnToolEntry<TItem>>();
  for (const [scopeId, sessionItemIndexes] of sessionItemIndexesByScopeId) {
    for (const entry of collectTranscriptTurnToolEntries(
      items,
      sessionItemIndexes,
      scopeId,
      options,
    )) {
      entriesByItemIndex.set(entry.index, entry);
    }
  }

  const normalizedItems: TItem[] = [];
  const callSlotIndexByScopeAndId = new Map<string, number>();
  const slotCallsByIndex = new Map<number, Map<string, AgentSessionItemToolCallView>>();
  const dirtySlotIndexes = new Set<number>();
  const slotCommandsByIndex = new Map<
    number,
    Map<string, NonNullable<AgentSessionItemViewSource['commands']>[number]>
  >();
  const slotFileChangesByIndex = new Map<
    number,
    Map<string, NonNullable<AgentSessionItemViewSource['fileChanges']>[number]>
  >();
  const slotResourcesByIndex = new Map<
    number,
    Map<string, NonNullable<AgentSessionItemViewSource['resources']>[number]>
  >();
  const slotReasoningByIndex = new Map<number, TItem['reasoning']>();
  const slotTaskProgressByIndex = new Map<number, TItem['taskProgress']>();
  let previousActivitySlotIndex: number | undefined;
  let previousActivityScopeId = '';
  let didNormalizeActivity = false;

  const callKey = (scopeId: string, callId: string): string => `${scopeId}\u0001${callId}`;
  const readResourceKey = (
    resource: NonNullable<AgentSessionItemViewSource['resources']>[number],
    index: number,
    sessionItemIdentity: string,
  ): string => {
    const id = typeof resource === 'object' && resource !== null && 'id' in resource
      && typeof resource.id === 'string'
      ? resource.id.trim()
      : '';
    return id || `${sessionItemIdentity}\u0001resource\u0001${index}`;
  };
  const mergeIntoSlot = (
    slotIndex: number,
    incoming: TItem,
    calls: readonly AgentSessionItemToolCallView[],
    incomingCommands: readonly NonNullable<AgentSessionItemViewSource['commands']>[number][],
    includeAncillary: boolean,
  ): void => {
    const previous = normalizedItems[slotIndex]!;
    const callsById = slotCallsByIndex.get(slotIndex) ?? new Map<string, AgentSessionItemToolCallView>();
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
      const reasoning = mergeAgentSessionItemReasoning(
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

  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = items[itemIndex]!;
    const scopeId = scopeIds[itemIndex]!;
    const fallbackCalls = entriesByItemIndex.has(itemIndex)
      ? []
      : readTranscriptToolCalls(item, options);
    const fallbackEntry = entriesByItemIndex.get(itemIndex) ?? {
      calls: fallbackCalls,
      callsWereRewritten: false,
      index: itemIndex,
      isCollapsible: isCollapsibleToolActivityItem(item, fallbackCalls),
      item,
    };
    const callsById = new Map<string, AgentSessionItemToolCallView>();
    for (const call of fallbackEntry.calls) {
      callsById.set(call.id, mergeNormalizedToolCall(callsById.get(call.id), call));
    }
    const calls = [...callsById.values()];

    if (!fallbackEntry.isCollapsible) {
      previousActivitySlotIndex = undefined;
      previousActivityScopeId = '';
      const hasDuplicateLifecycle = calls.length < fallbackEntry.calls.length;
      const retainedCalls: AgentSessionItemToolCallView[] = [];
      let routedCallToPriorSlot = false;
      for (const call of calls) {
        const existingSlot = callSlotIndexByScopeAndId.get(callKey(scopeId, call.id));
        if (existingSlot === undefined) {
          retainedCalls.push(call);
        } else {
          mergeIntoSlot(existingSlot, item, [call], [], false);
          routedCallToPriorSlot = true;
        }
      }
      const outputIndex = normalizedItems.length;
      const mustNormalizeCalls = hasDuplicateLifecycle
        || fallbackEntry.callsWereRewritten
        || routedCallToPriorSlot;
      normalizedItems.push(mustNormalizeCalls
        ? {
            ...item,
            tool_calls: retainedCalls.length > 0 ? retainedCalls : undefined,
          } as TItem
        : item);
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

    const callsBySlot = new Map<number, AgentSessionItemToolCallView[]>();
    const unassignedCalls: AgentSessionItemToolCallView[] = [];
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
      const selectedActivitySlotIndex = contiguousSlotIndex ?? normalizedItems.length;
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
    const commandsBySlot = new Map<number, NonNullable<AgentSessionItemViewSource['commands']>[number][]>();
    for (const command of item.commands ?? []) {
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
        const ownsAllCommands = slotCommands.length === (item.commands?.length ?? 0);
        const canRetainItem = ownsAllCalls
          && ownsAllCommands
          && !fallbackEntry.callsWereRewritten
          && calls.length === fallbackEntry.calls.length;
        const slotItem = canRetainItem
          ? item
          : {
              ...item,
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
            } as TItem;
        normalizedItems.push(slotItem);
        slotCallsByIndex.set(slotIndex, new Map(slotCalls.map((call) => [call.id, call])));
        if (!canRetainItem) {
          didNormalizeActivity = true;
        }
      } else {
        mergeIntoSlot(
          slotIndex,
          item,
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
    const previous = normalizedItems[slotIndex]!;
    const callsById = slotCallsByIndex.get(slotIndex);
    const commandsByKey = slotCommandsByIndex.get(slotIndex);
    const fileChangesByPath = slotFileChangesByIndex.get(slotIndex);
    const resourcesByKey = slotResourcesByIndex.get(slotIndex);
    normalizedItems[slotIndex] = {
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

  return didNormalizeActivity ? normalizedItems : items as TItem[];
}

interface FileUpdateSummaryBlock {
  endLineIndex: number;
  fileChanges: AgentSessionActivityFileChangeView[];
  startLineIndex: number;
}

function normalizeFileUpdateSummaryPath(path: string): string {
  return path.trim().replace(/^["'`]+|["'`]+$/g, '');
}

function parseFileUpdateSummaryEntry(line: string): AgentSessionActivityFileChangeView | null {
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
  const fileChanges: AgentSessionActivityFileChangeView[] = [];
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

export function parseFileUpdateSummaryContent(content: string): AgentSessionActivityFileChangeView[] {
  if (!content.trim()) {
    return [];
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const fileChanges: AgentSessionActivityFileChangeView[] = [];
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
  sessionItemIdentity: string,
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
  return toolCallId || `${sessionItemIdentity}\u0001${commandText}\u0001${kind}\u0001${index}`;
}

type AgentTurnActivitySummaryIndex = ReadonlyMap<AgentSessionItemViewSource, AgentTurnActivityPresentation | null>;

const agentTurnActivitySummaryCache = new WeakMap<
  object,
  Map<string, AgentTurnActivitySummaryIndex>
>();

function buildAgentTurnActivitySummaryIndex(
  items: readonly AgentSessionItemViewSource[],
  options: ComposeAgentSessionTranscriptActivityOptions,
): AgentTurnActivitySummaryIndex {
  const sessionItemIndexesByTurnId = new Map<string, number[]>();
  for (let index = 0; index < items.length; index += 1) {
    const turnId = items[index]?.turnId?.trim() ?? '';
    if (!turnId) {
      continue;
    }
    const sessionItemIndexes = sessionItemIndexesByTurnId.get(turnId) ?? [];
    sessionItemIndexes.push(index);
    sessionItemIndexesByTurnId.set(turnId, sessionItemIndexes);
  }

  const summaryIndex = new Map<AgentSessionItemViewSource, AgentTurnActivityPresentation | null>();
  const indexedItems = new Set<AgentSessionItemViewSource>();
  for (const [turnId, sessionItemIndexes] of sessionItemIndexesByTurnId) {
    const toolEntries = collectTranscriptTurnToolEntries(
      items,
      sessionItemIndexes,
      turnId,
      options,
    );
    for (const entry of toolEntries) {
      const { index, item: candidate } = entry;
      indexedItems.add(candidate);
      const fileChangesByPath = new Map<
        string,
        NonNullable<AgentSessionItemViewSource['fileChanges']>[number]
      >();
      const commandsByKey = new Map<
        string,
        NonNullable<AgentSessionItemViewSource['commands']>[number]
      >();
      const toolCallsById = new Map<string, AgentSessionItemToolCallView>();

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
        const normalizedCommand = normalizeAgentSessionCommand(toolCall);
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

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    if (indexedItems.has(item)) {
      continue;
    }
    const calls = readTranscriptToolCalls(item, options);
    const commandsByKey = new Map<string, NonNullable<AgentSessionItemViewSource['commands']>[number]>();
    const fileChangesByPath = new Map<
      string,
      NonNullable<AgentSessionItemViewSource['fileChanges']>[number]
    >();
    for (let commandIndex = 0; commandIndex < (item.commands?.length ?? 0); commandIndex += 1) {
      const command = item.commands?.[commandIndex];
      const key = readActivityCommandKey(command, commandIndex, item.id || String(index));
      if (key) {
        commandsByKey.set(key, command!);
      }
    }
    for (const call of calls) {
      const command = normalizeAgentSessionCommand(call);
      if (command) {
        commandsByKey.set(command.toolCallId, command);
      }
    }
    for (const fileChange of item.fileChanges ?? []) {
      if (typeof fileChange === 'object' && fileChange !== null) {
        const path = (fileChange as FileChange).path;
        if (typeof path === 'string' && path.trim()) {
          fileChangesByPath.set(normalizeActivityFileChangePathKey(path), fileChange);
        }
      }
    }
    summaryIndex.set(
      item,
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

function resolveAgentTurnActivitySummaryIndex(
  items: readonly AgentSessionItemViewSource[],
  options: ComposeAgentSessionTranscriptActivityOptions,
): AgentTurnActivitySummaryIndex {
  const cacheKey = options.engineId?.trim().toLowerCase() ?? '';
  const cachedByEngine = agentTurnActivitySummaryCache.get(items);
  const cachedIndex = cachedByEngine?.get(cacheKey);
  if (cachedIndex) {
    return cachedIndex;
  }

  const summaryIndex = buildAgentTurnActivitySummaryIndex(items, options);
  const nextCachedByEngine = cachedByEngine ?? new Map<string, AgentTurnActivitySummaryIndex>();
  nextCachedByEngine.set(cacheKey, summaryIndex);
  if (!cachedByEngine) {
    agentTurnActivitySummaryCache.set(items, nextCachedByEngine);
  }
  return summaryIndex;
}

/**
 * Resolves only the activity owned by this ordered transcript slot. A stable
 * item array is indexed once, then each rendered row is an O(1) lookup.
 */
export function resolveAgentTurnActivityPresentation(
  items: readonly AgentSessionItemViewSource[],
  item: AgentSessionItemViewSource,
  options: ComposeAgentSessionTranscriptActivityOptions = {},
): AgentTurnActivityPresentation | null {
  return resolveAgentTurnActivitySummaryIndex(items, options).get(item) ?? null;
}

export function resolveAgentSessionActivityFileChangeViews(
  item: AgentSessionItemViewSource,
): AgentSessionActivityFileChangeView[] {
  const structuredFileChanges = (item.fileChanges ?? [])
    .filter((fileChange): fileChange is FileChange => {
      if (typeof fileChange !== 'object' || fileChange === null) {
        return false;
      }

      const path = (fileChange as FileChange).path;
      return typeof path === 'string' && path.trim().length > 0;
    })
    .map<AgentSessionActivityFileChangeView>((fileChange) => ({
      ...fileChange,
      lineImpactKnown: fileChange.lineImpactKnown ?? true,
    }));
  const parsedFileChanges = parseFileUpdateSummaryContent(item.content).map<AgentSessionActivityFileChangeView>(
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

  const fileChangesByPath = new Map<string, AgentSessionActivityFileChangeView>();
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

export function shouldHideSessionItemContentAsFileUpdateSummary(
  content: string,
  activityFileChanges: readonly FileChange[] | undefined,
): boolean {
  if (!activityFileChanges || activityFileChanges.length === 0) {
    return false;
  }

  const strippedContent = stripFileUpdateSummaryContent(content);
  return strippedContent.length === 0;
}

export function resolveVisibleAssistantSessionItemContent(
  item: AgentSessionItemViewSource,
): string {
  const activityFileChanges = resolveAgentSessionActivityFileChangeViews(item);
  const strippedContent = stripFileUpdateSummaryContent(item.content).trim();

  if (shouldHideSessionItemContentAsFileUpdateSummary(item.content, activityFileChanges)) {
    return '';
  }

  if (activityFileChanges.length > 0) {
    const contentLines = item.content
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

  return strippedContent || item.content;
}

export function resolveSessionItemCopyContent(item: AgentSessionItemViewSource): string {
  if (item.role === 'user') {
    return item.content;
  }

  return resolveVisibleAssistantSessionItemContent(item);
}

export function resolveAgentSessionItemVisibleMarkdownContent(
  item: AgentSessionItemViewSource,
): string {
  if (item.role === 'user') {
    return item.content;
  }

  return resolveVisibleAssistantSessionItemContent(item);
}

export function hasParsedFileUpdateSummary(content: string): boolean {
  if (!content.trim()) {
    return false;
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  return lines.some((line) => FILE_UPDATE_SUMMARY_HEADER_PATTERN.test(line.trim()));
}
