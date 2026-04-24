import {
  createCapabilitySnapshot,
  resolveTransportKindForRuntimeMode,
} from '@sdkwork/birdcoder-chat';
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
  BirdCoderCodingSessionArtifactKind,
  BirdCoderCodingSessionRuntimeStatus,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdcoderApprovalPolicy,
  BirdcoderRiskLevel,
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

function normalizeArtifactKind(
  toolName: string,
): BirdCoderCodingSessionArtifactKind | null {
  switch (toolName) {
    case 'edit_file':
    case 'apply_patch':
    case 'write_file':
      return 'patch';
    case 'run_command':
    case 'execute_command':
      return 'command-log';
    case 'update_todo':
    case 'write_todo':
      return 'todo-list';
    case 'open_terminal':
    case 'pty_exec':
      return 'pty-transcript';
    case 'search_code':
    case 'read_file':
    case 'grep_code':
      return 'diagnostic-bundle';
    default:
      return 'structured-output';
  }
}

function buildArtifactTitle(toolCall: ToolCall): string {
  return `${toolCall.function.name}:${toolCall.id}`;
}

function resolveToolRiskLevel(toolName: string): BirdcoderRiskLevel {
  switch (toolName) {
    case 'search_code':
    case 'read_file':
    case 'grep_code':
      return 'P0';
    case 'update_todo':
    case 'write_todo':
      return 'P1';
    case 'run_command':
    case 'execute_command':
    case 'edit_file':
    case 'apply_patch':
    case 'write_file':
    case 'open_terminal':
    case 'pty_exec':
      return 'P2';
    default:
      return 'P1';
  }
}

function projectToolCall(
  toolCall: ToolCall,
  approvalPolicy: BirdcoderApprovalPolicy,
): CanonicalToolProjection {
  const riskLevel = resolveToolRiskLevel(toolCall.function.name);
  const requiresApproval = approvalPolicy !== 'AutoAllow' && riskLevel !== 'P0';
  const artifactKind = normalizeArtifactKind(toolCall.function.name);

  return {
    artifact: artifactKind
      ? {
          kind: artifactKind,
          title: buildArtifactTitle(toolCall),
          metadata: {
            toolCallId: toolCall.id,
            toolName: toolCall.function.name,
          },
        }
      : null,
    requiresApproval,
    riskLevel,
    runtimeStatus: requiresApproval ? 'awaiting_approval' : 'awaiting_tool',
  };
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
    sequence,
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
            sawToolCall = true;
            const projection = projectToolCall(toolCall, runtime.approvalPolicy);
            finalRuntimeStatus = projection.runtimeStatus;

            yield createCanonicalEvent(++sequence, 'tool.call.requested', projection.runtimeStatus, {
              toolCallId: toolCall.id,
              toolName: toolCall.function.name,
              toolArguments: toolCall.function.arguments,
              riskLevel: projection.riskLevel,
              requiresApproval: projection.requiresApproval,
            });

            if (projection.artifact) {
              yield createCanonicalEvent(
                ++sequence,
                'artifact.upserted',
                projection.runtimeStatus,
                {
                  toolCallId: toolCall.id,
                  toolName: toolCall.function.name,
                  artifactKind: projection.artifact.kind,
                  artifactTitle: projection.artifact.title,
                },
                projection.artifact,
              );
            }

            if (projection.requiresApproval) {
              yield createCanonicalEvent(++sequence, 'approval.required', 'awaiting_approval', {
                toolCallId: toolCall.id,
                toolName: toolCall.function.name,
                approvalPolicy: runtime.approvalPolicy,
                riskLevel: projection.riskLevel,
              });
            }
          }

          if (choice.finish_reason === 'tool_calls') {
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
