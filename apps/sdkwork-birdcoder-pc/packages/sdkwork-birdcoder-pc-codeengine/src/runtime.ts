import {
  canonicalizeBirdCoderCodeEngineToolName,
  flushBirdCoderCodeEngineToolCallDeltas,
  mergeBirdCoderCodeEngineToolCallDelta,
  normalizeBirdCoderCodeEngineToolLifecycleStatus,
  parseBirdCoderApiJson,
  resolveBirdCoderCodeEngineArtifactKind,
  resolveBirdCoderCodeEngineRiskLevel,
  resolveBirdCoderCodeEngineToolKind,
  stringifyBirdCoderLongInteger,
} from '@sdkwork/birdcoder-pc-types';
import type {
  BirdCoderCodeEngineKey,
  BirdCoderCodeEnginePendingToolCallDelta,
  BirdCoderCodingSessionRuntimeStatus,
  BirdCoderEngineDescriptor,
} from '@sdkwork/birdcoder-pc-types';
import type {
  ChatCanonicalEvent,
  ChatCanonicalRuntimeDescriptor,
  ChatEngineIntegrationDescriptor,
  ChatEngineHealthReport,
  ChatOptions,
  ChatStreamChunk,
  IChatEngine,
  ToolCall,
} from '@sdkwork/birdcoder-pc-projection';
import {
  createDefaultChatCanonicalRuntimeDescriptor,
  resolveTransportKindForRuntimeMode,
} from '@sdkwork/birdcoder-pc-projection';

import { getWorkbenchCodeEngineKernel } from './kernel.ts';

export interface WorkbenchCanonicalChatEngineInput {
  engineId?: BirdCoderCodeEngineKey;
  defaultModelId?: string;
  descriptor?: BirdCoderEngineDescriptor;
}

type BoundFunction<TArgs extends unknown[], TResult> = (...args: TArgs) => TResult;

