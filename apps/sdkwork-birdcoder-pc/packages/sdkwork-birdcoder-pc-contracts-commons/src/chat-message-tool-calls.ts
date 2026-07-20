export type {
  BirdCoderChatMessageToolCall as ChatMessageToolCall,
} from '@sdkwork/birdcoder-chat-contracts';
import type {
  BirdCoderChatMessageToolCall as ChatMessageToolCall,
  BirdCoderChatMessageToolCallKind,
  BirdCoderChatMessageToolCallStatus,
} from '@sdkwork/birdcoder-chat-contracts';
import {
  hasChatMessageToolErrorValue,
  hasStructuredChatMessageToolError,
  resolveChatMessageToolCallOutput,
  resolveChatMessageToolCallResultBlocks,
} from './chat-message-tool-results.ts';

export interface ProjectChatMessageToolCallOptions {
  engineId?: string;
  fallbackIdPrefix?: string;
}

export const CHAT_MESSAGE_TOOL_PROTOCOL_ADAPTER_IDS = [
  'opencode.part',
  'codex.item',
  'claude.content-block',
  'gemini.event',
  'openai.function',
  'canonical',
] as const;

export type ChatMessageToolProtocolAdapterId =
  (typeof CHAT_MESSAGE_TOOL_PROTOCOL_ADAPTER_IDS)[number];

export interface ProjectChatMessageToolResultInput {
  content: string;
  id?: string;
  name?: string;
  status?: unknown;
}

export interface ProjectedChatMessageCommand {
  command: string;
  status: 'running' | 'success' | 'error';
  output?: string;
  runtimeStatus?: 'terminated';
  kind: 'command';
  toolName: string;
  toolCallId: string;
}

export interface ProjectedChatMessageToolNotice {
  content: string;
  description?: string;
  id: string;
  kind: 'notice';
  name?: string;
  result?: string;
  resultSummary?: string;
}

const GEMINI_TOOL_DISPLAY_FORMATS = new Set([
  'auto',
  'box',
  'compact',
  'hidden',
  'notice',
]);
const MAX_GEMINI_TOOL_DISPLAY_NAME_CHARACTERS = 160;
const MAX_GEMINI_TOOL_DISPLAY_DESCRIPTION_CHARACTERS = 1_000;
const MAX_GEMINI_TOOL_DISPLAY_SUMMARY_CHARACTERS = 2_000;
const MAX_GEMINI_TOOL_DISPLAY_RESULT_CHARACTERS = 24_000;
const GEMINI_TOOL_DISPLAY_TRUNCATION_SEPARATOR = '\n\n...\n\n';

type ChatMessageToolResultBlock = NonNullable<ChatMessageToolCall['resultBlocks']>[number];
type GeminiToolDisplayFormat = 'auto' | 'box' | 'compact' | 'hidden' | 'notice';

interface NormalizedGeminiToolDisplay {
  description?: unknown;
  format?: unknown;
  name?: unknown;
  result?: unknown;
  resultSummary?: unknown;
}

interface GeminiToolDisplayContext {
  argumentsValue?: unknown;
  callId: string;
  display: NormalizedGeminiToolDisplay;
  eventType: string;
  explicitStatus: string;
  isError: boolean;
  toolName: string;
}

interface GeminiToolDisplayResultProjection {
  blocks: readonly ChatMessageToolResultBlock[];
  semanticType?: 'agent';
  text: string;
}

const COMMAND_TOOL_NAMES = new Set([
  'bash',
  'command',
  'command_execution',
  'execute_command',
  'exec_command',
  'pty_exec',
  'power_shell',
  'powershell',
  'run_command',
  'run_shell_command',
  'shell',
  'shell_command',
]);

const FILE_MUTATION_TOOL_NAMES = new Set([
  'apply_patch',
  'create_file',
  'edit',
  'edit_file',
  'multi_edit',
  'multiedit',
  'notebook_edit',
  'replace',
  'replace_file',
  'patch',
  'str_replace_editor',
  'write',
  'write_file',
]);

const FILE_TOOL_NAMES = new Set([
  ...FILE_MUTATION_TOOL_NAMES,
  'read',
  'read_file',
  'read_many_files',
]);

const SEARCH_TOOL_NAMES = new Set([
  'glob',
  'grep',
  'grep_code',
  'grep_search',
  'codesearch',
  'list',
  'list_directory',
  'list_files',
  'ls',
  'lsp',
  'rg',
  'search',
  'search_code',
]);

const TASK_TOOL_NAMES = new Set([
  'todo',
  'todo_read',
  'todo_write',
  'todoread',
  'todowrite',
  'update_todo',
  'write_todo',
  'write_todos',
  'task_create',
  'task_get',
  'task_list',
  'task_update',
  'tracker_add_dependency',
  'tracker_create_task',
  'tracker_get_task',
  'tracker_list_tasks',
  'tracker_update_task',
  'tracker_visualize',
]);

const AGENT_TOOL_NAMES = new Set([
  'agent',
  'close_agent',
  'delegate',
  'delegate_to_agent',
  'followup_task',
  'list_agents',
  'resume_agent',
  'run_agent',
  'send_input',
  'send_message',
  'spawn_agent',
  'subagent',
  'subtask',
  'task',
  'task_output',
  'task_stop',
  'team_create',
  'team_delete',
  'wait_agent',
]);

const SKILL_TOOL_NAMES = new Set([
  'load_skill',
  'skill',
  'use_skill',
  'activate_skill',
]);

const MEDIA_TOOL_NAMES = new Set([
  'generate_image',
  'image_generation',
  'image_generation_call',
  'render_image',
  'view_image',
]);

const WEB_TOOL_NAMES = new Set([
  'web_fetch',
  'web_search',
  'webfetch',
  'websearch',
]);

const APPROVAL_TOOL_NAMES = new Set([
  'approval',
  'approval_request',
  'permission',
  'permission_request',
  'request_approval',
  'request_permission',
]);

const QUESTION_TOOL_NAMES = new Set([
  'ask_question',
  'ask_user',
  'ask_user_question',
  'prompt_user',
  'question',
  'user_input',
  'user_question',
]);

const COMMAND_ARGUMENT_KEYS = ['command', 'cmd', 'shell', 'script'] as const;
const TARGET_ARGUMENT_KEYS = [
  'target',
  'path',
  'filePath',
  'file_path',
  'dirPath',
  'dir_path',
  'filename',
  'notebook_path',
  'outputFile',
  'output_file',
  'query',
  'pattern',
  'description',
  'prompt',
  'uri',
  'url',
] as const;

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

function hasToolCancellationDetail(
  value: unknown,
  visited = new WeakSet<object>(),
  depth = 0,
): boolean {
  if (depth >= 6 || value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'string') {
    return /^\[?(?:(?:operation|request|tool|command|user)\s+)?(?:was\s+)?cancel(?:led|ed)(?:\]|\b)/iu
      .test(value.trim());
  }
  if (value instanceof Error) {
    return hasToolCancellationDetail(value.message, visited, depth + 1);
  }
  if (Array.isArray(value)) {
    return value.some((entry) => hasToolCancellationDetail(entry, visited, depth + 1));
  }
  const record = readToolCallRecord(value);
  if (!record || visited.has(record)) {
    return false;
  }
  visited.add(record);
  return ['message', 'reason', 'detail', 'error', 'output', 'resultDisplay', 'response']
    .some((key) => hasToolCancellationDetail(record[key], visited, depth + 1));
}

