import type {
  BirdCoderCodingSessionArtifactKind,
  BirdCoderCodingSessionStatus,
  BirdCoderCodingSessionRuntimeStatus,
} from './coding-session.ts';
import type { BirdcoderRiskLevel } from './governance.ts';
import { parseBirdCoderApiJson } from './json.ts';

export const BIRDCODER_CODE_ENGINE_USER_QUESTION_TOOL_NAME = 'user_question';
export const BIRDCODER_CODE_ENGINE_PERMISSION_REQUEST_TOOL_NAME = 'permission_request';

export type BirdCoderCodeEngineToolLifecycleStatus =
  | 'awaiting_approval'
  | 'awaiting_user'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type BirdCoderCodeEngineCommandStatus = 'running' | 'success' | 'error';

export type BirdCoderCodeEngineToolKind =
  | 'approval'
  | 'command'
  | 'file_change'
  | 'task'
  | 'tool'
  | 'user_question';

export interface BirdCoderCodeEngineProviderToolNameInput {
  fallbackToolName?: string;
  provider?: unknown;
  toolName: unknown;
}

export interface BirdCoderCodeEngineCommandTextInput {
  fallbackArguments?: string;
  toolArguments?: Record<string, unknown> | null;
  toolName: unknown;
}

export interface BirdCoderCodeEngineInteractionRuntimeStatusInput {
  hasAnswer?: boolean;
  phase?: unknown;
  runtimeStatus?: unknown;
  state?: unknown;
  status?: unknown;
}

export interface BirdCoderCodeEngineToolKindInput {
  hasCommandArguments?: boolean;
  runtimeStatus?: BirdCoderCodingSessionRuntimeStatus;
  toolArguments?: unknown;
  toolName: unknown;
}

export interface BirdCoderCodeEngineToolClassificationInput {
  toolKind?: BirdCoderCodeEngineToolKind;
  toolName: unknown;
}

export interface BirdCoderCodeEngineCommandInteractionStateInput {
  kind?: BirdCoderCodeEngineToolKind;
  requiresApproval?: unknown;
  requiresApprovalValues?: readonly unknown[];
  requiresReply?: unknown;
  requiresReplyValues?: readonly unknown[];
  runtimeStatus?: BirdCoderCodingSessionRuntimeStatus;
  status?: unknown;
}

export interface BirdCoderCodeEngineCommandInteractionState {
  isRunning: boolean;
  requiresApproval: boolean;
  requiresReply: boolean;
}

export interface BirdCoderCodeEngineCommandSnapshot {
  command: string;
  kind?: BirdCoderCodeEngineToolKind;
  output?: string;
  requiresApproval?: boolean;
  requiresReply?: boolean;
  runtimeStatus?: BirdCoderCodingSessionRuntimeStatus;
  status: BirdCoderCodeEngineCommandStatus;
  toolCallId?: string;
  toolName?: string;
}

export interface BirdCoderCodeEngineCommandStatusInput {
  defaultStatus?: BirdCoderCodeEngineCommandStatus;
  exitCode?: unknown;
  phase?: unknown;
  runtimeStatus?: unknown;
  state?: unknown;
  status?: unknown;
}

export interface BirdCoderCodeEngineToolCallDelta {
  id?: string;
  index?: number;
  type?: 'function' | string;
  function?: {
    arguments?: string;
    name?: string;
  };
}

export interface BirdCoderCodeEnginePendingToolCallDelta {
  id: string;
  type: 'function';
  function: {
    arguments: string;
    name: string;
  };
}

export interface BirdCoderCodeEngineToolCallDeltaAccumulator {
  pendingToolCallOrder: string[];
  pendingToolCalls: Map<string, BirdCoderCodeEnginePendingToolCallDelta>;
}

export interface BirdCoderCodeEngineToolCallDeltaInput
  extends BirdCoderCodeEngineToolCallDeltaAccumulator {
  toolCall: BirdCoderCodeEngineToolCallDelta;
}

export interface BirdCoderCodeEngineIdentityInput {
  checkpointState?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
  toolArguments?: Record<string, unknown> | null;
}

export interface BirdCoderCodeEngineUserQuestionIdentityInput
  extends BirdCoderCodeEngineIdentityInput {
  toolCallId?: unknown;
}

const USER_QUESTION_TOOL_NAME_ALIASES = new Set([
  'ask_question',
  'ask_user',
  'input_request',
  'prompt_user',
  'question',
  'user_input',
  'user_question',
]);

const APPROVAL_TOOL_NAME_ALIASES = new Set([
  'approval',
  'approval_request',
  'authorization',
  'authorization_request',
  'confirm',
  'confirmation',
  'confirmation_request',
  'permission',
  'permission_request',
  'request_approval',
  'request_permission',
]);

const COMMAND_TOOL_NAME_ALIASES = new Set([
  'bash',
  'command',
  'command_execution',
  'execute_command',
  'pty_exec',
  'run_command',
  'shell',
  'shell_command',
]);

const COMMAND_ARGUMENT_KEYS = ['command', 'cmd', 'shell', 'script'] as const;
const COMMAND_TEXT_ARGUMENT_KEYS = [
  'command',
  'cmd',
  'shell',
  'script',
  'query',
  'path',
  'filePath',
  'file_path',
  'filename',
  'targetFile',
  'target_file',
] as const;

