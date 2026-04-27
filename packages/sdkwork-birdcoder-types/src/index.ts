import type {
  BirdCoderCodingSessionMessage as BirdCoderRuntimeCodingSessionMessage,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionRuntimeStatus,
  BirdCoderCodingSessionSummary,
} from './coding-session.ts';
import type {
  BirdCoderCanonicalEntityId,
  BirdCoderDataScope,
  BirdCoderLongIntegerString,
} from './data.ts';
import {
  buildBirdCoderChatMessageLogicalMatchKey,
  compareBirdCoderCodingSessionEventSequence,
  deduplicateBirdCoderComparableChatMessages,
  extractBirdCoderTextContent,
} from './coding-session.ts';
import { parseBirdCoderApiJson, stringifyBirdCoderApiJson } from './json.ts';
import {
  canonicalizeBirdCoderCodeEngineToolName,
  isBirdCoderCodeEngineApprovalToolName,
  isBirdCoderCodeEngineSettledStatus,
  isBirdCoderCodeEngineUserQuestionToolName,
  mergeBirdCoderCodeEngineCommandSnapshot,
  normalizeBirdCoderCodeEngineBoolean,
  normalizeBirdCoderCodeEngineRuntimeStatus,
  resolveBirdCoderCodeEngineApprovalRuntimeStatus,
  resolveBirdCoderCodeEngineArtifactKind,
  resolveBirdCoderCodeEngineCommandInteractionState,
  resolveBirdCoderCodeEngineCommandStatus,
  resolveBirdCoderCodeEngineCommandText,
  resolveBirdCoderCodeEngineToolCallId,
  resolveBirdCoderCodeEngineToolKind,
  resolveBirdCoderCodeEngineUserQuestionId,
  resolveBirdCoderCodeEngineUserQuestionRuntimeStatus,
  type BirdCoderCodeEngineToolKind,
} from './codeEngineDialect.ts';

declare global {
  interface Window {
    __TAURI__?: any;
  }
}

export type AppTab =
  | 'code'
  | 'studio'
  | 'terminal'
  | 'settings'
  | 'auth'
  | 'user'
  | 'vip'
  | 'skills'
  | 'templates';

export * from './projectBusinessIdentity.ts';

export interface User {
  id: BirdCoderCanonicalEntityId;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface IWorkspace {
  id: BirdCoderCanonicalEntityId;
  uuid?: string;
  tenantId?: BirdCoderCanonicalEntityId;
  organizationId?: BirdCoderCanonicalEntityId;
  dataScope?: BirdCoderDataScope;
  code?: string;
  title?: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  ownerId?: BirdCoderCanonicalEntityId;
  leaderId?: BirdCoderCanonicalEntityId;
  createdByUserId?: BirdCoderCanonicalEntityId;
  type?: string;
  status?: 'active' | 'archived';
  startTime?: string;
  endTime?: string;
  maxMembers?: number;
  currentMembers?: number;
  memberCount?: number;
  maxStorage?: BirdCoderLongIntegerString;
  usedStorage?: BirdCoderLongIntegerString;
  settings?: Record<string, unknown>;
  isPublic?: boolean;
  isTemplate?: boolean;
  viewerRole?: 'owner' | 'admin' | 'member' | 'viewer';
}

export interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  content?: string;
  originalContent?: string;
}

export interface CommandExecution {
  command: string;
  status: 'running' | 'success' | 'error';
  output?: string;
  kind?: CommandExecutionKind;
  toolName?: string;
  toolCallId?: string;
  runtimeStatus?: BirdCoderCodingSessionRuntimeStatus;
  requiresApproval?: boolean;
  requiresReply?: boolean;
}

export type CommandExecutionKind = BirdCoderCodeEngineToolKind;

export interface TaskProgress {
  total: number;
  completed: number;
}

export interface BirdCoderChatMessage extends BirdCoderRuntimeCodingSessionMessage {
  timestamp?: number;
  name?: string;
  tool_calls?: any[];
  tool_call_id?: string;
  fileChanges?: FileChange[];
  commands?: CommandExecution[];
  taskProgress?: TaskProgress;
}

interface BirdCoderProjectionDeltaMessage {
  commands?: BirdCoderChatMessage['commands'];
  content: string;
  createdAt: string;
  fileChanges?: BirdCoderChatMessage['fileChanges'];
  role: BirdCoderChatMessage['role'];
  taskProgress?: BirdCoderChatMessage['taskProgress'];
  tool_call_id?: BirdCoderChatMessage['tool_call_id'];
  tool_calls?: BirdCoderChatMessage['tool_calls'];
  turnId?: string;
}

export interface MergeBirdCoderProjectionMessagesOptions {
  codingSessionId: string;
  existingMessages: readonly BirdCoderChatMessage[];
  idPrefix: string;
  events: readonly BirdCoderCodingSessionEvent[];
}

interface BuiltProjectionMessages {
  deletedMessageIds: Set<string>;
  deletedMessageKeys: Set<string>;
  messages: BirdCoderChatMessage[];
}