interface ChatMessageToolProtocolAdapter {
  id: ChatMessageToolProtocolAdapterId;
  engineIds: readonly string[];
  adapt: (record: Record<string, unknown>) => Record<string, unknown> | null;
}

function adaptCodexToolRecord(record: Record<string, unknown>): Record<string, unknown> | null {
  const item = readToolCallRecord(record.item);
  const source = item ? { ...record, ...item } : record;
  const type = normalizeToolCallName(readNonEmptyString(source.type));
  const action = readToolCallRecord(source.action);

  if (type === 'local_shell_call') {
    return {
      ...source,
      name: 'shell_command',
      arguments: action ?? source.action,
      command: action?.command,
    };
  }
  if (type === 'command_execution') {
    return {
      ...source,
      name: 'shell_command',
      arguments: { command: source.command },
      output: source.aggregatedOutput ?? source.aggregated_output,
    };
  }
  if (type === 'file_change') {
    const changes = Array.isArray(source.changes) ? source.changes : [];
    const firstChange = readToolCallRecord(changes[0]);
    const firstChangeKind = readToolCallRecord(firstChange?.kind);
    const firstMovePath = readNonEmptyString(
      firstChangeKind?.move_path ?? firstChangeKind?.movePath,
    );
    const firstPath = readNonEmptyString(firstChange?.path);
    const movedChangeCount = changes.filter((change) => {
      const changeRecord = readToolCallRecord(change);
      const changeKind = readToolCallRecord(changeRecord?.kind);
      return Boolean(readNonEmptyString(changeKind?.move_path ?? changeKind?.movePath));
    }).length;
    const title = firstMovePath && changes.length === 1
      ? `Moved ${firstPath || 'file'} -> ${firstMovePath}`
      : changes.length > 0
        ? `${changes.length} file${changes.length === 1 ? '' : 's'}${
            movedChangeCount > 0 ? ` (${movedChangeCount} moved)` : ''
          }`
        : undefined;
    return {
      ...source,
      name: 'apply_patch',
      arguments: { changes },
      target: firstMovePath || firstPath,
      title,
    };
  }
  if (type === 'todo_list') {
    const items = Array.isArray(source.items) ? source.items : [];
    const normalizedItems = items.flatMap((item) => {
      const itemRecord = readToolCallRecord(item);
      const text = readNonEmptyString(itemRecord?.text);
      const itemStatus = normalizeToolCallName(readNonEmptyString(itemRecord?.status));
      return text
        ? [{
            text,
            completed: itemRecord?.completed === true || itemStatus === 'completed',
            status: itemStatus,
          }]
        : [];
    });
    const completed = normalizedItems.filter((item) => item.completed).length;
    return {
      ...source,
      name: 'todo',
      arguments: { items: normalizedItems },
      output: normalizedItems.map((item) => {
        const marker = item.completed
          ? 'x'
          : item.status === 'in_progress'
            ? '~'
            : item.status === 'cancelled'
              ? '-'
              : item.status === 'blocked'
                ? '!'
                : ' ';
        return `[${marker}] ${item.text}`;
      }),
      status: source.status ?? (
        normalizedItems.length > 0 && completed === normalizedItems.length
          ? 'completed'
          : 'running'
      ),
      title: `${completed}/${normalizedItems.length}`,
    };
  }
  if (type === 'web_search') {
    return {
      ...source,
      name: 'web_search',
      input: {
        query: source.query,
        ...(source.action !== undefined ? { action: source.action } : {}),
      },
      ...(Array.isArray(source.results) ? { output: source.results } : {}),
      status: source.status ?? 'completed',
    };
  }
  if (type === 'sleep') {
    return {
      ...source,
      name: 'sleep',
      arguments: { durationMs: source.durationMs },
      status: source.status ?? 'completed',
    };
  }
  if (type === 'sub_agent_activity') {
    const activityKind = normalizeToolCallName(readNonEmptyString(source.kind));
    return {
      ...source,
      name: activityKind ? `subagent_${activityKind}` : 'subagent_activity',
      type: 'agent',
      arguments: {
        kind: activityKind,
        agentThreadId: source.agentThreadId,
        agentPath: source.agentPath,
      },
      target: source.agentPath ?? source.agentThreadId,
      status: activityKind === 'interrupted'
        ? 'cancelled'
        : activityKind === 'started'
          ? 'running'
          : source.status,
    };
  }
  if (type === 'tool_search_call') {
    return {
      ...source,
      name: 'tool_search',
      input: source.arguments,
      title: source.execution,
    };
  }
  if (type === 'web_search_call') {
    return {
      ...source,
      name: 'web_search',
      input: source.action,
    };
  }
  if (type === 'function_call_output' || type === 'custom_tool_call_output') {
    return {
      ...source,
      name: readNonEmptyString(source.name) || 'tool',
      output: source.output,
      status: 'completed',
    };
  }
  if (type === 'tool_search_output') {
    return {
      ...source,
      name: 'tool_search',
      output: source.tools,
    };
  }
  if (type === 'image_generation_call') {
    const result = readNonEmptyString(source.result);
    const imageSource = /^(?:blob:|data:|https?:)/iu.test(result)
      ? result
      : result
        ? `data:image/png;base64,${result}`
        : '';
    return {
      ...source,
      name: 'image_generation',
      input: source.revised_prompt,
      ...(imageSource
        ? {
            resultBlocks: [{
              type: 'image',
              source: imageSource,
              mimeType: 'image/png',
            }],
          }
        : {}),
    };
  }
  if (type === 'dynamic_tool_call') {
    return {
      ...source,
      name: readNonEmptyString(source.tool) || 'tool',
      output: source.contentItems ?? source.content_items,
      status: source.success === false ? 'failed' : source.status,
    };
  }
  if (type === 'image_view') {
    const path = readNonEmptyString(source.path);
    return {
      ...source,
      name: 'view_image',
      arguments: { path },
      target: path,
      ...(path ? { resultBlocks: [{ type: 'image', source: path }] } : {}),
      status: source.status ?? 'completed',
    };
  }
  if (type === 'image_generation') {
    const result = readNonEmptyString(source.result);
    const imageSource = /^(?:blob:|data:|https?:)/iu.test(result)
      ? result
      : result
        ? `data:image/png;base64,${result}`
        : '';
    return {
      ...source,
      name: 'image_generation',
      arguments: {
        prompt: source.revisedPrompt ?? source.revised_prompt,
        savedPath: source.savedPath ?? source.saved_path,
      },
      target: source.savedPath ?? source.saved_path,
      ...(imageSource
        ? {
            resultBlocks: [{
              type: 'image',
              source: imageSource,
              mimeType: 'image/png',
            }],
          }
        : {}),
    };
  }
  if (type === 'collab_agent_tool_call') {
    const receiverThreadIds = Array.isArray(source.receiverThreadIds)
      ? source.receiverThreadIds.filter((value): value is string => typeof value === 'string')
      : [];
    return {
      ...source,
      name: readNonEmptyString(source.tool) || 'agent',
      arguments: {
        senderThreadId: source.senderThreadId,
        receiverThreadIds,
        prompt: source.prompt,
        model: source.model,
        reasoningEffort: source.reasoningEffort,
      },
      title: receiverThreadIds.length > 0
        ? `${receiverThreadIds.length} agent${receiverThreadIds.length === 1 ? '' : 's'}`
        : undefined,
    };
  }

  return item || [
    'custom_tool_call',
    'function_call',
    'mcp_tool_call',
  ].includes(type)
    ? source
    : null;
}