const CODE_ENGINE_PATH_ARGUMENT_KEYS = [
  'path',
  'filePath',
  'file_path',
  'filename',
  'targetFile',
  'target_file',
] as const;

const CODE_ENGINE_PROMPT_ARGUMENT_KEYS = [
  'question',
  'prompt',
  'title',
  'header',
] as const;

const CODE_ENGINE_TOOL_CALL_ID_KEYS = [
  'toolCallId',
  'toolCallID',
  'tool_call_id',
  'callId',
  'callID',
  'call_id',
  'toolUseId',
  'toolUseID',
  'tool_use_id',
  'id',
] as const;

const CODE_ENGINE_USER_QUESTION_ID_KEYS = [
  'questionId',
  'questionID',
  'question_id',
  'requestId',
  'requestID',
  'request_id',
  'promptId',
  'promptID',
  'prompt_id',
  'id',
] as const;

const CODE_ENGINE_APPROVAL_ID_KEYS = [
  'approvalId',
  'approvalID',
  'approval_id',
  'permissionId',
  'permissionID',
  'permission_id',
  'requestId',
  'requestID',
  'request_id',
  'id',
] as const;

const CODE_ENGINE_CHECKPOINT_ID_KEYS = [
  'checkpointId',
  'checkpointID',
  'checkpoint_id',
] as const;

const CODE_ENGINE_PERMISSION_ROOT_TARGET_KEYS = [
  'title',
  'tool',
  'command',
  ...CODE_ENGINE_PATH_ARGUMENT_KEYS,
  'permission',
  'pattern',
] as const;

const CODE_ENGINE_PERMISSION_NAMED_TARGET_KEYS = [
  'title',
  'command',
  'tool',
  'name',
] as const;

const CODE_ENGINE_PERMISSION_REQUEST_ARGUMENT_KEYS = [
  'command',
  'cmd',
  ...CODE_ENGINE_PATH_ARGUMENT_KEYS,
] as const;

const FILE_CHANGE_TOOL_NAME_ALIASES = new Set([
  'apply_patch',
  'create_file',
  'edit_file',
  'multi_edit',
  'replace_file',
  'str_replace_editor',
  'write_file',
]);

const TASK_TOOL_NAME_ALIASES = new Set([
  'todo',
  'todowrite',
  'update_todo',
  'write_todo',
]);

const DIAGNOSTIC_TOOL_NAME_ALIASES = new Set([
  'grep_code',
  'read_file',
  'search_code',
]);

const PTY_TOOL_NAME_ALIASES = new Set([
  'open_terminal',
  'pty_exec',
]);

const CLAUDE_CODE_PROVIDER_KEYS = new Set([
  'claude',
  'claude_code',
]);

const CLAUDE_CODE_NATIVE_TOOL_NAME_ALIASES = new Map<string, string>([
  ['bash', 'run_command'],
  ['edit', 'edit_file'],
  ['exit_plan_mode', 'exit_plan_mode'],
  ['exitplanmode', 'exit_plan_mode'],
  ['glob', 'search_code'],
  ['grep', 'grep_code'],
  ['ls', 'list_files'],
  ['multi_edit', 'multi_edit'],
  ['multiedit', 'multi_edit'],
  ['notebook_edit', 'edit_notebook'],
  ['notebookedit', 'edit_notebook'],
  ['read', 'read_file'],
  ['task', 'task'],
  ['todo_read', 'read_todo'],
  ['todoread', 'read_todo'],
  ['todo_write', 'write_todo'],
  ['todowrite', 'write_todo'],
  ['web_fetch', 'web_fetch'],
  ['web_search', 'web_search'],
  ['webfetch', 'web_fetch'],
  ['websearch', 'web_search'],
  ['write', 'write_file'],
]);

const CODE_ENGINE_CANONICAL_TOOL_NAME_ALIASES = new Map<string, string>([
  ['bash', 'run_command'],
  ['command', 'run_command'],
  ['command_execution', 'run_command'],
  ['execute_command', 'run_command'],
  ['shell', 'run_command'],
  ['shell_command', 'run_command'],
  ['todo', 'write_todo'],
  ['todoread', 'read_todo'],
  ['todo_read', 'read_todo'],
  ['todowrite', 'write_todo'],
  ['todo_write', 'write_todo'],
  ['update_todo', 'write_todo'],
]);

const CODEX_NATIVE_TOOL_NAME_ALIASES = new Map<string, string>([
  ['command_execution', 'run_command'],
  ['execute_command', 'run_command'],
  ['file_change', 'apply_patch'],
  ['todo_list', 'write_todo'],
]);

const GEMINI_NATIVE_TOOL_NAME_ALIASES = new Map<string, string>([
  ['bash', 'run_command'],
  ['edit', 'edit_file'],
  ['glob', 'search_code'],
  ['grep', 'grep_code'],
  ['ls', 'list_files'],
  ['read', 'read_file'],
  ['shell_command', 'run_command'],
  ['write', 'write_file'],
]);

const OPENCODE_NATIVE_TOOL_NAME_ALIASES = new Map<string, string>([
  ['bash', 'run_command'],
  ['edit', 'edit_file'],
  ['glob', 'search_code'],
  ['grep', 'grep_code'],
  ['list', 'list_files'],
  ['read', 'read_file'],
  ['todowrite', 'write_todo'],
  ['write', 'write_file'],
]);

