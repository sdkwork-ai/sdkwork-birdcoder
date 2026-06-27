import type {
  ChatCanonicalEvent,
  ChatMessage,
  ChatOptions,
} from '@sdkwork/birdcoder-pc-projection';
import {
  buildDefaultBirdCoderCodeEngineModelConfig,
  createBirdCoderCodeEngineModelConfigSyncPlan,
  getBirdCoderCodeEngineCapabilities,
  getBirdCoderCodeEngineDescriptor,
  listBirdCoderCodeEngineNativeSessionProviders,
  listBirdCoderCodeEngineDescriptors,
  listBirdCoderCodeEngineModels,
} from '@sdkwork/birdcoder-pc-codeengine';
import { createWorkbenchServerSessionEngineBinding } from '@sdkwork/birdcoder-pc-codeengine/serverRuntime';
import {
  resolveTransportKindForRuntimeMode,
} from '@sdkwork/birdcoder-pc-projection';
import {
  BIRDCODER_DEFAULT_LOCAL_API_BASE_URL,
  BIRDCODER_DEFAULT_LOCAL_API_HOST,
  BIRDCODER_DEFAULT_LOCAL_API_PORT,
  createBirdHostDescriptorFromDistribution,
  type BirdHostDescriptor,
} from '@sdkwork/birdcoder-pc-host-core';
import {
  SDKWORK_IAM_HEADERS,
  SDKWORK_IAM_OPERATION_IDS,
} from '@sdkwork/iam-contracts';
import type {
  BirdCoderApiEnvelope,
  BirdCoderApiGatewaySummary,
  BirdCoderApiRouteCatalogEntry,
  BirdCoderApiRouteDefinition,
  BirdCoderBackendApiContract,
  BirdCoderApiSurface,
  BirdCoderAppApiContract,
  BirdCoderApprovalDecisionResult,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdCoderCodingServerDescriptor,
  BirdCoderCodeEngineModelConfig,
  BirdCoderCodeEngineModelConfigSyncResult,
  BirdCoderAppRuntimeApiContract,
  BirdCoderModelCatalogEntry,
  BirdCoderNativeSessionProviderSummary,
  BirdCoderOperationDescriptor,
  BirdCoderCodingSessionArtifact,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionRuntime,
  BirdCoderHostMode,
  BirdCoderUserQuestionAnswerResult,
} from '@sdkwork/birdcoder-pc-types';
import type {
  BirdCoderAppSdkApiClient,
  BirdCoderBackendSdkApiClient,
} from '@sdkwork/birdcoder-pc-infrastructure/services/sdkClients';
import { createBirdCoderServerRequestId } from './serverRequestId.ts';
import {
  BIRDCODER_CODING_SERVER_API_VERSION as BIRDCODER_CODING_SERVER_API_VERSION_VALUE,
  BIRDCODER_CODING_SESSION_ARTIFACT_KINDS,
  BIRDCODER_CODING_SESSION_EVENT_KINDS,
  BIRDCODER_CODING_SESSION_MESSAGE_ROLES,
  BIRDCODER_CODING_SESSION_RUNTIME_STATUSES,
  BIRDCODER_CODING_SESSION_STATUSES,
  BIRDCODER_DATA_SCOPES,
  BIRDCODER_ENGINE_INTEGRATION_CLASSES,
  BIRDCODER_ENGINE_RUNTIME_MODES,
  BIRDCODER_HOST_MODES,
  stringifyBirdCoderLongInteger,
} from '@sdkwork/birdcoder-pc-types';
import type {
  BirdCoderCoreSessionProjectionSnapshot,
  BirdCoderCoreSessionProjectionStore,
  BirdCoderCoreSessionRunProjection,
  BirdCoderCoreSessionRunRequest,
} from './coreSessionContracts.ts';
import type { BirdCoderCoreSessionProjectionState } from './serverRuntime.ts';
import { createEnvelope } from './eventEnvelopes.ts';

