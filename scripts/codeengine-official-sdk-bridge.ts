import { stdin, stderr, stdout } from 'node:process';
import { pathToFileURL } from 'node:url';

import { createChatEngineById } from '../packages/sdkwork-birdcoder-codeengine/src/engines.ts';
import type {
  ChatContext,
  ChatMessage,
  ChatOptions,
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
  temperature?: number;
  topP?: number;
  maxTokens?: number;
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

type CodeEngineSdkBridgeStreamEventType =
  | 'message.delta'
  | 'tool.call.requested'
  | 'tool.call.progress'
  | 'tool.call.completed'
  | 'approval.required'
  | 'turn.failed';

interface CodeEngineSdkBridgeStreamEvent {
  type: CodeEngineSdkBridgeStreamEventType;
  payload?: Record<string, unknown>;
  role?: string;
  contentDelta?: string;
}

interface CodeEngineSdkBridgeCommandEntry {
  key: string;
  command: CodeEngineSdkBridgeCommand;
}

function normalizeNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeBridgeFiniteNumber(
  value: unknown,
  minimum: number,
  maximum: number,
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeBridgePositiveInteger(
  value: unknown,
  maximum: number,
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(maximum, Math.max(1, Math.floor(value)));
}

function normalizeBridgeTemperature(value: unknown): number | undefined {
  return normalizeBridgeFiniteNumber(value, 0, 2);
}

function normalizeBridgeTopP(value: unknown): number | undefined {
  return normalizeBridgeFiniteNumber(value, 0, 1);
}

function normalizeBridgeMaxTokens(value: unknown): number | undefined {
  return normalizeBridgePositiveInteger(value, 128000);
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

function resolveOfficialSdkBridgeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function buildOfficialSdkBridgeFailureOutput(error: unknown): string {
  return serializeOfficialSdkBridgeOutput({
    payload: {
      errorMessage: resolveOfficialSdkBridgeErrorMessage(error),
      runtimeStatus: 'failed',
    },
    type: 'turn.failed',
  });
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

function bridgeCommandSnapshotsAreEquivalent(
  left: CodeEngineSdkBridgeCommand,
  right: CodeEngineSdkBridgeCommand,
): boolean {
  return serializeOfficialSdkBridgeOutput(left) === serializeOfficialSdkBridgeOutput(right);
}

function upsertBridgeCommandEntries(
  commandOrder: string[],
  commandsByKey: Map<string, CodeEngineSdkBridgeCommand>,
  entries: readonly CodeEngineSdkBridgeCommandEntry[],
  onEvent?: (event: CodeEngineSdkBridgeStreamEvent) => void,
): void {
  for (const entry of entries) {
    const existingCommand = commandsByKey.get(entry.key);
    const nextCommand = existingCommand
      ? mergeBridgeCommandSnapshot(existingCommand, entry.command)
      : entry.command;
    if (
      existingCommand &&
      bridgeCommandSnapshotsAreEquivalent(existingCommand, nextCommand)
    ) {
      continue;
    }
    if (!existingCommand) {
      commandOrder.push(entry.key);
    }
    commandsByKey.set(entry.key, nextCommand);
    emitBridgeCommandStreamEvents(nextCommand, existingCommand, onEvent);
  }
}

function bridgeToolCallDeltaIsProjectable(
  toolCall: BirdCoderCodeEnginePendingToolCallDelta,
): boolean {
  if (!normalizeNonEmptyString(toolCall.function.name)) {
    return false;
  }

  const normalizedArguments = normalizeNonEmptyString(toolCall.function.arguments);
  if (!normalizedArguments) {
    return false;
  }

  if (parseToolCallArguments(normalizedArguments)) {
    return true;
  }

  return !/^[{[]/u.test(normalizedArguments);
}

function drainProjectableBridgeToolCallDeltas(
  pendingToolCallOrder: string[],
  pendingToolCalls: Map<string, BirdCoderCodeEnginePendingToolCallDelta>,
): BirdCoderCodeEnginePendingToolCallDelta[] {
  const projectableToolCalls: BirdCoderCodeEnginePendingToolCallDelta[] = [];
  const retainedOrder: string[] = [];

  for (const key of pendingToolCallOrder) {
    const toolCall = pendingToolCalls.get(key);
    if (!toolCall) {
      continue;
    }

    if (bridgeToolCallDeltaIsProjectable(toolCall)) {
      projectableToolCalls.push(toolCall);
      pendingToolCalls.delete(key);
      continue;
    }

    retainedOrder.push(key);
  }

  pendingToolCallOrder.splice(0, pendingToolCallOrder.length, ...retainedOrder);
  return projectableToolCalls;
}

function upsertProjectableBridgeToolCallDeltas(
  commandOrder: string[],
  commandsByKey: Map<string, CodeEngineSdkBridgeCommand>,
  pendingToolCallOrder: string[],
  pendingToolCalls: Map<string, BirdCoderCodeEnginePendingToolCallDelta>,
  onEvent?: (event: CodeEngineSdkBridgeStreamEvent) => void,
): void {
  upsertBridgeCommandEntries(
    commandOrder,
    commandsByKey,
    projectToolCallDeltasToBridgeCommandEntries(
      drainProjectableBridgeToolCallDeltas(pendingToolCallOrder, pendingToolCalls),
    ),
    onEvent,
  );
}

function mergeBridgeCommandSnapshot(
  existingCommand: CodeEngineSdkBridgeCommand,
  nextCommand: CodeEngineSdkBridgeCommand,
): CodeEngineSdkBridgeCommand {
  return mergeBirdCoderCodeEngineCommandSnapshot(existingCommand, nextCommand);
}

function resolveBridgeCommandStreamEventType(
  command: CodeEngineSdkBridgeCommand,
  existingCommand: CodeEngineSdkBridgeCommand | undefined,
): CodeEngineSdkBridgeStreamEventType {
  if (
    command.status === 'success' ||
    command.status === 'error' ||
    command.runtimeStatus === 'completed' ||
    command.runtimeStatus === 'failed' ||
    command.runtimeStatus === 'terminated' ||
    command.runtimeStatus === 'awaiting_tool'
  ) {
    return 'tool.call.completed';
  }

  return existingCommand ? 'tool.call.progress' : 'tool.call.requested';
}

function bridgeCommandToStreamEventPayload(
  command: CodeEngineSdkBridgeCommand,
): Record<string, unknown> {
  const toolArguments = parseBridgeCommandStreamToolArguments(command.output);
  return {
    ...(command.toolName ? { toolName: command.toolName } : {}),
    ...(command.toolCallId ? { toolCallId: command.toolCallId } : {}),
    ...(toolArguments === undefined ? {} : { toolArguments }),
    status: command.status,
    ...(command.runtimeStatus ? { runtimeStatus: command.runtimeStatus } : {}),
    requiresApproval: command.requiresApproval,
    requiresReply: command.requiresReply,
  };
}

function parseBridgeCommandStreamToolArguments(
  value: string | undefined,
): unknown {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  try {
    const parsed = parseBirdCoderApiJson(value) as unknown;
    return parsed && typeof parsed === 'object' ? parsed : value;
  } catch {
    return value;
  }
}

function emitBridgeCommandStreamEvents(
  command: CodeEngineSdkBridgeCommand,
  existingCommand: CodeEngineSdkBridgeCommand | undefined,
  onEvent: ((event: CodeEngineSdkBridgeStreamEvent) => void) | undefined,
): void {
  if (!onEvent) {
    return;
  }

  const payload = bridgeCommandToStreamEventPayload(command);
  onEvent({
    type: resolveBridgeCommandStreamEventType(command, existingCommand),
    payload,
  });

  if (command.requiresApproval === true) {
    onEvent({
      type: 'approval.required',
      payload,
    });
  }
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

    upsertProjectableBridgeToolCallDeltas(
      commandOrder,
      commandsByKey,
      pendingToolCallOrder,
      pendingToolCalls,
      options.onEvent,
    );

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
        options.onEvent,
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
    options.onEvent,
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
    stream: true,
    temperature: normalizeBridgeTemperature(request.temperature),
    topP: normalizeBridgeTopP(request.topP),
    maxTokens: normalizeBridgeMaxTokens(request.maxTokens),
  } satisfies ChatOptions;

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
  try {
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
  } catch (error: unknown) {
    if (request.streamEvents) {
      stdout.write(`${buildOfficialSdkBridgeFailureOutput(error)}\n`);
    }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    stderr.write(`${resolveOfficialSdkBridgeErrorMessage(error)}\n`);
    process.exitCode = 1;
  });
}
