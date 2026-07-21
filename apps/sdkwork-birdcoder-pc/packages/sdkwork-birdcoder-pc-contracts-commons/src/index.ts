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
  areBirdCoderChatMessagesLogicallyMatched,
  buildBirdCoderChatMessageLogicalMatchKey,
  buildBirdCoderChatMessageStructuredMatchKeys,
  compareBirdCoderCodingSessionEventSequence,
  deduplicateBirdCoderComparableChatMessages,
  extractBirdCoderProtocolNotices,
  extractBirdCoderTextContent,
  isBirdCoderSyntheticUserMessage,
  mergeBirdCoderComparableChatMessages,
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
  | 'multiwindow'
  | 'terminal'
  | 'settings'
  | 'auth'
  | 'user'
  | 'vip';

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

export type { FileChange } from './file-change.ts';
import type { FileChange } from './file-change.ts';
import {
  projectChatMessageResources,
  type BirdCoderChatMessageResource,
} from './chat-message-resources.ts';
import {
  mergeChatMessageReasoning,
  projectChatMessageReasoning,
  type BirdCoderChatMessageReasoningItem,
} from './chat-message-reasoning.ts';

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
  reasoning?: BirdCoderChatMessageReasoningItem[];
  resources?: BirdCoderChatMessageResource[];
  taskProgress?: TaskProgress;
}

interface BirdCoderProjectionDeltaMessage {
  commands?: BirdCoderChatMessage['commands'];
  content: string;
  createdAt: string;
  fileChanges?: BirdCoderChatMessage['fileChanges'];
  isStructuredOnly: boolean;
  order: number;
  reasoning?: BirdCoderChatMessage['reasoning'];
  resources?: BirdCoderChatMessage['resources'];
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
  editedMessageContentById: Map<string, string>;
  editedMessageContentByKey: Map<string, string>;
  messageOrderById: Map<string, number>;
  messages: BirdCoderChatMessage[];
  retractedProviderMessageUuids: Set<string>;
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
  const directCommands = payload?.commands;
  if (Array.isArray(directCommands)) {
    return directCommands as BirdCoderChatMessage['commands'];
  }

  return undefined;
}

function parseProjectionFileChanges(
  payload: Record<string, unknown> | undefined,
): BirdCoderChatMessage['fileChanges'] | undefined {
  const directFileChanges = payload?.fileChanges;
  const fileChanges = Array.isArray(directFileChanges)
    ? [...directFileChanges] as FileChange[]
    : [];
  const nativeFileChanges: FileChange[] = [];
  collectProjectionNativeFileChanges(
    payload,
    nativeFileChanges,
    new WeakSet<object>(),
  );
  const fileChangesByPath = new Map<string, FileChange>();
  for (const fileChange of [...fileChanges, ...nativeFileChanges]) {
    if (typeof fileChange?.path !== 'string' || !fileChange.path.trim()) {
      continue;
    }
    fileChangesByPath.set(fileChange.path.trim().replace(/\\/gu, '/'), fileChange);
  }
  return fileChangesByPath.size > 0 ? [...fileChangesByPath.values()] : undefined;
}

const MAX_PROJECTION_CLAUDE_MEMORY_RESOURCES = 32;
const MAX_PROJECTION_CLAUDE_MEMORY_DESCRIPTION_CHARACTERS = 4_000;
const MAX_PROJECTION_CLAUDE_MEMORY_DEPTH = 8;

function resolveProjectionResourceName(path: string): string | undefined {
  const normalizedPath = path.replace(/\\/gu, '/').replace(/\/+$/gu, '');
  const name = normalizedPath.slice(normalizedPath.lastIndexOf('/') + 1).trim();
  return name || undefined;
}

function collectProjectionClaudeMemoryResources(
  value: unknown,
  output: unknown[],
  visited: WeakSet<object>,
  depth = 0,
): void {
  if (
    depth > MAX_PROJECTION_CLAUDE_MEMORY_DEPTH
    || output.length >= MAX_PROJECTION_CLAUDE_MEMORY_RESOURCES
  ) {
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectProjectionClaudeMemoryResources(entry, output, visited, depth + 1);
    }
    return;
  }
  if (!isProjectionPayloadRecord(value) || visited.has(value)) {
    return;
  }

  visited.add(value);
  const type = normalizeProjectionToolContentType(value.type);
  const subtype = normalizeProjectionToolContentType(value.subtype);
  if (type === 'system' && subtype === 'memory_recall') {
    const messageId = normalizeProjectionPayloadString(value.uuid)
      ?? normalizeProjectionPayloadString(value.id)
      ?? 'claude-memory-recall';
    const memories = Array.isArray(value.memories) ? value.memories : [];
    for (const [index, memoryValue] of memories.entries()) {
      if (output.length >= MAX_PROJECTION_CLAUDE_MEMORY_RESOURCES) {
        break;
      }
      if (!isProjectionPayloadRecord(memoryValue)) {
        continue;
      }
      const path = normalizeProjectionPayloadString(memoryValue.path);
      if (!path) {
        continue;
      }
      const scope = normalizeProjectionPayloadString(memoryValue.scope);
      const rawDescription = normalizeProjectionPayloadString(memoryValue.content);
      const description = rawDescription?.slice(
        0,
        MAX_PROJECTION_CLAUDE_MEMORY_DESCRIPTION_CHARACTERS,
      );
      const isExternal = /^https?:\/\//iu.test(path);
      const isSynthesis = /^<synthesis:/iu.test(path);
      output.push({
        id: `${messageId}:memory:${index + 1}`,
        kind: 'citation',
        ...(isSynthesis
          ? { name: 'Memory synthesis' }
          : { name: resolveProjectionResourceName(path) }),
        ...(!isExternal && !isSynthesis ? { path } : {}),
        ...(isExternal ? { uri: path } : {}),
        ...(description ? { description } : {}),
        ...(scope
          ? {
              origin: {
                kind: 'resource',
                name: scope,
                clientName: 'Claude Code memory',
              },
            }
          : {}),
      });
    }
    return;
  }

  for (const key of ['content', 'message', 'messages', 'payload', 'response'] as const) {
    collectProjectionClaudeMemoryResources(value[key], output, visited, depth + 1);
  }
}