function readProjectionPayloadString(
  payload: Record<string, unknown> | undefined,
  fieldName: string,
): string | undefined {
  const value = payload?.[fieldName];
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function parseProjectionCommands(
  payload: Record<string, unknown> | undefined,
): BirdCoderChatMessage['commands'] | undefined {
  const rawCommands = readProjectionPayloadString(payload, 'commandsJson');
  if (!rawCommands) {
    return undefined;
  }

  try {
    const parsedCommands = parseBirdCoderApiJson(rawCommands);
    return Array.isArray(parsedCommands)
      ? (parsedCommands as BirdCoderChatMessage['commands'])
      : undefined;
  } catch {
    return undefined;
  }
}

function parseProjectionFileChanges(
  payload: Record<string, unknown> | undefined,
): BirdCoderChatMessage['fileChanges'] | undefined {
  const directFileChanges = payload?.fileChanges;
  if (Array.isArray(directFileChanges)) {
    return directFileChanges as BirdCoderChatMessage['fileChanges'];
  }

  const rawFileChanges = readProjectionPayloadString(payload, 'fileChangesJson');
  if (!rawFileChanges) {
    return undefined;
  }

  try {
    const parsedFileChanges = parseBirdCoderApiJson(rawFileChanges);
    return Array.isArray(parsedFileChanges)
      ? (parsedFileChanges as BirdCoderChatMessage['fileChanges'])
      : undefined;
  } catch {
    return undefined;
  }
}

function parseProjectionToolCalls(
  payload: Record<string, unknown> | undefined,
): BirdCoderChatMessage['tool_calls'] | undefined {
  const directToolCalls = payload?.tool_calls ?? payload?.toolCalls;
  if (Array.isArray(directToolCalls)) {
    return directToolCalls as BirdCoderChatMessage['tool_calls'];
  }

  const rawToolCalls = readProjectionPayloadString(payload, 'toolCallsJson');
  if (!rawToolCalls) {
    return undefined;
  }

  try {
    const parsedToolCalls = parseBirdCoderApiJson(rawToolCalls);
    return Array.isArray(parsedToolCalls)
      ? (parsedToolCalls as BirdCoderChatMessage['tool_calls'])
      : undefined;
  } catch {
    return undefined;
  }
}

function parseProjectionToolCallId(
  payload: Record<string, unknown> | undefined,
): BirdCoderChatMessage['tool_call_id'] | undefined {
  return resolveBirdCoderCodeEngineToolCallId({
    payload,
  });
}

function parseProjectionTaskProgress(
  payload: Record<string, unknown> | undefined,
): BirdCoderChatMessage['taskProgress'] | undefined {
  const directTaskProgress = normalizeProjectionTaskProgress(payload?.taskProgress);
  if (directTaskProgress) {
    return directTaskProgress;
  }

  const rawTaskProgress = readProjectionPayloadString(payload, 'taskProgressJson');
  if (!rawTaskProgress) {
    return undefined;
  }

  try {
    const parsedTaskProgress = parseBirdCoderApiJson(rawTaskProgress) as unknown;
    return normalizeProjectionTaskProgress(parsedTaskProgress);
  } catch {
    return undefined;
  }
}

function normalizeProjectionPayloadString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
}

function normalizeProjectionPayloadNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      return undefined;
    }
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number(value.trim());
    if (Number.isInteger(parsedValue) && !Number.isSafeInteger(parsedValue)) {
      return undefined;
    }
    return Number.isFinite(parsedValue) ? Math.max(0, Math.floor(parsedValue)) : undefined;
  }

  return undefined;
}

function normalizeProjectionTaskProgress(value: unknown): TaskProgress | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const total = normalizeProjectionPayloadNumber(record.total);
  const completed = normalizeProjectionPayloadNumber(record.completed);
  return total === undefined || completed === undefined
    ? undefined
    : {
        total,
        completed,
      };
}

function isProjectionPayloadRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseProjectionToolArguments(
  value: unknown,
): {
  fallback: string;
  record: Record<string, unknown> | null;
} {
  if (typeof value === 'string') {
    const fallback = value.trim();
    try {
      const parsedValue = parseBirdCoderApiJson(value) as unknown;
      return {
        fallback,
        record: isProjectionPayloadRecord(parsedValue) ? parsedValue : null,
      };
    } catch {
      return {
        fallback,
        record: null,
      };
    }
  }

  if (isProjectionPayloadRecord(value)) {
    return {
      fallback: stringifyBirdCoderApiJson(value),
      record: value,
    };
  }

  return {
    fallback: '',
    record: null,
  };
}

function stringifyProjectionToolArguments(
  record: Record<string, unknown> | null,
  fallback: string,
): string | undefined {
  if (!record) {
    return fallback.trim() ? fallback : undefined;
  }

  try {
    return stringifyBirdCoderApiJson(record);
  } catch {
    return fallback.trim() ? fallback : undefined;
  }
}

function readProjectionRecordString(
  record: Record<string, unknown> | null,
  fieldNames: readonly string[],
): string | undefined {
  for (const fieldName of fieldNames) {
    const value = record?.[fieldName];
    if (typeof value === 'string') {
      return value;
    }
  }

  return undefined;
}

function readProjectionRecordTrimmedString(
  record: Record<string, unknown> | null,
  fieldNames: readonly string[],
): string | undefined {
  const value = readProjectionRecordString(record, fieldNames)?.trim();
  return value ? value : undefined;
}

function normalizeProjectionToolCommandStatus(
  event: BirdCoderCodingSessionEvent,
  args: Record<string, unknown> | null,
): CommandExecution['status'] {
  if (
    event.kind === 'operation.updated' &&
    (readProjectionPayloadString(event.payload, 'answer') ??
      normalizeProjectionPayloadString(args?.answer))
  ) {
    return 'success';
  }

  return resolveBirdCoderCodeEngineCommandStatus({
    status: event.payload?.status ?? args?.status,
    runtimeStatus: event.payload?.runtimeStatus ?? args?.runtimeStatus,
    state: args?.state,
    phase: args?.phase,
    exitCode: args?.exitCode ?? args?.exit_code,
    defaultStatus: event.kind === 'tool.call.completed' ? 'success' : 'running',
  });
}

function hasProjectionUserQuestionAnswer(
  event: BirdCoderCodingSessionEvent,
  args: Record<string, unknown> | null,
): boolean {
  return (
    !!normalizeProjectionPayloadString(event.payload?.answer) ||
    !!normalizeProjectionPayloadString(args?.answer)
  );
}

function resolveProjectionUserQuestionRuntimeStatus(
  event: BirdCoderCodingSessionEvent,
  args: Record<string, unknown> | null,
): BirdCoderCodingSessionRuntimeStatus {
  return resolveBirdCoderCodeEngineUserQuestionRuntimeStatus({
    status: event.payload?.status ?? args?.status,
    runtimeStatus: event.payload?.runtimeStatus ?? args?.runtimeStatus,
    state: args?.state,
    phase: args?.phase,
    hasAnswer: hasProjectionUserQuestionAnswer(event, args),
  });
}

function resolveProjectionApprovalRuntimeStatus(
  event: BirdCoderCodingSessionEvent,
  args: Record<string, unknown> | null,
): BirdCoderCodingSessionRuntimeStatus {
  return resolveBirdCoderCodeEngineApprovalRuntimeStatus({
    status: event.payload?.status ?? args?.status,
    runtimeStatus: event.payload?.runtimeStatus ?? args?.runtimeStatus,
    state: args?.state,
    phase: args?.phase,
  });
}

