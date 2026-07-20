export type {
  BirdCoderChatMessageToolCall as ChatMessageToolCall,
} from '@sdkwork/birdcoder-chat-contracts';
import type {
  BirdCoderChatMessageToolCall as ChatMessageToolCall,
  BirdCoderChatMessageToolCallKind,
  BirdCoderChatMessageToolResultBlock,
  BirdCoderChatMessageToolCallStatus,
} from '@sdkwork/birdcoder-chat-contracts';

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
  kind: 'command';
  toolName: string;
  toolCallId: string;
}

const COMMAND_TOOL_NAMES = new Set([
  'bash',
  'command',
  'command_execution',
  'execute_command',
  'exec_command',
  'pty_exec',
  'run_command',
  'shell',
  'shell_command',
]);

const FILE_TOOL_NAMES = new Set([
  'apply_patch',
  'create_file',
  'edit',
  'edit_file',
  'multi_edit',
  'notebook_edit',
  'read',
  'read_file',
  'replace_file',
  'str_replace_editor',
  'write',
  'write_file',
]);

const SEARCH_TOOL_NAMES = new Set([
  'glob',
  'grep',
  'grep_code',
  'list',
  'list_files',
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
]);

const AGENT_TOOL_NAMES = new Set([
  'agent',
  'delegate',
  'run_agent',
  'spawn_agent',
  'subagent',
  'subtask',
  'task',
]);

const SKILL_TOOL_NAMES = new Set([
  'load_skill',
  'skill',
  'use_skill',
]);

const MEDIA_TOOL_NAMES = new Set([
  'generate_image',
  'image_generation',
  'image_generation_call',
  'render_image',
  'view_image',
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
  'prompt_user',
  'question',
  'user_input',
  'user_question',
]);