function parseProjectionResources(
  payload: Record<string, unknown> | undefined,
): BirdCoderChatMessage['resources'] | undefined {
  const nativeResources: unknown[] = [];
  collectProjectionClaudeMemoryResources(
    payload,
    nativeResources,
    new WeakSet<object>(),
  );
  const resources = projectChatMessageResources(
    [
      ...(Array.isArray(payload?.resources) ? payload.resources : []),
      ...nativeResources,
    ],
  );
  return resources.length > 0 ? resources : undefined;
}

function parseProjectionReasoning(
  payload: Record<string, unknown> | undefined,
): BirdCoderChatMessage['reasoning'] | undefined {
  const reasoning = projectChatMessageReasoning(
    Array.isArray(payload?.reasoning) ? payload.reasoning : undefined,
  );
  return reasoning.length > 0 ? reasoning : undefined;
}

function mergeProjectionReasoning(
  ...sources: Array<BirdCoderChatMessage['reasoning'] | undefined>
): BirdCoderChatMessage['reasoning'] | undefined {
  const reasoning = mergeChatMessageReasoning(...sources);
  return reasoning.length > 0 ? reasoning : undefined;
}

function mergeProjectionResources(
  ...sources: Array<BirdCoderChatMessage['resources'] | undefined>
): BirdCoderChatMessage['resources'] | undefined {
  const resources = projectChatMessageResources(sources.flatMap((source) => source ?? []));
  return resources.length > 0 ? resources : undefined;
}

const PROJECTION_OPENCODE_FILE_CHANGE_TOOLS = new Set([
  'apply_patch',
  'edit',
  'multi_edit',
  'multiedit',
  'notebook_edit',
  'patch',
  'write',
]);

const PROJECTION_NON_APPLIED_FILE_CHANGE_STATUSES = new Set([
  'aborted',
  'awaiting_approval',
  'awaiting_user',
  'canceled',
  'cancelled',
  'declined',
  'denied',
  'error',
  'executing',
  'failed',
  'failure',
  'in_progress',
  'inprogress',
  'interrupted',
  'pending',
  'queued',
  'rejected',
  'running',
  'scheduled',
  'stopped',
  'validating',
]);

function normalizeProjectionFileChangePath(...values: unknown[]): string | undefined {
  for (const value of values) {
    const path = normalizeProjectionPayloadString(value)?.replace(/\\/gu, '/');
    if (path) {
      return path;
    }
  }
  return undefined;
}

function projectStructuredPatch(
  value: unknown,
): { additions: number; deletions: number; diff?: string } {
  if (!Array.isArray(value)) {
    return { additions: 0, deletions: 0 };
  }
  const diffParts: string[] = [];
  let additions = 0;
  let deletions = 0;
  for (const hunk of value) {
    if (!isProjectionPayloadRecord(hunk) || !Array.isArray(hunk.lines)) {
      continue;
    }
    const lines = hunk.lines.filter((line): line is string => typeof line === 'string');
    for (const line of lines) {
      if (line.startsWith('+')) {
        additions += 1;
      } else if (line.startsWith('-')) {
        deletions += 1;
      }
    }
    const oldStart = normalizeProjectionPayloadNumber(hunk.oldStart) ?? 0;
    const oldLines = normalizeProjectionPayloadNumber(hunk.oldLines) ?? 0;
    const newStart = normalizeProjectionPayloadNumber(hunk.newStart) ?? 0;
    const newLines = normalizeProjectionPayloadNumber(hunk.newLines) ?? 0;
    diffParts.push(`@@ -${oldStart},${oldLines} +${newStart},${newLines} @@\n${lines.join('\n')}`);
  }
  const diff = diffParts.join('\n');
  return {
    additions,
    deletions,
    ...(diff ? { diff } : {}),
  };
}

function projectOpenCodeMetadataFileChange(
  value: unknown,
  fallbackDiff?: string,
): FileChange | null {
  const record = isProjectionPayloadRecord(value) ? value : null;
  if (!record) {
    return null;
  }
  const path = normalizeProjectionFileChangePath(
    record.relativePath,
    record.movePath,
    record.filePath,
    record.file,
    record.filepath,
  );
  if (!path) {
    return null;
  }
  const diff = normalizeProjectionPayloadString(record.patch ?? record.diff ?? fallbackDiff);
  const diffLines = countProjectionDiffLines(diff);
  const additions = normalizeProjectionPayloadNumber(record.additions) ?? diffLines.additions;
  const deletions = normalizeProjectionPayloadNumber(record.deletions) ?? diffLines.deletions;
  return {
    path,
    additions,
    deletions,
    lineImpactKnown: additions > 0 || deletions > 0 || Boolean(diff),
    ...(diff ? { diff } : {}),
  };
}