function resolveProjectionToolRuntimeStatus(
  event: BirdCoderCodingSessionEvent,
  toolName: string,
  args: Record<string, unknown> | null,
): BirdCoderCodingSessionRuntimeStatus | undefined {
  if (isBirdCoderCodeEngineUserQuestionToolName(toolName)) {
    return resolveProjectionUserQuestionRuntimeStatus(event, args);
  }
  if (isBirdCoderCodeEngineApprovalToolName(toolName)) {
    return resolveProjectionApprovalRuntimeStatus(event, args);
  }

  const explicitStatus =
    normalizeBirdCoderCodeEngineRuntimeStatus(event.payload?.runtimeStatus) ??
    normalizeBirdCoderCodeEngineRuntimeStatus(event.payload?.status) ??
    normalizeBirdCoderCodeEngineRuntimeStatus(args?.runtimeStatus) ??
    normalizeBirdCoderCodeEngineRuntimeStatus(args?.status) ??
    normalizeBirdCoderCodeEngineRuntimeStatus(args?.state) ??
    normalizeBirdCoderCodeEngineRuntimeStatus(args?.phase);
  if (explicitStatus) {
    return explicitStatus;
  }

  if (
    normalizeBirdCoderCodeEngineBoolean(event.payload?.requiresApproval) === true ||
    normalizeBirdCoderCodeEngineBoolean(args?.requiresApproval) === true
  ) {
    return 'awaiting_approval';
  }

  return undefined;
}

function resolveProjectionCommandKind(
  toolName: string,
  args: Record<string, unknown> | null,
  runtimeStatus: BirdCoderCodingSessionRuntimeStatus | undefined,
): CommandExecutionKind {
  return resolveBirdCoderCodeEngineToolKind({
    runtimeStatus,
    toolArguments: args,
    toolName,
  });
}

function projectionToolEventToCommand(
  event: BirdCoderCodingSessionEvent,
): CommandExecution | null {
  const toolArguments = parseProjectionToolArguments(
    event.payload?.toolArguments ??
      event.payload?.arguments ??
      event.payload?.input,
  );
  const toolCallId = resolveBirdCoderCodeEngineToolCallId({
    payload: event.payload,
    toolArguments: toolArguments.record,
  });
  const userQuestionId = resolveBirdCoderCodeEngineUserQuestionId({
    payload: event.payload,
    toolArguments: toolArguments.record,
    toolCallId,
  });
  const answer = normalizeProjectionPayloadString(event.payload?.answer) ??
    normalizeProjectionPayloadString(toolArguments.record?.answer);
  const isUserQuestionAnswerUpdate =
    event.kind === 'operation.updated' &&
    !!answer &&
    (!!userQuestionId || !!toolCallId);
  if (
    event.kind !== 'tool.call.requested' &&
    event.kind !== 'tool.call.progress' &&
    event.kind !== 'tool.call.completed' &&
    !isUserQuestionAnswerUpdate
  ) {
    return null;
  }

  const rawToolName =
    (isUserQuestionAnswerUpdate
      ? 'user_question'
      : readProjectionPayloadString(event.payload, 'toolName') ??
        readProjectionPayloadString(event.payload, 'name')) ?? 'tool';
  const toolName = canonicalizeBirdCoderCodeEngineToolName(rawToolName);
  const runtimeStatus = resolveProjectionToolRuntimeStatus(event, toolName, toolArguments.record);
  const kind = resolveProjectionCommandKind(toolName, toolArguments.record, runtimeStatus);
  const status = normalizeProjectionToolCommandStatus(event, toolArguments.record);
  const interactionState = resolveBirdCoderCodeEngineCommandInteractionState({
    kind,
    requiresApprovalValues: [
      event.payload?.requiresApproval,
      toolArguments.record?.requiresApproval,
    ],
    requiresReplyValues: [
      event.payload?.requiresReply,
      toolArguments.record?.requiresReply,
    ],
    runtimeStatus,
    status,
  });
  const output =
    normalizeProjectionPayloadString(event.payload?.answer) ??
    normalizeProjectionPayloadString(toolArguments.record?.answer) ??
    normalizeProjectionPayloadString(event.payload?.output) ??
    normalizeProjectionPayloadString(event.payload?.result) ??
    normalizeProjectionPayloadString(event.payload?.error) ??
    normalizeProjectionPayloadString(toolArguments.record?.output) ??
    normalizeProjectionPayloadString(toolArguments.record?.aggregated_output) ??
    normalizeProjectionPayloadString(toolArguments.record?.aggregatedOutput) ??
    normalizeProjectionPayloadString(toolArguments.record?.error) ??
    stringifyProjectionToolArguments(toolArguments.record, toolArguments.fallback);

  return {
    command: resolveBirdCoderCodeEngineCommandText({
      fallbackArguments: toolArguments.fallback,
      toolName,
      toolArguments: toolArguments.record,
    }),
    status,
    output,
    kind,
    toolName,
    ...(toolCallId ? { toolCallId } : {}),
    ...(runtimeStatus ? { runtimeStatus } : {}),
    requiresApproval: interactionState.requiresApproval,
    requiresReply: interactionState.requiresReply,
  };
}

const PROJECTION_FILE_CHANGE_ARTIFACT_KINDS = new Set(['diff', 'file', 'patch']);

function countProjectionContentLines(value: string | undefined): number {
  if (typeof value !== 'string' || value.length === 0) {
    return 0;
  }

  const normalizedValue = value.replace(/\r\n?/gu, '\n');
  const valueWithoutTrailingLineBreak = normalizedValue.endsWith('\n')
    ? normalizedValue.slice(0, -1)
    : normalizedValue;
  return valueWithoutTrailingLineBreak.length === 0
    ? 0
    : valueWithoutTrailingLineBreak.split('\n').length;
}

function countProjectionDiffLines(
  diffContent: string | undefined,
): { additions: number; deletions: number } {
  if (!diffContent) {
    return {
      additions: 0,
      deletions: 0,
    };
  }

  let additions = 0;
  let deletions = 0;
  for (const line of diffContent.replace(/\r\n?/gu, '\n').split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---')) {
      continue;
    }
    if (line.startsWith('+')) {
      additions += 1;
      continue;
    }
    if (line.startsWith('-')) {
      deletions += 1;
    }
  }

  return {
    additions,
    deletions,
  };
}