const RUNTIME_STATUS_ALIASES = new Map<string, BirdCoderCodingSessionRuntimeStatus>([
  ['abort', 'terminated'],
  ['aborted', 'terminated'],
  ['active', 'streaming'],
  ['archived', 'completed'],
  ['awaiting_approval', 'awaiting_approval'],
  ['awaiting_tool', 'awaiting_tool'],
  ['awaiting_user', 'awaiting_user'],
  ['busy', 'streaming'],
  ['cancelled', 'terminated'],
  ['canceled', 'terminated'],
  ['complete', 'completed'],
  ['completed', 'completed'],
  ['draft', 'ready'],
  ['done', 'completed'],
  ['failed', 'failed'],
  ['failure', 'failed'],
  ['initializing', 'initializing'],
  ['needs_approval', 'awaiting_approval'],
  ['needs_user', 'awaiting_user'],
  ['paused', 'failed'],
  ['pending_approval', 'awaiting_approval'],
  ['pending_user', 'awaiting_user'],
  ['permission_asked', 'awaiting_approval'],
  ['ready', 'ready'],
  ['retry', 'failed'],
  ['running', 'streaming'],
  ['started', 'streaming'],
  ['streaming', 'streaming'],
  ['success', 'completed'],
  ['succeeded', 'completed'],
  ['terminated', 'terminated'],
  ['user_input_required', 'awaiting_user'],
  ['waiting_for_user', 'awaiting_user'],
]);

const TOOL_LIFECYCLE_STATUS_ALIASES = new Map<
  string,
  BirdCoderCodeEngineToolLifecycleStatus
>([
  ['abort', 'cancelled'],
  ['aborted', 'cancelled'],
  ['accept', 'completed'],
  ['accepted', 'completed'],
  ['allow', 'completed'],
  ['allowed', 'completed'],
  ['approve', 'completed'],
  ['approved', 'completed'],
  ['awaiting', 'running'],
  ['awaiting_approval', 'awaiting_approval'],
  ['awaiting_tool', 'running'],
  ['awaiting_user', 'awaiting_user'],
  ['blocked', 'failed'],
  ['cancelled', 'cancelled'],
  ['canceled', 'cancelled'],
  ['complete', 'completed'],
  ['completed', 'completed'],
  ['decline', 'failed'],
  ['declined', 'failed'],
  ['deny', 'failed'],
  ['denied', 'failed'],
  ['disallow', 'failed'],
  ['disallowed', 'failed'],
  ['done', 'completed'],
  ['error', 'failed'],
  ['errored', 'failed'],
  ['executing', 'running'],
  ['failed', 'failed'],
  ['failure', 'failed'],
  ['finished', 'completed'],
  ['grant', 'completed'],
  ['granted', 'completed'],
  ['in_progress', 'running'],
  ['no', 'failed'],
  ['needs_approval', 'awaiting_approval'],
  ['needs_user', 'awaiting_user'],
  ['ok', 'completed'],
  ['passed', 'completed'],
  ['pending', 'running'],
  ['pending_approval', 'awaiting_approval'],
  ['pending_user', 'awaiting_user'],
  ['permission_asked', 'awaiting_approval'],
  ['processing', 'running'],
  ['queued', 'running'],
  ['reject', 'failed'],
  ['rejected', 'failed'],
  ['requested', 'running'],
  ['running', 'running'],
  ['started', 'running'],
  ['success', 'completed'],
  ['succeeded', 'completed'],
  ['terminated', 'cancelled'],
  ['user_input_required', 'awaiting_user'],
  ['waiting_for_user', 'awaiting_user'],
  ['yes', 'completed'],
]);