function collectProjectionNativeFileChanges(
  value: unknown,
  output: FileChange[],
  visited: WeakSet<object>,
): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectProjectionNativeFileChanges(entry, output, visited);
    }
    return;
  }
  if (typeof value !== 'object' || value === null || visited.has(value)) {
    return;
  }

  visited.add(value);
  const record = value as Record<string, unknown>;
  const type = normalizeProjectionToolContentType(record.type);
  if (type === 'patch' && Array.isArray(record.files)) {
    for (const file of record.files) {
      const path = normalizeProjectionFileChangePath(file);
      if (path) {
        output.push({
          path,
          additions: 0,
          deletions: 0,
          lineImpactKnown: false,
        });
      }
    }
    return;
  }

  const structuredPatch = Array.isArray(record.structuredPatch)
    ? projectStructuredPatch(record.structuredPatch)
    : null;
  const claudeFilePath = normalizeProjectionFileChangePath(record.filePath);
  if (structuredPatch && claudeFilePath) {
    const gitDiff = isProjectionPayloadRecord(record.gitDiff) ? record.gitDiff : null;
    const diff = normalizeProjectionPayloadString(gitDiff?.patch) ?? structuredPatch.diff;
    const additions = normalizeProjectionPayloadNumber(gitDiff?.additions)
      ?? (type === 'create' && typeof record.content === 'string'
        ? countProjectionContentLines(record.content)
        : structuredPatch.additions);
    const deletions = normalizeProjectionPayloadNumber(gitDiff?.deletions)
      ?? structuredPatch.deletions;
    const content = typeof record.content === 'string' ? record.content : undefined;
    const originalContent = typeof record.originalFile === 'string'
      ? record.originalFile
      : undefined;
    output.push({
      path: claudeFilePath,
      additions,
      deletions,
      lineImpactKnown: true,
      ...(diff ? { diff } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(originalContent !== undefined ? { originalContent } : {}),
    });
    return;
  }

  if (type === 'tool') {
    const state = isProjectionPayloadRecord(record.state) ? record.state : null;
    const status = normalizeProjectionToolContentType(state?.status ?? record.status);
    const toolName = normalizeProjectionToolContentType(record.tool ?? record.name);
    if (status === 'completed' && PROJECTION_OPENCODE_FILE_CHANGE_TOOLS.has(toolName)) {
      const metadata = isProjectionPayloadRecord(state?.metadata)
        ? state.metadata
        : isProjectionPayloadRecord(record.metadata)
          ? record.metadata
          : null;
      const metadataFiles = Array.isArray(metadata?.files) ? metadata.files : [];
      const fallbackDiff = normalizeProjectionPayloadString(metadata?.diff);
      const outputLengthBeforeMetadataFiles = output.length;
      for (const file of metadataFiles) {
        const fileChange = projectOpenCodeMetadataFileChange(file, fallbackDiff);
        if (fileChange) {
          output.push(fileChange);
        }
      }
      if (output.length > outputLengthBeforeMetadataFiles) {
        return;
      }
      const metadataFileDiff = projectOpenCodeMetadataFileChange(metadata?.filediff, fallbackDiff);
      if (metadataFileDiff) {
        output.push(metadataFileDiff);
        return;
      }
      const input = isProjectionPayloadRecord(state?.input) ? state.input : null;
      const path = normalizeProjectionFileChangePath(
        metadata?.filepath,
        input?.filePath,
        input?.file_path,
      );
      if (path) {
        const content = typeof input?.content === 'string' ? input.content : undefined;
        const isKnownNewFile = metadata?.exists === false;
        output.push({
          path,
          additions: isKnownNewFile && content !== undefined
            ? countProjectionContentLines(content)
            : 0,
          deletions: 0,
          lineImpactKnown: isKnownNewFile,
          ...(fallbackDiff ? { diff: fallbackDiff } : {}),
          ...(content !== undefined ? { content } : {}),
        });
        return;
      }
    }
  }
  if (type === 'file_change') {
    const status = normalizeProjectionToolContentType(record.status);
    if (PROJECTION_NON_APPLIED_FILE_CHANGE_STATUSES.has(status)) {
      return;
    }
    for (const change of Array.isArray(record.changes) ? record.changes : []) {
      if (!isProjectionPayloadRecord(change)) {
        continue;
      }
      const changeKind = isProjectionPayloadRecord(change.kind) ? change.kind : null;
      const originalPath = normalizeProjectionFileChangePath(change.path);
      const movePath = normalizeProjectionFileChangePath(
        changeKind?.move_path,
        changeKind?.movePath,
      );
      const path = movePath ?? originalPath;
      if (!path) {
        continue;
      }
      const diff = normalizeProjectionPayloadString(change.diff ?? change.patch);
      const diffLines = countProjectionDiffLines(diff);
      const additions = normalizeProjectionPayloadNumber(change.additions) ?? diffLines.additions;
      const deletions = normalizeProjectionPayloadNumber(change.deletions) ?? diffLines.deletions;
      const content = typeof change.content === 'string' ? change.content : undefined;
      const originalContent = typeof change.originalContent === 'string'
        ? change.originalContent
        : typeof change.original_content === 'string'
          ? change.original_content
          : undefined;
      output.push({
        path,
        additions,
        deletions,
        lineImpactKnown: additions > 0 || deletions > 0 || Boolean(diff),
        ...(movePath && originalPath ? { updateStatus: `moved from ${originalPath}` } : {}),
        ...(diff ? { diff } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(originalContent !== undefined ? { originalContent } : {}),
      });
    }
    return;
  }

  const responseRecord = isProjectionPayloadRecord(record.response)
    ? record.response
    : null;
  const resultDisplay = isProjectionPayloadRecord(record.resultDisplay)
    ? record.resultDisplay
    : isProjectionPayloadRecord(responseRecord?.resultDisplay)
      ? responseRecord.resultDisplay
      : null;
  const geminiFileDiff = typeof resultDisplay?.fileDiff === 'string'
    ? resultDisplay.fileDiff
    : undefined;
  const geminiFilePath = normalizeProjectionPayloadString(
    resultDisplay?.filePath ?? resultDisplay?.fileName,
  )?.replace(/\\/gu, '/');
  if (resultDisplay && geminiFileDiff?.trim() && geminiFilePath) {
    const status = normalizeProjectionToolContentType(record.status);
    if (!PROJECTION_NON_APPLIED_FILE_CHANGE_STATUSES.has(status)) {
      const diffStat = isProjectionPayloadRecord(resultDisplay.diffStat)
        ? resultDisplay.diffStat
        : null;
      const diffLines = countProjectionDiffLines(geminiFileDiff);
      const additions = normalizeProjectionPayloadNumber(diffStat?.model_added_lines)
        ?? diffLines.additions;
      const deletions = normalizeProjectionPayloadNumber(diffStat?.model_removed_lines)
        ?? diffLines.deletions;
      const content = typeof resultDisplay.newContent === 'string'
        ? resultDisplay.newContent
        : undefined;
      const originalContent = typeof resultDisplay.originalContent === 'string'
        ? resultDisplay.originalContent
        : undefined;
      output.push({
        path: geminiFilePath,
        additions,
        deletions,
        lineImpactKnown: true,
        diff: geminiFileDiff,
        ...(content !== undefined ? { content } : {}),
        ...(originalContent !== undefined ? { originalContent } : {}),
      });
    }
    return;
  }

  for (const key of PROJECTION_NATIVE_TOOL_CONTAINER_KEYS) {
    collectProjectionNativeFileChanges(record[key], output, visited);
  }
}

function parseProjectionToolCalls(
  payload: Record<string, unknown> | undefined,
): BirdCoderChatMessage['tool_calls'] | undefined {
  const directToolCalls = payload?.tool_calls ?? payload?.toolCalls;
  if (Array.isArray(directToolCalls)) {
    return directToolCalls as BirdCoderChatMessage['tool_calls'];
  }

  const nativeToolCalls: unknown[] = [];
  const visited = new WeakSet<object>();
  collectProjectionNativeToolCalls(payload, nativeToolCalls, visited, undefined);
  return nativeToolCalls.length > 0
    ? nativeToolCalls as BirdCoderChatMessage['tool_calls']
    : undefined;
}

const PROJECTION_PROVIDER_MESSAGE_TYPES = new Set([
  'assistant',
  'result',
  'system',
  'user',
]);

interface ProjectionProviderMessageSignals {
  messageUuids: Set<string>;
  retractedMessageUuids: Set<string>;
}

function collectProjectionProviderMessageSignals(
  value: unknown,
  signals: ProjectionProviderMessageSignals,
  visited: WeakSet<object>,
): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectProjectionProviderMessageSignals(entry, signals, visited);
    }
    return;
  }
  if (!isProjectionPayloadRecord(value) || visited.has(value)) {
    return;
  }

  visited.add(value);
  const type = normalizeProjectionToolContentType(value.type);
  const uuid = normalizeProjectionPayloadString(value.uuid);
  if (uuid && PROJECTION_PROVIDER_MESSAGE_TYPES.has(type)) {
    signals.messageUuids.add(uuid);
  }
  for (const key of ['messageUuid', 'message_uuid', 'providerMessageUuid', 'provider_message_uuid'] as const) {
    const messageUuid = normalizeProjectionPayloadString(value[key]);
    if (messageUuid) {
      signals.messageUuids.add(messageUuid);
    }
  }

  for (const key of ['supersedes', 'retracted_message_uuids'] as const) {
    const retractedUuids = value[key];
    if (!Array.isArray(retractedUuids)) {
      continue;
    }
    for (const retractedUuid of retractedUuids) {
      const normalizedUuid = normalizeProjectionPayloadString(retractedUuid);
      if (normalizedUuid) {
        signals.retractedMessageUuids.add(normalizedUuid);
      }
    }
  }

  for (const child of Object.values(value)) {
    collectProjectionProviderMessageSignals(child, signals, visited);
  }
}