function adaptOpenCodeToolRecord(record: Record<string, unknown>): Record<string, unknown> | null {
  const part = readToolCallRecord(record.part);
  const recordType = normalizeToolCallName(readNonEmptyString(record.type));
  if (!part && !['subtask', 'tool'].includes(recordType)) {
    return null;
  }

  const source = part ? { ...record, ...part } : { ...record };
  const type = normalizeToolCallName(readNonEmptyString(source.type));
  const state = readToolCallRecord(source.state);
  const stateMetadata = readToolCallRecord(state?.metadata);
  if (stateMetadata?.interrupted === true) {
    source.status = 'cancelled';
  }
  if (type === 'subtask') {
    return {
      ...source,
      name: readNonEmptyString(source.agent) || 'subtask',
      input: {
        prompt: source.prompt,
        description: source.description,
        model: source.model,
        command: source.command,
      },
      title: source.description,
    };
  }

  return source;
}

function adaptClaudeToolRecord(record: Record<string, unknown>): Record<string, unknown> | null {
  const contentBlock = readToolCallRecord(record.contentBlock)
    ?? readToolCallRecord(record.content_block);
  const source = contentBlock ? { ...record, ...contentBlock } : record;
  const type = normalizeToolCallName(readNonEmptyString(source.type));
  const subtype = normalizeToolCallName(readNonEmptyString(source.subtype));
  if (
    type === 'system'
    && ['task_notification', 'task_progress', 'task_started', 'task_updated'].includes(subtype)
  ) {
    if (source.skip_transcript === true) {
      return null;
    }
    const usage = readToolCallRecord(source.usage);
    const patch = readToolCallRecord(source.patch);
    const rawStatus = subtype === 'task_started' || subtype === 'task_progress'
      ? 'running'
      : normalizeToolCallName(
          readNonEmptyString(source.status) || readNonEmptyString(patch?.status),
        );
    const status = rawStatus === 'stopped' || rawStatus === 'killed'
      ? 'cancelled'
      : rawStatus === 'paused'
        ? 'waiting'
        : rawStatus;
    return {
      ...source,
      id: source.task_id ?? source.tool_use_id ?? source.id,
      tool_call_id: source.task_id ?? source.tool_use_id ?? source.id,
      name: 'task',
      type: 'agent',
      arguments: {
        description: source.description,
        outputFile: source.output_file,
        prompt: source.prompt,
        taskId: source.task_id,
        taskType: source.task_type,
        workflowName: source.workflow_name,
        ...(patch ? { patch } : {}),
      },
      output: source.summary ?? patch?.error,
      title: source.description ?? patch?.description ?? source.summary,
      durationMs: usage?.duration_ms,
      status,
    };
  }
  if (type === 'system' && subtype === 'permission_denied') {
    return {
      ...source,
      id: source.tool_use_id ?? source.id,
      name: readNonEmptyString(source.tool_name) || 'tool',
      type: 'permission_denied',
      arguments: {
        agentId: source.agent_id,
        decisionReasonType: source.decision_reason_type,
        decisionReason: source.decision_reason,
      },
      output: source.message,
      title: source.decision_reason,
      status: 'cancelled',
    };
  }
  const resultToolNameByType: Readonly<Record<string, string>> = {
    advisor_tool_result: 'advisor',
    bash_code_execution_tool_result: 'code_execution',
    code_execution_tool_result: 'code_execution',
    mcp_tool_result: 'mcp_tool',
    text_editor_code_execution_tool_result: 'code_execution',
    tool_search_tool_result: 'tool_search',
    web_fetch_tool_result: 'web_fetch',
    web_search_tool_result: 'web_search',
  };
  if (type === 'tool_result' || type in resultToolNameByType) {
    return {
      ...source,
      id: source.tool_use_id ?? source.id,
      name: readNonEmptyString(source.name) || resultToolNameByType[type] || 'tool',
      output: source.output ?? source.content,
      status: source.status ?? (
        hasStructuredChatMessageToolError(source)
          ? 'error'
          : 'completed'
      ),
    };
  }

  return contentBlock || [
    'mcp_tool_use',
    'server_tool_use',
    'tool_progress',
    'tool_use',
  ].includes(type)
    ? source
    : null;
}

function boundGeminiToolDisplayText(
  value: unknown,
  maxCharacters: number,
  options: { oneLine?: boolean; tailCharacters?: number } = {},
): string {
  if (typeof value !== 'string') {
    return '';
  }
  const source = options.oneLine
    ? value.replace(/\s+/gu, ' ').trim()
    : value.trim();
  if (!source || source.length <= maxCharacters) {
    return source;
  }
  const separator = GEMINI_TOOL_DISPLAY_TRUNCATION_SEPARATOR;
  const tailCharacters = Math.min(
    Math.max(0, options.tailCharacters ?? 0),
    Math.floor((maxCharacters - separator.length) / 2),
  );
  if (tailCharacters <= 0) {
    return `${source.slice(0, Math.max(0, maxCharacters - 3))}...`;
  }
  const headCharacters = maxCharacters - separator.length - tailCharacters;
  return `${source.slice(0, headCharacters)}${separator}${source.slice(-tailCharacters)}`;
}

function readGeminiToolDisplayContainer(
  record: Record<string, unknown> | null,
): Record<string, unknown> | null {
  return readToolCallRecord(record?.display)
    ?? readToolCallRecord(record?.toolDisplay)
    ?? readToolCallRecord(record?.tool_display);
}

function mergeGeminiToolDisplay(
  ...containers: Array<Record<string, unknown> | null>
): NormalizedGeminiToolDisplay | null {
  const merged: NormalizedGeminiToolDisplay = {};
  let hasDisplay = false;
  for (const container of containers) {
    const display = readGeminiToolDisplayContainer(container);
    if (!display) {
      continue;
    }
    hasDisplay = true;
    if ('name' in display) merged.name = display.name;
    if ('description' in display) merged.description = display.description;
    if ('format' in display) merged.format = display.format;
    if ('result' in display) merged.result = display.result;
    if ('resultSummary' in display) merged.resultSummary = display.resultSummary;
    if ('result_summary' in display) merged.resultSummary = display.result_summary;
  }
  return hasDisplay ? merged : null;
}

