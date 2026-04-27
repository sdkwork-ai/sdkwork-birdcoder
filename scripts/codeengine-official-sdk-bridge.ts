import { stdin, stderr, stdout } from 'node:process';
import { pathToFileURL } from 'node:url';

import { createChatEngineById } from '../packages/sdkwork-birdcoder-codeengine/src/engines.ts';
import type {
  ChatContext,
  ChatMessage,
  ChatResponse,
  ChatStreamChunk,
  ToolCall,
} from '../packages/sdkwork-birdcoder-chat/src/types.ts';
import type {
  BirdCoderCodeEnginePendingToolCallDelta,
  BirdCoderCodeEngineToolKind,
} from '../packages/sdkwork-birdcoder-types/src/index.ts';
import {
  canonicalizeBirdCoderCodeEngineToolName,
  flushBirdCoderCodeEngineToolCallDeltas,
  isBirdCoderCodeEngineApprovalToolName,
  isBirdCoderCodeEngineUserQuestionToolName,
  mergeBirdCoderCodeEngineToolCallDelta,
  mergeBirdCoderCodeEngineCommandSnapshot,
  normalizeBirdCoderCodeEngineBoolean,
  normalizeBirdCoderCodeEngineRuntimeStatus,
  parseBirdCoderApiJson,
  resolveBirdCoderCodeEngineApprovalRuntimeStatus,
  resolveBirdCoderCodeEngineCommandInteractionState,
  resolveBirdCoderCodeEngineCommandStatus,
  resolveBirdCoderCodeEngineCommandText,
  resolveBirdCoderCodeEngineToolKind,
  resolveBirdCoderCodeEngineUserQuestionRuntimeStatus,
  stringifyBirdCoderApiJson,
} from '../packages/sdkwork-birdcoder-types/src/index.ts';

interface CodeEngineSdkBridgeRequest {
  engineId?: string;
  modelId?: string;
  promptText?: string;
  nativeSessionId?: string | null;
  streamEvents?: boolean;
  workingDirectory?: string | null;
  requestKind?: string;
  ideContext?: {
    workspaceId?: string | null;
    projectId?: string | null;
    sessionId?: string | null;
    currentFile?: {
      path?: string;
      content?: string | null;
      language?: string | null;
    } | null;
  } | null;
}

interface CodeEngineSdkBridgeResponse {
  assistantContent: string;
  commands?: CodeEngineSdkBridgeCommand[];
  nativeSessionId?: string | null;
}

interface CodeEngineSdkBridgeCommand {
  command: string;
  status: 'running' | 'success' | 'error';
  output?: string;
  kind?: CodeEngineSdkBridgeCommandKind;
  toolName?: string;
  toolCallId?: string;
  runtimeStatus?: CodeEngineSdkBridgeRuntimeStatus;
  requiresApproval?: boolean;
  requiresReply?: boolean;
}

type CodeEngineSdkBridgeCommandKind = BirdCoderCodeEngineToolKind;

type CodeEngineSdkBridgeRuntimeStatus =
  | 'initializing'
  | 'ready'
  | 'streaming'
  | 'awaiting_tool'
  | 'awaiting_approval'
  | 'awaiting_user'
  | 'completed'
  | 'failed'
  | 'terminated';

interface CodeEngineSdkBridgeStreamEvent {
  type: 'message.delta';
  role: string;
  contentDelta: string;
}

interface CodeEngineSdkBridgeCommandEntry {
  key: string;
  command: CodeEngineSdkBridgeCommand;
}

function normalizeNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function parseOfficialSdkBridgeRequest(payload: string): CodeEngineSdkBridgeRequest {
  try {
    const parsed = parseBirdCoderApiJson(payload) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('request payload must be a JSON object');
    }
    return parsed as CodeEngineSdkBridgeRequest;
  } catch (error) {
    throw new Error(
      `Invalid codeengine SDK bridge request: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function buildChatContext(request: CodeEngineSdkBridgeRequest): ChatContext {
  const ideContext = request.ideContext;
  const context: ChatContext = {
    workspaceId: normalizeNonEmptyString(ideContext?.workspaceId) ?? undefined,
    projectId: normalizeNonEmptyString(ideContext?.projectId) ?? undefined,
    codingSessionId:
      normalizeNonEmptyString(request.nativeSessionId) ??
      normalizeNonEmptyString(ideContext?.sessionId) ??
      undefined,
    sessionId:
      normalizeNonEmptyString(request.nativeSessionId) ??
      normalizeNonEmptyString(ideContext?.sessionId) ??
      undefined,
    workspaceRoot: normalizeNonEmptyString(request.workingDirectory) ?? undefined,
  };

  const currentFile = ideContext?.currentFile;
  const currentFilePath = normalizeNonEmptyString(currentFile?.path);
  if (currentFilePath) {
    context.currentFile = {
      path: currentFilePath,
      content: typeof currentFile?.content === 'string' ? currentFile.content : '',
      language: normalizeNonEmptyString(currentFile?.language) ?? 'text',
    };
  }

  return context;
}

function buildMessages(request: CodeEngineSdkBridgeRequest): ChatMessage[] {
  const requestKind = normalizeNonEmptyString(request.requestKind) ?? 'chat';
  const promptText = normalizeNonEmptyString(request.promptText);
  if (!promptText) {
    throw new Error('Codeengine SDK bridge request requires promptText.');
  }

  return [
    {
      id: `sdk-bridge-system-${Date.now()}`,
      role: 'system',
      content:
        'You are running inside the BirdCoder code engine SDK bridge. Return the assistant response for the current coding turn.',
      timestamp: Date.now(),
    },
    {
      id: `sdk-bridge-user-${Date.now()}`,
      role: 'user',
      content: requestKind === 'chat' ? promptText : `Request kind: ${requestKind}\n\n${promptText}`,
      timestamp: Date.now(),
    },
  ];
}

function extractAssistantContent(response: ChatResponse): string {
  return response.choices
    .map((choice) => choice.message.content)
    .filter((content): content is string => typeof content === 'string' && content.trim().length > 0)
    .join('\n')
    .trim();
}

function parseToolCallArguments(value: string): Record<string, unknown> | null {
  try {
    const parsed = parseBirdCoderApiJson(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function stringifyToolCallArguments(value: Record<string, unknown> | null, fallback: string): string | undefined {
  if (!value) {
    return fallback.trim() ? fallback : undefined;
  }

  try {
    return stringifyBirdCoderApiJson(value);
  } catch {
    return fallback.trim() ? fallback : undefined;
  }
}

export function serializeOfficialSdkBridgeOutput(value: unknown): string {
  return stringifyBirdCoderApiJson(value);
}

function readBridgeRecordString(
  record: Record<string, unknown> | null,
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

function resolveToolCallCommandStatus(
  args: Record<string, unknown> | null,
): CodeEngineSdkBridgeCommand['status'] {
  return resolveBirdCoderCodeEngineCommandStatus({
    status: args?.status,
    runtimeStatus: args?.runtimeStatus,
    state: args?.state,
    phase: args?.phase,
    exitCode: args?.exitCode ?? args?.exit_code,
  });
}

function hasToolCallAnswer(args: Record<string, unknown> | null): boolean {
  return !!readBridgeRecordString(args, ['answer']);
}

function resolveUserQuestionRuntimeStatus(
  args: Record<string, unknown> | null,
): CodeEngineSdkBridgeRuntimeStatus {
  return resolveBirdCoderCodeEngineUserQuestionRuntimeStatus({
    status: args?.status,
    runtimeStatus: args?.runtimeStatus,
    state: args?.state,
    phase: args?.phase,
    hasAnswer: hasToolCallAnswer(args),
  });
}

function resolveApprovalRuntimeStatus(
  args: Record<string, unknown> | null,
): CodeEngineSdkBridgeRuntimeStatus {
  return resolveBirdCoderCodeEngineApprovalRuntimeStatus({
    status: args?.status,
    runtimeStatus: args?.runtimeStatus,
    state: args?.state,
    phase: args?.phase,
  });
}

function resolveToolCallRuntimeStatus(
  toolName: string,
  args: Record<string, unknown> | null,
): CodeEngineSdkBridgeRuntimeStatus | undefined {
  if (isBirdCoderCodeEngineUserQuestionToolName(toolName)) {
    return resolveUserQuestionRuntimeStatus(args);
  }
  if (isBirdCoderCodeEngineApprovalToolName(toolName)) {
    return resolveApprovalRuntimeStatus(args);
  }

  const explicitStatus =
    normalizeBirdCoderCodeEngineRuntimeStatus(args?.runtimeStatus) ??
    normalizeBirdCoderCodeEngineRuntimeStatus(args?.status) ??
    normalizeBirdCoderCodeEngineRuntimeStatus(args?.state) ??
    normalizeBirdCoderCodeEngineRuntimeStatus(args?.phase);
  if (explicitStatus) {
    return explicitStatus;
  }

  if (
    normalizeBirdCoderCodeEngineBoolean(args?.requiresApproval) === true
  ) {
    return 'awaiting_approval';
  }

  return undefined;
}

function resolveToolCallCommandKind(
  toolName: string,
  args: Record<string, unknown> | null,
  runtimeStatus: CodeEngineSdkBridgeRuntimeStatus | undefined,
): CodeEngineSdkBridgeCommandKind {
  return resolveBirdCoderCodeEngineToolKind({
    runtimeStatus,
    toolArguments: args,
    toolName,
  });
}

function resolveToolCallCommandText(toolCall: ToolCall): string {
  const args = parseToolCallArguments(toolCall.function.arguments);
  const toolName = canonicalizeBirdCoderCodeEngineToolName(toolCall.function.name);
  return resolveBirdCoderCodeEngineCommandText({
    fallbackArguments: toolCall.function.arguments,
    toolArguments: args,
    toolName,
  });
}

function toolCallToBridgeCommand(toolCall: ToolCall): CodeEngineSdkBridgeCommand {
  const args = parseToolCallArguments(toolCall.function.arguments);
  const toolName = canonicalizeBirdCoderCodeEngineToolName(toolCall.function.name);
  const runtimeStatus = resolveToolCallRuntimeStatus(toolName, args);
  const kind = resolveToolCallCommandKind(toolName, args, runtimeStatus);
  const toolCallId = normalizeNonEmptyString(toolCall.id);
  const status = resolveToolCallCommandStatus(args);
  const interactionState = resolveBirdCoderCodeEngineCommandInteractionState({
    kind,
    requiresApproval: args?.requiresApproval,
    requiresReply: args?.requiresReply,
    runtimeStatus,
    status,
  });
  return {
    command: resolveToolCallCommandText(toolCall),
    status,
    output: stringifyToolCallArguments(args, toolCall.function.arguments),
    kind,
    toolName,
    ...(toolCallId ? { toolCallId } : {}),
    ...(runtimeStatus ? { runtimeStatus } : {}),
    requiresApproval: interactionState.requiresApproval,
    requiresReply: interactionState.requiresReply,
  };
}

function resolveToolCallCommandKey(toolCall: ToolCall): string {
  const toolCallId = normalizeNonEmptyString(toolCall.id);
  if (toolCallId) {
    return toolCallId;
  }

  return `${canonicalizeBirdCoderCodeEngineToolName(toolCall.function.name)}:${resolveToolCallCommandText(toolCall)}`;
}

export function isOfficialSdkBridgeResponseEmpty(
  response: Pick<CodeEngineSdkBridgeResponse, 'assistantContent' | 'commands'>,
): boolean {
  return !response.assistantContent.trim() && (response.commands?.length ?? 0) === 0;
}

function projectToolCallDeltasToBridgeCommandEntries(
  toolCalls: readonly BirdCoderCodeEnginePendingToolCallDelta[],
): CodeEngineSdkBridgeCommandEntry[] {
  return toolCalls.map((toolCall) => ({
    key: resolveToolCallCommandKey(toolCall),
    command: toolCallToBridgeCommand(toolCall),
  }));
}

function upsertBridgeCommandEntries(
  commandOrder: string[],
  commandsByKey: Map<string, CodeEngineSdkBridgeCommand>,
  entries: readonly CodeEngineSdkBridgeCommandEntry[],
): void {
  for (const entry of entries) {
    const existingCommand = commandsByKey.get(entry.key);
    if (!existingCommand) {
      commandOrder.push(entry.key);
    }
    commandsByKey.set(
      entry.key,
      existingCommand
        ? mergeBridgeCommandSnapshot(existingCommand, entry.command)
        : entry.command,
    );
  }
}

function mergeBridgeCommandSnapshot(
  existingCommand: CodeEngineSdkBridgeCommand,
  nextCommand: CodeEngineSdkBridgeCommand,
): CodeEngineSdkBridgeCommand {
  return mergeBirdCoderCodeEngineCommandSnapshot(existingCommand, nextCommand);
}

export async function collectOfficialSdkBridgeStreamResult(
  stream: AsyncIterable<ChatStreamChunk>,
  options: {
    onEvent?: (event: CodeEngineSdkBridgeStreamEvent) => void;
  } = {},
): Promise<CodeEngineSdkBridgeResponse> {
  let assistantContent = '';
  const commandOrder: string[] = [];
  const commandsByKey = new Map<string, CodeEngineSdkBridgeCommand>();
  const pendingToolCalls = new Map<string, BirdCoderCodeEnginePendingToolCallDelta>();
  const pendingToolCallOrder: string[] = [];

  for await (const chunk of stream) {
    const choice = chunk.choices[0];
    const delta = choice?.delta;
    if (!delta) {
      continue;
    }

    if (typeof delta.content === 'string') {
      assistantContent += delta.content;
      if (delta.content.length > 0) {
        options.onEvent?.({
          type: 'message.delta',
          role: delta.role ?? 'assistant',
          contentDelta: delta.content,
        });
      }
    }

    for (const toolCall of delta.tool_calls ?? []) {
      mergeBirdCoderCodeEngineToolCallDelta({
        pendingToolCallOrder,
        pendingToolCalls,
        toolCall,
      });
    }

    if (choice.finish_reason === 'tool_calls') {
      upsertBridgeCommandEntries(
        commandOrder,
        commandsByKey,
        projectToolCallDeltasToBridgeCommandEntries(
          flushBirdCoderCodeEngineToolCallDeltas({
            pendingToolCallOrder,
            pendingToolCalls,
          }),
        ),
      );
    }
  }
  upsertBridgeCommandEntries(
    commandOrder,
    commandsByKey,
    projectToolCallDeltasToBridgeCommandEntries(
      flushBirdCoderCodeEngineToolCallDeltas({
        pendingToolCallOrder,
        pendingToolCalls,
      }),
    ),
  );
  const commands = commandOrder.flatMap((key) => {
    const command = commandsByKey.get(key);
    return command ? [command] : [];
  });

  return {
    assistantContent: assistantContent.trim(),
    commands: commands.length > 0 ? commands : undefined,
  };
}

async function executeOfficialSdkBridgeRequest(
  request: CodeEngineSdkBridgeRequest,
): Promise<CodeEngineSdkBridgeResponse> {
  const engineId = normalizeNonEmptyString(request.engineId);
  const modelId = normalizeNonEmptyString(request.modelId);
  if (!engineId) {
    throw new Error('Codeengine SDK bridge request requires engineId.');
  }
  if (!modelId) {
    throw new Error('Codeengine SDK bridge request requires modelId.');
  }

  const engine = createChatEngineById(engineId);
  const messages = buildMessages(request);
  const options = {
    model: modelId,
    context: buildChatContext(request),
  };

  const streamResult = await collectOfficialSdkBridgeStreamResult(
    engine.sendMessageStream(messages, options),
    request.streamEvents
      ? {
          onEvent: (event) => {
            stdout.write(`${serializeOfficialSdkBridgeOutput(event)}\n`);
          },
        }
      : undefined,
  );
  if (streamResult.assistantContent || (streamResult.commands?.length ?? 0) > 0) {
    return {
      ...streamResult,
      nativeSessionId: normalizeNonEmptyString(request.nativeSessionId),
    };
  }

  const response = await engine.sendMessage(messages, options);
  return {
    assistantContent: extractAssistantContent(response),
    nativeSessionId: normalizeNonEmptyString(request.nativeSessionId),
  };
}

export async function main() {
  const request = parseOfficialSdkBridgeRequest(await readStdin());
  const bridgeResponse = await executeOfficialSdkBridgeRequest(request);
  if (isOfficialSdkBridgeResponseEmpty(bridgeResponse)) {
    throw new Error(
      `Codeengine SDK bridge for ${normalizeNonEmptyString(request.engineId) ?? 'unknown'} returned an empty assistant response.`,
    );
  }

  if (request.streamEvents) {
    stdout.write(
      `${serializeOfficialSdkBridgeOutput({ type: 'turn.completed', response: bridgeResponse })}\n`,
    );
    return;
  }

  stdout.write(`${serializeOfficialSdkBridgeOutput(bridgeResponse)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