function readProjectionProviderMessageSignals(
  value: unknown,
): ProjectionProviderMessageSignals {
  const signals: ProjectionProviderMessageSignals = {
    messageUuids: new Set<string>(),
    retractedMessageUuids: new Set<string>(),
  };
  collectProjectionProviderMessageSignals(value, signals, new WeakSet<object>());
  return signals;
}

function payloadContainsRetractedProviderMessage(
  payload: Record<string, unknown> | undefined,
  retractedMessageUuids: ReadonlySet<string>,
): boolean {
  if (retractedMessageUuids.size === 0) {
    return false;
  }
  const { messageUuids } = readProjectionProviderMessageSignals(payload);
  return [...messageUuids].some((uuid) => retractedMessageUuids.has(uuid));
}

function isRetractedProjectionMessage(
  message: BirdCoderChatMessage,
  retractedMessageUuids: ReadonlySet<string>,
): boolean {
  if (retractedMessageUuids.size === 0) {
    return false;
  }
  const metadata = isProjectionPayloadRecord(message.metadata) ? message.metadata : null;
  return [
    message.id,
    metadata?.providerMessageUuid,
    metadata?.rawMessageId,
    metadata?.uuid,
  ].some((candidate) => {
    const uuid = normalizeProjectionPayloadString(candidate);
    return Boolean(uuid && retractedMessageUuids.has(uuid));
  });
}

const PROJECTION_NATIVE_TOOL_CONTENT_TYPES = new Set([
  'advisor_tool_result',
  'approval_request',
  'bash_code_execution_tool_result',
  'code_execution_tool_result',
  'tool_use_summary',
  'command_execution',
  'collab_agent_tool_call',
  'custom_tool_call',
  'custom_tool_call_output',
  'dynamic_tool_call',
  'file_change',
  'function_call',
  'function_call_output',
  'image_generation_call',
  'image_generation',
  'image_view',
  'local_shell_call',
  'mcp_tool_call',
  'mcp_tool_result',
  'mcp_tool_use',
  'server_tool_use',
  'sleep',
  'sub_agent_activity',
  'subtask',
  'text_editor_code_execution_tool_result',
  'todo_list',
  'tool',
  'tool_call_confirmation',
  'tool_call_request',
  'tool_call_response',
  'tool_progress',
  'tool_result',
  'tool_search_call',
  'tool_search_output',
  'tool_search_tool_result',
  'tool_use',
  'web_fetch_tool_result',
  'web_search',
  'web_search_call',
  'web_search_tool_result',
]);

const PROJECTION_NATIVE_TOOL_CONTAINER_KEYS = [
  'blocks',
  'candidates',
  'content',
  'content_block',
  'items',
  'item',
  'message',
  'messages',
  'part',
  'parts',
  'params',
  'payload',
  'properties',
  'response',
  'responses',
  'tool_calls',
  'toolCalls',
  'tools',
  'toolUseResult',
  'tool_use_result',
  'value',
] as const;

function normalizeProjectionToolContentType(value: unknown): string {
  return typeof value === 'string'
    ? value
        .trim()
        .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
        .toLowerCase()
        .replace(/[.\s-]+/gu, '_')
    : '';
}

function collectProjectionNativeToolCalls(
  value: unknown,
  output: unknown[],
  visited: WeakSet<object>,
  inheritedToolResult: unknown,
): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectProjectionNativeToolCalls(entry, output, visited, inheritedToolResult);
    }
    return;
  }
  if (typeof value !== 'object' || value === null || visited.has(value)) {
    return;
  }

  visited.add(value);
  const record = value as Record<string, unknown>;
  const type = normalizeProjectionToolContentType(record.type);
  const subtype = normalizeProjectionToolContentType(record.subtype);
  const toolResult = record.toolUseResult ?? record.tool_use_result ?? inheritedToolResult;
  if (
    PROJECTION_NATIVE_TOOL_CONTENT_TYPES.has(type)
    || (
      type === 'system'
      && [
        'hook_progress',
        'hook_response',
        'hook_started',
        'permission_denied',
        'task_notification',
        'task_progress',
        'task_started',
        'task_updated',
      ].includes(subtype)
    )
    || (typeof record.functionCall === 'object' && record.functionCall !== null)
    || (typeof record.functionResponse === 'object' && record.functionResponse !== null)
  ) {
    const projectedRecord = toolResult !== undefined
      && isProjectionNativeToolResultType(type)
      && record.output === undefined
      ? { ...record, output: toolResult }
      : record;
    output.push(projectedRecord);
    return;
  }

  for (const key of PROJECTION_NATIVE_TOOL_CONTAINER_KEYS) {
    collectProjectionNativeToolCalls(record[key], output, visited, toolResult);
  }
}

function isProjectionNativeToolResultType(type: string): boolean {
  return type.endsWith('_result') || type.endsWith('_output');
}