function resolveProjectionDiffPath(diffContent: string | undefined): string | undefined {
  if (!diffContent) {
    return undefined;
  }

  for (const line of diffContent.replace(/\r\n?/gu, '\n').split('\n')) {
    const match = /^(?:\+\+\+|---)\s+(?:[ab]\/)?(.+)$/u.exec(line.trim());
    const candidate = match?.[1]?.trim();
    if (candidate && candidate !== '/dev/null') {
      return candidate;
    }
  }

  return undefined;
}

function projectionToolEventMayProduceFileChange(
  event: BirdCoderCodingSessionEvent,
  toolName: string,
): boolean {
  const artifactKind = readProjectionPayloadString(event.payload, 'artifactKind')
    ?.toLocaleLowerCase();

  return (
    resolveBirdCoderCodeEngineArtifactKind({ toolName }) === 'patch' ||
    !!artifactKind && PROJECTION_FILE_CHANGE_ARTIFACT_KINDS.has(artifactKind)
  );
}

function projectionToolArgumentRecordToFileChange(
  event: BirdCoderCodingSessionEvent,
): FileChange | null {
  const toolArguments = parseProjectionToolArguments(
    event.payload?.toolArguments ??
      event.payload?.arguments ??
      event.payload?.input,
  );
  return projectionToolArgumentRecordToFileChangeFromRecord(event, toolArguments.record);
}

function projectionToolArgumentRecordToFileChangeFromRecord(
  event: BirdCoderCodingSessionEvent,
  toolArgumentsRecord: Record<string, unknown> | null,
): FileChange | null {
  const patchContent =
    readProjectionRecordString(toolArgumentsRecord, ['patch', 'diff']) ??
    normalizeProjectionPayloadString(event.payload?.patch) ??
    normalizeProjectionPayloadString(event.payload?.diff);
  const path =
    readProjectionRecordTrimmedString(toolArgumentsRecord, [
      'path',
      'filePath',
      'file_path',
      'filename',
      'targetFile',
      'target_file',
    ]) ??
    readProjectionPayloadString(event.payload, 'path') ??
    readProjectionPayloadString(event.payload, 'filePath') ??
    resolveProjectionDiffPath(patchContent);
  if (!path) {
    return null;
  }

  const content = readProjectionRecordString(toolArgumentsRecord, [
    'content',
    'newContent',
    'new_content',
  ]);
  const originalContent = readProjectionRecordString(toolArgumentsRecord, [
    'originalContent',
    'original_content',
    'oldContent',
    'old_content',
  ]);
  const replacementContent = readProjectionRecordString(toolArgumentsRecord, [
    'replacement',
    'newString',
    'new_string',
  ]);
  const replacedContent = readProjectionRecordString(toolArgumentsRecord, [
    'oldString',
    'old_string',
  ]);
  const diffStats = countProjectionDiffLines(patchContent);
  const additions =
    normalizeProjectionPayloadNumber(toolArgumentsRecord?.additions) ??
    normalizeProjectionPayloadNumber(event.payload?.additions) ??
    (diffStats.additions > 0
      ? diffStats.additions
      : countProjectionContentLines(content ?? replacementContent));
  const deletions =
    normalizeProjectionPayloadNumber(toolArgumentsRecord?.deletions) ??
    normalizeProjectionPayloadNumber(event.payload?.deletions) ??
    (diffStats.deletions > 0
      ? diffStats.deletions
      : countProjectionContentLines(originalContent ?? replacedContent));

  return {
    path,
    additions,
    deletions,
    ...(typeof content === 'string' ? { content } : {}),
    ...(typeof originalContent === 'string' ? { originalContent } : {}),
  };
}

function projectionToolEventToFileChanges(
  event: BirdCoderCodingSessionEvent,
): FileChange[] {
  if (
    event.kind !== 'tool.call.requested' &&
    event.kind !== 'tool.call.progress' &&
    event.kind !== 'tool.call.completed' &&
    event.kind !== 'artifact.upserted'
  ) {
    return [];
  }

  const toolName =
    readProjectionPayloadString(event.payload, 'toolName') ??
    readProjectionPayloadString(event.payload, 'name') ??
    '';
  if (!projectionToolEventMayProduceFileChange(event, toolName)) {
    return [];
  }

  const toolArguments = parseProjectionToolArguments(
    event.payload?.toolArguments ??
      event.payload?.arguments ??
      event.payload?.input,
  );
  const changes =
    (Array.isArray(toolArguments.record?.changes)
      ? toolArguments.record?.changes
      : undefined) ??
    (Array.isArray(event.payload?.changes) ? event.payload?.changes : undefined);

  if (changes && changes.length > 0) {
    return changes.flatMap((change) => {
      if (!isProjectionPayloadRecord(change)) {
        return [];
      }
      const fileChange = projectionToolArgumentRecordToFileChangeFromRecord(event, change);
      return fileChange ? [fileChange] : [];
    });
  }

  const fileChange = projectionToolArgumentRecordToFileChange(event);
  return fileChange ? [fileChange] : [];
}

function buildProjectionFileChangesByTurn(
  events: readonly BirdCoderCodingSessionEvent[],
): Map<string, FileChange[]> {
  const fileChangeStateByTurn = new Map<
    string,
    {
      order: string[];
      values: Map<string, FileChange>;
    }
  >();

  for (const event of events) {
    const turnId = event.turnId?.trim();
    if (!turnId) {
      continue;
    }

    const fileChanges = projectionToolEventToFileChanges(event);
    if (fileChanges.length === 0) {
      continue;
    }

    const turnState = fileChangeStateByTurn.get(turnId) ?? {
      order: [],
      values: new Map<string, FileChange>(),
    };
    for (const fileChange of fileChanges) {
      const toolCallKey = resolveBirdCoderCodeEngineToolCallId({
        payload: event.payload,
      });
      const fileChangeKey = toolCallKey
        ? `${toolCallKey}:${fileChange.path}`
        : fileChange.path;
      if (!turnState.values.has(fileChangeKey)) {
        turnState.order.push(fileChangeKey);
      }
      turnState.values.set(fileChangeKey, fileChange);
    }
    fileChangeStateByTurn.set(turnId, turnState);
  }

  return new Map(
    [...fileChangeStateByTurn.entries()].map(([turnId, turnState]) => [
      turnId,
      turnState.order.flatMap((fileChangeKey) => {
        const fileChange = turnState.values.get(fileChangeKey);
        return fileChange ? [fileChange] : [];
      }),
    ]),
  );
}

