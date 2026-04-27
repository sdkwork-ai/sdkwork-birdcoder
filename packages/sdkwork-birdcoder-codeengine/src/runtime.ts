import {
  createCapabilitySnapshot,
  resolveTransportKindForRuntimeMode,
} from '@sdkwork/birdcoder-chat';
import {
  canonicalizeBirdCoderCodeEngineToolName,
  flushBirdCoderCodeEngineToolCallDeltas,
  mergeBirdCoderCodeEngineToolCallDelta,
  normalizeBirdCoderCodeEngineExitCode,
  normalizeBirdCoderCodeEngineToolLifecycleStatus,
  parseBirdCoderApiJson,
  resolveBirdCoderCodeEngineArtifactKind,
  resolveBirdCoderCodeEngineRiskLevel,
  resolveBirdCoderCodeEngineToolKind,
  stringifyBirdCoderLongInteger,
} from '@sdkwork/birdcoder-types';
import type {
  ChatCanonicalArtifact,
  ChatCanonicalEvent,
  ChatCanonicalRuntimeDescriptor,
  ChatMessage,
  ChatOptions,
  IChatEngine,
  ToolCall,
} from '@sdkwork/birdcoder-chat';
import type {
  BirdCoderCodeEngineToolLifecycleStatus,
  BirdCoderCodingSessionRuntimeStatus,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdcoderApprovalPolicy,
  BirdcoderRiskLevel,
  BirdCoderCodeEnginePendingToolCallDelta,
} from '@sdkwork/birdcoder-types';

export interface WorkbenchCanonicalRuntimeBinding {
  defaultModelId: string;
  descriptor: BirdCoderEngineDescriptor;
}

interface CanonicalToolProjection {
  artifact: ChatCanonicalArtifact | null;
  requiresApproval: boolean;
  riskLevel: BirdcoderRiskLevel;
  runtimeStatus: BirdCoderCodingSessionRuntimeStatus;
  toolName: string;
}

interface CanonicalToolCallEventInput {
  artifact?: ChatCanonicalArtifact;
  kind: ChatCanonicalEvent['kind'];
  payload: Record<string, unknown>;
  runtimeStatus: BirdCoderCodingSessionRuntimeStatus;
}

interface CanonicalToolLifecycleProjection {
  kind: ChatCanonicalEvent['kind'];
  runtimeStatus: BirdCoderCodingSessionRuntimeStatus;
  status: BirdCoderCodeEngineToolLifecycleStatus | null;
  emitApproval: boolean;
}

function resolveRuntimeModelId(
  binding: WorkbenchCanonicalRuntimeBinding,
  options?: ChatOptions,
): string {
  const explicitModelId = options?.model?.trim();
  if (explicitModelId) {
    return explicitModelId;
  }

  const defaultModelId = binding.defaultModelId.trim();
  if (defaultModelId) {
    return defaultModelId;
  }

  throw new Error(
    `BirdCoder runtime binding for engine "${binding.descriptor.engineKey}" must expose a non-empty defaultModelId.`,
  );
}

function resolveRuntimeTransportKind(
  binding: WorkbenchCanonicalRuntimeBinding,
): ChatCanonicalRuntimeDescriptor['transportKind'] {
  const primaryAccessLane =
    binding.descriptor.accessPlan?.lanes.find(
      (lane) => lane.laneId === binding.descriptor.accessPlan?.primaryLaneId,
    ) ?? binding.descriptor.accessPlan?.lanes[0];

  return primaryAccessLane?.transportKind ?? binding.descriptor.transportKinds[0] ?? 'sdk-stream';
}

function resolveRuntimeApprovalPolicy(
  binding: WorkbenchCanonicalRuntimeBinding,
): BirdcoderApprovalPolicy {
  return binding.descriptor.capabilityMatrix.approvalCheckpoints ? 'OnRequest' : 'AutoAllow';
}

function buildArtifactTitle(toolName: string, toolCallId: string): string {
  return `${toolName}:${toolCallId}`;
}