function projectionToolCallsContainResult(
  toolCalls: BirdCoderChatMessage['tool_calls'] | undefined,
): boolean {
  return (toolCalls ?? []).some((toolCall) => {
    if (!isProjectionPayloadRecord(toolCall)) {
      return false;
    }
    return isProjectionNativeToolResultType(
      normalizeProjectionToolContentType(toolCall.type),
    );
  });
}

function mergeProjectionToolCalls(
  ...sources: Array<BirdCoderChatMessage['tool_calls'] | undefined>
): BirdCoderChatMessage['tool_calls'] | undefined {
  const mergedToolCalls: unknown[] = [];
  const seenSnapshots = new Set<string>();
  for (const toolCalls of sources) {
    for (const toolCall of toolCalls ?? []) {
      let snapshotKey: string;
      try {
        snapshotKey = JSON.stringify(toolCall);
      } catch {
        snapshotKey = String(toolCall);
      }
      if (seenSnapshots.has(snapshotKey)) {
        continue;
      }
      seenSnapshots.add(snapshotKey);
      mergedToolCalls.push(toolCall);
    }
  }

  return mergedToolCalls.length > 0
    ? mergedToolCalls as BirdCoderChatMessage['tool_calls']
    : undefined;
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

  const toolCalls = parseProjectionToolCalls(payload);
  if (Array.isArray(toolCalls)) {
    for (let index = toolCalls.length - 1; index >= 0; index -= 1) {
      const toolCall = isProjectionPayloadRecord(toolCalls[index])
        ? toolCalls[index]
        : null;
      if (!toolCall) {
        continue;
      }
      const item = isProjectionPayloadRecord(toolCall.item) ? toolCall.item : null;
      const part = isProjectionPayloadRecord(toolCall.part) ? toolCall.part : null;
      const source = item ?? part ?? toolCall;
      const response = isProjectionPayloadRecord(source.response)
        ? source.response
        : null;
      const resultDisplay = isProjectionPayloadRecord(source.resultDisplay)
        ? source.resultDisplay
        : isProjectionPayloadRecord(response?.resultDisplay)
          ? response.resultDisplay
          : null;
      const request = isProjectionPayloadRecord(source.request) ? source.request : null;
      const state = isProjectionPayloadRecord(source.state) ? source.state : null;
      const requestArguments = isProjectionPayloadRecord(request?.args)
        ? request.args
        : isProjectionPayloadRecord(source.args)
          ? source.args
          : isProjectionPayloadRecord(source.input)
            ? source.input
            : isProjectionPayloadRecord(source.arguments)
              ? source.arguments
              : isProjectionPayloadRecord(state?.input)
                ? state.input
                : null;
      const todos = Array.isArray(resultDisplay?.todos)
        ? resultDisplay.todos
        : Array.isArray(requestArguments?.todos)
          ? requestArguments.todos
          : normalizeProjectionToolContentType(source.type) === 'todo_list'
              && Array.isArray(source.items)
            ? source.items
            : null;
      if (!todos) {
        continue;
      }
      return {
        total: todos.length,
        completed: todos.filter((todo: unknown) =>
          isProjectionPayloadRecord(todo)
          && (
            todo.completed === true
            || normalizeProjectionToolContentType(todo.status) === 'completed'
          ),
        ).length,
      };
    }
  }

  return undefined;
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
  const hasSettledUserQuestionStatus = [
    event.payload?.runtimeStatus,
    event.payload?.status,
    event.payload?.state,
    event.payload?.phase,
    toolArguments.record?.runtimeStatus,
    toolArguments.record?.status,
    toolArguments.record?.state,
    toolArguments.record?.phase,
  ].some(isBirdCoderCodeEngineSettledStatus);
  const isUserQuestionOperationUpdate =
    event.kind === 'operation.updated' &&
    (!!answer || hasSettledUserQuestionStatus) &&
    (!!userQuestionId || (!!answer && !!toolCallId));
  if (
    event.kind !== 'tool.call.requested' &&
    event.kind !== 'tool.call.progress' &&
    event.kind !== 'tool.call.completed' &&
    !isUserQuestionOperationUpdate
  ) {
    return null;
  }

  const rawToolName =
    (isUserQuestionOperationUpdate
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
    (isUserQuestionOperationUpdate
      ? normalizeProjectionPayloadString(event.payload?.status)
      : undefined) ??
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
    ...(typeof patchContent === 'string' ? { diff: patchContent } : {}),
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
  if (
    event.kind !== 'artifact.upserted'
    && (
      event.kind !== 'tool.call.completed'
      || normalizeProjectionToolCommandStatus(event, toolArguments.record) !== 'success'
    )
  ) {
    return [];
  }
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
        ...(typeof fileChange.lineImpactKnown === 'boolean'
          ? { lineImpactKnown: fileChange.lineImpactKnown }
          : {}),
        ...(typeof fileChange.updateStatus === 'string' && fileChange.updateStatus.trim()
          ? { updateStatus: fileChange.updateStatus.trim() }
          : {}),
        ...(typeof fileChange.diff === 'string' ? { diff: fileChange.diff } : {}),
        ...(typeof fileChange.content === 'string' ? { content: fileChange.content } : {}),
        ...(typeof fileChange.originalContent === 'string'
          ? { originalContent: fileChange.originalContent }
          : {}),
      };
      const fileChangeKey = JSON.stringify([
        normalizedFileChange.path,
        normalizedFileChange.additions,
        normalizedFileChange.deletions,
        normalizedFileChange.lineImpactKnown ?? true,
        normalizedFileChange.updateStatus ?? '',
        normalizedFileChange.diff ?? '',
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

function resolveProjectionFailureContent(
  payload: Readonly<Record<string, unknown>> | undefined,
): string {
  for (const key of ['errorMessage', 'message', 'reason', 'error', 'details'] as const) {
    const content = extractBirdCoderTextContent(payload?.[key]);
    if (content) {
      return content;
    }
  }

  return 'Turn failed.';
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
    role === 'system' ||
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
  return timestampOrder === 0 ? 0 : timestampOrder;
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
      Date.parse(left.createdAt) - Date.parse(right.createdAt),
  );
  const authoritativeMessages: BirdCoderChatMessage[] = [];
  const deltaMessagesByKey = new Map<string, BirdCoderProjectionDeltaMessage>();
  const activeTextDeltaKeyByTurnRole = new Map<string, string>();
  const turnRolesWithTextDeltaSegments = new Set<string>();
  const deletedMessageIds = new Set<string>();
  const deletedMessageKeys = new Set<string>();
  const editedMessageContentById = new Map<string, string>();
  const editedMessageContentByKey = new Map<string, string>();
  const messageOrderById = new Map<string, number>();
  const retractedProviderMessageUuids = new Set<string>();
  const appendAuthoritativeMessage = (
    message: BirdCoderChatMessage,
    order: number,
  ): void => {
    authoritativeMessages.push(message);
    messageOrderById.set(message.id, order);
  };

  for (const event of sortedEvents) {
    const signals = readProjectionProviderMessageSignals(event.payload);
    for (const uuid of signals.retractedMessageUuids) {
      retractedProviderMessageUuids.add(uuid);
    }
  }
  const activeEvents = sortedEvents.filter(
    (event) => !payloadContainsRetractedProviderMessage(
      event.payload,
      retractedProviderMessageUuids,
    ),
  );
  const toolCommandsByTurn = buildProjectionToolCommandsByTurn(activeEvents);
  const fileChangesByTurn = buildProjectionFileChangesByTurn(activeEvents);

  for (const event of activeEvents) {
    if (event.kind === 'message.edited') {
      const editedContent = extractBirdCoderTextContent(event.payload?.content);
      if (!editedContent) {
        continue;
      }

      const editedMessageId = readProjectionPayloadString(event.payload, 'editedMessageId');
      if (editedMessageId) {
        editedMessageContentById.set(editedMessageId, editedContent);
      }

      const role = readProjectionPayloadString(event.payload, 'role');
      if (isProjectionRole(role) && event.turnId) {
        editedMessageContentByKey.set(`${event.turnId}:${role}`, editedContent);
      }
      continue;
    }

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

  for (const [eventIndex, event] of activeEvents.entries()) {
    const eventOrder = eventIndex * 1_024;
    if (event.kind === 'turn.failed') {
      const role = 'system' as const;
      const messageId = `${codingSessionId}:${idPrefix}:${event.turnId ?? event.id}:${role}:turn-failed`;
      if (
        !deletedMessageIds.has(messageId) &&
        !deletedMessageKeys.has(`${event.turnId ?? event.id}:${role}`)
      ) {
        appendAuthoritativeMessage({
          id: messageId,
          codingSessionId,
          turnId: event.turnId,
          role,
          content: resolveProjectionFailureContent(event.payload),
          metadata: {
            noticeKind: 'failed',
            providerEventId: event.id,
          },
          createdAt: event.createdAt,
          timestamp: Date.parse(event.createdAt),
        }, eventOrder + 512);
      }
      continue;
    }

    if (event.kind === 'message.completed') {
      const declaredRole = readProjectionPayloadString(event.payload, 'role');
      const tool_calls = parseProjectionToolCalls(event.payload);
      const role = declaredRole === 'user' && projectionToolCallsContainResult(tool_calls)
        ? 'tool'
        : declaredRole;
      if (role !== 'user') {
        for (const [noticeIndex, notice] of extractBirdCoderProtocolNotices(
          event.payload?.content,
        ).entries()) {
          appendAuthoritativeMessage({
            id: `${codingSessionId}:${idPrefix}:${event.id}:notice:${noticeIndex}`,
            codingSessionId,
            turnId: event.turnId,
            role: 'system',
            content: notice.message,
            metadata: {
              noticeKind: notice.kind,
              providerEventId: event.id,
            },
            createdAt: event.createdAt,
            timestamp: Date.parse(event.createdAt),
          }, eventOrder + noticeIndex);
        }
      }
      const isSyntheticUserMessage = declaredRole === 'user' && (
        isBirdCoderSyntheticUserMessage(event.payload)
        || isBirdCoderSyntheticUserMessage(event.payload?.content)
      );
      const content = isSyntheticUserMessage
        ? ''
        : extractBirdCoderTextContent(event.payload?.content) ?? '';
      const eventCommands = parseProjectionCommands(event.payload);
      const eventFileChanges = parseProjectionFileChanges(event.payload);
      const reasoning = parseProjectionReasoning(event.payload);
      const resources = parseProjectionResources(event.payload);
      const taskProgress = parseProjectionTaskProgress(event.payload);
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
          (reasoning?.length ?? 0) === 0 &&
          (resources?.length ?? 0) === 0 &&
          !taskProgress &&
          (tool_calls?.length ?? 0) === 0 &&
          !tool_call_id
        )
      ) {
        continue;
      }

      const isProtocolToolActivityMessage = role === 'tool' || (
        (role === 'assistant' || role === 'planner' || role === 'reviewer') &&
        !content &&
        ((tool_calls?.length ?? 0) > 0 || Boolean(tool_call_id))
      );
      const messageId = `${codingSessionId}:${idPrefix}:${event.id}:${role}${
        isProtocolToolActivityMessage ? ':tool-activity' : ''
      }`;

      if (
        deletedMessageIds.has(messageId) ||
        deletedMessageKeys.has(`${event.turnId ?? event.id}:${role}`)
      ) {
        continue;
      }

      const editedContent =
        editedMessageContentById.get(messageId) ??
        editedMessageContentByKey.get(`${event.turnId ?? event.id}:${role}`);
      appendAuthoritativeMessage({
        id: messageId,
        codingSessionId,
        turnId: event.turnId,
        role,
        content: editedContent ?? content,
        commands,
        fileChanges,
        reasoning,
        resources,
        taskProgress,
        tool_call_id,
        tool_calls,
        createdAt: event.createdAt,
        timestamp: Date.parse(event.createdAt),
      }, eventOrder + 512);
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

    const eventCommands = parseProjectionCommands(event.payload);
    const eventFileChanges = parseProjectionFileChanges(event.payload);
    const commands = mergeProjectionCommands(
      eventCommands,
      event.turnId && projectionRoleShouldReceiveToolCommands(roleCandidate)
        ? toolCommandsByTurn.get(event.turnId)
        : undefined,
    );
    const fileChanges = mergeProjectionFileChanges(
      eventFileChanges,
      event.turnId && projectionRoleShouldReceiveToolCommands(roleCandidate)
        ? fileChangesByTurn.get(event.turnId)
        : undefined,
    );
    const taskProgress = parseProjectionTaskProgress(event.payload);
    const reasoning = parseProjectionReasoning(event.payload);
    const resources = parseProjectionResources(event.payload);
    const tool_calls = parseProjectionToolCalls(event.payload);
    const tool_call_id = parseProjectionToolCallId(event.payload);
    if (
      !contentDelta &&
      (commands?.length ?? 0) === 0 &&
      (fileChanges?.length ?? 0) === 0 &&
      (reasoning?.length ?? 0) === 0 &&
      (resources?.length ?? 0) === 0 &&
      !taskProgress &&
      (tool_calls?.length ?? 0) === 0 &&
      !tool_call_id
    ) {
      continue;
    }

    const hasStructuredDelta = (
      (eventCommands?.length ?? 0) > 0
      || (eventFileChanges?.length ?? 0) > 0
      || (reasoning?.length ?? 0) > 0
      || (resources?.length ?? 0) > 0
      || Boolean(taskProgress)
      || (tool_calls?.length ?? 0) > 0
      || Boolean(tool_call_id)
    );
    const isStructuredOnly = !contentDelta && hasStructuredDelta;
    const deltaTurnRoleKey = `${event.turnId ?? event.id}:${roleCandidate}`;
    let deltaKey: string;
    if (isStructuredOnly) {
      deltaKey = `event:${event.id}:${roleCandidate}`;
    } else {
      deltaKey = activeTextDeltaKeyByTurnRole.get(deltaTurnRoleKey)
        ?? (
          turnRolesWithTextDeltaSegments.has(deltaTurnRoleKey)
            ? `event:${event.id}:${roleCandidate}:text`
            : deltaTurnRoleKey
        );
      activeTextDeltaKeyByTurnRole.set(deltaTurnRoleKey, deltaKey);
      turnRolesWithTextDeltaSegments.add(deltaTurnRoleKey);
    }
    if (
      deletedMessageIds.has(`${codingSessionId}:${idPrefix}:${deltaKey}`) ||
      deletedMessageKeys.has(deltaTurnRoleKey)
    ) {
      continue;
    }
    const existingDeltaMessage = deltaMessagesByKey.get(deltaKey);
    deltaMessagesByKey.set(deltaKey, {
      commands: commands ?? existingDeltaMessage?.commands,
      content: `${existingDeltaMessage?.content ?? ''}${contentDelta}`,
      createdAt: existingDeltaMessage?.createdAt ?? event.createdAt,
      fileChanges: fileChanges ?? existingDeltaMessage?.fileChanges,
      isStructuredOnly,
      order: existingDeltaMessage?.order ?? eventOrder + 512,
      reasoning: mergeProjectionReasoning(existingDeltaMessage?.reasoning, reasoning),
      resources: mergeProjectionResources(existingDeltaMessage?.resources, resources),
      role: roleCandidate,
      taskProgress: mergeProjectionTaskProgress(existingDeltaMessage?.taskProgress, taskProgress),
      tool_call_id: tool_call_id ?? existingDeltaMessage?.tool_call_id,
      tool_calls: mergeProjectionToolCalls(existingDeltaMessage?.tool_calls, tool_calls),
      turnId: event.turnId,
    });
    if (hasStructuredDelta) {
      activeTextDeltaKeyByTurnRole.delete(deltaTurnRoleKey);
    }
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
        !deltaMessage.isStructuredOnly &&
        typeof deltaMessage.turnId === 'string' &&
        deltaMessage.turnId.trim().length > 0 &&
        completedMessageTurnRoleKeys.has(buildProjectionTurnRoleKey(deltaMessage.turnId, deltaMessage.role))
      ) ||
      (!deltaMessage.isStructuredOnly && authoritativeMessageKeys.has(messageIdentity)) ||
      (
        !deltaMessage.content.trim() &&
        (deltaMessage.commands?.length ?? 0) === 0 &&
        (deltaMessage.fileChanges?.length ?? 0) === 0 &&
        (deltaMessage.reasoning?.length ?? 0) === 0 &&
        (deltaMessage.resources?.length ?? 0) === 0 &&
        !deltaMessage.taskProgress &&
        (deltaMessage.tool_calls?.length ?? 0) === 0 &&
        !deltaMessage.tool_call_id
      )
    ) {
      continue;
    }

    const deltaMessageId = `${codingSessionId}:${idPrefix}:${deltaKey}`;
    appendAuthoritativeMessage({
      id: deltaMessageId,
      codingSessionId,
      turnId: deltaMessage.turnId,
      role: deltaMessage.role,
      content:
        editedMessageContentById.get(`${codingSessionId}:${idPrefix}:${deltaKey}`) ??
        editedMessageContentByKey.get(deltaKey) ??
        deltaMessage.content,
      commands: deltaMessage.commands,
      fileChanges: deltaMessage.fileChanges,
      reasoning: deltaMessage.reasoning,
      resources: deltaMessage.resources,
      taskProgress: deltaMessage.taskProgress,
      tool_call_id: deltaMessage.tool_call_id,
      tool_calls: deltaMessage.tool_calls,
      createdAt: deltaMessage.createdAt,
      timestamp: Date.parse(deltaMessage.createdAt),
    }, deltaMessage.order);
    authoritativeMessageKeys.add(messageIdentity);
  }

  return {
    deletedMessageIds,
    deletedMessageKeys,
    editedMessageContentById,
    editedMessageContentByKey,
    messageOrderById,
    messages: authoritativeMessages,
    retractedProviderMessageUuids,
  };
}

