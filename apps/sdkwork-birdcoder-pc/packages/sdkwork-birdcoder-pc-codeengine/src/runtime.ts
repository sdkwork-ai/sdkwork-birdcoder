import {
  canonicalizeBirdCoderCodeEngineToolName,
  normalizeBirdCoderCodeEngineToolLifecycleStatus,
  parseBirdCoderApiJson,
  resolveBirdCoderCodeEngineArtifactKind,
  resolveBirdCoderCodeEngineRiskLevel,
  resolveBirdCoderCodeEngineToolKind,
  stringifyBirdCoderLongInteger,
} from '@sdkwork/birdcoder-pc-types';
import type {
  BirdCoderCodeEngineKey,
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
} from '@sdkwork/birdcoder-pc-chat';
import {
  createDefaultChatCanonicalRuntimeDescriptor,
  resolveTransportKindForRuntimeMode,
} from '@sdkwork/birdcoder-pc-chat';

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

function resolveChunkToolCalls(chunk: ChatStreamChunk): readonly ToolCall[] {
  return chunk.choices.flatMap((choice) => choice.delta.tool_calls ?? []);
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
    integrationClass: 'official-sdk',
    runtimeMode: 'sdk',
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

export function createWorkbenchCanonicalChatEngine(
  runtime: IChatEngine,
  input: WorkbenchCanonicalChatEngineInput = {},
): IChatEngine {
  const engineId =
    input.engineId ?? runtime.describeIntegration?.().engineId ?? 'codex';
  const kernel = getWorkbenchCodeEngineKernel(engineId);
  const descriptor = input.descriptor ?? kernel.descriptor;
  const defaultModelId = input.defaultModelId ?? descriptor.defaultModelId;

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
      const runtimeMode = integration?.runtimeMode ?? 'sdk';

      return {
        ...createDefaultChatCanonicalRuntimeDescriptor({
          descriptor: integration ?? {
            engineId,
            integrationClass: 'official-sdk',
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
      const seenToolSnapshots = new Set<string>();
      const approvalEmittedToolIds = new Set<string>();

      yield createCanonicalEvent(++sequence, 'session.started', 'ready', {
        engineId: runtimeDescriptor.engineId,
        modelId: runtimeDescriptor.modelId,
        transportKind: runtimeDescriptor.transportKind,
        approvalPolicy: runtimeDescriptor.approvalPolicy,
      });
      yield createCanonicalEvent(++sequence, 'turn.started', 'streaming', {
        messageCount: messages.length,
      });

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

        for (const toolCall of resolveChunkToolCalls(chunk)) {
          const args = parseToolArguments(toolCall);
          const toolName = canonicalizeBirdCoderCodeEngineToolName(
            toolCall.function.name,
          );
          const status = resolveLifecycleStatus(args);
          const toolEventKind = eventKindForToolStatus(status);
          const runtimeStatus = runtimeStatusForToolStatus(status);
          const snapshotKey = JSON.stringify({
            id: toolCall.id,
            kind: toolEventKind,
            args,
          });

          if (seenToolSnapshots.has(snapshotKey)) {
            continue;
          }

          seenToolSnapshots.add(snapshotKey);
          terminalStatus = runtimeStatus === 'streaming' ? terminalStatus : runtimeStatus;

          const payload = {
            toolCallId: toolCall.id,
            toolName,
            providerToolName: toolCall.function.name,
            arguments: args,
            status: status ?? 'requested',
            requiresApproval: shouldRequireApproval({ toolName, status, args }),
          };

          yield createCanonicalEvent(++sequence, toolEventKind, runtimeStatus, payload);

          yield createCanonicalEvent(
            ++sequence,
            'artifact.upserted',
            runtimeStatus,
            {
              toolCallId: toolCall.id,
              toolName,
              arguments: args,
            },
            {
              kind: resolveBirdCoderCodeEngineArtifactKind({
                toolName,
                toolKind: resolveBirdCoderCodeEngineToolKind({
                  toolName,
                  toolArguments: args,
                }),
              }),
              title: resolveToolTitle(toolName, args),
              metadata: {
                toolCallId: toolCall.id,
                status: status ?? 'requested',
              },
            },
          );

          if (
            payload.requiresApproval &&
            !approvalEmittedToolIds.has(toolCall.id)
          ) {
            approvalEmittedToolIds.add(toolCall.id);
            terminalStatus = 'awaiting_approval';
            yield createCanonicalEvent(++sequence, 'approval.required', 'awaiting_approval', {
              toolCallId: toolCall.id,
              toolName,
              riskLevel: resolveBirdCoderCodeEngineRiskLevel({
                toolName,
                toolKind: resolveBirdCoderCodeEngineToolKind({
                  toolName,
                  toolArguments: args,
                }),
              }),
              arguments: args,
            });
          }
        }
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

      if (terminalStatus !== 'awaiting_approval' && terminalStatus !== 'awaiting_user') {
        yield createCanonicalEvent(++sequence, 'turn.completed', 'completed', {
          engineId,
          modelId: runtimeDescriptor.modelId,
        });
      }
    },
  };
}