function projectToolCall(
  toolCall: ToolCall,
  approvalPolicy: BirdcoderApprovalPolicy,
): CanonicalToolProjection {
  const toolName = canonicalizeBirdCoderCodeEngineToolName(toolCall.function.name);
  const toolArguments = parseCanonicalToolArgumentsRecord(toolCall);
  const toolKind = resolveBirdCoderCodeEngineToolKind({
    toolArguments,
    toolName,
  });
  const riskLevel = resolveBirdCoderCodeEngineRiskLevel({ toolKind, toolName });
  const requiresApproval = approvalPolicy !== 'AutoAllow' && riskLevel !== 'P0';
  const artifactKind = resolveBirdCoderCodeEngineArtifactKind({ toolKind, toolName });

  return {
    artifact: artifactKind
      ? {
          kind: artifactKind,
          title: buildArtifactTitle(toolName, toolCall.id),
          metadata: {
            toolCallId: toolCall.id,
            toolName,
          },
        }
      : null,
    requiresApproval,
    riskLevel,
    runtimeStatus: requiresApproval ? 'awaiting_approval' : 'awaiting_tool',
    toolName,
  };
}

function isCanonicalRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCanonicalToolArgumentsRecord(
  toolCall: ToolCall,
): Record<string, unknown> | null {
  const rawArguments = toolCall.function.arguments.trim();
  if (!rawArguments) {
    return null;
  }

  try {
    const parsedArguments = parseBirdCoderApiJson(rawArguments) as unknown;
    return isCanonicalRecord(parsedArguments) ? parsedArguments : null;
  } catch {
    return null;
  }
}

function resolveCanonicalToolLifecycleStatus(
  toolCall: ToolCall,
): BirdCoderCodeEngineToolLifecycleStatus | null {
  const args = parseCanonicalToolArgumentsRecord(toolCall);
  const status =
    normalizeBirdCoderCodeEngineToolLifecycleStatus(args?.status) ??
    normalizeBirdCoderCodeEngineToolLifecycleStatus(args?.state) ??
    normalizeBirdCoderCodeEngineToolLifecycleStatus(args?.phase) ??
    normalizeBirdCoderCodeEngineToolLifecycleStatus(args?.resultStatus) ??
    normalizeBirdCoderCodeEngineToolLifecycleStatus(args?.result_status);

  if (status) {
    return status;
  }

  const exitCode =
    normalizeBirdCoderCodeEngineExitCode(args?.exitCode) ??
    normalizeBirdCoderCodeEngineExitCode(args?.exit_code);
  if (exitCode === undefined) {
    return null;
  }

  return exitCode === 0 ? 'completed' : 'failed';
}