export function normalizeBirdCoderCodeEngineDialectKey(
  value: unknown,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim().toLocaleLowerCase().replace(/[\s-]+/gu, '_');
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

export function isBirdCoderCodeEngineUserQuestionToolName(
  value: unknown,
): boolean {
  const normalizedValue = normalizeBirdCoderCodeEngineDialectKey(value);
  return normalizedValue ? USER_QUESTION_TOOL_NAME_ALIASES.has(normalizedValue) : false;
}

export function isBirdCoderCodeEngineApprovalToolName(
  value: unknown,
): boolean {
  const normalizedValue = normalizeBirdCoderCodeEngineDialectKey(value);
  return normalizedValue ? APPROVAL_TOOL_NAME_ALIASES.has(normalizedValue) : false;
}

export function canonicalizeBirdCoderCodeEngineToolName(value: string): string {
  const normalizedValue = normalizeBirdCoderCodeEngineDialectKey(value);
  if (isBirdCoderCodeEngineUserQuestionToolName(normalizedValue)) {
    return BIRDCODER_CODE_ENGINE_USER_QUESTION_TOOL_NAME;
  }
  if (isBirdCoderCodeEngineApprovalToolName(normalizedValue)) {
    return BIRDCODER_CODE_ENGINE_PERMISSION_REQUEST_TOOL_NAME;
  }

  const canonicalToolName = normalizedValue
    ? CODE_ENGINE_CANONICAL_TOOL_NAME_ALIASES.get(normalizedValue)
    : undefined;
  return canonicalToolName ?? value.trim();
}

function stringifyBirdCoderCodeEngineToolName(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}

function resolveBirdCoderCodeEngineProviderToolNameAlias(
  provider: unknown,
  toolName: string,
): string | undefined {
  const providerKey = normalizeBirdCoderCodeEngineDialectKey(provider);
  const toolNameKey = normalizeBirdCoderCodeEngineDialectKey(toolName);
  if (!providerKey || !toolNameKey) {
    return undefined;
  }

  if (CLAUDE_CODE_PROVIDER_KEYS.has(providerKey)) {
    return CLAUDE_CODE_NATIVE_TOOL_NAME_ALIASES.get(toolNameKey);
  }

  if (providerKey === 'codex') {
    return CODEX_NATIVE_TOOL_NAME_ALIASES.get(toolNameKey);
  }

  if (providerKey === 'gemini') {
    return GEMINI_NATIVE_TOOL_NAME_ALIASES.get(toolNameKey);
  }

  if (providerKey === 'opencode') {
    return OPENCODE_NATIVE_TOOL_NAME_ALIASES.get(toolNameKey);
  }

  return undefined;
}

export function canonicalizeBirdCoderCodeEngineProviderToolName(
  input: BirdCoderCodeEngineProviderToolNameInput,
): string {
  const fallbackToolName = stringifyBirdCoderCodeEngineToolName(
    input.fallbackToolName,
  ) || 'tool_use';
  const rawToolName = stringifyBirdCoderCodeEngineToolName(input.toolName);
  if (!rawToolName) {
    return fallbackToolName;
  }

  const providerToolName =
    resolveBirdCoderCodeEngineProviderToolNameAlias(input.provider, rawToolName) ??
    rawToolName;
  return canonicalizeBirdCoderCodeEngineToolName(providerToolName);
}

function isBirdCoderCodeEnginePayloadRecord(
  value: unknown,
): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeBirdCoderCodeEngineIdentifier(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }

  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    Number.isSafeInteger(value)
  ) {
    return String(value);
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  return undefined;
}