export function createEmptyCoreSessionProjectionSnapshot(
  codingSessionId: string,
): BirdCoderCoreSessionProjectionSnapshot {
  return {
    codingSessionId,
    runtime: null,
    events: [],
    artifacts: [],
    operations: [],
  };
}

export function cloneCoreSessionProjectionSnapshot(
  codingSessionId: string,
  state: BirdCoderCoreSessionProjectionState,
): BirdCoderCoreSessionProjectionSnapshot {
  return {
    codingSessionId,
    runtime: state.runtime ? { ...state.runtime } : null,
    events: [...state.events],
    artifacts: [...state.artifacts],
    operations: [...state.operationsById.values()],
  };
}

export function appendDistinctById<TEntity extends { id: string }>(
  target: TEntity[],
  entries: readonly TEntity[],
): void {
  const existingIds = new Set(target.map((entry) => entry.id));
  for (const entry of entries) {
    if (existingIds.has(entry.id)) {
      continue;
    }
    target.push(entry);
    existingIds.add(entry.id);
  }
}

export function mapCanonicalEventToCoreEvent(
  request: BirdCoderCoreSessionRunRequest,
  canonicalEvent: ChatCanonicalEvent,
): {
  event: BirdCoderCodingSessionEvent;
  artifact: BirdCoderCodingSessionArtifact | null;
} {
  const createdAt = new Date().toISOString();
  const sequence = stringifyBirdCoderLongInteger(canonicalEvent.sequence);
  const event: BirdCoderCodingSessionEvent = {
    id: `${request.runtimeId}:${request.turnId}:event:${canonicalEvent.sequence}`,
    codingSessionId: request.sessionId,
    turnId: request.turnId,
    runtimeId: request.runtimeId,
    kind: canonicalEvent.kind,
    sequence,
    payload: {
      ...canonicalEvent.payload,
      engineId: request.engineId,
      modelId: request.modelId,
      runtimeStatus: canonicalEvent.runtimeStatus,
    },
    createdAt,
  };

  const artifact = canonicalEvent.artifact
    ? {
        id: `${request.turnId}:artifact:${canonicalEvent.sequence}`,
        codingSessionId: request.sessionId,
        turnId: request.turnId,
        kind: canonicalEvent.artifact.kind,
        status: 'sealed' as const,
        title: canonicalEvent.artifact.title,
        metadata: {
          ...canonicalEvent.artifact.metadata,
          sourceEventKind: canonicalEvent.kind,
          sourceSequence: sequence,
          runtimeStatus: canonicalEvent.runtimeStatus,
        },
        createdAt,
      }
    : null;

  return {
    event,
    artifact,
  };
}

export function resolveCoreSessionRunFailureMessage(error: unknown): string {
  return String(error);
}

export function resolveNextCanonicalFailureSequence(
  events: readonly BirdCoderCodingSessionEvent[],
): string {
  const latestSequence = events
    .map((event) => Number.parseInt(String(event.sequence), 10))
    .filter((sequence) => Number.isFinite(sequence))
    .reduce((latest, sequence) => Math.max(latest, sequence), 0);
  return stringifyBirdCoderLongInteger(latestSequence + 1);
}

export function createCanonicalFailureEvent(
  sequence: string,
  error: unknown,
): ChatCanonicalEvent {
  return {
    kind: 'turn.failed',
    sequence,
    runtimeStatus: 'failed',
    payload: {
      errorMessage: resolveCoreSessionRunFailureMessage(error),
    },
  };
}

export function appendCoreSessionRunFailureEvent(
  request: BirdCoderCoreSessionRunRequest,
  events: BirdCoderCodingSessionEvent[],
  error: unknown,
): BirdCoderCodingSessionEvent | null {
  if (events.at(-1)?.kind === 'turn.failed') {
    return null;
  }

  const { event } = mapCanonicalEventToCoreEvent(
    request,
    createCanonicalFailureEvent(resolveNextCanonicalFailureSequence(events), error),
  );
  events.push(event);
  return event;
}