function buildProjectionToolCommandsByTurn(
  events: readonly BirdCoderCodingSessionEvent[],
): Map<string, CommandExecution[]> {
  const commandStateByTurn = new Map<
    string,
    {
      order: string[];
      values: Map<string, CommandExecution>;
    }
  >();

  for (const event of events) {
    const turnId = event.turnId?.trim();
    if (!turnId) {
      continue;
    }

    const command = projectionToolEventToCommand(event);
    if (!command) {
      continue;
    }

    const commandKey =
      resolveBirdCoderCodeEngineToolCallId({
        payload: event.payload,
      }) ??
      command.toolCallId ??
      command.command;
    const turnState = commandStateByTurn.get(turnId) ?? {
      order: [],
      values: new Map<string, CommandExecution>(),
    };
    const existingCommand = turnState.values.get(commandKey);
    const nextCommand =
      existingCommand && existingCommand.toolCallId && existingCommand.toolCallId === command.toolCallId
        ? mergeProjectionToolCommandSnapshot(existingCommand, command)
        : command;
    if (!turnState.values.has(commandKey)) {
      turnState.order.push(commandKey);
    }
    turnState.values.set(commandKey, nextCommand);
    commandStateByTurn.set(turnId, turnState);
  }

  return new Map(
    [...commandStateByTurn.entries()].map(([turnId, turnState]) => [
      turnId,
      turnState.order.flatMap((commandKey) => {
        const command = turnState.values.get(commandKey);
        return command ? [command] : [];
      }),
    ]),
  );
}

function mergeProjectionToolCommandSnapshot(
  existingCommand: CommandExecution,
  nextCommand: CommandExecution,
): CommandExecution {
  return mergeBirdCoderCodeEngineCommandSnapshot(existingCommand, nextCommand);
}

function mergeProjectionFileChanges(
  ...sources: Array<BirdCoderChatMessage['fileChanges'] | undefined>
): BirdCoderChatMessage['fileChanges'] | undefined {
  const mergedFileChanges: FileChange[] = [];
  const seenFileChanges = new Set<string>();

  for (const fileChanges of sources) {
    for (const fileChange of fileChanges ?? []) {
      if (!fileChange?.path?.trim()) {
        continue;
      }

      const normalizedFileChange: FileChange = {
        path: fileChange.path.trim(),
        additions: normalizeProjectionPayloadNumber(fileChange.additions) ?? 0,
        deletions: normalizeProjectionPayloadNumber(fileChange.deletions) ?? 0,
        ...(typeof fileChange.content === 'string' ? { content: fileChange.content } : {}),
        ...(typeof fileChange.originalContent === 'string'
          ? { originalContent: fileChange.originalContent }
          : {}),
      };
      const fileChangeKey = JSON.stringify([
        normalizedFileChange.path,
        normalizedFileChange.additions,
        normalizedFileChange.deletions,
        normalizedFileChange.content ?? '',
        normalizedFileChange.originalContent ?? '',
      ]);
      if (seenFileChanges.has(fileChangeKey)) {
        continue;
      }

      seenFileChanges.add(fileChangeKey);
      mergedFileChanges.push(normalizedFileChange);
    }
  }

  return mergedFileChanges.length > 0 ? mergedFileChanges : undefined;
}

function mergeProjectionTaskProgress(
  ...sources: Array<BirdCoderChatMessage['taskProgress'] | undefined>
): BirdCoderChatMessage['taskProgress'] | undefined {
  let mergedTaskProgress: TaskProgress | undefined;

  for (const taskProgress of sources) {
    const normalizedTaskProgress = normalizeProjectionTaskProgress(taskProgress);
    if (!normalizedTaskProgress) {
      continue;
    }

    mergedTaskProgress = normalizedTaskProgress;
  }

  return mergedTaskProgress;
}

function projectionRoleShouldReceiveToolCommands(
  role: BirdCoderChatMessage['role'],
): boolean {
  return role !== 'user' && role !== 'system';
}

function mergeProjectionCommands(
  ...sources: Array<BirdCoderChatMessage['commands'] | undefined>
): BirdCoderChatMessage['commands'] | undefined {
  const mergedCommands: CommandExecution[] = [];
  const seenCommands = new Set<string>();

  for (const commands of sources) {
    for (const command of commands ?? []) {
      if (!command?.command?.trim()) {
        continue;
      }

      const normalizedCommand: CommandExecution = {
        command: command.command.trim(),
        status:
          command.status === 'success' || command.status === 'error'
            ? command.status
            : 'running',
        output: command.output,
        ...(command.kind ? { kind: command.kind } : {}),
        ...(command.toolName ? { toolName: command.toolName } : {}),
        ...(command.toolCallId ? { toolCallId: command.toolCallId } : {}),
        ...(command.runtimeStatus ? { runtimeStatus: command.runtimeStatus } : {}),
        ...(typeof command.requiresApproval === 'boolean'
          ? { requiresApproval: command.requiresApproval }
          : {}),
        ...(typeof command.requiresReply === 'boolean'
          ? { requiresReply: command.requiresReply }
          : {}),
      };
      const commandKey = JSON.stringify([
        normalizedCommand.command,
        normalizedCommand.status,
        normalizedCommand.output ?? '',
        normalizedCommand.kind ?? '',
        normalizedCommand.toolName ?? '',
        normalizedCommand.toolCallId ?? '',
        normalizedCommand.runtimeStatus ?? '',
        normalizedCommand.requiresApproval === true ? 'approval' : '',
        normalizedCommand.requiresReply === true ? 'reply' : '',
      ]);
      if (seenCommands.has(commandKey)) {
        continue;
      }

      seenCommands.add(commandKey);
      mergedCommands.push(normalizedCommand);
    }
  }

  return mergedCommands.length > 0 ? mergedCommands : undefined;
}

function normalizeProjectionMessageIdentity(
  role: BirdCoderChatMessage['role'],
  content: string,
  turnId?: string,
  createdAt?: string,
): string {
  const normalizedContent = normalizeProjectionMessageContent(content);
  return JSON.stringify([
    turnId ?? '',
    role,
    normalizedContent || createdAt || '',
  ]);
}