function resolveCanonicalToolLifecycleProjection(input: {
  lifecycleStatus: BirdCoderCodeEngineToolLifecycleStatus | null;
  projection: CanonicalToolProjection;
  wasRequested: boolean;
}): CanonicalToolLifecycleProjection {
  if (!input.wasRequested) {
    if (input.lifecycleStatus === 'completed') {
      return {
        kind: 'tool.call.completed',
        runtimeStatus: 'completed',
        status: input.lifecycleStatus,
        emitApproval: false,
      };
    }

    if (input.lifecycleStatus === 'failed') {
      return {
        kind: 'tool.call.completed',
        runtimeStatus: 'failed',
        status: input.lifecycleStatus,
        emitApproval: false,
      };
    }

    if (input.lifecycleStatus === 'cancelled') {
      return {
        kind: 'tool.call.completed',
        runtimeStatus: 'terminated',
        status: input.lifecycleStatus,
        emitApproval: false,
      };
    }

    if (input.lifecycleStatus === 'running') {
      return {
        kind: 'tool.call.progress',
        runtimeStatus: 'awaiting_tool',
        status: input.lifecycleStatus,
        emitApproval: false,
      };
    }

    return {
      kind: 'tool.call.requested',
      runtimeStatus:
        input.lifecycleStatus === 'awaiting_user'
          ? 'awaiting_user'
          : input.projection.runtimeStatus,
      status: input.lifecycleStatus,
      emitApproval:
        input.lifecycleStatus === 'awaiting_user' ? false : input.projection.requiresApproval,
    };
  }

  if (input.lifecycleStatus === 'completed') {
    return {
      kind: 'tool.call.completed',
      runtimeStatus: 'completed',
      status: input.lifecycleStatus,
      emitApproval: false,
    };
  }

  if (input.lifecycleStatus === 'failed') {
    return {
      kind: 'tool.call.completed',
      runtimeStatus: 'failed',
      status: input.lifecycleStatus,
      emitApproval: false,
    };
  }

  if (input.lifecycleStatus === 'cancelled') {
    return {
      kind: 'tool.call.completed',
      runtimeStatus: 'terminated',
      status: input.lifecycleStatus,
      emitApproval: false,
    };
  }

  return {
    kind: 'tool.call.progress',
    runtimeStatus:
      input.lifecycleStatus === 'awaiting_approval'
        ? 'awaiting_approval'
        : input.lifecycleStatus === 'awaiting_user'
          ? 'awaiting_user'
          : 'awaiting_tool',
    status: input.lifecycleStatus,
    emitApproval: false,
  };
}

function projectToolCallToCanonicalEventInputs(
  toolCall: ToolCall,
  approvalPolicy: BirdcoderApprovalPolicy,
  wasRequested: boolean,
): CanonicalToolCallEventInput[] {
  const projection = projectToolCall(toolCall, approvalPolicy);
  const lifecycle = resolveCanonicalToolLifecycleProjection({
    lifecycleStatus: resolveCanonicalToolLifecycleStatus(toolCall),
    projection,
    wasRequested,
  });
  const events: CanonicalToolCallEventInput[] = [
    {
      kind: lifecycle.kind,
      runtimeStatus: lifecycle.runtimeStatus,
      payload: {
        toolCallId: toolCall.id,
        toolName: projection.toolName,
        toolArguments: toolCall.function.arguments,
        riskLevel: projection.riskLevel,
        requiresApproval: lifecycle.emitApproval,
        ...(lifecycle.status ? { status: lifecycle.status } : {}),
      },
    },
  ];

  if (projection.artifact) {
    events.push({
      kind: 'artifact.upserted',
      runtimeStatus: lifecycle.runtimeStatus,
      payload: {
        toolCallId: toolCall.id,
        toolName: projection.toolName,
        toolArguments: toolCall.function.arguments,
        artifactKind: projection.artifact.kind,
        artifactTitle: projection.artifact.title,
        ...(lifecycle.status ? { status: lifecycle.status } : {}),
      },
      artifact: projection.artifact,
    });
  }

  if (lifecycle.emitApproval) {
    events.push({
      kind: 'approval.required',
      runtimeStatus: 'awaiting_approval',
      payload: {
        toolCallId: toolCall.id,
        toolName: projection.toolName,
        approvalPolicy,
        riskLevel: projection.riskLevel,
      },
    });
  }

  return events;
}

function createCanonicalEvent(
  sequence: number,
  kind: ChatCanonicalEvent['kind'],
  runtimeStatus: BirdCoderCodingSessionRuntimeStatus,
  payload: Record<string, unknown>,
  artifact?: ChatCanonicalArtifact,
): ChatCanonicalEvent {
  return {
    kind,
    sequence: stringifyBirdCoderLongInteger(sequence),
    runtimeStatus,
    payload,
    artifact,
  };
}

function buildRuntimeDescriptor(
  binding: WorkbenchCanonicalRuntimeBinding,
  options?: ChatOptions,
): ChatCanonicalRuntimeDescriptor {
  return {
    engineId: binding.descriptor.engineKey,
    modelId: resolveRuntimeModelId(binding, options),
    transportKind: resolveRuntimeTransportKind(binding),
    approvalPolicy: resolveRuntimeApprovalPolicy(binding),
    capabilityMatrix: {
      ...(binding.descriptor.capabilityMatrix as BirdCoderEngineCapabilityMatrix),
    },
  };
}