function readGeminiToolDisplayContext(
  record: Record<string, unknown>,
): GeminiToolDisplayContext | null {
  const value = readToolCallRecord(record.value);
  const request = readToolCallRecord(record.request) ?? readToolCallRecord(value?.request);
  const response = readToolCallRecord(record.response) ?? readToolCallRecord(value?.response);
  const display = mergeGeminiToolDisplay(request, value, record, response);
  if (!display) {
    return null;
  }
  const payload = value ?? record;
  const eventType = normalizeToolCallName(
    readNonEmptyString(record.type) || readNonEmptyString(payload.type),
  );
  const callId = readFirstString(response, ['requestId', 'request_id', 'callId', 'call_id', 'id'])
    || readFirstString(request, ['requestId', 'request_id', 'callId', 'call_id', 'id'])
    || readFirstString(payload, ['requestId', 'request_id', 'callId', 'call_id', 'id'])
    || readFirstString(record, ['requestId', 'request_id', 'callId', 'call_id', 'id']);
  const toolName = readFirstString(response, ['name', 'toolName', 'tool_name'])
    || readFirstString(request, ['name', 'toolName', 'tool_name'])
    || readFirstString(payload, ['name', 'toolName', 'tool_name'])
    || readFirstString(record, ['name', 'toolName', 'tool_name']);
  const explicitStatus = readFirstString(record, ['status'])
    || readFirstString(payload, ['status'])
    || readFirstString(response, ['status']);
  const isError = response?.isError === true
    || response?.is_error === true
    || payload.isError === true
    || payload.is_error === true
    || record.isError === true
    || record.is_error === true
    || hasChatMessageToolErrorValue(response?.error)
    || hasChatMessageToolErrorValue(payload.error)
    || hasChatMessageToolErrorValue(record.error);

  return {
    argumentsValue: request?.args
      ?? request?.arguments
      ?? payload.args
      ?? payload.arguments
      ?? payload.parameters
      ?? record.args
      ?? record.arguments,
    callId,
    display,
    eventType,
    explicitStatus,
    isError,
    toolName,
  };
}

function readGeminiToolDisplayFormat(display: NormalizedGeminiToolDisplay): GeminiToolDisplayFormat {
  const format = normalizeToolCallName(readNonEmptyString(display.format));
  return GEMINI_TOOL_DISPLAY_FORMATS.has(format)
    ? format as GeminiToolDisplayFormat
    : 'auto';
}

function readGeminiToolDisplayAnsi(value: unknown): string {
  if (!Array.isArray(value)) {
    return '';
  }
  const lines: string[] = [];
  for (const line of value) {
    if (!Array.isArray(line)) {
      return '';
    }
    const text = line.map((token) => {
      const tokenRecord = readToolCallRecord(token);
      return typeof tokenRecord?.text === 'string' ? tokenRecord.text : '';
    }).join('');
    lines.push(text);
  }
  return lines.join('\n');
}

function buildGeminiToolDisplayDiff(result: Record<string, unknown>): string {
  const path = boundGeminiToolDisplayText(
    readFirstString(result, ['path']),
    512,
    { oneLine: true },
  ) || 'file';
  const beforeText = boundGeminiToolDisplayText(
    result.beforeText ?? result.before_text,
    10_000,
    { tailCharacters: 2_000 },
  );
  const afterText = boundGeminiToolDisplayText(
    result.afterText ?? result.after_text,
    10_000,
    { tailCharacters: 2_000 },
  );
  if (!beforeText && !afterText) {
    return '';
  }
  const deletedLines = beforeText.split(/\r?\n/gu).map((line) => `-${line}`);
  const addedLines = afterText.split(/\r?\n/gu).map((line) => `+${line}`);
  return boundGeminiToolDisplayText(
    [`--- ${path}`, `+++ ${path}`, ...deletedLines, ...addedLines].join('\n'),
    MAX_GEMINI_TOOL_DISPLAY_RESULT_CHARACTERS,
    { tailCharacters: 6_000 },
  );
}

function projectGeminiToolDisplayResult(
  display: NormalizedGeminiToolDisplay,
  isError: boolean,
): GeminiToolDisplayResultProjection {
  const summary = boundGeminiToolDisplayText(
    display.resultSummary,
    MAX_GEMINI_TOOL_DISPLAY_SUMMARY_CHARACTERS,
    { oneLine: true },
  );
  const result = readToolCallRecord(display.result);
  const resultType = normalizeToolCallName(readNonEmptyString(result?.type));
  let resultText = '';
  let resultBlock: ChatMessageToolResultBlock | null = null;
  let semanticType: 'agent' | undefined;

  if (typeof display.result === 'string') {
    resultText = boundGeminiToolDisplayText(
      display.result,
      MAX_GEMINI_TOOL_DISPLAY_RESULT_CHARACTERS,
      { tailCharacters: 6_000 },
    );
  } else if (resultType === 'text') {
    resultText = boundGeminiToolDisplayText(
      result?.text,
      MAX_GEMINI_TOOL_DISPLAY_RESULT_CHARACTERS,
      { tailCharacters: 6_000 },
    );
  } else if (resultType === 'diff' && result) {
    resultText = buildGeminiToolDisplayDiff(result);
    if (resultText) {
      const path = boundGeminiToolDisplayText(result.path, 512, { oneLine: true });
      resultBlock = { type: 'diff', content: resultText, ...(path ? { path } : {}) };
    }
  } else if (resultType === 'terminal' && result) {
    const ansiText = readGeminiToolDisplayAnsi(result.ansi);
    const terminalMetadata = [
      readNonEmptyString(result.pid) ? `PID: ${readNonEmptyString(result.pid)}` : '',
      typeof result.exitCode === 'number' && Number.isFinite(result.exitCode)
        ? `Exit code: ${result.exitCode}`
        : typeof result.exit_code === 'number' && Number.isFinite(result.exit_code)
          ? `Exit code: ${result.exit_code}`
          : '',
    ].filter(Boolean).join('\n');
    resultText = boundGeminiToolDisplayText(
      [ansiText, terminalMetadata].filter(Boolean).join('\n'),
      MAX_GEMINI_TOOL_DISPLAY_RESULT_CHARACTERS,
      { tailCharacters: 6_000 },
    );
  } else if (resultType === 'agent' && result) {
    const threadId = boundGeminiToolDisplayText(
      readFirstString(result, ['threadId', 'thread_id']),
      512,
      { oneLine: true },
    );
    resultText = threadId ? `Subagent: ${threadId}` : '';
    semanticType = 'agent';
  }

  if (!resultBlock && resultText) {
    resultBlock = isError
      ? { type: 'error', message: resultText }
      : { type: 'text', text: resultText };
  }
  const blocks: ChatMessageToolResultBlock[] = [];
  if (resultBlock) {
    blocks.push(resultBlock);
  }
  if (summary && summary !== resultText) {
    blocks.push(isError && blocks.length === 0
      ? { type: 'error', message: summary }
      : { type: 'text', text: summary });
  }
  return {
    blocks,
    ...(semanticType ? { semanticType } : {}),
    text: boundGeminiToolDisplayText(
      [resultText, summary].filter(Boolean).join('\n\n'),
      MAX_GEMINI_TOOL_DISPLAY_RESULT_CHARACTERS,
      { tailCharacters: 6_000 },
    ),
  };
}