function buildProjectionTurnRoleKey(
  turnId: string | undefined,
  role: BirdCoderChatMessage['role'],
): string {
  return JSON.stringify([turnId ?? '', role]);
}

function normalizeProjectionMessageContent(content: string): string {
  return content.replace(/\r\n?/gu, '\n').trim();
}

function extractProjectionTextDeltaContent(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const normalizedValue = value.replace(/\r\n?/gu, '\n');
    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }

  return extractBirdCoderTextContent(value);
}

const PROJECTION_LOCAL_MIRROR_MATCH_WINDOW_MS = 5 * 60 * 1000;

function parseProjectionMessageTimestamp(createdAt: string): number | null {
  const parsedTimestamp = Date.parse(createdAt);
  return Number.isNaN(parsedTimestamp) ? null : parsedTimestamp;
}

function resolveLocalMirrorProjectionMessage(
  authoritativeMessage: BirdCoderChatMessage,
  existingMessages: readonly BirdCoderChatMessage[],
  consumedExistingMessageIds: ReadonlySet<string>,
): BirdCoderChatMessage | undefined {
  if (!authoritativeMessage.turnId) {
    return undefined;
  }

  const authoritativeTimestamp = parseProjectionMessageTimestamp(
    authoritativeMessage.createdAt,
  );
  if (authoritativeTimestamp === null) {
    return undefined;
  }

  const authoritativeContent = normalizeProjectionMessageContent(
    authoritativeMessage.content,
  );
  let bestMatch: {
    distanceMs: number;
    message: BirdCoderChatMessage;
  } | null = null;

  for (const existingMessage of existingMessages) {
    if (
      consumedExistingMessageIds.has(existingMessage.id) ||
      existingMessage.turnId ||
      existingMessage.codingSessionId.trim() !== authoritativeMessage.codingSessionId.trim() ||
      existingMessage.role !== authoritativeMessage.role ||
      normalizeProjectionMessageContent(existingMessage.content) !== authoritativeContent
    ) {
      continue;
    }

    const existingTimestamp = parseProjectionMessageTimestamp(existingMessage.createdAt);
    if (existingTimestamp === null) {
      continue;
    }

    const distanceMs = Math.abs(authoritativeTimestamp - existingTimestamp);
    if (
      distanceMs > PROJECTION_LOCAL_MIRROR_MATCH_WINDOW_MS ||
      (bestMatch && distanceMs >= bestMatch.distanceMs)
    ) {
      continue;
    }

    bestMatch = {
      distanceMs,
      message: existingMessage,
    };
  }

  return bestMatch?.message;
}

function isProjectionRole(
  role: string | undefined,
): role is BirdCoderChatMessage['role'] {
  return (
    role === 'assistant' ||
    role === 'planner' ||
    role === 'reviewer' ||
    role === 'tool' ||
    role === 'user'
  );
}

function compareProjectionMessages(
  left: BirdCoderChatMessage,
  right: BirdCoderChatMessage,
): number {
  const timestampOrder = Date.parse(left.createdAt) - Date.parse(right.createdAt);
  if (timestampOrder !== 0) {
    return timestampOrder;
  }

  if (left.turnId && left.turnId === right.turnId && left.role !== right.role) {
    if (left.role === 'user') {
      return -1;
    }
    if (right.role === 'user') {
      return 1;
    }
  }

  return left.role.localeCompare(right.role);
}

export function buildBirdCoderAuthoritativeProjectionMessageId(
  codingSessionId: string,
  turnIdOrEventId: string,
  role: BirdCoderChatMessage['role'],
): string {
  return `${codingSessionId}:authoritative:${turnIdOrEventId}:${role}`;
}