async function resolveStreamingRuntimeDescriptor(
  engine: IChatEngine,
  binding: WorkbenchCanonicalRuntimeBinding,
  options?: ChatOptions,
): Promise<ChatCanonicalRuntimeDescriptor> {
  const runtimeDescriptor = buildRuntimeDescriptor(binding, options);
  const health = await engine.getHealth?.();
  if (!health) {
    return runtimeDescriptor;
  }

  return {
    ...runtimeDescriptor,
    transportKind: resolveTransportKindForRuntimeMode(
      binding.descriptor.transportKinds,
      health.runtimeMode,
    ),
  };
}

function proxyMethod<TArgs extends unknown[], TResult>(
  method: ((...args: TArgs) => TResult) | undefined,
  engine: IChatEngine,
): ((...args: TArgs) => TResult) | undefined {
  if (!method) {
    return method;
  }

  return method.bind(engine) as (...args: TArgs) => TResult;
}

export function createWorkbenchCanonicalChatEngine(
  engine: IChatEngine,
  binding: WorkbenchCanonicalRuntimeBinding,
): IChatEngine {
  const sendMessage = engine.sendMessage.bind(engine);
  const sendMessageStream = engine.sendMessageStream.bind(engine);

  return {
    name: engine.name,
    version: engine.version,
    initialize: proxyMethod(engine.initialize, engine),
    sendMessage,
    sendMessageStream,
    describeRuntime: (options?: ChatOptions) => buildRuntimeDescriptor(binding, options),
    describeIntegration: proxyMethod(engine.describeIntegration, engine),
    getCapabilities: async () => {
      const health = await engine.getHealth?.();
      return createCapabilitySnapshot({
        capabilityMatrix: binding.descriptor.capabilityMatrix,
        health: health ?? {
          status: 'missing',
          runtimeMode: 'protocol-fallback',
          officialEntry: {
            packageName: 'unavailable',
          },
          sdkAvailable: false,
          cliAvailable: false,
          authConfigured: false,
          fallbackActive: true,
          sourceMirrorStatus: 'missing',
          diagnostics: ['Provider did not expose health diagnostics.'],
          checkedAt: Date.now(),
        },
        experimentalCapabilities: engine.describeRawExtensions?.()?.experimentalFeatures ?? [],
      });
    },
    describeRawExtensions: proxyMethod(engine.describeRawExtensions, engine),
    async *sendCanonicalEvents(
      messages: ChatMessage[],
      options?: ChatOptions,
    ): AsyncGenerator<ChatCanonicalEvent, void, unknown> {
      const runtime = await resolveStreamingRuntimeDescriptor(engine, binding, options);
      let sequence = 0;
      let combinedContent = '';
      let sawToolCall = false;
      let finalRuntimeStatus: BirdCoderCodingSessionRuntimeStatus = 'streaming';
      const pendingToolCalls = new Map<string, BirdCoderCodeEnginePendingToolCallDelta>();
      const pendingToolCallOrder: string[] = [];
      const requestedToolCallIds = new Set<string>();

      yield createCanonicalEvent(++sequence, 'session.started', 'ready', {
        engineId: runtime.engineId,
        modelId: runtime.modelId,
        transportKind: runtime.transportKind,
        approvalPolicy: runtime.approvalPolicy,
      });
      yield createCanonicalEvent(++sequence, 'turn.started', 'streaming', {
        messageCount: messages.length,
        lastMessageRole: messages.at(-1)?.role ?? null,
      });

      try {
        for await (const chunk of sendMessageStream(messages, options)) {
          const choice = chunk.choices[0];
          const delta = choice?.delta;
          if (!choice || !delta) {
            continue;
          }

          if (typeof delta.content === 'string' && delta.content.length > 0) {
            combinedContent += delta.content;
            yield createCanonicalEvent(++sequence, 'message.delta', 'streaming', {
              chunkId: chunk.id,
              model: chunk.model,
              role: delta.role ?? 'assistant',
              contentDelta: delta.content,
            });
          }

          for (const toolCall of delta.tool_calls ?? []) {
            mergeBirdCoderCodeEngineToolCallDelta({
              pendingToolCallOrder,
              pendingToolCalls,
              toolCall,
            });
          }

          if (choice.finish_reason === 'tool_calls') {
            const toolCalls = flushBirdCoderCodeEngineToolCallDeltas({
              pendingToolCallOrder,
              pendingToolCalls,
            });
            for (const toolCall of toolCalls) {
              sawToolCall = true;
              const wasRequested = requestedToolCallIds.has(toolCall.id);
              for (const eventInput of projectToolCallToCanonicalEventInputs(
                toolCall,
                runtime.approvalPolicy,
                wasRequested,
              )) {
                finalRuntimeStatus = eventInput.runtimeStatus;
                yield createCanonicalEvent(
                  ++sequence,
                  eventInput.kind,
                  eventInput.runtimeStatus,
                  eventInput.payload,
                  eventInput.artifact,
                );
              }
              requestedToolCallIds.add(toolCall.id);
            }
            yield createCanonicalEvent(++sequence, 'operation.updated', finalRuntimeStatus, {
              finishReason: choice.finish_reason,
              status: finalRuntimeStatus,
            });
          }
        }
      } catch (error) {
        yield createCanonicalEvent(++sequence, 'turn.failed', 'failed', {
          error: String(error),
        });
        throw error;
      }

      const remainingToolCalls = flushBirdCoderCodeEngineToolCallDeltas({
        pendingToolCallOrder,
        pendingToolCalls,
      });
      if (remainingToolCalls.length > 0) {
        for (const toolCall of remainingToolCalls) {
          sawToolCall = true;
          const wasRequested = requestedToolCallIds.has(toolCall.id);
          for (const eventInput of projectToolCallToCanonicalEventInputs(
            toolCall,
            runtime.approvalPolicy,
            wasRequested,
          )) {
            finalRuntimeStatus = eventInput.runtimeStatus;
            yield createCanonicalEvent(
              ++sequence,
              eventInput.kind,
              eventInput.runtimeStatus,
              eventInput.payload,
              eventInput.artifact,
            );
          }
          requestedToolCallIds.add(toolCall.id);
        }
        yield createCanonicalEvent(++sequence, 'operation.updated', finalRuntimeStatus, {
          status: finalRuntimeStatus,
          toolCallsDetected: true,
        });
      }

      const completionRuntimeStatus = sawToolCall ? finalRuntimeStatus : 'completed';

      yield createCanonicalEvent(++sequence, 'message.completed', completionRuntimeStatus, {
        role: 'assistant',
        content: combinedContent,
      });
      yield createCanonicalEvent(++sequence, 'operation.updated', completionRuntimeStatus, {
        status: completionRuntimeStatus,
        toolCallsDetected: sawToolCall,
      });
      yield createCanonicalEvent(++sequence, 'turn.completed', completionRuntimeStatus, {
        contentLength: combinedContent.length,
        finishReason: sawToolCall ? 'tool_calls' : 'stop',
      });
    },
    getHealth: proxyMethod(engine.getHealth, engine),
    createSession: proxyMethod(engine.createSession, engine),
    getSession: proxyMethod(engine.getSession, engine),
    createCodingSession: proxyMethod(engine.createCodingSession, engine),
    getCodingSession: proxyMethod(engine.getCodingSession, engine),
    addMessageToCodingSession: proxyMethod(engine.addMessageToCodingSession, engine),
    updateContext: proxyMethod(engine.updateContext, engine),
    onToolCall: proxyMethod(engine.onToolCall, engine),
  };
}