export function resolveRequiredRuntimeModelId(
  request: BirdCoderCoreSessionRunRequest,
): string {
  const requestModelId =
    typeof request.modelId === 'string' ? request.modelId.trim() : '';
  if (!requestModelId) {
    throw new Error(
      `Coding session run requires an explicit model id for engine "${request.engineId}".`,
    );
  }

  const optionsModelId = request.options?.model?.trim();
  if (
    optionsModelId &&
    optionsModelId.localeCompare(requestModelId, undefined, { sensitivity: 'accent' }) !== 0
  ) {
    throw new Error(
      `Coding session run model id mismatch for engine "${request.engineId}": request model "${requestModelId}" does not match options model "${optionsModelId}".`,
    );
  }

  return requestModelId;
}

export function resolveOperationStatus(
  events: BirdCoderCodingSessionEvent[],
): BirdCoderOperationDescriptor['status'] {
  const lastEvent = events.at(-1);
  if (!lastEvent) {
    return 'queued';
  }

  if (lastEvent.kind === 'turn.failed') {
    return 'failed';
  }

  if (lastEvent.kind === 'turn.completed') {
    const runtimeStatus = String(lastEvent.payload.runtimeStatus ?? '');
    return runtimeStatus === 'completed' ? 'succeeded' : 'running';
  }

  return 'running';
}

export async function executeBirdCoderCoreSessionRun(
  request: BirdCoderCoreSessionRunRequest,
): Promise<BirdCoderCoreSessionRunProjection> {
  const resolvedModelId = resolveRequiredRuntimeModelId(request);
  const { kernel, chatEngine } = createWorkbenchServerSessionEngineBinding(request.engineId);
  const runtimeDescriptor =
    chatEngine.describeRuntime?.({
      ...request.options,
      model: resolvedModelId,
    }) ??
    (() => {
      throw new Error(`Engine ${request.engineId} does not expose describeRuntime()`);
    })();
  if (
    runtimeDescriptor.modelId.trim().localeCompare(resolvedModelId, undefined, {
      sensitivity: 'accent',
    }) !== 0
  ) {
    throw new Error(
      `Coding session runtime model id mismatch for engine "${request.engineId}": runtime resolved "${runtimeDescriptor.modelId}" but request requires "${resolvedModelId}".`,
    );
  }
  const runtimeHealth = await chatEngine.getHealth?.();
  const runtimeTransportKind = runtimeHealth
    ? resolveTransportKindForRuntimeMode(
        kernel.descriptor.transportKinds,
        runtimeHealth.runtimeMode,
      )
    : runtimeDescriptor.transportKind;
  const createdAt = new Date().toISOString();
  const events: BirdCoderCodingSessionEvent[] = [];
  const artifacts: BirdCoderCodingSessionArtifact[] = [];

  const resolvedRequest = {
    ...request,
    modelId: resolvedModelId,
  };

  try {
    for await (const canonicalEvent of chatEngine.sendCanonicalEvents?.(
      request.messages,
      {
        ...request.options,
        model: resolvedModelId,
      },
    ) ?? []) {
      const projection = mapCanonicalEventToCoreEvent(
        resolvedRequest,
        canonicalEvent,
      );
      events.push(projection.event);
      if (projection.artifact) {
        artifacts.push(projection.artifact);
      }
    }
  } catch (error) {
    appendCoreSessionRunFailureEvent(resolvedRequest, events, error);
  }

  const runtime: BirdCoderCodingSessionRuntime = {
    id: request.runtimeId,
    codingSessionId: request.sessionId,
    hostMode: request.hostMode ?? 'server',
    status:
      (String(events.at(-1)?.payload.runtimeStatus ?? 'initializing') as BirdCoderCodingSessionRuntime['status']) ??
      'initializing',
    engineId: runtimeDescriptor.engineId,
    modelId: resolvedModelId,
    nativeRef: {
      engineId: runtimeDescriptor.engineId,
      transportKind: runtimeTransportKind,
      nativeSessionId: request.sessionId,
      nativeTurnContainerId: request.turnId,
      metadata: {
        approvalPolicy: runtimeDescriptor.approvalPolicy,
      },
    },
    capabilitySnapshot: runtimeDescriptor.capabilityMatrix,
    metadata: {
      approvalPolicy: runtimeDescriptor.approvalPolicy,
    },
    createdAt,
    updatedAt: events.at(-1)?.createdAt ?? createdAt,
  };

  const operation: BirdCoderOperationDescriptor = {
    operationId: `${request.turnId}:operation`,
    status: resolveOperationStatus(events),
    artifactRefs: artifacts.map((artifact) => artifact.id),
    streamUrl: `/app/v3/api/intelligence/coding_sessions/${request.sessionId}/events`,
    streamKind: 'sse',
  };

  return {
    runtime,
    events,
    artifacts,
    operation,
  };
}