function resolveGeminiToolDisplayStatus(context: GeminiToolDisplayContext): string {
  if (context.explicitStatus) {
    return context.explicitStatus;
  }
  if (context.isError) {
    return 'error';
  }
  if (['tool_response', 'tool_call_response'].includes(context.eventType)) {
    return 'completed';
  }
  if (['tool_update'].includes(context.eventType)) {
    return 'running';
  }
  return 'pending';
}

function adaptGeminiToolDisplayRecord(
  context: GeminiToolDisplayContext,
): Record<string, unknown> {
  const format = readGeminiToolDisplayFormat(context.display);
  if (format === 'hidden') {
    return { type: 'tool_display_hidden' };
  }
  if (format === 'notice') {
    return { type: 'tool_display_notice' };
  }
  const displayName = boundGeminiToolDisplayText(
    context.display.name,
    MAX_GEMINI_TOOL_DISPLAY_NAME_CHARACTERS,
    { oneLine: true },
  );
  const description = boundGeminiToolDisplayText(
    context.display.description,
    MAX_GEMINI_TOOL_DISPLAY_DESCRIPTION_CHARACTERS,
    { tailCharacters: 200 },
  );
  const result = projectGeminiToolDisplayResult(context.display, context.isError);
  return {
    id: context.callId,
    name: displayName || context.toolName || 'tool',
    ...(displayName && context.toolName ? { semanticName: context.toolName } : {}),
    ...(context.argumentsValue !== undefined ? { arguments: context.argumentsValue } : {}),
    ...(description ? { title: description } : {}),
    ...(result.text ? { output: result.text } : {}),
    ...(result.blocks.length > 0 ? { resultBlocks: result.blocks } : {}),
    status: resolveGeminiToolDisplayStatus(context),
    type: result.semanticType || context.eventType || 'tool',
  };
}

function adaptGeminiToolRecord(record: Record<string, unknown>): Record<string, unknown> | null {
  const toolDisplayContext = readGeminiToolDisplayContext(record);
  if (toolDisplayContext) {
    return adaptGeminiToolDisplayRecord(toolDisplayContext);
  }
  const value = readToolCallRecord(record.value);
  const type = normalizeToolCallName(readNonEmptyString(record.type));
  if (type === 'tool_use') {
    return {
      ...record,
      id: record.tool_id ?? record.id,
      name: readNonEmptyString(record.tool_name) || 'tool',
      arguments: record.parameters,
      status: record.status ?? 'pending',
    };
  }
  if (type === 'tool_result') {
    const error = hasChatMessageToolErrorValue(record.error) ? record.error : undefined;
    return {
      ...record,
      id: record.tool_id ?? record.id,
      name: readNonEmptyString(record.tool_name) || 'tool',
      ...(error !== undefined ? { error } : {}),
      output: record.output,
      status: record.status ?? (error !== undefined ? 'error' : 'completed'),
    };
  }
  const functionCall = readToolCallRecord(record.functionCall)
    ?? readToolCallRecord(value?.functionCall);
  if (functionCall) {
    return {
      ...record,
      ...functionCall,
      id: functionCall.id ?? record.id,
      arguments: functionCall.args,
      status: record.status ?? 'pending',
      type: 'function_call',
    };
  }

  const functionResponse = readToolCallRecord(record.functionResponse)
    ?? readToolCallRecord(value?.functionResponse);
  if (functionResponse) {
    const response = functionResponse.response;
    const responseRecord = readToolCallRecord(response);
    const responseError = responseRecord?.error;
    const responsePayload = responseRecord
      ? responseRecord.output
        ?? responseRecord.content
        ?? responseRecord.result
        ?? responseRecord.data
        ?? (Object.keys(responseRecord).some((key) => !['error', 'status'].includes(key))
          ? response
          : undefined)
      : response;
    const responseParts = Array.isArray(functionResponse.parts) ? functionResponse.parts : [];
    const output = responseParts.length > 0
      ? [responsePayload, ...responseParts].filter((part) => part !== undefined)
      : responsePayload;
    return {
      ...record,
      ...functionResponse,
      id: functionResponse.id ?? record.id,
      ...(hasChatMessageToolErrorValue(responseError) ? { error: responseError } : {}),
      output,
      status: hasChatMessageToolErrorValue(responseError) ? 'error' : 'completed',
      type: 'function_call_output',
    };
  }

  const request = readToolCallRecord(record.request);
  const response = readToolCallRecord(record.response);
  const directCallId = readNonEmptyString(request?.callId)
    || readNonEmptyString(record.callId)
    || readNonEmptyString(record.id);
  const directName = readNonEmptyString(request?.name)
    || readNonEmptyString(record.name);
  const isCoreToolCall = Boolean(request && directCallId && directName);
  const isDisplayToolCall = Boolean(
    directCallId
    && directName
    && (
      'resultDisplay' in record
      || 'confirmationDetails' in record
      || 'progressMessage' in record
      || 'subagentHistory' in record
    )
  );
  if (isCoreToolCall || isDisplayToolCall) {
    const responseError = response?.error ?? record.error;
    const output = record.resultDisplay
      ?? record.liveOutput
      ?? response?.resultDisplay
      ?? response?.responseParts
      ?? response?.data
      ?? record.progressMessage
      ?? record.subagentHistory
      ?? record.outputFile
      ?? response?.outputFile;
    return {
      ...record,
      id: directCallId,
      name: directName,
      arguments: request?.args ?? record.args,
      ...(hasChatMessageToolErrorValue(responseError) ? { error: responseError } : {}),
      ...(output !== undefined ? { output } : {}),
      type: readNonEmptyString(record.type) || 'tool',
    };
  }

  if (type === 'tool_call_request' && value) {
    return {
      ...record,
      ...value,
      id: value.callId ?? value.id,
      arguments: value.args,
      status: value.status ?? 'pending',
    };
  }
  if (type === 'tool_call_response' && value) {
    const responseParts = Array.isArray(value.responseParts) ? value.responseParts : [];
    const functionResponse = responseParts
      .map((part) => readToolCallRecord(readToolCallRecord(part)?.functionResponse))
      .find((part): part is Record<string, unknown> => Boolean(part));
    const functionResponsePayload = readToolCallRecord(functionResponse?.response);
    const nestedError = functionResponsePayload?.error;
    const rawStatus = normalizeToolCallName(
      readNonEmptyString(value.status) || readNonEmptyString(record.status),
    );
    const isCancelled = ['aborted', 'canceled', 'cancelled'].includes(rawStatus)
      || hasToolCancellationDetail(value.error)
      || hasToolCancellationDetail(nestedError)
      || hasToolCancellationDetail(value.resultDisplay);
    const hasError = hasChatMessageToolErrorValue(value.error)
      || hasStructuredChatMessageToolError(responseParts);
    return {
      ...record,
      ...value,
      id: value.callId ?? functionResponse?.id ?? value.id,
      name: readNonEmptyString(value.name)
        || readNonEmptyString(functionResponse?.name)
        || 'tool',
      output: value.resultDisplay
        ?? (responseParts.length > 0 ? responseParts : undefined)
        ?? value.data
        ?? value.error,
      status: isCancelled ? 'cancelled' : hasError ? 'error' : 'completed',
    };
  }
  if (type === 'tool_call_confirmation' && value) {
    const request = readToolCallRecord(value.request);
    const details = readToolCallRecord(value.details);
    const target = readFirstString(details, ['filePath', 'file_path', 'fileName', 'filename']);
    const fileDiff = readFirstString(details, ['fileDiff', 'file_diff']);
    return {
      ...record,
      ...value,
      id: request?.callId ?? value.callId ?? value.id,
      name: readNonEmptyString(request?.name) || 'approval',
      arguments: {
        request: request?.args,
        details: value.details,
      },
      title: readNonEmptyString(details?.title),
      target,
      ...(fileDiff
        ? {
            resultBlocks: [{
              type: 'diff',
              content: fileDiff,
              ...(target ? { path: target } : {}),
            }],
          }
        : {}),
      status: 'awaiting_approval',
      type: 'approval_request',
    };
  }

  return null;
}

