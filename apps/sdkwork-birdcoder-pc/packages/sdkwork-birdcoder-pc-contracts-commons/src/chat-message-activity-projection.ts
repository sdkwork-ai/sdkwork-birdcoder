import type { FileChange } from './file-change.ts';
import type { ChatMessageViewSource } from './chat-message-view.ts';
import {
  projectChatMessageCommand,
  projectChatMessageToolResult,
  projectChatMessageToolCalls,
  type ChatMessageToolCall,
} from './chat-message-tool-calls.ts';

const FILE_UPDATE_SUMMARY_HEADER_PATTERN = /^(?:Success\.\s+)?Updated the following files:\s*$/i;
const FILE_UPDATE_SUMMARY_ENTRY_PATTERN = /^([A-Z?]{1,2})\s+(.+)$/;

export interface ProjectedActivityFileChange extends FileChange {
  lineImpactKnown?: boolean;
  updateStatus?: string;
}

export interface ChatTurnActivitySummary {
  commands: readonly NonNullable<ChatMessageViewSource['commands']>[number][];
  fileChanges: readonly NonNullable<ChatMessageViewSource['fileChanges']>[number][];
}

export interface ProjectChatTranscriptToolActivityOptions {
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

function mergeProjectedToolCall(
  previous: ChatMessageToolCall | undefined,
  incoming: ChatMessageToolCall,
): ChatMessageToolCall {
  if (!previous) {
    return incoming;
  }

  return {
    ...previous,
    ...incoming,
    arguments: incoming.arguments.trim() ? incoming.arguments : previous.arguments,
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
  options: ProjectChatTranscriptToolActivityOptions,
): ChatMessageToolCall[] {
  const fallbackIdentity = message.id.trim()
    || `${message.turnId?.trim() ?? 'turn'}:${message.createdAt}`;
  const calls = projectChatMessageToolCalls(message.tool_calls, {
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
  const result = projectChatMessageToolResult({
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
): void {
  if (engineId?.trim().toLowerCase() !== 'gemini') {
    return;
  }

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
      return {
        ...call,
        id: requestId ?? `birdcoder-gemini:${turnId}:${normalizedName}:result-${resultIndex + 1}`,
      };
    });
  }
}

function collectTranscriptTurnToolEntries<TMessage extends ChatMessageViewSource>(
  messages: readonly TMessage[],
  messageIndexes: readonly number[],
  turnId: string,
  options: ProjectChatTranscriptToolActivityOptions,
): TranscriptTurnToolEntry<TMessage>[] {
  const entries = messageIndexes.map((index) => {
    const message = messages[index]!;
    const calls = readTranscriptToolCalls(message, options);
    return {
      calls,
      index,
      isCollapsible: isCollapsibleToolActivityMessage(message, calls),
      message,
    };
  });
  correlateGeminiFallbackToolCallIds(entries, turnId, options.engineId);
  return entries;
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
 * Collapses provider tool-use/progress/result messages into one stable turn row.
 * This mirrors desktop coding clients while keeping the renderer independent of
 * Codex, Claude Code, OpenCode, and Gemini wire formats.
 */
export function projectChatTranscriptToolActivity<TMessage extends ChatMessageViewSource>(
  messages: readonly TMessage[],
  options: ProjectChatTranscriptToolActivityOptions = {},
): TMessage[] {
  if (messages.length < 2) {
    return messages as TMessage[];
  }

  const messageIndexesByTurnId = new Map<string, number[]>();
  const replyTargetByTurnId = new Map<string, number>();
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!;
    const turnId = message.turnId?.trim() ?? '';
    if (!turnId) {
      continue;
    }
    const turnMessageIndexes = messageIndexesByTurnId.get(turnId) ?? [];
    turnMessageIndexes.push(index);
    messageIndexesByTurnId.set(turnId, turnMessageIndexes);
    if (isTurnReplyMessage(message)) {
      replyTargetByTurnId.set(turnId, index);
    }
  }

  const projectedMessages = [...messages];
  const suppressedIndexes = new Set<number>();
  let didProjectActivity = false;
  for (const [turnId, targetIndex] of replyTargetByTurnId.entries()) {
    const turnMessageIndexes = messageIndexesByTurnId.get(turnId) ?? [];
    const turnEntries = collectTranscriptTurnToolEntries(
      messages,
      turnMessageIndexes,
      turnId,
      options,
    );
    const callsById = new Map<string, ChatMessageToolCall>();
    const commandsByKey = new Map<
      string,
      NonNullable<ChatMessageViewSource['commands']>[number]
    >();
    const fileChangesByPath = new Map<
      string,
      NonNullable<ChatMessageViewSource['fileChanges']>[number]
    >();
    let latestTaskProgress: ChatMessageViewSource['taskProgress'];
    let hasCollapsibleActivity = false;

    for (const entry of turnEntries) {
      const { calls, index, isCollapsible, message } = entry;
      if (index !== targetIndex && !isCollapsible) {
        continue;
      }

      hasCollapsibleActivity ||= isCollapsible;
      for (const call of calls) {
        callsById.set(call.id, mergeProjectedToolCall(callsById.get(call.id), call));
      }
      for (let commandIndex = 0; commandIndex < (message.commands?.length ?? 0); commandIndex += 1) {
        const command = message.commands?.[commandIndex];
        if (command) {
          commandsByKey.set(
            readTranscriptCommandKey(command, commandIndex, message.id || String(index)),
            command,
          );
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
      if (message.taskProgress) {
        latestTaskProgress = message.taskProgress;
      }
      if (index !== targetIndex && isCollapsible) {
        suppressedIndexes.add(index);
      }
    }

    if (!hasCollapsibleActivity) {
      continue;
    }

    const target = messages[targetIndex]!;
    projectedMessages[targetIndex] = {
      ...target,
      ...(callsById.size > 0 ? { tool_calls: [...callsById.values()] } : {}),
      ...(commandsByKey.size > 0 ? { commands: [...commandsByKey.values()] } : {}),
      ...(fileChangesByPath.size > 0 ? { fileChanges: [...fileChangesByPath.values()] } : {}),
      ...(latestTaskProgress ? { taskProgress: latestTaskProgress } : {}),
    };
    didProjectActivity = true;
  }

  return suppressedIndexes.size === 0
    ? didProjectActivity ? projectedMessages : messages as TMessage[]
    : projectedMessages.filter((_, index) => !suppressedIndexes.has(index));
}

interface FileUpdateSummaryBlock {
  endLineIndex: number;
  fileChanges: ProjectedActivityFileChange[];
  startLineIndex: number;
}

function normalizeFileUpdateSummaryPath(path: string): string {
  return path.trim().replace(/^["'`]+|["'`]+$/g, '');
}

function parseFileUpdateSummaryEntry(line: string): ProjectedActivityFileChange | null {
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
  const fileChanges: ProjectedActivityFileChange[] = [];
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

export function parseFileUpdateSummaryContent(content: string): ProjectedActivityFileChange[] {
  if (!content.trim()) {
    return [];
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const fileChanges: ProjectedActivityFileChange[] = [];
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

function isTurnCompletionReply(message: ChatMessageViewSource): boolean {
  return message.role === 'assistant' || message.role === 'planner' || message.role === 'reviewer';
}

interface CachedChatTurnActivitySummary {
  lastReply: ChatMessageViewSource | undefined;
  summary: ChatTurnActivitySummary | null;
}

type ChatTurnActivitySummaryIndex = ReadonlyMap<string, CachedChatTurnActivitySummary>;

const chatTurnActivitySummaryCache = new WeakMap<
  object,
  Map<string, ChatTurnActivitySummaryIndex>
>();

function buildChatTurnActivitySummaryIndex(
  messages: readonly ChatMessageViewSource[],
  options: ProjectChatTranscriptToolActivityOptions,
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

  const summaryIndex = new Map<string, CachedChatTurnActivitySummary>();
  for (const [turnId, messageIndexes] of messageIndexesByTurnId) {
    const fileChangesByPath = new Map<
      string,
      NonNullable<ChatMessageViewSource['fileChanges']>[number]
    >();
    const commandsByKey = new Map<
      string,
      NonNullable<ChatMessageViewSource['commands']>[number]
    >();
    const toolCallsById = new Map<string, ChatMessageToolCall>();
    const toolEntries = collectTranscriptTurnToolEntries(
      messages,
      messageIndexes,
      turnId,
      options,
    );
    let lastReply: ChatMessageViewSource | undefined;

    for (const entry of toolEntries) {
      const { index, message: candidate } = entry;
      if (isTurnCompletionReply(candidate)) {
        lastReply = candidate;
      }

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
          mergeProjectedToolCall(toolCallsById.get(toolCall.id), toolCall),
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
    }

    for (const toolCall of toolCallsById.values()) {
      const projectedCommand = projectChatMessageCommand(toolCall);
      if (projectedCommand) {
        commandsByKey.set(projectedCommand.toolCallId, projectedCommand);
      }
    }

    summaryIndex.set(turnId, {
      lastReply,
      summary: fileChangesByPath.size === 0 && commandsByKey.size === 0
        ? null
        : {
            commands: [...commandsByKey.values()],
            fileChanges: [...fileChangesByPath.values()],
          },
    });
  }

  return summaryIndex;
}

function resolveChatTurnActivitySummaryIndex(
  messages: readonly ChatMessageViewSource[],
  options: ProjectChatTranscriptToolActivityOptions,
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
 * Resolves the activity card for a turn's final reply through a transcript-level
 * weak cache. A stable message array is indexed once, then each rendered row is
 * an O(1) lookup.
 */
export function resolveChatTurnActivitySummary(
  messages: readonly ChatMessageViewSource[],
  message: ChatMessageViewSource,
  options: ProjectChatTranscriptToolActivityOptions = {},
): ChatTurnActivitySummary | null {
  const turnId = message.turnId?.trim() ?? '';
  if (!turnId || !isTurnCompletionReply(message)) {
    return null;
  }

  const cachedTurn = resolveChatTurnActivitySummaryIndex(messages, options).get(turnId);
  return cachedTurn?.lastReply === message ? cachedTurn.summary : null;
}

export function resolveProjectedActivityFileChanges(
  message: ChatMessageViewSource,
): ProjectedActivityFileChange[] {
  const structuredFileChanges = (message.fileChanges ?? [])
    .filter((fileChange): fileChange is FileChange => {
      if (typeof fileChange !== 'object' || fileChange === null) {
        return false;
      }

      const path = (fileChange as FileChange).path;
      return typeof path === 'string' && path.trim().length > 0;
    })
    .map<ProjectedActivityFileChange>((fileChange) => ({
      ...fileChange,
      lineImpactKnown: fileChange.lineImpactKnown ?? true,
    }));
  const parsedFileChanges = parseFileUpdateSummaryContent(message.content).map<ProjectedActivityFileChange>(
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

  const fileChangesByPath = new Map<string, ProjectedActivityFileChange>();
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
  const activityFileChanges = resolveProjectedActivityFileChanges(message);
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