function buildAuthoritativeProjectionMessages(
  codingSessionId: string,
  idPrefix: string,
  events: readonly BirdCoderCodingSessionEvent[],
): BuiltProjectionMessages {
  const sortedEvents = [...events].sort(
    (left, right) =>
      compareBirdCoderCodingSessionEventSequence(left, right) ||
      Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
      left.id.localeCompare(right.id),
  );
  const authoritativeMessages: BirdCoderChatMessage[] = [];
  const deltaMessagesByKey = new Map<string, BirdCoderProjectionDeltaMessage>();
  const deletedMessageIds = new Set<string>();
  const deletedMessageKeys = new Set<string>();
  const toolCommandsByTurn = buildProjectionToolCommandsByTurn(sortedEvents);
  const fileChangesByTurn = buildProjectionFileChangesByTurn(sortedEvents);

  for (const event of sortedEvents) {
    if (event.kind !== 'message.deleted') {
      continue;
    }

    const deletedMessageId = readProjectionPayloadString(event.payload, 'deletedMessageId');
    if (deletedMessageId) {
      deletedMessageIds.add(deletedMessageId);
    }

    const role = readProjectionPayloadString(event.payload, 'role');
    if (isProjectionRole(role) && event.turnId) {
      deletedMessageKeys.add(`${event.turnId}:${role}`);
    }
  }

  for (const event of sortedEvents) {
    if (event.kind === 'message.completed') {
      const role = readProjectionPayloadString(event.payload, 'role');
      const content = extractBirdCoderTextContent(event.payload?.content) ?? '';
      const eventCommands = parseProjectionCommands(event.payload);
      const eventFileChanges = parseProjectionFileChanges(event.payload);
      const taskProgress = parseProjectionTaskProgress(event.payload);
      const tool_calls = parseProjectionToolCalls(event.payload);
      const tool_call_id = parseProjectionToolCallId(event.payload);
      const commands = mergeProjectionCommands(
        eventCommands,
        isProjectionRole(role) &&
          event.turnId &&
          projectionRoleShouldReceiveToolCommands(role)
          ? toolCommandsByTurn.get(event.turnId)
          : undefined,
      );
      const fileChanges = mergeProjectionFileChanges(
        eventFileChanges,
        isProjectionRole(role) &&
          event.turnId &&
          projectionRoleShouldReceiveToolCommands(role)
          ? fileChangesByTurn.get(event.turnId)
          : undefined,
      );
      if (
        !isProjectionRole(role) ||
        (
          !content &&
          (commands?.length ?? 0) === 0 &&
          (fileChanges?.length ?? 0) === 0 &&
          !taskProgress &&
          (tool_calls?.length ?? 0) === 0 &&
          !tool_call_id
        )
      ) {
        continue;
      }

      const messageId =
        idPrefix === 'authoritative'
          ? buildBirdCoderAuthoritativeProjectionMessageId(
              codingSessionId,
              event.turnId ?? event.id,
              role,
            )
          : `${codingSessionId}:${idPrefix}:${event.turnId ?? event.id}:${role}`;

      if (
        deletedMessageIds.has(messageId) ||
        deletedMessageKeys.has(`${event.turnId ?? event.id}:${role}`)
      ) {
        continue;
      }

      authoritativeMessages.push({
        id: messageId,
        codingSessionId,
        turnId: event.turnId,
        role,
        content,
        commands,
        fileChanges,
        taskProgress,
        tool_call_id,
        tool_calls,
        createdAt: event.createdAt,
        timestamp: Date.parse(event.createdAt),
      });
      continue;
    }

    if (event.kind !== 'message.delta') {
      continue;
    }

    const contentDelta =
      extractProjectionTextDeltaContent(event.payload?.contentDelta) ??
      extractProjectionTextDeltaContent(event.payload?.content) ??
      '';
    const roleCandidate = readProjectionPayloadString(event.payload, 'role') ?? 'assistant';
    if (!isProjectionRole(roleCandidate)) {
      continue;
    }

    const commands = mergeProjectionCommands(
      parseProjectionCommands(event.payload),
      event.turnId && projectionRoleShouldReceiveToolCommands(roleCandidate)
        ? toolCommandsByTurn.get(event.turnId)
        : undefined,
    );
    const fileChanges = mergeProjectionFileChanges(
      parseProjectionFileChanges(event.payload),
      event.turnId && projectionRoleShouldReceiveToolCommands(roleCandidate)
        ? fileChangesByTurn.get(event.turnId)
        : undefined,
    );
    const taskProgress = parseProjectionTaskProgress(event.payload);
    const tool_calls = parseProjectionToolCalls(event.payload);
    const tool_call_id = parseProjectionToolCallId(event.payload);
    if (
      !contentDelta &&
      (commands?.length ?? 0) === 0 &&
      (fileChanges?.length ?? 0) === 0 &&
      !taskProgress &&
      (tool_calls?.length ?? 0) === 0 &&
      !tool_call_id
    ) {
      continue;
    }

    const deltaKey = `${event.turnId ?? event.id}:${roleCandidate}`;
    if (
      deletedMessageIds.has(`${codingSessionId}:${idPrefix}:${deltaKey}`) ||
      deletedMessageKeys.has(deltaKey)
    ) {
      continue;
    }
    const existingDeltaMessage = deltaMessagesByKey.get(deltaKey);
    deltaMessagesByKey.set(deltaKey, {
      commands: commands ?? existingDeltaMessage?.commands,
      content: `${existingDeltaMessage?.content ?? ''}${contentDelta}`,
      createdAt: existingDeltaMessage?.createdAt ?? event.createdAt,
      fileChanges: fileChanges ?? existingDeltaMessage?.fileChanges,
      role: roleCandidate,
      taskProgress: mergeProjectionTaskProgress(existingDeltaMessage?.taskProgress, taskProgress),
      tool_call_id: tool_call_id ?? existingDeltaMessage?.tool_call_id,
      tool_calls: tool_calls ?? existingDeltaMessage?.tool_calls,
      turnId: event.turnId,
    });
  }

  const authoritativeMessageKeys = new Set(
    authoritativeMessages.map((message) =>
      normalizeProjectionMessageIdentity(message.role, message.content, message.turnId, message.createdAt),
    ),
  );
  const completedMessageTurnRoleKeys = new Set(
    authoritativeMessages
      .filter((message) => typeof message.turnId === 'string' && message.turnId.trim().length > 0)
      .map((message) => buildProjectionTurnRoleKey(message.turnId, message.role)),
  );

  for (const [deltaKey, deltaMessage] of deltaMessagesByKey.entries()) {
    const messageIdentity = normalizeProjectionMessageIdentity(
      deltaMessage.role,
      deltaMessage.content,
      deltaMessage.turnId,
      deltaMessage.createdAt,
    );
    if (
      (
        typeof deltaMessage.turnId === 'string' &&
        deltaMessage.turnId.trim().length > 0 &&
        completedMessageTurnRoleKeys.has(buildProjectionTurnRoleKey(deltaMessage.turnId, deltaMessage.role))
      ) ||
      authoritativeMessageKeys.has(messageIdentity) ||
      (
        !deltaMessage.content.trim() &&
        (deltaMessage.commands?.length ?? 0) === 0 &&
        (deltaMessage.fileChanges?.length ?? 0) === 0 &&
        !deltaMessage.taskProgress &&
        (deltaMessage.tool_calls?.length ?? 0) === 0 &&
        !deltaMessage.tool_call_id
      )
    ) {
      continue;
    }

    authoritativeMessages.push({
      id: `${codingSessionId}:${idPrefix}:${deltaKey}`,
      codingSessionId,
      turnId: deltaMessage.turnId,
      role: deltaMessage.role,
      content: deltaMessage.content,
      commands: deltaMessage.commands,
      fileChanges: deltaMessage.fileChanges,
      taskProgress: deltaMessage.taskProgress,
      tool_call_id: deltaMessage.tool_call_id,
      tool_calls: deltaMessage.tool_calls,
      createdAt: deltaMessage.createdAt,
      timestamp: Date.parse(deltaMessage.createdAt),
    });
    authoritativeMessageKeys.add(messageIdentity);
  }

  return {
    deletedMessageIds,
    deletedMessageKeys,
    messages: authoritativeMessages,
  };
}