const CHAT_MESSAGE_TOOL_PROTOCOL_ADAPTERS: readonly ChatMessageToolProtocolAdapter[] = [
  {
    id: 'opencode.part',
    engineIds: ['opencode'],
    adapt: adaptOpenCodeToolRecord,
  },
  {
    id: 'codex.item',
    engineIds: ['codex'],
    adapt: adaptCodexToolRecord,
  },
  {
    id: 'claude.content-block',
    engineIds: ['claude-code'],
    adapt: adaptClaudeToolRecord,
  },
  {
    id: 'gemini.event',
    engineIds: ['gemini'],
    adapt: adaptGeminiToolRecord,
  },
  {
    id: 'openai.function',
    engineIds: ['codex'],
    adapt(record) {
      return readToolCallRecord(record.function) ? record : null;
    },
  },
  {
    id: 'canonical',
    engineIds: [],
    adapt(record) {
      return record;
    },
  },
];

function resolveCompatibleToolCallRecord(
  record: Record<string, unknown>,
  engineId?: string,
): Record<string, unknown> {
  const normalizedEngineId = engineId?.trim().toLowerCase() ?? '';
  const preferredAdapters = normalizedEngineId
    ? CHAT_MESSAGE_TOOL_PROTOCOL_ADAPTERS.filter((adapter) =>
        adapter.engineIds.includes(normalizedEngineId),
      )
    : [];
  const remainingAdapters = CHAT_MESSAGE_TOOL_PROTOCOL_ADAPTERS.filter(
    (adapter) => !preferredAdapters.includes(adapter),
  );

  for (const adapter of [...preferredAdapters, ...remainingAdapters]) {
    const adaptedRecord = adapter.adapt(record);
    if (adaptedRecord) {
      return adaptedRecord;
    }
  }

  return record;
}

const NON_TOOL_PROTOCOL_TYPES = new Set([
  'chat_compressed',
  'compaction',
  'content',
  'message',
  'reasoning',
  'retry',
  'step_finish',
  'step_start',
  'thinking',
  'thought',
  'tool_display_hidden',
  'tool_display_notice',
  'tool_use_summary',
]);

function shouldIgnoreToolProtocolRecord(record: Record<string, unknown>): boolean {
  return NON_TOOL_PROTOCOL_TYPES.has(
    normalizeToolCallName(readNonEmptyString(record.type)),
  );
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

function readFirstString(
  record: Record<string, unknown> | null,
  keys: readonly string[],
): string {
  for (const key of keys) {
    const value = readNonEmptyString(record?.[key]);
    if (value) {
      return value;
    }
  }

  return '';
}

function resolveToolCallName(record: Record<string, unknown>): string | null {
  const directName = readNonEmptyString(record.name)
    || readNonEmptyString(record.toolName)
    || readNonEmptyString(record.tool_name)
    || readNonEmptyString(record.tool);
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

  if ('args' in record) {
    return formatToolCallArguments(record.args);
  }

  const stateRecord = readToolCallRecord(record.state);
  if (stateRecord && 'input' in stateRecord) {
    return formatToolCallArguments(stateRecord.input);
  }

  const functionRecord = readToolCallFunction(record);
  if (!functionRecord) {
    return '';
  }

  return formatToolCallArguments(functionRecord.arguments);
}

function resolveToolCallId(
  record: Record<string, unknown>,
  index: number,
  fallbackIdPrefix?: string,
): string {
  const isClaudeTaskLifecycle = normalizeToolCallName(readNonEmptyString(record.type)) === 'agent'
    && normalizeToolCallName(readNonEmptyString(record.name)) === 'task';
  if (isClaudeTaskLifecycle) {
    const taskId = readNonEmptyString(record.task_id)
      || readNonEmptyString(record.taskId);
    if (taskId) {
      return taskId;
    }
  }

  return readNonEmptyString(record.tool_call_id)
    || readNonEmptyString(record.toolCallId)
    || readNonEmptyString(record.tool_id)
    || readNonEmptyString(record.call_id)
    || readNonEmptyString(record.callID)
    || readNonEmptyString(record.callId)
    || readNonEmptyString(record.tool_use_id)
    || readNonEmptyString(record.toolUseId)
    || readNonEmptyString(record.id)
    || `${fallbackIdPrefix?.trim() || 'tool-call'}-${index + 1}`;
}

function resolveToolCallType(record: Record<string, unknown>): string {
  return readNonEmptyString(record.type) || 'function';
}

function normalizeToolCallName(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .toLowerCase()
    .replace(/[.\s-]+/g, '_');
}

export function isChatMessageFileMutationToolCall(
  call: Pick<ChatMessageToolCall, 'kind' | 'name' | 'type'>,
): boolean {
  if (call.kind !== 'file') {
    return false;
  }

  const normalizedName = normalizeToolCallName(call.name);
  const normalizedType = normalizeToolCallName(call.type);
  return FILE_MUTATION_TOOL_NAMES.has(normalizedName)
    || ['file_change', 'patch'].includes(normalizedType);
}

function readFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return value;
}

function formatCommandPart(value: string): string {
  return /\s|"/u.test(value) ? JSON.stringify(value) : value;
}

function readCommandValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
      .map(formatCommandPart)
      .join(' ')
      .trim();
  }

  return '';
}

function parseArgumentsRecord(argumentsText: string): Record<string, unknown> | null {
  if (!argumentsText.trim()) {
    return null;
  }

  try {
    return readToolCallRecord(JSON.parse(argumentsText));
  } catch {
    return null;
  }
}