const COMMAND_ARGUMENT_KEYS = ['command', 'cmd', 'shell', 'script'] as const;
const TARGET_ARGUMENT_KEYS = [
  'path',
  'filePath',
  'file_path',
  'filename',
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
      output: source.aggregated_output,
    };
  }
  if (type === 'file_change') {
    const changes = Array.isArray(source.changes) ? source.changes : [];
    const firstChange = readToolCallRecord(changes[0]);
    return {
      ...source,
      name: 'apply_patch',
      arguments: { changes },
      target: firstChange?.path,
      title: changes.length > 0 ? `${changes.length} file${changes.length === 1 ? '' : 's'}` : undefined,
    };
  }
  if (type === 'web_search') {
    return {
      ...source,
      name: 'web_search',
      input: { query: source.query },
      status: source.status ?? 'completed',
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
    return {
      ...source,
      name: 'image_generation',
      input: source.revised_prompt,
      output: source.result,
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
  const resultToolNameByType: Readonly<Record<string, string>> = {
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
        source.is_error === true || hasStructuredToolError(source.content)
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

function adaptGeminiToolRecord(record: Record<string, unknown>): Record<string, unknown> | null {
  const value = readToolCallRecord(record.value);
  const functionCall = readToolCallRecord(record.functionCall)
    ?? readToolCallRecord(value?.functionCall);
  if (functionCall) {
    return {
      ...record,
      ...functionCall,
      id: functionCall.id ?? record.id,
      arguments: functionCall.args,
      type: 'function_call',
    };
  }

  const functionResponse = readToolCallRecord(record.functionResponse)
    ?? readToolCallRecord(value?.functionResponse);
  if (functionResponse) {
    return {
      ...record,
      ...functionResponse,
      id: functionResponse.id ?? record.id,
      output: functionResponse.response,
      status: 'completed',
      type: 'function_call_output',
    };
  }

  const type = normalizeToolCallName(readNonEmptyString(record.type));
  if (type === 'tool_call_request' && value) {
    return {
      ...record,
      ...value,
      id: value.callId ?? value.id,
      arguments: value.args,
    };
  }
  if (type === 'tool_call_response' && value) {
    return {
      ...record,
      ...value,
      id: value.callId ?? value.id,
      name: readNonEmptyString(value.name) || 'tool',
      output: value.resultDisplay
        ?? value.responseParts
        ?? value.data
        ?? value.error,
      status: value.error ? 'error' : 'completed',
    };
  }
  if (type === 'tool_call_confirmation' && value) {
    const request = readToolCallRecord(value.request);
    return {
      ...record,
      ...value,
      id: request?.callId ?? value.callId ?? value.id,
      name: readNonEmptyString(request?.name) || 'approval',
      arguments: {
        request: request?.args,
        details: value.details,
      },
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

function hasStructuredToolError(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasStructuredToolError);
  }
  const record = readToolCallRecord(value);
  if (!record) {
    return false;
  }

  const type = normalizeToolCallName(readNonEmptyString(record.type));
  return record.is_error === true
    || Boolean(record.error)
    || type === 'error'
    || type.endsWith('_error');
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
  return readNonEmptyString(record.tool_call_id)
    || readNonEmptyString(record.toolCallId)
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
  return value.trim().toLowerCase().replace(/[.\s-]+/g, '_');
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
  const mcpNameMatch = /^mcp__(.+?)__(.+)$/iu.exec(name)
    ?? /^mcp[.:/](.+?)[.:/](.+)$/iu.exec(name);

  return {
    ...(serverName || mcpNameMatch?.[1]
      ? { serverName: serverName || mcpNameMatch?.[1] }
      : {}),
    toolName: explicitToolName || mcpNameMatch?.[2] || name,
  };
}

function resolveToolCallKind(
  record: Record<string, unknown>,
  name: string,
  type: string,
): BirdCoderChatMessageToolCallKind {
  const normalizedName = normalizeToolCallName(name);
  const normalizedType = normalizeToolCallName(type);
  if (['approval_request', 'tool_call_confirmation'].includes(normalizedType)) {
    return 'approval';
  }
  if (
    normalizedType.includes('mcp')
    || normalizedName.startsWith('mcp__')
    || normalizedName.startsWith('mcp_')
    || readFirstString(record, ['server', 'serverName', 'server_name', 'mcpServer'])
  ) {
    return 'mcp';
  }
  if (COMMAND_TOOL_NAMES.has(normalizedName) || normalizedType === 'command_execution') {
    return 'command';
  }
  if (FILE_TOOL_NAMES.has(normalizedName) || normalizedType === 'file_change') {
    return 'file';
  }
  if (SEARCH_TOOL_NAMES.has(normalizedName)) {
    return 'search';
  }
  if (normalizedName.startsWith('web_') || normalizedName.includes('fetch_url')) {
    return 'web';
  }
  if (AGENT_TOOL_NAMES.has(normalizedName) || ['agent', 'subtask'].includes(normalizedType)) {
    return 'agent';
  }
  if (SKILL_TOOL_NAMES.has(normalizedName)) {
    return 'skill';
  }
  if (MEDIA_TOOL_NAMES.has(normalizedName) || normalizedType === 'image_generation_call') {
    return 'media';
  }
  if (TASK_TOOL_NAMES.has(normalizedName)) {
    return 'task';
  }
  if (APPROVAL_TOOL_NAMES.has(normalizedName)) {
    return 'approval';
  }
  if (QUESTION_TOOL_NAMES.has(normalizedName)) {
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
    record.is_error === true
    || record.error
    || stateRecord?.error
    || ['error', 'failed', 'failure'].includes(status)
  ) {
    return 'error';
  }
  if (['aborted', 'cancelled', 'canceled', 'stopped', 'terminated'].includes(status)) {
    return 'cancelled';
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

function resolveToolCallOutput(record: Record<string, unknown>): string {
  return formatToolCallArguments(resolveToolCallOutputValue(record));
}

function resolveToolCallOutputValue(record: Record<string, unknown>): unknown {
  const stateRecord = readToolCallRecord(record.state);
  const normalizedType = normalizeToolCallName(readNonEmptyString(record.type));
  return record.error
    ?? stateRecord?.error
    ?? record.output
    ?? record.aggregated_output
    ?? record.result
    ?? stateRecord?.output
    ?? stateRecord?.result
    ?? (normalizedType === 'tool_result' ? record.content : undefined);
}

const TOOL_RESULT_BLOCK_TYPES = new Set([
  'audio',
  'diff',
  'error',
  'image',
  'link',
  'list',
  'resource',
  'text',
]);

function readToolResultErrorMessage(value: unknown): string {
  const directMessage = readNonEmptyString(value);
  if (directMessage) {
    return directMessage;
  }
  const record = readToolCallRecord(value);
  return readFirstString(record, ['message', 'error', 'detail', 'reason'])
    || formatToolCallArguments(value);
}

function resolveToolResultMediaSource(
  record: Record<string, unknown>,
): { mimeType?: string; source: string } | null {
  const nestedSource = readToolCallRecord(record.source);
  const mimeType = readFirstString(record, ['mimeType', 'mime_type', 'media_type'])
    || readFirstString(nestedSource, ['mimeType', 'mime_type', 'media_type']);
  const source = readFirstString(record, ['url', 'uri'])
    || readFirstString(nestedSource, ['url', 'uri'])
    || readFirstString(record, ['data', 'base64'])
    || readFirstString(nestedSource, ['data', 'base64']);
  if (!source) {
    return null;
  }
  if (/^(?:data:|https?:|blob:)/iu.test(source)) {
    return { ...(mimeType ? { mimeType } : {}), source };
  }
  return {
    ...(mimeType ? { mimeType } : {}),
    source: `data:${mimeType || 'application/octet-stream'};base64,${source}`,
  };
}

function projectToolResultValue(
  value: unknown,
  blocks: BirdCoderChatMessageToolResultBlock[],
  visited: WeakSet<object>,
): void {
  if (value === undefined || value === null || blocks.length >= 200) {
    return;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value).trim();
    if (text) {
      blocks.push({ type: 'text', text });
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 1 && value.every((entry) => ['string', 'number', 'boolean'].includes(typeof entry))) {
      blocks.push({ type: 'list', items: value.map(String) });
      return;
    }
    for (const entry of value) {
      projectToolResultValue(entry, blocks, visited);
    }
    return;
  }
  if (typeof value !== 'object' || visited.has(value)) {
    return;
  }

  visited.add(value);
  const record = value as Record<string, unknown>;
  const type = normalizeToolCallName(readNonEmptyString(record.type));
  if (type === 'error' || type.endsWith('_error') || record.is_error === true) {
    blocks.push({ type: 'error', message: readToolResultErrorMessage(record) });
    return;
  }
  if (type === 'image' || type === 'audio') {
    const media = resolveToolResultMediaSource(record);
    if (media) {
      blocks.push({
        type,
        ...media,
        ...(readFirstString(record, ['title', 'name', 'alt'])
          ? { title: readFirstString(record, ['title', 'name', 'alt']) }
          : {}),
      });
      return;
    }
  }
  if (type === 'resource' || readToolCallRecord(record.resource)) {
    const resource = readToolCallRecord(record.resource) ?? record;
    const uri = readFirstString(resource, ['uri', 'url']);
    if (uri) {
      blocks.push({
        type: 'resource',
        uri,
        ...(readFirstString(resource, ['name', 'title'])
          ? { name: readFirstString(resource, ['name', 'title']) }
          : {}),
        ...(readFirstString(resource, ['mimeType', 'mime_type'])
          ? { mimeType: readFirstString(resource, ['mimeType', 'mime_type']) }
          : {}),
        ...(readNonEmptyString(resource.text) ? { text: readNonEmptyString(resource.text) } : {}),
      });
      return;
    }
  }
  const url = readFirstString(record, ['url', 'href']);
  if (type === 'link' || url) {
    if (url) {
      blocks.push({
        type: 'link',
        url,
        ...(readFirstString(record, ['title', 'name'])
          ? { title: readFirstString(record, ['title', 'name']) }
          : {}),
        ...(readFirstString(record, ['description', 'snippet'])
          ? { description: readFirstString(record, ['description', 'snippet']) }
          : {}),
      });
      return;
    }
  }
  const diff = readNonEmptyString(record.diff)
    || (type === 'diff' ? readNonEmptyString(record.content) : '');
  if (diff) {
    blocks.push({
      type: 'diff',
      content: diff,
      ...(readFirstString(record, ['path', 'filePath', 'file_path'])
        ? { path: readFirstString(record, ['path', 'filePath', 'file_path']) }
        : {}),
    });
    return;
  }
  const text = readFirstString(record, ['text']);
  if (type === 'text' && text) {
    blocks.push({ type: 'text', text });
    return;
  }
  if (Array.isArray(record.items)) {
    if (record.items.every((entry) => ['string', 'number', 'boolean'].includes(typeof entry))) {
      blocks.push({ type: 'list', items: record.items.map(String) });
    } else {
      projectToolResultValue(record.items, blocks, visited);
    }
    return;
  }
  if ('content' in record) {
    const previousBlockCount = blocks.length;
    projectToolResultValue(record.content, blocks, visited);
    if (blocks.length > previousBlockCount) {
      return;
    }
  }

  const fallback = formatToolCallArguments(record).trim();
  if (fallback) {
    blocks.push({ type: 'text', text: fallback });
  }
}

function resolveToolCallResultBlocks(
  record: Record<string, unknown>,
  status: BirdCoderChatMessageToolCallStatus | undefined,
): readonly BirdCoderChatMessageToolResultBlock[] {
  if (Array.isArray(record.resultBlocks)) {
    return record.resultBlocks.filter((block): block is BirdCoderChatMessageToolResultBlock => {
      const blockRecord = readToolCallRecord(block);
      return TOOL_RESULT_BLOCK_TYPES.has(
        normalizeToolCallName(readNonEmptyString(blockRecord?.type)),
      );
    });
  }

  const stateRecord = readToolCallRecord(record.state);
  const errorValue = record.error ?? stateRecord?.error;
  if (errorValue !== undefined && errorValue !== null) {
    const message = readToolResultErrorMessage(errorValue).trim();
    return message ? [{ type: 'error', message }] : [];
  }

  const outputValue = resolveToolCallOutputValue(record);
  if (status === 'error') {
    const message = readToolResultErrorMessage(outputValue).trim();
    return message ? [{ type: 'error', message }] : [];
  }
  const blocks: BirdCoderChatMessageToolResultBlock[] = [];
  projectToolResultValue(outputValue, blocks, new WeakSet<object>());
  return blocks;
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
  const output = resolveToolCallOutput(record);
  const status = resolveToolCallStatus(record);
  const title = resolveToolCallTitle(record);
  const durationMs = resolveToolCallDurationMs(record);
  const resultBlocks = resolveToolCallResultBlocks(record, status);

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