export function mergeBirdCoderProjectionMessages({
  codingSessionId,
  events,
  existingMessages,
  idPrefix,
}: MergeBirdCoderProjectionMessagesOptions): BirdCoderChatMessage[] {
  const normalizedCodingSessionId = codingSessionId.trim();
  const scopedEvents = events.filter(
    (event) => event.codingSessionId.trim() === normalizedCodingSessionId,
  );
  const scopedExistingMessages = existingMessages.filter(
    (existingMessage) => existingMessage.codingSessionId.trim() === normalizedCodingSessionId,
  );
  const {
    deletedMessageIds,
    deletedMessageKeys,
    messages: authoritativeMessages,
  } = buildAuthoritativeProjectionMessages(normalizedCodingSessionId, idPrefix, scopedEvents);
  if (authoritativeMessages.length === 0) {
    return deduplicateBirdCoderComparableChatMessages(
      scopedExistingMessages.filter((existingMessage) => {
        const deletionKey =
          existingMessage.turnId && existingMessage.role
            ? `${existingMessage.turnId}:${existingMessage.role}`
            : undefined;
        return (
          !deletedMessageIds.has(existingMessage.id) &&
          (!deletionKey || !deletedMessageKeys.has(deletionKey))
        );
      }),
    ).sort(compareProjectionMessages);
  }

  const existingMessagesById = new Map<string, BirdCoderChatMessage>();
  const existingMessagesByMatchKey = new Map<string, BirdCoderChatMessage>();
  for (const existingMessage of scopedExistingMessages) {
    existingMessagesById.set(existingMessage.id, existingMessage);
    existingMessagesByMatchKey.set(
      buildBirdCoderChatMessageLogicalMatchKey(existingMessage),
      existingMessage,
    );
  }

  const authoritativeMatchKeys = new Set<string>();
  const consumedExistingMessageIds = new Set<string>();
  const mergedMessages = authoritativeMessages.map((authoritativeMessage) => {
    const messageMatchKey = buildBirdCoderChatMessageLogicalMatchKey(authoritativeMessage);
    authoritativeMatchKeys.add(messageMatchKey);
    const existingMessage =
      existingMessagesById.get(authoritativeMessage.id) ??
      existingMessagesByMatchKey.get(messageMatchKey) ??
      resolveLocalMirrorProjectionMessage(
        authoritativeMessage,
        scopedExistingMessages,
        consumedExistingMessageIds,
      );
    if (existingMessage) {
      consumedExistingMessageIds.add(existingMessage.id);
    }
    return existingMessage
      ? {
          ...existingMessage,
          ...authoritativeMessage,
        }
      : authoritativeMessage;
  });

  const authoritativeMessageIds = new Set(mergedMessages.map((message) => message.id));
  for (const existingMessage of scopedExistingMessages) {
    const messageMatchKey = buildBirdCoderChatMessageLogicalMatchKey(existingMessage);
    const deletionKey =
      existingMessage.turnId && existingMessage.role
        ? `${existingMessage.turnId}:${existingMessage.role}`
        : undefined;
    if (
      consumedExistingMessageIds.has(existingMessage.id) ||
      authoritativeMessageIds.has(existingMessage.id) ||
      authoritativeMatchKeys.has(messageMatchKey) ||
      deletedMessageIds.has(existingMessage.id) ||
      (deletionKey && deletedMessageKeys.has(deletionKey))
    ) {
      continue;
    }

    mergedMessages.push(existingMessage);
  }

  return deduplicateBirdCoderComparableChatMessages(mergedMessages).sort(
    compareProjectionMessages,
  );
}

export interface BirdCoderCodingSession extends BirdCoderCodingSessionSummary {
  displayTime: string;
  pinned?: boolean;
  archived?: boolean;
  unread?: boolean;
  messages: BirdCoderChatMessage[];
}

export interface IFileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: IFileNode[];
}

export interface ProjectFileSystemChangeEvent {
  kind: 'create' | 'modify' | 'remove' | 'rename' | 'other';
  paths: string[];
}

export interface FileRevisionLookupResult {
  path: string;
  revision: string | null;
  missing: boolean;
  error?: string;
}

export interface BrowserLocalFolderMountSource {
  type: 'browser';
  handle: FileSystemDirectoryHandle;
  path?: never;
}

export interface TauriLocalFolderMountSource {
  type: 'tauri';
  path: string;
  handle?: never;
}

export type LocalFolderMountSource =
  | BrowserLocalFolderMountSource
  | TauriLocalFolderMountSource;

export interface BirdCoderProject {
  id: BirdCoderCanonicalEntityId;
  uuid?: string;
  tenantId?: BirdCoderCanonicalEntityId;
  organizationId?: BirdCoderCanonicalEntityId;
  dataScope?: BirdCoderDataScope;
  workspaceId: BirdCoderCanonicalEntityId;
  workspaceUuid?: string;
  userId?: BirdCoderCanonicalEntityId;
  parentId?: BirdCoderCanonicalEntityId;
  parentUuid?: string;
  parentMetadata?: Record<string, unknown>;
  code?: string;
  title?: string;
  name: string;
  description?: string;
  path?: string;
  sitePath?: string;
  domainPrefix?: string;
  ownerId?: BirdCoderCanonicalEntityId;
  leaderId?: BirdCoderCanonicalEntityId;
  createdByUserId?: BirdCoderCanonicalEntityId;
  author?: string;
  fileId?: BirdCoderCanonicalEntityId;
  conversationId?: BirdCoderCanonicalEntityId;
  type?: string;
  coverImage?: Record<string, unknown>;
  startTime?: string;
  endTime?: string;
  budgetAmount?: BirdCoderLongIntegerString;
  isTemplate?: boolean;
  viewerRole?: 'owner' | 'admin' | 'member' | 'viewer';
  createdAt: string;
  updatedAt: string;
  codingSessions: BirdCoderCodingSession[];
  archived?: boolean;
}

export interface BirdCoderTeam {
  id: BirdCoderCanonicalEntityId;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  workspaceId: BirdCoderCanonicalEntityId;
  code?: string;
  title?: string;
  name: string;
  description?: string;
  status: 'active' | 'archived';
  ownerId?: string;
  leaderId?: string;
  createdByUserId?: string;
  metadata?: Record<string, unknown>;
}

export * from './coding-session.ts';
export * from './codeEngineDialect.ts';
export * from './data.ts';
export * from './engine.ts';
export * from './engineCatalog.ts';
export * from './fileSearch.ts';
export * from './generated/coding-server-openapi.ts';
export * from './generated/coding-server-client.ts';
export * from './governance.ts';
export * from './json.ts';
export * from './prompt-skill-template.ts';
export * from './server-api.ts';
export * from './storageBindings.ts';