function resolveMcpIdentity(
  record: Record<string, unknown>,
  name: string,
): { serverName?: string; toolName: string } {
  const serverName = readFirstString(record, [
    'server',
    'serverName',
    'server_name',
    'mcpServer',
    'mcp_server',
  ]);
  const explicitToolName = readFirstString(record, ['tool', 'toolName', 'tool_name']);
  const semanticName = readFirstString(record, ['semanticName', 'semantic_name']);
  const mcpIdentityName = semanticName || name;
  const mcpNameMatch = /^mcp__(.+?)__(.+)$/iu.exec(mcpIdentityName)
    ?? /^mcp[.:/](.+?)[.:/](.+)$/iu.exec(mcpIdentityName);

  return {
    ...(serverName || mcpNameMatch?.[1]
      ? { serverName: serverName || mcpNameMatch?.[1] }
      : {}),
    toolName: explicitToolName || (semanticName ? name : mcpNameMatch?.[2]) || name,
  };
}

function resolveToolCallKind(
  record: Record<string, unknown>,
  name: string,
  type: string,
): BirdCoderChatMessageToolCallKind {
  const normalizedName = normalizeToolCallName(name);
  const normalizedSemanticName = normalizeToolCallName(
    readFirstString(record, ['semanticName', 'semantic_name']),
  );
  const normalizedNames = [normalizedName, normalizedSemanticName].filter(Boolean);
  const normalizedType = normalizeToolCallName(type);
  if (['approval_request', 'tool_call_confirmation'].includes(normalizedType)) {
    return 'approval';
  }
  const resultDisplay = readToolCallRecord(record.resultDisplay);
  if (
    normalizedType === 'collab_agent_tool_call'
    || normalizeToolCallName(readFirstString(record, ['kind', 'toolKind', 'tool_kind'])) === 'agent'
    || record.isSubagentProgress === true
    || resultDisplay?.isSubagentProgress === true
    || Array.isArray(record.subagentHistory)
  ) {
    return 'agent';
  }
  if (
    normalizedType.includes('mcp')
    || normalizedNames.some((candidate) => candidate.startsWith('mcp__'))
    || normalizedNames.some((candidate) => candidate.startsWith('mcp_'))
    || readFirstString(record, ['server', 'serverName', 'server_name', 'mcpServer'])
  ) {
    return 'mcp';
  }
  if (normalizedNames.some((candidate) => COMMAND_TOOL_NAMES.has(candidate)) || normalizedType === 'command_execution') {
    return 'command';
  }
  if (normalizedNames.some((candidate) => FILE_TOOL_NAMES.has(candidate)) || normalizedType === 'file_change') {
    return 'file';
  }
  if (normalizedNames.some((candidate) => SEARCH_TOOL_NAMES.has(candidate))) {
    return 'search';
  }
  if (
    normalizedNames.some((candidate) => WEB_TOOL_NAMES.has(candidate))
    || normalizedNames.some((candidate) => candidate.startsWith('web_'))
    || normalizedNames.some((candidate) => candidate.includes('fetch_url'))
  ) {
    return 'web';
  }
  if (normalizedNames.some((candidate) => AGENT_TOOL_NAMES.has(candidate)) || ['agent', 'subtask'].includes(normalizedType)) {
    return 'agent';
  }
  if (normalizedNames.some((candidate) => SKILL_TOOL_NAMES.has(candidate))) {
    return 'skill';
  }
  if (normalizedNames.some((candidate) => MEDIA_TOOL_NAMES.has(candidate)) || normalizedType === 'image_generation_call') {
    return 'media';
  }
  if (normalizedNames.some((candidate) => TASK_TOOL_NAMES.has(candidate))) {
    return 'task';
  }
  if (normalizedNames.some((candidate) => APPROVAL_TOOL_NAMES.has(candidate))) {
    return 'approval';
  }
  if (normalizedNames.some((candidate) => QUESTION_TOOL_NAMES.has(candidate))) {
    return 'question';
  }

  return 'other';
}

function resolveToolCallStatus(record: Record<string, unknown>): BirdCoderChatMessageToolCallStatus | undefined {
  const stateRecord = readToolCallRecord(record.state);
  const stateMetadata = readToolCallRecord(stateRecord?.metadata);
  const rawStatus = readNonEmptyString(record.status)
    || readNonEmptyString(record.phase)
    || readNonEmptyString(stateRecord?.status)
    || readNonEmptyString(stateRecord?.phase);
  const status = normalizeToolCallName(rawStatus);
  if (normalizeToolCallName(readNonEmptyString(record.type)) === 'tool_progress') {
    return 'running';
  }
  if (stateMetadata?.interrupted === true || record.interrupted === true) {
    return 'cancelled';
  }
  if (
    ['aborted', 'cancelled', 'canceled', 'declined', 'rejected', 'stopped', 'terminated']
      .includes(status)
  ) {
    return 'cancelled';
  }
  if (
    hasToolCancellationDetail(record.error)
    || hasToolCancellationDetail(stateRecord?.error)
    || hasToolCancellationDetail(record.output)
    || hasToolCancellationDetail(stateRecord?.output)
    || hasToolCancellationDetail(record.resultDisplay)
  ) {
    return 'cancelled';
  }
  const progressRecord = [
    record.resultDisplay,
    record.liveOutput,
    record.output,
    stateRecord?.output,
  ].map(readToolCallRecord).find((candidate) => candidate?.isSubagentProgress === true);
  if (progressRecord) {
    const progressState = normalizeToolCallName(readNonEmptyString(progressRecord.state));
    if (['aborted', 'cancelled', 'canceled', 'stopped'].includes(progressState)) {
      return 'cancelled';
    }
    if (['error', 'errored', 'failed'].includes(progressState)) {
      return 'error';
    }
    if (['completed', 'done', 'success'].includes(progressState)) {
      return 'success';
    }
    if (['pending', 'running', 'scheduled'].includes(progressState)) {
      return progressState === 'running' ? 'running' : 'pending';
    }
  }
  if (
    record.success === false
    || hasStructuredChatMessageToolError(record)
    || hasChatMessageToolErrorValue(stateRecord?.error)
    || hasStructuredChatMessageToolError(
      record.result ?? record.output ?? stateRecord?.result ?? stateRecord?.output,
    )
    || ['error', 'failed', 'failure'].includes(status)
  ) {
    return 'error';
  }
  if (['completed', 'complete', 'done', 'success', 'succeeded'].includes(status)) {
    return 'success';
  }
  if (['executing', 'running', 'in_progress', 'streaming', 'started'].includes(status)) {
    return 'running';
  }
  if (['awaiting_approval', 'awaiting_user', 'waiting'].includes(status)) {
    return 'waiting';
  }
  if (['pending', 'queued', 'scheduled', 'validating'].includes(status)) {
    return 'pending';
  }

  return undefined;
}

function resolveToolCallTitle(record: Record<string, unknown>): string {
  const stateRecord = readToolCallRecord(record.state);
  return readFirstString(record, ['title', 'description', 'execution'])
    || readFirstString(stateRecord, ['title', 'description']);
}

function resolveToolCallDurationMs(record: Record<string, unknown>): number | undefined {
  const stateRecord = readToolCallRecord(record.state);
  const timeRecord = readToolCallRecord(stateRecord?.time) ?? readToolCallRecord(record.time);
  const start = readFiniteNumber(timeRecord?.start);
  const end = readFiniteNumber(timeRecord?.end);
  if (start !== undefined && end !== undefined && end >= start) {
    return end - start;
  }

  const explicitDuration = readFiniteNumber(record.durationMs)
    ?? readFiniteNumber(record.duration_ms);
  if (explicitDuration !== undefined && explicitDuration >= 0) {
    return explicitDuration;
  }

  const elapsedSeconds = readFiniteNumber(record.elapsed_time_seconds);
  return elapsedSeconds !== undefined && elapsedSeconds >= 0
    ? elapsedSeconds * 1000
    : undefined;
}