function applyProjectionMessageEdit(
  message: BirdCoderChatMessage,
  editedMessageContentById: Map<string, string>,
  editedMessageContentByKey: Map<string, string>,
): BirdCoderChatMessage {
  const deletionKey =
    message.turnId && message.role ? `${message.turnId}:${message.role}` : undefined;
  const editedContent =
    editedMessageContentById.get(message.id) ??
    (deletionKey ? editedMessageContentByKey.get(deletionKey) : undefined);

  return editedContent === undefined
    ? message
    : {
        ...message,
        content: editedContent,
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
    editedMessageContentById,
    editedMessageContentByKey,
    messageOrderById,
    messages: authoritativeMessages,
    retractedProviderMessageUuids,
  } = buildAuthoritativeProjectionMessages(normalizedCodingSessionId, idPrefix, scopedEvents);
  if (authoritativeMessages.length === 0) {
    return deduplicateBirdCoderComparableChatMessages(
      scopedExistingMessages
        .filter((existingMessage) => {
          const deletionKey =
            existingMessage.turnId && existingMessage.role
              ? `${existingMessage.turnId}:${existingMessage.role}`
              : undefined;
          return (
            !deletedMessageIds.has(existingMessage.id) &&
            (!deletionKey || !deletedMessageKeys.has(deletionKey)) &&
            !isRetractedProjectionMessage(existingMessage, retractedProviderMessageUuids)
          );
        })
        .map((existingMessage) =>
          applyProjectionMessageEdit(
            existingMessage,
            editedMessageContentById,
            editedMessageContentByKey,
          ),
        ),
    ).sort(compareProjectionMessages);
  }

  const existingMessagesById = new Map<string, BirdCoderChatMessage>();
  const existingMessagesByMatchKey = new Map<string, BirdCoderChatMessage[]>();
  const existingMessagesByStructuredKey = new Map<string, BirdCoderChatMessage[]>();
  const existingMessageOrderById = new Map<string, number>();
  const addExistingMessageCandidate = (
    candidatesByKey: Map<string, BirdCoderChatMessage[]>,
    key: string,
    message: BirdCoderChatMessage,
  ): void => {
    const candidates = candidatesByKey.get(key) ?? [];
    candidates.push(message);
    candidatesByKey.set(key, candidates);
  };
  for (const [existingMessageIndex, existingMessage] of scopedExistingMessages.entries()) {
    existingMessagesById.set(existingMessage.id, existingMessage);
    existingMessageOrderById.set(existingMessage.id, existingMessageIndex);
    addExistingMessageCandidate(
      existingMessagesByMatchKey,
      buildBirdCoderChatMessageLogicalMatchKey(existingMessage),
      existingMessage,
    );
    for (const structuredKey of buildBirdCoderChatMessageStructuredMatchKeys(existingMessage)) {
      addExistingMessageCandidate(
        existingMessagesByStructuredKey,
        structuredKey,
        existingMessage,
      );
    }
  }

  const consumedExistingMessageIds = new Set<string>();
  const mergedMessages = authoritativeMessages.map((authoritativeMessage) => {
    const messageMatchKey = buildBirdCoderChatMessageLogicalMatchKey(authoritativeMessage);
    const candidateMessages = new Set<BirdCoderChatMessage>();
    const messageById = existingMessagesById.get(authoritativeMessage.id);
    if (messageById) {
      candidateMessages.add(messageById);
    }
    for (const candidate of existingMessagesByMatchKey.get(messageMatchKey) ?? []) {
      candidateMessages.add(candidate);
    }
    for (const structuredKey of buildBirdCoderChatMessageStructuredMatchKeys(
      authoritativeMessage,
    )) {
      for (const candidate of existingMessagesByStructuredKey.get(structuredKey) ?? []) {
        candidateMessages.add(candidate);
      }
    }
    const existingMessage = [...candidateMessages].find((candidate) =>
      !consumedExistingMessageIds.has(candidate.id)
      && areBirdCoderChatMessagesLogicallyMatched(candidate, authoritativeMessage),
    ) ??
      resolveLocalMirrorProjectionMessage(
        authoritativeMessage,
        scopedExistingMessages,
        consumedExistingMessageIds,
      );
    if (existingMessage) {
      consumedExistingMessageIds.add(existingMessage.id);
    }
    const mergedMessage = existingMessage
      ? mergeBirdCoderComparableChatMessages(existingMessage, authoritativeMessage)
      : authoritativeMessage;
    const existingOrder = existingMessage
      ? existingMessageOrderById.get(existingMessage.id)
      : undefined;
    if (existingOrder !== undefined) {
      existingMessageOrderById.set(mergedMessage.id, existingOrder);
    }
    return mergedMessage;
  });

  const authoritativeMessageIds = new Set(mergedMessages.map((message) => message.id));
  for (const existingMessage of scopedExistingMessages) {
    const deletionKey =
      existingMessage.turnId && existingMessage.role
        ? `${existingMessage.turnId}:${existingMessage.role}`
        : undefined;
    if (
      consumedExistingMessageIds.has(existingMessage.id) ||
      authoritativeMessageIds.has(existingMessage.id) ||
      deletedMessageIds.has(existingMessage.id) ||
      isRetractedProjectionMessage(existingMessage, retractedProviderMessageUuids) ||
      (deletionKey && deletedMessageKeys.has(deletionKey))
    ) {
      continue;
    }

    mergedMessages.push(
      applyProjectionMessageEdit(
        existingMessage,
        editedMessageContentById,
        editedMessageContentByKey,
      ),
    );
  }

  return deduplicateBirdCoderComparableChatMessages(mergedMessages).sort((left, right) => {
    const leftOrder = messageOrderById.get(left.id);
    const rightOrder = messageOrderById.get(right.id);
    if (leftOrder !== undefined && rightOrder !== undefined && leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    const timestampOrder = compareProjectionMessages(left, right);
    if (timestampOrder !== 0) {
      return timestampOrder;
    }
    const leftExistingOrder = existingMessageOrderById.get(left.id);
    const rightExistingOrder = existingMessageOrderById.get(right.id);
    return leftExistingOrder !== undefined
      && rightExistingOrder !== undefined
      && leftExistingOrder !== rightExistingOrder
      ? leftExistingOrder - rightExistingOrder
      : 0;
  });
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

/**
 * Device-local mount state for a remote project. This intentionally exposes
 * no browser handle, native path, or remote workspace-root value.
 */
export type ProjectDeviceMountStatus =
  | 'mounted'
  | 'recoverable'
  | 'permission_required'
  | 'mount_required'
  | 'session_required';

export interface ProjectDeviceMountState {
  displayName: string | null;
  host: LocalFolderMountSource['type'] | 'server' | null;
  status: ProjectDeviceMountStatus;
}

export * from './apiTransportError.ts';

export interface ProjectDeviceMountRecoveryResult {
  restored: boolean;
  state: ProjectDeviceMountState;
}

/**
 * Result of requesting a local folder capability from the current host.
 *
 * Browser folder handles and Tauri file-system paths intentionally remain
 * device-local capabilities. Neither variant is a remote workspace root.
 */
export type LocalFolderPickerResult =
  | {
      status: 'selected';
      source: LocalFolderMountSource;
    }
  | {
      status: 'cancelled';
    }
  | {
      status: 'unsupported';
      capability: 'local_folder_picker';
      code: 'browser_file_system_access_unavailable';
      message: string;
    };

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
export * from './chat-message-view.ts';
export * from './chat-message-activity-projection.ts';
export * from './chat-message-media.ts';
export * from './chat-message-reasoning.ts';
export * from './chat-message-resources.ts';
export * from './chat-message-task-progress.ts';