export function readBirdCoderCodeEngineIdentifier(
  record: Record<string, unknown> | null | undefined,
  fieldNames: readonly string[],
): string | undefined {
  for (const fieldName of fieldNames) {
    const value = normalizeBirdCoderCodeEngineIdentifier(record?.[fieldName]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function readBirdCoderCodeEngineIdentityFromRecords(
  fieldNames: readonly string[],
  records: ReadonlyArray<Record<string, unknown> | null | undefined>,
): string | undefined {
  for (const fieldName of fieldNames) {
    for (const record of records) {
      const value = normalizeBirdCoderCodeEngineIdentifier(record?.[fieldName]);
      if (value) {
        return value;
      }
    }
  }

  return undefined;
}

export function resolveBirdCoderCodeEngineToolCallId(
  input: BirdCoderCodeEngineIdentityInput,
): string | undefined {
  return readBirdCoderCodeEngineIdentityFromRecords(CODE_ENGINE_TOOL_CALL_ID_KEYS, [
    input.payload,
    input.toolArguments,
    input.checkpointState,
  ]);
}

export function resolveBirdCoderCodeEngineUserQuestionId(
  input: BirdCoderCodeEngineUserQuestionIdentityInput,
): string | undefined {
  return (
    readBirdCoderCodeEngineIdentityFromRecords(CODE_ENGINE_USER_QUESTION_ID_KEYS, [
      input.toolArguments,
      input.payload,
      input.checkpointState,
    ]) ??
    normalizeBirdCoderCodeEngineIdentifier(input.toolCallId) ??
    resolveBirdCoderCodeEngineToolCallId(input)
  );
}

export function resolveBirdCoderCodeEngineApprovalId(
  input: BirdCoderCodeEngineIdentityInput,
): string | undefined {
  return readBirdCoderCodeEngineIdentityFromRecords(CODE_ENGINE_APPROVAL_ID_KEYS, [
    input.payload,
    input.toolArguments,
    input.checkpointState,
  ]);
}

export function resolveBirdCoderCodeEngineCheckpointId(
  input: BirdCoderCodeEngineIdentityInput,
): string | undefined {
  return readBirdCoderCodeEngineIdentityFromRecords(CODE_ENGINE_CHECKPOINT_ID_KEYS, [
    input.payload,
    input.toolArguments,
    input.checkpointState,
  ]);
}

function readBirdCoderCodeEngineRecordString(
  record: Record<string, unknown> | null | undefined,
  fieldNames: readonly string[],
): string | undefined {
  for (const fieldName of fieldNames) {
    const value = record?.[fieldName];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function resolveBirdCoderCodeEnginePromptText(
  args: Record<string, unknown> | null,
): string | undefined {
  const directPrompt = readBirdCoderCodeEngineRecordString(
    args,
    CODE_ENGINE_PROMPT_ARGUMENT_KEYS,
  );
  if (directPrompt) {
    return directPrompt;
  }

  const questions = Array.isArray(args?.questions) ? args.questions : [];
  for (const question of questions) {
    if (!isBirdCoderCodeEnginePayloadRecord(question)) {
      continue;
    }

    const questionText = readBirdCoderCodeEngineRecordString(
      question,
      CODE_ENGINE_PROMPT_ARGUMENT_KEYS,
    );
    if (questionText) {
      return questionText;
    }
  }

  return undefined;
}

function resolveBirdCoderCodeEnginePermissionRequestText(
  args: Record<string, unknown> | null,
): string {
  const details = isBirdCoderCodeEnginePayloadRecord(args?.details)
    ? args.details
    : null;
  const metadata = isBirdCoderCodeEnginePayloadRecord(args?.metadata)
    ? args.metadata
    : null;
  const request = isBirdCoderCodeEnginePayloadRecord(args?.request)
    ? args.request
    : null;
  const requestArgs = isBirdCoderCodeEnginePayloadRecord(request?.args)
    ? request.args
    : null;
  const target =
    readBirdCoderCodeEngineRecordString(
      details,
      CODE_ENGINE_PERMISSION_NAMED_TARGET_KEYS,
    ) ??
    readBirdCoderCodeEngineRecordString(
      metadata,
      CODE_ENGINE_PERMISSION_NAMED_TARGET_KEYS,
    ) ??
    readBirdCoderCodeEngineRecordString(
      args,
      CODE_ENGINE_PERMISSION_ROOT_TARGET_KEYS,
    ) ??
    readBirdCoderCodeEngineRecordString(
      requestArgs,
      CODE_ENGINE_PERMISSION_REQUEST_ARGUMENT_KEYS,
    ) ??
    readBirdCoderCodeEngineRecordString(request, ['name', 'tool']);

  return target ? `Permission required: ${target}` : 'Permission required';
}

function resolveBirdCoderCodeEngineChangePaths(
  args: Record<string, unknown> | null,
): string[] {
  const changes = Array.isArray(args?.changes) ? args.changes : [];
  return changes.flatMap((change) => {
    if (!isBirdCoderCodeEnginePayloadRecord(change)) {
      return [];
    }

    const path = readBirdCoderCodeEngineRecordString(
      change,
      CODE_ENGINE_PATH_ARGUMENT_KEYS,
    );
    return path ? [path] : [];
  });
}

export function resolveBirdCoderCodeEngineCommandText(
  input: BirdCoderCodeEngineCommandTextInput,
): string {
  const toolName = stringifyBirdCoderCodeEngineToolName(input.toolName) || 'tool';
  const args = input.toolArguments ?? null;
  const changePaths = resolveBirdCoderCodeEngineChangePaths(args);
  if (changePaths.length > 0) {
    return `${toolName}: ${changePaths.join(', ')}`;
  }

  if (isBirdCoderCodeEngineApprovalToolName(toolName)) {
    return resolveBirdCoderCodeEnginePermissionRequestText(args);
  }

  const promptText = resolveBirdCoderCodeEnginePromptText(args);
  if (promptText) {
    return promptText;
  }

  if (isBirdCoderCodeEngineUserQuestionToolName(toolName)) {
    const answerText = readBirdCoderCodeEngineRecordString(args, ['answer']);
    if (answerText) {
      return answerText;
    }
  }

  const commandCandidate = readBirdCoderCodeEngineRecordString(
    args,
    COMMAND_TEXT_ARGUMENT_KEYS,
  );
  if (commandCandidate) {
    return commandCandidate;
  }

  const fallbackArguments = stringifyBirdCoderCodeEngineToolName(
    input.fallbackArguments,
  );
  return fallbackArguments ? `${toolName} ${fallbackArguments}` : toolName;
}

function hasBirdCoderCodeEngineCommandArgumentValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return value !== undefined && value !== null && value !== false;
}

export function hasBirdCoderCodeEngineCommandArguments(value: unknown): boolean {
  if (!isBirdCoderCodeEnginePayloadRecord(value)) {
    return false;
  }

  return COMMAND_ARGUMENT_KEYS.some((key) =>
    hasBirdCoderCodeEngineCommandArgumentValue(value[key]),
  );
}

export function resolveBirdCoderCodeEngineToolKind(
  input: BirdCoderCodeEngineToolKindInput,
): BirdCoderCodeEngineToolKind {
  const normalizedToolName = normalizeBirdCoderCodeEngineDialectKey(input.toolName);
  if (
    isBirdCoderCodeEngineUserQuestionToolName(normalizedToolName) ||
    input.runtimeStatus === 'awaiting_user'
  ) {
    return 'user_question';
  }
  if (
    isBirdCoderCodeEngineApprovalToolName(normalizedToolName) ||
    input.runtimeStatus === 'awaiting_approval'
  ) {
    return 'approval';
  }
  if (
    (normalizedToolName ? COMMAND_TOOL_NAME_ALIASES.has(normalizedToolName) : false) ||
    input.hasCommandArguments === true ||
    hasBirdCoderCodeEngineCommandArguments(input.toolArguments)
  ) {
    return 'command';
  }
  if (normalizedToolName && FILE_CHANGE_TOOL_NAME_ALIASES.has(normalizedToolName)) {
    return 'file_change';
  }
  if (normalizedToolName && TASK_TOOL_NAME_ALIASES.has(normalizedToolName)) {
    return 'task';
  }

  return 'tool';
}

export function resolveBirdCoderCodeEngineArtifactKind(
  input: BirdCoderCodeEngineToolClassificationInput,
): BirdCoderCodingSessionArtifactKind {
  const normalizedToolName = normalizeBirdCoderCodeEngineDialectKey(input.toolName);
  if (normalizedToolName && PTY_TOOL_NAME_ALIASES.has(normalizedToolName)) {
    return 'pty-transcript';
  }
  if (normalizedToolName && DIAGNOSTIC_TOOL_NAME_ALIASES.has(normalizedToolName)) {
    return 'diagnostic-bundle';
  }

  const toolKind =
    input.toolKind ??
    resolveBirdCoderCodeEngineToolKind({
      toolName: input.toolName,
    });
  switch (toolKind) {
    case 'command':
      return 'command-log';
    case 'file_change':
      return 'patch';
    case 'task':
      return 'todo-list';
    default:
      return 'structured-output';
  }
}

export function resolveBirdCoderCodeEngineRiskLevel(
  input: BirdCoderCodeEngineToolClassificationInput,
): BirdcoderRiskLevel {
  const normalizedToolName = normalizeBirdCoderCodeEngineDialectKey(input.toolName);
  if (normalizedToolName && DIAGNOSTIC_TOOL_NAME_ALIASES.has(normalizedToolName)) {
    return 'P0';
  }
  if (normalizedToolName && PTY_TOOL_NAME_ALIASES.has(normalizedToolName)) {
    return 'P2';
  }

  const toolKind =
    input.toolKind ??
    resolveBirdCoderCodeEngineToolKind({
      toolName: input.toolName,
    });
  switch (toolKind) {
    case 'user_question':
      return 'P0';
    case 'command':
    case 'file_change':
      return 'P2';
    case 'approval':
    case 'task':
    case 'tool':
      return 'P1';
  }
}

export function normalizeBirdCoderCodeEngineRuntimeStatus(
  value: unknown,
): BirdCoderCodingSessionRuntimeStatus | undefined {
  const normalizedValue = normalizeBirdCoderCodeEngineDialectKey(value);
  return normalizedValue ? RUNTIME_STATUS_ALIASES.get(normalizedValue) : undefined;
}

export function resolveBirdCoderCodeEngineSessionRuntimeStatus(
  value: unknown,
): BirdCoderCodingSessionRuntimeStatus {
  if (value === undefined || value === null) {
    return 'completed';
  }

  return normalizeBirdCoderCodeEngineRuntimeStatus(value) ?? 'ready';
}

export function resolveBirdCoderCodeEngineSessionStatusFromRuntime(
  value: unknown,
): BirdCoderCodingSessionStatus {
  const runtimeStatus = normalizeBirdCoderCodeEngineRuntimeStatus(value);
  switch (runtimeStatus) {
    case 'completed':
    case 'terminated':
      return 'completed';
    case 'failed':
      return 'paused';
    case 'awaiting_approval':
    case 'awaiting_tool':
    case 'awaiting_user':
    case 'initializing':
    case 'ready':
    case 'streaming':
    default:
      return 'active';
  }
}

export function normalizeBirdCoderCodeEngineToolLifecycleStatus(
  value: unknown,
): BirdCoderCodeEngineToolLifecycleStatus | undefined {
  const normalizedValue = normalizeBirdCoderCodeEngineDialectKey(value);
  return normalizedValue ? TOOL_LIFECYCLE_STATUS_ALIASES.get(normalizedValue) : undefined;
}

export function normalizeBirdCoderCodeEngineExitCode(value: unknown): number | undefined {
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    Number.isSafeInteger(value)
  ) {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  if (!/^-?\d+$/u.test(normalizedValue)) {
    return undefined;
  }

  const parsedValue = BigInt(normalizedValue);
  if (
    parsedValue < BigInt(Number.MIN_SAFE_INTEGER) ||
    parsedValue > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    return undefined;
  }

  return Number(parsedValue);
}

export function normalizeBirdCoderCodeEngineBoolean(
  value: unknown,
): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim().toLocaleLowerCase();
  if (
    normalizedValue === 'true' ||
    normalizedValue === '1' ||
    normalizedValue === 'yes' ||
    normalizedValue === 'y'
  ) {
    return true;
  }
  if (
    normalizedValue === 'false' ||
    normalizedValue === '0' ||
    normalizedValue === 'no' ||
    normalizedValue === 'n'
  ) {
    return false;
  }

  return undefined;
}

function hasAffirmativeBirdCoderCodeEngineBoolean(
  value: unknown,
  values: readonly unknown[] | undefined,
): boolean {
  if (normalizeBirdCoderCodeEngineBoolean(value) === true) {
    return true;
  }

  return values?.some((item) => normalizeBirdCoderCodeEngineBoolean(item) === true) ?? false;
}

export function resolveBirdCoderCodeEngineCommandInteractionState(
  input: BirdCoderCodeEngineCommandInteractionStateInput,
): BirdCoderCodeEngineCommandInteractionState {
  const isRunning = input.status === 'running';
  return {
    isRunning,
    requiresApproval:
      isRunning &&
      (input.runtimeStatus === 'awaiting_approval' ||
        hasAffirmativeBirdCoderCodeEngineBoolean(
          input.requiresApproval,
          input.requiresApprovalValues,
        ) ||
        input.kind === 'approval'),
    requiresReply:
      isRunning &&
      (input.runtimeStatus === 'awaiting_user' ||
        hasAffirmativeBirdCoderCodeEngineBoolean(
          input.requiresReply,
          input.requiresReplyValues,
        ) ||
        input.kind === 'user_question'),
  };
}

export function shouldPreserveBirdCoderCodeEngineCommandText(
  existingCommand: BirdCoderCodeEngineCommandSnapshot,
  nextCommand: BirdCoderCodeEngineCommandSnapshot,
): boolean {
  return (
    existingCommand.kind === nextCommand.kind &&
    ((existingCommand.kind === 'user_question' && nextCommand.requiresReply === false) ||
      nextCommand.command === nextCommand.toolName ||
      nextCommand.command === `${nextCommand.toolName ?? ''}`.trim())
  );
}

export function mergeBirdCoderCodeEngineCommandSnapshot<
  TCommand extends BirdCoderCodeEngineCommandSnapshot,
>(existingCommand: TCommand, nextCommand: TCommand): TCommand {
  const shouldPreserveCommandText = shouldPreserveBirdCoderCodeEngineCommandText(
    existingCommand,
    nextCommand,
  );

  const mergedCommand = {
    ...existingCommand,
    ...nextCommand,
    command: shouldPreserveCommandText ? existingCommand.command : nextCommand.command,
    status: nextCommand.status,
  } as TCommand;

  const output = nextCommand.output ?? existingCommand.output;
  if (output !== undefined) {
    mergedCommand.output = output;
  } else {
    delete mergedCommand.output;
  }

  const kind = nextCommand.kind ?? existingCommand.kind;
  if (kind !== undefined) {
    mergedCommand.kind = kind;
  } else {
    delete mergedCommand.kind;
  }

  const toolName = nextCommand.toolName ?? existingCommand.toolName;
  if (toolName !== undefined) {
    mergedCommand.toolName = toolName;
  } else {
    delete mergedCommand.toolName;
  }

  const toolCallId = nextCommand.toolCallId ?? existingCommand.toolCallId;
  if (toolCallId !== undefined) {
    mergedCommand.toolCallId = toolCallId;
  } else {
    delete mergedCommand.toolCallId;
  }

  const runtimeStatus = nextCommand.runtimeStatus ?? existingCommand.runtimeStatus;
  if (runtimeStatus !== undefined) {
    mergedCommand.runtimeStatus = runtimeStatus;
  } else {
    delete mergedCommand.runtimeStatus;
  }

  const requiresApproval =
    typeof nextCommand.requiresApproval === 'boolean'
      ? nextCommand.requiresApproval
      : existingCommand.requiresApproval;
  if (requiresApproval !== undefined) {
    mergedCommand.requiresApproval = requiresApproval;
  } else {
    delete mergedCommand.requiresApproval;
  }

  const requiresReply =
    typeof nextCommand.requiresReply === 'boolean'
      ? nextCommand.requiresReply
      : existingCommand.requiresReply;
  if (requiresReply !== undefined) {
    mergedCommand.requiresReply = requiresReply;
  } else {
    delete mergedCommand.requiresReply;
  }

  return mergedCommand;
}

export function isBirdCoderCodeEngineSettledStatus(value: unknown): boolean {
  const runtimeStatus = normalizeBirdCoderCodeEngineRuntimeStatus(value);
  if (
    runtimeStatus === 'awaiting_tool' ||
    runtimeStatus === 'completed' ||
    runtimeStatus === 'failed' ||
    runtimeStatus === 'terminated'
  ) {
    return true;
  }

  const lifecycleStatus = normalizeBirdCoderCodeEngineToolLifecycleStatus(value);
  return (
    lifecycleStatus === 'completed' ||
    lifecycleStatus === 'failed' ||
    lifecycleStatus === 'cancelled'
  );
}

function isCompleteBirdCoderCodeEngineToolArguments(value: string): boolean {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return false;
  }

  try {
    parseBirdCoderApiJson(normalizedValue);
    return true;
  } catch {
    return false;
  }
}

function mergeBirdCoderCodeEngineToolCallArguments(
  existingArguments: string,
  nextArguments: string,
): string {
  if (!nextArguments) {
    return existingArguments;
  }

  if (!existingArguments) {
    return nextArguments;
  }

  if (isCompleteBirdCoderCodeEngineToolArguments(nextArguments)) {
    return nextArguments;
  }

  return `${existingArguments}${nextArguments}`;
}

export function mergeBirdCoderCodeEngineToolCallDelta(
  input: BirdCoderCodeEngineToolCallDeltaInput,
): void {
  const { pendingToolCallOrder, pendingToolCalls, toolCall } = input;
  const key = Number.isInteger(toolCall.index)
    ? `index:${toolCall.index}`
    : toolCall.id ||
      (pendingToolCallOrder.length === 1
        ? pendingToolCallOrder[0]
        : `order:${pendingToolCallOrder.length}`);
  const existingToolCall = pendingToolCalls.get(key);
  const nextToolCall: BirdCoderCodeEnginePendingToolCallDelta = {
    id: toolCall.id || existingToolCall?.id || key,
    type: 'function',
    function: {
      name: toolCall.function?.name || existingToolCall?.function.name || 'tool',
      arguments: mergeBirdCoderCodeEngineToolCallArguments(
        existingToolCall?.function.arguments ?? '',
        toolCall.function?.arguments ?? '',
      ),
    },
  };

  if (!existingToolCall) {
    pendingToolCallOrder.push(key);
  }
  pendingToolCalls.set(key, nextToolCall);
}

export function flushBirdCoderCodeEngineToolCallDeltas(
  input: BirdCoderCodeEngineToolCallDeltaAccumulator,
): BirdCoderCodeEnginePendingToolCallDelta[] {
  const { pendingToolCallOrder, pendingToolCalls } = input;
  const toolCalls = pendingToolCallOrder.flatMap((key) => {
    const toolCall = pendingToolCalls.get(key);
    return toolCall ? [toolCall] : [];
  });
  pendingToolCalls.clear();
  pendingToolCallOrder.splice(0);
  return toolCalls;
}

function firstRuntimeStatus(
  input: BirdCoderCodeEngineInteractionRuntimeStatusInput,
): BirdCoderCodingSessionRuntimeStatus | undefined {
  return (
    normalizeBirdCoderCodeEngineRuntimeStatus(input.runtimeStatus) ??
    normalizeBirdCoderCodeEngineRuntimeStatus(input.state) ??
    normalizeBirdCoderCodeEngineRuntimeStatus(input.phase)
  );
}

function statusTransitionsToAwaitingTool(value: unknown): boolean {
  return (
    normalizeBirdCoderCodeEngineRuntimeStatus(value) === 'awaiting_tool' ||
    normalizeBirdCoderCodeEngineToolLifecycleStatus(value) === 'completed'
  );
}

function statusTransitionsToFailed(value: unknown): boolean {
  const runtimeStatus = normalizeBirdCoderCodeEngineRuntimeStatus(value);
  if (runtimeStatus === 'failed' || runtimeStatus === 'terminated') {
    return true;
  }

  const lifecycleStatus = normalizeBirdCoderCodeEngineToolLifecycleStatus(value);
  return lifecycleStatus === 'failed' || lifecycleStatus === 'cancelled';
}

export function resolveBirdCoderCodeEngineUserQuestionRuntimeStatus(
  input: BirdCoderCodeEngineInteractionRuntimeStatusInput,
): BirdCoderCodingSessionRuntimeStatus {
  const status = input.status;
  const explicitRuntimeStatus = firstRuntimeStatus(input);
  if (
    explicitRuntimeStatus === 'completed' &&
    (input.hasAnswer === true || statusTransitionsToAwaitingTool(status))
  ) {
    return 'awaiting_tool';
  }
  if (explicitRuntimeStatus) {
    return explicitRuntimeStatus;
  }
  if (input.hasAnswer === true || statusTransitionsToAwaitingTool(status)) {
    return 'awaiting_tool';
  }
  if (statusTransitionsToFailed(status)) {
    return 'failed';
  }

  return 'awaiting_user';
}

export function resolveBirdCoderCodeEngineApprovalRuntimeStatus(
  input: BirdCoderCodeEngineInteractionRuntimeStatusInput,
): BirdCoderCodingSessionRuntimeStatus {
  const status = input.status;
  if (statusTransitionsToAwaitingTool(status)) {
    return 'awaiting_tool';
  }
  if (statusTransitionsToFailed(status)) {
    return 'failed';
  }

  const explicitRuntimeStatus = firstRuntimeStatus(input);
  if (explicitRuntimeStatus === 'completed') {
    return 'awaiting_tool';
  }
  if (explicitRuntimeStatus) {
    return explicitRuntimeStatus;
  }

  return 'awaiting_approval';
}

export function resolveBirdCoderCodeEngineCommandStatus(
  input: BirdCoderCodeEngineCommandStatusInput,
): BirdCoderCodeEngineCommandStatus {
  const exitCode = normalizeBirdCoderCodeEngineExitCode(input.exitCode);
  if (exitCode !== undefined) {
    return exitCode === 0 ? 'success' : 'error';
  }

  const lifecycleStatus =
    normalizeBirdCoderCodeEngineToolLifecycleStatus(input.status) ??
    normalizeBirdCoderCodeEngineToolLifecycleStatus(input.runtimeStatus) ??
    normalizeBirdCoderCodeEngineToolLifecycleStatus(input.state) ??
    normalizeBirdCoderCodeEngineToolLifecycleStatus(input.phase);
  if (lifecycleStatus === 'completed') {
    return 'success';
  }
  if (lifecycleStatus === 'failed' || lifecycleStatus === 'cancelled') {
    return 'error';
  }
  if (
    lifecycleStatus === 'awaiting_approval' ||
    lifecycleStatus === 'awaiting_user' ||
    lifecycleStatus === 'running'
  ) {
    return 'running';
  }

  const runtimeStatus =
    normalizeBirdCoderCodeEngineRuntimeStatus(input.runtimeStatus) ??
    normalizeBirdCoderCodeEngineRuntimeStatus(input.status) ??
    normalizeBirdCoderCodeEngineRuntimeStatus(input.state) ??
    normalizeBirdCoderCodeEngineRuntimeStatus(input.phase);
  if (runtimeStatus === 'completed') {
    return 'success';
  }
  if (runtimeStatus === 'failed' || runtimeStatus === 'terminated') {
    return 'error';
  }
  if (
    runtimeStatus === 'awaiting_approval' ||
    runtimeStatus === 'awaiting_tool' ||
    runtimeStatus === 'awaiting_user' ||
    runtimeStatus === 'initializing' ||
    runtimeStatus === 'streaming'
  ) {
    return 'running';
  }

  return input.defaultStatus ?? 'running';
}