function resolveSemanticArgument(
  argumentsRecord: Record<string, unknown> | null,
  keys: readonly string[],
): string {
  return readFirstString(argumentsRecord, keys);
}

export function projectChatMessageToolCall(
  value: unknown,
  index: number,
  options: ProjectChatMessageToolCallOptions = {},
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
      kind: 'other',
    };
  }

  const sourceRecord = readToolCallRecord(value);
  if (!sourceRecord) {
    return null;
  }
  const record = resolveCompatibleToolCallRecord(sourceRecord, options.engineId);
  if (shouldIgnoreToolProtocolRecord(record)) {
    return null;
  }

  const name = resolveToolCallName(record);
  const argumentsText = resolveToolCallArguments(record);
  if (!name && !argumentsText) {
    return null;
  }

  const type = resolveToolCallType(record);
  const kind = resolveToolCallKind(record, name ?? 'tool', type);
  const mcpIdentity = kind === 'mcp'
    ? resolveMcpIdentity(record, name ?? 'tool')
    : null;
  const normalizedName = mcpIdentity?.toolName ?? name ?? 'tool';
  const argumentsRecord = parseArgumentsRecord(argumentsText);
  const command = kind === 'command'
    ? resolveSemanticArgument(argumentsRecord, COMMAND_ARGUMENT_KEYS)
      || readFirstString(record, COMMAND_ARGUMENT_KEYS)
      || readCommandValue(record.command)
    : '';
  const target = resolveSemanticArgument(argumentsRecord, TARGET_ARGUMENT_KEYS)
    || readFirstString(record, TARGET_ARGUMENT_KEYS);
  const output = resolveChatMessageToolCallOutput(record);
  const protocolStatus = resolveToolCallStatus(record);
  const title = resolveToolCallTitle(record);
  const durationMs = resolveToolCallDurationMs(record);
  const resultBlocks = resolveChatMessageToolCallResultBlocks(record, protocolStatus);
  const status = protocolStatus === 'cancelled'
    ? protocolStatus
    : resultBlocks.some((block) => block.type === 'error')
      ? 'error'
      : protocolStatus;

  return {
    id: resolveToolCallId(record, index, options.fallbackIdPrefix),
    type,
    name: normalizedName,
    arguments: argumentsText,
    kind,
    ...(status ? { status } : {}),
    ...(output ? { output } : {}),
    ...(command ? { command } : {}),
    ...(target ? { target } : {}),
    ...(mcpIdentity?.serverName ? { serverName: mcpIdentity.serverName } : {}),
    ...(title ? { title } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(resultBlocks.length > 0 ? { resultBlocks } : {}),
  };
}

export function projectChatMessageToolNotice(
  value: unknown,
  index: number,
  options: ProjectChatMessageToolCallOptions = {},
): ProjectedChatMessageToolNotice | null {
  if (options.engineId?.trim().toLowerCase() !== 'gemini') {
    return null;
  }
  const record = readToolCallRecord(value);
  if (!record) {
    return null;
  }
  const context = readGeminiToolDisplayContext(record);
  if (!context || readGeminiToolDisplayFormat(context.display) !== 'notice') {
    return null;
  }
  const name = boundGeminiToolDisplayText(
    context.display.name,
    MAX_GEMINI_TOOL_DISPLAY_NAME_CHARACTERS,
    { oneLine: true },
  );
  const description = boundGeminiToolDisplayText(
    context.display.description,
    MAX_GEMINI_TOOL_DISPLAY_DESCRIPTION_CHARACTERS,
    { tailCharacters: 200 },
  );
  const result = projectGeminiToolDisplayResult(context.display, context.isError).text;
  const resultSummary = boundGeminiToolDisplayText(
    context.display.resultSummary,
    MAX_GEMINI_TOOL_DISPLAY_SUMMARY_CHARACTERS,
    { oneLine: true },
  );
  const isRedundantName = Boolean(name && description.includes(`"${name}"`));
  const content = boundGeminiToolDisplayText(
    [isRedundantName ? '' : name, description, resultSummary || result]
      .filter(Boolean)
      .join(name && description && !isRedundantName ? ': ' : '\n'),
    MAX_GEMINI_TOOL_DISPLAY_RESULT_CHARACTERS,
    { tailCharacters: 4_000 },
  );
  if (!content) {
    return null;
  }
  return {
    content,
    ...(description ? { description } : {}),
    id: context.callId || `${options.fallbackIdPrefix?.trim() || 'tool-notice'}-${index + 1}`,
    kind: 'notice',
    ...(name ? { name } : {}),
    ...(result ? { result } : {}),
    ...(resultSummary ? { resultSummary } : {}),
  };
}

export function projectChatMessageToolNotices(
  toolCalls: readonly unknown[] | undefined,
  options: ProjectChatMessageToolCallOptions = {},
): ProjectedChatMessageToolNotice[] {
  if (!toolCalls || toolCalls.length === 0) {
    return [];
  }
  return toolCalls.flatMap((toolCall, index) => {
    const notice = projectChatMessageToolNotice(toolCall, index, options);
    return notice ? [notice] : [];
  });
}

export function projectChatMessageToolResult(
  input: ProjectChatMessageToolResultInput,
  options: ProjectChatMessageToolCallOptions = {},
): ChatMessageToolCall | null {
  if (!input.content.trim() && !input.name?.trim()) {
    return null;
  }

  return projectChatMessageToolCall({
    id: input.id,
    type: 'tool_result',
    name: input.name ?? 'tool',
    output: input.content,
    status: input.status ?? 'completed',
  }, 0, options);
}

export function projectChatMessageCommand(
  call: ChatMessageToolCall,
): ProjectedChatMessageCommand | null {
  if (call.kind !== 'command') {
    return null;
  }

  const command = call.command?.trim() || call.target?.trim() || call.name.trim();
  if (!command) {
    return null;
  }

  const status = call.status === 'success'
    ? 'success'
    : call.status === 'error' || call.status === 'cancelled'
      ? 'error'
      : 'running';

  return {
    command,
    status,
    ...(call.output?.trim() ? { output: call.output } : {}),
    ...(call.status === 'cancelled' ? { runtimeStatus: 'terminated' as const } : {}),
    kind: 'command',
    toolName: call.name,
    toolCallId: call.id,
  };
}

export function projectChatMessageToolCalls(
  toolCalls: readonly unknown[] | undefined,
  options: ProjectChatMessageToolCallOptions = {},
): ChatMessageToolCall[] {
  if (!toolCalls || toolCalls.length === 0) {
    return [];
  }

  return toolCalls.flatMap((toolCall, index) => {
    const projected = projectChatMessageToolCall(toolCall, index, options);
    return projected ? [projected] : [];
  });
}