function proxyMethod<TArgs extends unknown[], TResult>(
  method: BoundFunction<TArgs, TResult> | undefined,
  target: unknown,
): BoundFunction<TArgs, TResult> | undefined {
  return method ? method.bind(target) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseToolArguments(toolCall: ToolCall): Record<string, unknown> {
  const rawArguments = toolCall.function.arguments;

  if (!rawArguments.trim()) {
    return {};
  }

  try {
    const parsed = parseBirdCoderApiJson(rawArguments);

    return isRecord(parsed) ? parsed : {};
  } catch {
    return {
      rawArguments,
    };
  }
}

function resolveLifecycleStatus(
  args: Record<string, unknown>,
): ReturnType<typeof normalizeBirdCoderCodeEngineToolLifecycleStatus> {
  return (
    normalizeBirdCoderCodeEngineToolLifecycleStatus(args.status) ??
    normalizeBirdCoderCodeEngineToolLifecycleStatus(args.runtimeStatus) ??
    normalizeBirdCoderCodeEngineToolLifecycleStatus(args.state) ??
    normalizeBirdCoderCodeEngineToolLifecycleStatus(args.phase)
  );
}

function eventKindForToolStatus(
  status: ReturnType<typeof normalizeBirdCoderCodeEngineToolLifecycleStatus>,
): 'tool.call.requested' | 'tool.call.progress' | 'tool.call.completed' {
  if (status === 'completed') {
    return 'tool.call.completed';
  }
  if (status === 'running') {
    return 'tool.call.progress';
  }

  return 'tool.call.requested';
}

function shouldEmitTurnCompleted(
  status: BirdCoderCodingSessionRuntimeStatus,
): boolean {
  return status !== 'awaiting_approval' && status !== 'awaiting_user';
}

function runtimeStatusForToolStatus(
  status: ReturnType<typeof normalizeBirdCoderCodeEngineToolLifecycleStatus>,
): BirdCoderCodingSessionRuntimeStatus {
  if (status === 'completed') {
    return 'streaming';
  }
  if (status === 'running') {
    return 'awaiting_tool';
  }
  if (status === 'awaiting_user') {
    return 'awaiting_user';
  }
  if (status === 'awaiting_approval') {
    return 'awaiting_approval';
  }

  return 'awaiting_tool';
}

function shouldRequireApproval(input: {
  toolName: string;
  status: ReturnType<typeof normalizeBirdCoderCodeEngineToolLifecycleStatus>;
  args: Record<string, unknown>;
}): boolean {
  if (input.status === 'completed' || input.status === 'running') {
    return false;
  }

  if (input.status === 'awaiting_user') {
    return false;
  }

  if (input.status === 'awaiting_approval') {
    return true;
  }

  const toolKind = resolveBirdCoderCodeEngineToolKind({
    toolName: input.toolName,
    toolArguments: input.args,
  });

  return resolveBirdCoderCodeEngineRiskLevel({
    toolName: input.toolName,
    toolKind,
  }) === 'P2';
}

function resolveToolTitle(toolName: string, args: Record<string, unknown>): string {
  const command =
    String(args.command ?? args.cmd ?? args.shellCommand ?? args.query ?? '').trim();

  return command || toolName;
}

function createCanonicalEvent(
  sequence: number,
  kind: ChatCanonicalEvent['kind'],
  runtimeStatus: ChatCanonicalEvent['runtimeStatus'],
  payload: Record<string, unknown>,
  artifact?: ChatCanonicalEvent['artifact'],
): ChatCanonicalEvent {
  return {
    kind,
    sequence: stringifyBirdCoderLongInteger(sequence),
    runtimeStatus,
    payload,
    ...(artifact ? { artifact } : {}),
  };
}

function resolveChunkContent(chunk: ChatStreamChunk): string {
  return chunk.choices
    .map((choice) => choice.delta.content ?? '')
    .filter(Boolean)
    .join('');
}

function toolCallDeltaIsProjectable(
  toolCall: BirdCoderCodeEnginePendingToolCallDelta,
): boolean {
  const toolName = toolCall.function.name.trim();
  if (!toolName) {
    return false;
  }

  const toolArguments = toolCall.function.arguments.trim();
  if (!toolArguments) {
    return false;
  }

  try {
    parseBirdCoderApiJson(toolArguments);
    return true;
  } catch {
    return !/^[{[]/u.test(toolArguments);
  }
}

function drainProjectableToolCallDeltas(
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

    if (toolCallDeltaIsProjectable(toolCall)) {
      projectableToolCalls.push(toolCall);
      pendingToolCalls.delete(key);
      continue;
    }

    retainedOrder.push(key);
  }

  pendingToolCallOrder.splice(0, pendingToolCallOrder.length, ...retainedOrder);
  return projectableToolCalls;
}

function pendingToolCallToToolCall(
  toolCall: BirdCoderCodeEnginePendingToolCallDelta,
): ToolCall {
  return {
    id: toolCall.id,
    type: 'function',
    function: {
      name: toolCall.function.name,
      arguments: toolCall.function.arguments,
    },
  };
}

function toolCallSnapshotSignature(
  toolCall: BirdCoderCodeEnginePendingToolCallDelta,
): string {
  return JSON.stringify({
    id: toolCall.id,
    name: toolCall.function.name,
    arguments: toolCall.function.arguments,
  });
}

function buildProjectableToolCallEvents(input: {
  mergedToolCall: BirdCoderCodeEnginePendingToolCallDelta;
  projectedToolSnapshots: Map<string, string>;
  approvalEmittedToolIds: Set<string>;
  terminalStatus: BirdCoderCodingSessionRuntimeStatus;
  sequence: number;
}): {
  events: ChatCanonicalEvent[];
  terminalStatus: BirdCoderCodingSessionRuntimeStatus;
  sequence: number;
} {
  const signature = toolCallSnapshotSignature(input.mergedToolCall);
  if (input.projectedToolSnapshots.get(input.mergedToolCall.id) === signature) {
    return {
      events: [],
      terminalStatus: input.terminalStatus,
      sequence: input.sequence,
    };
  }

  input.projectedToolSnapshots.set(input.mergedToolCall.id, signature);

  const toolCall = pendingToolCallToToolCall(input.mergedToolCall);
  const toolArguments = toolCall.function.arguments;
  const args = parseToolArguments(toolCall);
  const toolName = canonicalizeBirdCoderCodeEngineToolName(toolCall.function.name);
  const status = resolveLifecycleStatus(args);
  const toolEventKind = eventKindForToolStatus(status);
  const runtimeStatus = runtimeStatusForToolStatus(status);
  const toolKind = resolveBirdCoderCodeEngineToolKind({
    toolName,
    toolArguments: args,
  });
  const riskLevel = resolveBirdCoderCodeEngineRiskLevel({
    toolName,
    toolKind,
  });
  let terminalStatus: BirdCoderCodingSessionRuntimeStatus =
    runtimeStatus === 'streaming' ? input.terminalStatus : runtimeStatus;
  const events: ChatCanonicalEvent[] = [];
  let sequence = input.sequence;

  const payload = {
    toolCallId: toolCall.id,
    toolName,
    providerToolName: toolCall.function.name,
    toolArguments,
    arguments: args,
    status: status ?? 'requested',
    riskLevel,
    requiresApproval: shouldRequireApproval({ toolName, status, args }),
  };

  events.push(createCanonicalEvent(++sequence, toolEventKind, runtimeStatus, payload));
  events.push(
    createCanonicalEvent(
      ++sequence,
      'artifact.upserted',
      runtimeStatus,
      {
        toolCallId: toolCall.id,
        toolName,
        toolArguments,
        arguments: args,
      },
      {
        kind: resolveBirdCoderCodeEngineArtifactKind({
          toolName,
          toolKind,
        }),
        title: resolveToolTitle(toolName, args),
        metadata: {
          toolCallId: toolCall.id,
          toolName,
          status: status ?? 'requested',
        },
      },
    ),
  );

  if (payload.requiresApproval && !input.approvalEmittedToolIds.has(toolCall.id)) {
    input.approvalEmittedToolIds.add(toolCall.id);
    terminalStatus = 'awaiting_approval';
    events.push(
      createCanonicalEvent(++sequence, 'approval.required', 'awaiting_approval', {
        toolCallId: toolCall.id,
        toolName,
        riskLevel: resolveBirdCoderCodeEngineRiskLevel({
          toolName,
          toolKind,
        }),
        toolArguments,
        arguments: args,
      }),
    );
  }

  return {
    events,
    terminalStatus,
    sequence,
  };
}

async function resolveHealth(runtime: IChatEngine): Promise<ChatEngineHealthReport | null> {
  return runtime.getHealth ? await runtime.getHealth() : null;
}

function createFallbackIntegrationDescriptor(input: {
  descriptor: BirdCoderEngineDescriptor;
  engineId: BirdCoderCodeEngineKey;
  kernel: ReturnType<typeof getWorkbenchCodeEngineKernel>;
}): ChatEngineIntegrationDescriptor {
  return {
    engineId: input.engineId,
    integrationClass: 'official-protocol',
    runtimeMode: 'headless',
    officialEntry: {
      packageName: input.kernel.executionTopology.officialSdkPackageName,
      sdkPath: input.descriptor.officialIntegration?.officialEntry.sdkPath,
      cliPackageName: input.descriptor.officialIntegration?.officialEntry.cliPackageName,
      sourceMirrorPath:
        input.descriptor.officialIntegration?.officialEntry.sourceMirrorPath ??
        input.kernel.source.externalPath,
      supplementalLanes:
        input.descriptor.officialIntegration?.officialEntry.supplementalLanes,
    },
    transportKinds: input.descriptor.transportKinds,
    sourceMirrorPath: input.kernel.source.externalPath,
    sourceMirrorStatus: input.kernel.source.sourceStatus,
  };
}

function createUnsupportedMessageStream(engineName: string) {
  return async function* unsupportedMessageStream(): AsyncGenerator<
    ChatStreamChunk,
    void,
    unknown
  > {
    throw new Error(
      `${engineName} uses kernel-backed sendCanonicalEvents() instead of sendMessageStream().`,
    );
  };
}

export function createWorkbenchCanonicalChatEngine(
  runtime: IChatEngine,
  input: WorkbenchCanonicalChatEngineInput = {},
): IChatEngine {
  const engineId =
    input.engineId ?? runtime.describeIntegration?.().engineId ?? 'codex';
  const kernel = getWorkbenchCodeEngineKernel(engineId);
  const descriptor = input.descriptor ?? kernel.descriptor;
  const defaultModelId = input.defaultModelId ?? descriptor.defaultModelId;

  if (runtime.sendCanonicalEvents) {
    return {
      name: runtime.name,
      version: runtime.version,
      initialize: proxyMethod(runtime.initialize, runtime),
      sendMessage: runtime.sendMessage.bind(runtime),
      sendMessageStream: createUnsupportedMessageStream(runtime.name),
      createSession: proxyMethod(runtime.createSession, runtime),
      getSession: proxyMethod(runtime.getSession, runtime),
      createCodingSession: proxyMethod(runtime.createCodingSession, runtime),
      getCodingSession: proxyMethod(runtime.getCodingSession, runtime),
      addMessageToCodingSession: proxyMethod(
        runtime.addMessageToCodingSession,
        runtime,
      ),
      updateContext: proxyMethod(runtime.updateContext, runtime),
      onToolCall: proxyMethod(runtime.onToolCall, runtime),
      describeIntegration: runtime.describeIntegration
        ? runtime.describeIntegration.bind(runtime)
        : () => createFallbackIntegrationDescriptor({ descriptor, engineId, kernel }),
      getHealth: runtime.getHealth?.bind(runtime),
      getCapabilities: runtime.getCapabilities?.bind(runtime),
      describeRawExtensions: runtime.describeRawExtensions?.bind(runtime),
      describeRuntime:
        runtime.describeRuntime?.bind(runtime) ??
        ((options?: ChatOptions): ChatCanonicalRuntimeDescriptor => ({
          ...createDefaultChatCanonicalRuntimeDescriptor({
            descriptor: createFallbackIntegrationDescriptor({
              descriptor,
              engineId,
              kernel,
            }),
            capabilityMatrix: descriptor.capabilityMatrix,
            options,
          }),
          engineId,
          modelId: options?.model?.trim() || defaultModelId,
          transportKind: resolveTransportKindForRuntimeMode(
            descriptor.transportKinds,
            'headless',
          ),
          capabilityMatrix: descriptor.capabilityMatrix,
        })),
      sendCanonicalEvents: runtime.sendCanonicalEvents.bind(runtime),
    };
  }

  return {
    name: runtime.name,
    version: runtime.version,
    initialize: proxyMethod(runtime.initialize, runtime),
    sendMessage: runtime.sendMessage.bind(runtime),
    sendMessageStream: runtime.sendMessageStream.bind(runtime),
    createSession: proxyMethod(runtime.createSession, runtime),
    getSession: proxyMethod(runtime.getSession, runtime),
    createCodingSession: proxyMethod(runtime.createCodingSession, runtime),
    getCodingSession: proxyMethod(runtime.getCodingSession, runtime),
    addMessageToCodingSession: proxyMethod(runtime.addMessageToCodingSession, runtime),
    updateContext: proxyMethod(runtime.updateContext, runtime),
    onToolCall: proxyMethod(runtime.onToolCall, runtime),
    describeIntegration: runtime.describeIntegration
      ? runtime.describeIntegration.bind(runtime)
      : () => createFallbackIntegrationDescriptor({ descriptor, engineId, kernel }),
    getHealth: runtime.getHealth?.bind(runtime),
    getCapabilities: runtime.getCapabilities?.bind(runtime),
    describeRawExtensions: runtime.describeRawExtensions?.bind(runtime),
    describeRuntime(options?: ChatOptions): ChatCanonicalRuntimeDescriptor {
      const integration = this.describeIntegration?.();
      const runtimeMode = integration?.runtimeMode ?? 'headless';

      return {
        ...createDefaultChatCanonicalRuntimeDescriptor({
          descriptor: integration ?? {
            engineId,
            integrationClass: 'official-protocol',
            runtimeMode,
            officialEntry: {
              packageName: kernel.executionTopology.officialSdkPackageName,
            },
            transportKinds: descriptor.transportKinds,
            sourceMirrorPath: kernel.source.externalPath,
            sourceMirrorStatus: kernel.source.sourceStatus,
          },
          capabilityMatrix: descriptor.capabilityMatrix,
          options,
        }),
        engineId,
        modelId: options?.model?.trim() || defaultModelId,
        transportKind: resolveTransportKindForRuntimeMode(
          descriptor.transportKinds,
          runtimeMode,
        ),
        capabilityMatrix: descriptor.capabilityMatrix,
      };
    },
    async *sendCanonicalEvents(
      messages,
      options,
    ): AsyncGenerator<ChatCanonicalEvent, void, unknown> {
      let sequence = 0;
      let combinedContent = '';
      let terminalStatus: BirdCoderCodingSessionRuntimeStatus = 'streaming';
      const stream = runtime.sendMessageStream(messages, {
        ...options,
        stream: true,
        model: options?.model ?? defaultModelId,
      });
      const runtimeDescriptor = this.describeRuntime?.(options) ?? {
        engineId,
        modelId: options?.model?.trim() || defaultModelId,
        transportKind: kernel.executionTopology.transportKind,
        approvalPolicy: 'OnRequest',
        capabilityMatrix: descriptor.capabilityMatrix,
      };
      const projectedToolSnapshots = new Map<string, string>();
      const approvalEmittedToolIds = new Set<string>();
      const pendingToolCalls = new Map<string, BirdCoderCodeEnginePendingToolCallDelta>();
      const pendingToolCallOrder: string[] = [];

      yield createCanonicalEvent(++sequence, 'session.started', 'ready', {
        engineId: runtimeDescriptor.engineId,
        modelId: runtimeDescriptor.modelId,
        transportKind: runtimeDescriptor.transportKind,
        approvalPolicy: runtimeDescriptor.approvalPolicy,
      });
      yield createCanonicalEvent(++sequence, 'turn.started', 'streaming', {
        messageCount: messages.length,
      });

      try {
        const emitProjectableToolCalls = (
          toolCalls: readonly BirdCoderCodeEnginePendingToolCallDelta[],
        ) => {
          const emittedEvents: ChatCanonicalEvent[] = [];
          for (const mergedToolCall of toolCalls) {
            const result = buildProjectableToolCallEvents({
              mergedToolCall,
              projectedToolSnapshots,
              approvalEmittedToolIds,
              terminalStatus,
              sequence,
            });
            terminalStatus = result.terminalStatus as BirdCoderCodingSessionRuntimeStatus;
            sequence = result.sequence;
            emittedEvents.push(...result.events);
          }
          return emittedEvents;
        };

        for await (const chunk of stream) {
          const contentDelta = resolveChunkContent(chunk);

          if (contentDelta) {
            combinedContent += contentDelta;
            yield createCanonicalEvent(++sequence, 'message.delta', 'streaming', {
              role: 'assistant',
              contentDelta,
              content: combinedContent,
              chunkId: chunk.id,
            });
          }

          for (const choice of chunk.choices) {
            for (const toolCall of choice.delta.tool_calls ?? []) {
              mergeBirdCoderCodeEngineToolCallDelta({
                pendingToolCallOrder,
                pendingToolCalls,
                toolCall,
              });
            }
          }

          for (const event of emitProjectableToolCalls(
            drainProjectableToolCallDeltas(pendingToolCallOrder, pendingToolCalls),
          )) {
            yield event;
          }

          if (chunk.choices.some((choice) => choice.finish_reason === 'tool_calls')) {
            for (const event of emitProjectableToolCalls(
              flushBirdCoderCodeEngineToolCallDeltas({
                pendingToolCallOrder,
                pendingToolCalls,
              }),
            )) {
              yield event;
            }
          }
        }

        for (const event of emitProjectableToolCalls(
          flushBirdCoderCodeEngineToolCallDeltas({
            pendingToolCallOrder,
            pendingToolCalls,
          }),
        )) {
          yield event;
        }

        if (combinedContent) {
          yield createCanonicalEvent(++sequence, 'message.completed', 'streaming', {
            role: 'assistant',
            content: combinedContent,
          });
        }

        const health = await resolveHealth(runtime);
        yield createCanonicalEvent(++sequence, 'operation.updated', terminalStatus, {
          engineId,
          modelId: runtimeDescriptor.modelId,
          healthStatus: health?.status ?? 'ready',
        });

        if (shouldEmitTurnCompleted(terminalStatus)) {
          yield createCanonicalEvent(++sequence, 'turn.completed', 'completed', {
            engineId,
            modelId: runtimeDescriptor.modelId,
          });
        }
      } catch (error) {
        yield createCanonicalEvent(++sequence, 'turn.failed', 'failed', {
          errorMessage: error instanceof Error ? String(error) : String(error),
        });
        throw error;
      }
    },
  };
}