export function createInMemoryBirdCoderCoreSessionProjectionStore(): BirdCoderCoreSessionProjectionStore {
  const states = new Map<string, BirdCoderCoreSessionProjectionState>();

  return {
    async getSessionSnapshot(
      codingSessionId: string,
    ): Promise<BirdCoderCoreSessionProjectionSnapshot> {
      const state = states.get(codingSessionId);
      return state
        ? cloneCoreSessionProjectionSnapshot(codingSessionId, state)
        : createEmptyCoreSessionProjectionSnapshot(codingSessionId);
    },
    async persistRunProjection(
      projection: BirdCoderCoreSessionRunProjection,
    ): Promise<BirdCoderCoreSessionProjectionSnapshot> {
      const codingSessionId = projection.runtime.codingSessionId;
      const state =
        states.get(codingSessionId) ??
        {
          runtime: null,
          events: [],
          artifacts: [],
          operationsById: new Map<string, BirdCoderOperationDescriptor>(),
        };

      state.runtime = projection.runtime;
      appendDistinctById(state.events, projection.events);
      appendDistinctById(state.artifacts, projection.artifacts);
      state.operationsById.set(projection.operation.operationId, projection.operation);
      states.set(codingSessionId, state);

      return cloneCoreSessionProjectionSnapshot(codingSessionId, state);
    },
  };
}

export async function persistBirdCoderCoreSessionRunProjection(
  store: BirdCoderCoreSessionProjectionStore,
  projection: BirdCoderCoreSessionRunProjection,
): Promise<BirdCoderCoreSessionProjectionSnapshot> {
  return store.persistRunProjection(projection);
}

export async function* streamBirdCoderCoreSessionEventEnvelopes(
  request: BirdCoderCoreSessionRunRequest,
): AsyncGenerator<BirdCoderApiEnvelope<BirdCoderCodingSessionEvent>, void, unknown> {
  const resolvedModelId = resolveRequiredRuntimeModelId(request);
  const { chatEngine } = createWorkbenchServerSessionEngineBinding(request.engineId);
  const resolvedRequest = {
    ...request,
    modelId: resolvedModelId,
  };
  const events: BirdCoderCodingSessionEvent[] = [];

  try {
    for await (const canonicalEvent of chatEngine.sendCanonicalEvents?.(
      request.messages,
      {
        ...request.options,
        model: resolvedModelId,
      },
    ) ?? []) {
      const { event } = mapCanonicalEventToCoreEvent(
        resolvedRequest,
        canonicalEvent,
      );
      events.push(event);
      yield createEnvelope(event, event.id);
    }
  } catch (error) {
    const appendedFailureEvent = appendCoreSessionRunFailureEvent(resolvedRequest, events, error);
    if (appendedFailureEvent) {
      yield createEnvelope(appendedFailureEvent, appendedFailureEvent.id);
    }
  }
}

