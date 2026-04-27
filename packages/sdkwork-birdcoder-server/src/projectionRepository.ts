import type {
  BirdCoderCoreSessionProjectionSnapshot,
  BirdCoderCoreSessionProjectionStore,
  BirdCoderCoreSessionRunProjection,
} from './index.ts';
import {
  createBirdCoderStorageProvider,
  createBirdCoderTableRecordRepository,
  type BirdCoderStorageAccess,
  type BirdCoderTableRecordRepository,
  type BirdCoderTransactionalStorageProvider,
} from '../../sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts';
import { createBirdCoderPromptSkillTemplateEvidenceRepositories } from '../../sdkwork-birdcoder-infrastructure/src/storage/promptSkillTemplateEvidenceRepository.ts';
import { getBirdCoderSchemaMigrationDefinition } from '../../sdkwork-birdcoder-infrastructure/src/storage/providers.ts';
import { coerceBirdCoderSqlEntityRow } from '../../sdkwork-birdcoder-infrastructure/src/storage/sqlRowCodec.ts';
import {
  BIRDCODER_CODING_SESSION_ARTIFACT_STORAGE_BINDING,
  BIRDCODER_CODING_SESSION_EVENT_STORAGE_BINDING,
  BIRDCODER_CODING_SESSION_OPERATION_STORAGE_BINDING,
  BIRDCODER_CODING_SESSION_RUNTIME_STORAGE_BINDING,
  getBirdCoderEntityDefinition,
  parseBirdCoderApiJson,
  stringifyBirdCoderLongInteger,
  type BirdCoderCodingSessionArtifact,
  type BirdCoderCodingSessionEvent,
  type BirdCoderCodingSessionRuntime,
  type BirdCoderDatabaseProviderId,
  type BirdCoderEntityStorageBinding,
  type BirdCoderOperationDescriptor,
} from '@sdkwork/birdcoder-types';

export interface BirdCoderCoreSessionProjectionBindingSet {
  artifacts: BirdCoderEntityStorageBinding;
  events: BirdCoderEntityStorageBinding;
  operations: BirdCoderEntityStorageBinding;
  runtime: BirdCoderEntityStorageBinding;
}

interface BirdCoderCoreSessionProjectionRepositories {
  artifacts: BirdCoderTableRecordRepository<BirdCoderCodingSessionArtifact>;
  events: BirdCoderTableRecordRepository<BirdCoderCodingSessionEvent>;
  operations: BirdCoderTableRecordRepository<BirdCoderOperationDescriptor>;
  runtime: BirdCoderTableRecordRepository<BirdCoderCodingSessionRuntime>;
}

export interface ProviderBackedBirdCoderCoreSessionProjectionStore
  extends BirdCoderCoreSessionProjectionStore {
  bindings: BirdCoderCoreSessionProjectionBindingSet;
  providerId: BirdCoderDatabaseProviderId;
  provider: BirdCoderTransactionalStorageProvider;
}

export interface JsonBirdCoderCoreSessionProjectionStore
  extends ProviderBackedBirdCoderCoreSessionProjectionStore {}

export type BirdCoderCoreSessionProjectionStoreProviderInput =
  | BirdCoderDatabaseProviderId
  | BirdCoderTransactionalStorageProvider;

function buildSessionScopedBinding(
  binding: BirdCoderEntityStorageBinding,
  storageKey: string,
): BirdCoderEntityStorageBinding {
  return {
    ...binding,
    storageKey,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeRuntimeRecord(value: unknown): BirdCoderCodingSessionRuntime | null {
  if (isRecord(value) && typeof value.id === 'string' && typeof value.codingSessionId === 'string') {
    return value as unknown as BirdCoderCodingSessionRuntime;
  }

  const row = coerceBirdCoderSqlEntityRow(
    getBirdCoderEntityDefinition('coding_session_runtime'),
    value,
  );
  if (!row || typeof row.coding_session_id !== 'string' || typeof row.engine_id !== 'string') {
    return null;
  }
  const normalizedModelId =
    typeof row.model_id === 'string' && row.model_id.trim().length > 0
      ? row.model_id.trim()
      : null;
  if (!normalizedModelId) {
    return null;
  }

  return {
    id: String(row.id),
    codingSessionId: String(row.coding_session_id),
    hostMode: String(row.host_mode ?? 'server') as BirdCoderCodingSessionRuntime['hostMode'],
    status: String(row.status ?? 'ready') as BirdCoderCodingSessionRuntime['status'],
    engineId: String(row.engine_id),
    modelId: normalizedModelId,
    nativeRef: {
      engineId: String(row.engine_id),
      transportKind: String(row.transport_kind ?? 'stdio'),
      nativeSessionId:
        typeof row.native_session_id === 'string' ? row.native_session_id : undefined,
      nativeTurnContainerId:
        typeof row.native_turn_container_id === 'string'
          ? row.native_turn_container_id
          : undefined,
      metadata: isRecord(row.metadata_json) ? row.metadata_json : {},
    },
    capabilitySnapshot: (
      isRecord(row.capability_snapshot_json) ? row.capability_snapshot_json : {}
    ) as unknown as BirdCoderCodingSessionRuntime['capabilitySnapshot'],
    metadata: isRecord(row.metadata_json) ? row.metadata_json : {},
    createdAt:
      typeof row.created_at === 'string' ? row.created_at : DEFAULT_SQL_PROJECTION_TIMESTAMP,
    updatedAt:
      typeof row.updated_at === 'string' ? row.updated_at : DEFAULT_SQL_PROJECTION_TIMESTAMP,
  };
}

function normalizeEventRecord(value: unknown): BirdCoderCodingSessionEvent | null {
  if (isRecord(value) && typeof value.id === 'string' && typeof value.kind === 'string') {
    return value as unknown as BirdCoderCodingSessionEvent;
  }

  const row = coerceBirdCoderSqlEntityRow(
    getBirdCoderEntityDefinition('coding_session_event'),
    value,
  );
  if (!row || typeof row.coding_session_id !== 'string' || typeof row.event_kind !== 'string') {
    return null;
  }

  return {
    id: String(row.id),
    codingSessionId: String(row.coding_session_id),
    turnId: typeof row.turn_id === 'string' ? row.turn_id : undefined,
    runtimeId: typeof row.runtime_id === 'string' ? row.runtime_id : undefined,
    kind: String(row.event_kind),
    sequence: stringifyBirdCoderLongInteger(String(row.sequence_no ?? 0)),
    payload: isRecord(row.payload_json) ? row.payload_json : {},
    createdAt:
      typeof row.created_at === 'string' ? row.created_at : DEFAULT_SQL_PROJECTION_TIMESTAMP,
  };
}

function normalizeArtifactRecord(value: unknown): BirdCoderCodingSessionArtifact | null {
  if (isRecord(value) && typeof value.id === 'string' && typeof value.kind === 'string') {
    return value as unknown as BirdCoderCodingSessionArtifact;
  }

  const row = coerceBirdCoderSqlEntityRow(
    getBirdCoderEntityDefinition('coding_session_artifact'),
    value,
  );
  if (!row || typeof row.coding_session_id !== 'string' || typeof row.artifact_kind !== 'string') {
    return null;
  }

  const metadata = isRecord(row.metadata_json) ? row.metadata_json : {};
  const artifactStatus =
    metadata.status === 'draft' || metadata.status === 'archived' || metadata.status === 'sealed'
      ? metadata.status
      : 'sealed';

  return {
    id: String(row.id),
    codingSessionId: String(row.coding_session_id),
    turnId: typeof row.turn_id === 'string' ? row.turn_id : undefined,
    kind: String(row.artifact_kind),
    status: artifactStatus,
    title: String(row.title ?? ''),
    blobRef: typeof row.blob_ref === 'string' ? row.blob_ref : undefined,
    metadata,
    createdAt:
      typeof row.created_at === 'string' ? row.created_at : DEFAULT_SQL_PROJECTION_TIMESTAMP,
  };
}

function normalizeOperationRecord(value: unknown): BirdCoderOperationDescriptor | null {
  if (isRecord(value) && typeof value.id === 'string' && typeof value.status === 'string') {
    const artifactRefs = Array.isArray(value.artifact_refs_json)
      ? (value.artifact_refs_json as string[])
      : typeof value.artifact_refs_json === 'string'
        ? (() => {
            try {
              const parsed = parseBirdCoderApiJson(value.artifact_refs_json);
              return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
            } catch {
              return [];
            }
          })()
        : [];

    return {
      operationId: value.id,
      status: value.status as BirdCoderOperationDescriptor['status'],
      artifactRefs,
      streamKind:
        typeof value.stream_kind === 'string'
          ? (value.stream_kind as BirdCoderOperationDescriptor['streamKind'])
          : undefined,
      streamUrl: typeof value.stream_url === 'string' ? value.stream_url : undefined,
    };
  }

  return isRecord(value) && typeof value.operationId === 'string'
    ? (value as unknown as BirdCoderOperationDescriptor)
    : (() => {
        const row = coerceBirdCoderSqlEntityRow(
          getBirdCoderEntityDefinition('coding_session_operation'),
          value,
        );
        if (!row || typeof row.id !== 'string' || typeof row.status !== 'string') {
          return null;
        }

        return {
          operationId: String(row.id),
          status: String(row.status) as BirdCoderOperationDescriptor['status'],
          artifactRefs: Array.isArray(row.artifact_refs_json)
            ? row.artifact_refs_json.map((entry) => String(entry))
            : [],
          streamKind:
            typeof row.stream_kind === 'string'
              ? (row.stream_kind as BirdCoderOperationDescriptor['streamKind'])
              : undefined,
          streamUrl: typeof row.stream_url === 'string' ? row.stream_url : undefined,
        };
      })();
}

const DEFAULT_SQL_PROJECTION_TIMESTAMP = '1970-01-01T00:00:00.000Z';

function runtimeRecordToRow(value: BirdCoderCodingSessionRuntime): Record<string, unknown> {
  return {
    id: value.id,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    version: 0,
    is_deleted: false,
    coding_session_id: value.codingSessionId,
    engine_id: value.engineId,
    model_id: value.modelId,
    host_mode: value.hostMode,
    status: value.status,
    transport_kind: value.nativeRef.transportKind,
    native_session_id: value.nativeRef.nativeSessionId ?? null,
    native_turn_container_id: value.nativeRef.nativeTurnContainerId ?? null,
    capability_snapshot_json: value.capabilitySnapshot,
    metadata_json: value.metadata ?? value.nativeRef.metadata ?? {},
  };
}

function eventRecordToRow(value: BirdCoderCodingSessionEvent): Record<string, unknown> {
  return {
    id: value.id,
    created_at: value.createdAt,
    updated_at: value.createdAt,
    version: 0,
    is_deleted: false,
    coding_session_id: value.codingSessionId,
    turn_id: value.turnId ?? null,
    runtime_id: value.runtimeId ?? null,
    event_kind: value.kind,
    sequence_no: value.sequence,
    payload_json: value.payload,
  };
}

function artifactRecordToRow(value: BirdCoderCodingSessionArtifact): Record<string, unknown> {
  return {
    id: value.id,
    created_at: value.createdAt,
    updated_at: value.createdAt,
    version: 0,
    is_deleted: false,
    coding_session_id: value.codingSessionId,
    turn_id: value.turnId ?? null,
    artifact_kind: value.kind,
    title: value.title,
    blob_ref: value.blobRef ?? null,
    metadata_json: value.metadata ?? { status: value.status ?? 'sealed' },
  };
}

function operationRecordToRow(value: BirdCoderOperationDescriptor): Record<string, unknown> {
  return {
    id: value.operationId,
    created_at: DEFAULT_SQL_PROJECTION_TIMESTAMP,
    updated_at: DEFAULT_SQL_PROJECTION_TIMESTAMP,
    version: 0,
    is_deleted: false,
    coding_session_id:
      value.streamUrl?.split('/coding-sessions/')[1]?.split('/')[0] ?? '',
    turn_id: value.operationId.replace(/:operation$/, ''),
    status: value.status,
    stream_url: value.streamUrl ?? '',
    stream_kind: value.streamKind ?? 'sse',
    artifact_refs_json: value.artifactRefs,
  };
}

function selectLatestRuntime(
  runtimes: readonly BirdCoderCodingSessionRuntime[],
): BirdCoderCodingSessionRuntime | null {
  if (runtimes.length === 0) {
    return null;
  }

  return [...runtimes].sort((left, right) => {
    return (
      left.updatedAt.localeCompare(right.updatedAt) ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id)
    );
  }).at(-1)!;
}

function createProjectionRepositories(
  bindings: BirdCoderCoreSessionProjectionBindingSet,
  storage: BirdCoderStorageAccess,
  providerId: BirdCoderDatabaseProviderId,
): BirdCoderCoreSessionProjectionRepositories {
  return {
    runtime: createBirdCoderTableRecordRepository({
      binding: bindings.runtime,
      definition: getBirdCoderEntityDefinition(bindings.runtime.entityName),
      providerId,
      storage,
      identify(value) {
        return value.id;
      },
      normalize: normalizeRuntimeRecord,
      toRow: runtimeRecordToRow,
    }),
    events: createBirdCoderTableRecordRepository({
      binding: bindings.events,
      definition: getBirdCoderEntityDefinition(bindings.events.entityName),
      providerId,
      storage,
      identify(value) {
        return value.id;
      },
      normalize: normalizeEventRecord,
      toRow: eventRecordToRow,
    }),
    artifacts: createBirdCoderTableRecordRepository({
      binding: bindings.artifacts,
      definition: getBirdCoderEntityDefinition(bindings.artifacts.entityName),
      providerId,
      storage,
      identify(value) {
        return value.id;
      },
      normalize: normalizeArtifactRecord,
      toRow: artifactRecordToRow,
    }),
    operations: createBirdCoderTableRecordRepository({
      binding: bindings.operations,
      definition: getBirdCoderEntityDefinition(bindings.operations.entityName),
      providerId,
      storage,
      identify(value) {
        return value.operationId;
      },
      normalize: normalizeOperationRecord,
      toRow: operationRecordToRow,
    }),
  };
}

function resolveOperationTurnId(operationId: string): string {
  const suffix = ':operation';
  return operationId.endsWith(suffix) ? operationId.slice(0, operationId.length - suffix.length) : operationId;
}

function resolvePromptEvidenceStatus(
  operationStatus: BirdCoderOperationDescriptor['status'],
): 'completed' | 'failed' {
  return operationStatus === 'failed' ? 'failed' : 'completed';
}

function resolvePromptEvidenceScore(
  operationStatus: BirdCoderOperationDescriptor['status'],
): number {
  return operationStatus === 'failed' ? 0 : 100;
}

function resolvePromptEvidenceProjectId(
  projection: BirdCoderCoreSessionRunProjection,
): string {
  const metadata = projection.runtime.metadata;
  const projectId =
    isRecord(metadata) && typeof metadata.projectId === 'string'
      ? metadata.projectId.trim()
      : '';
  return projectId || projection.runtime.codingSessionId;
}

async function persistPromptSkillTemplateEvidence(
  projection: BirdCoderCoreSessionRunProjection,
  storage: BirdCoderStorageAccess,
  providerId: BirdCoderDatabaseProviderId,
): Promise<void> {
  const repositories = createBirdCoderPromptSkillTemplateEvidenceRepositories({
    providerId,
    storage,
  });
  const operationId = projection.operation.operationId;
  const turnId = resolveOperationTurnId(operationId);
  const status = resolvePromptEvidenceStatus(projection.operation.status);
  const projectId = resolvePromptEvidenceProjectId(projection);
  const createdAt = projection.events[0]?.createdAt ?? projection.runtime.createdAt;
  const updatedAt =
    projection.events.at(-1)?.createdAt ??
    projection.runtime.updatedAt ??
    projection.runtime.createdAt;
  const promptRunId = `prompt-run-${operationId}`;

  await repositories.promptRuns.save({
    id: promptRunId,
    projectId,
    codingSessionId: projection.runtime.codingSessionId,
    promptBundleId: `coding-server-${projection.runtime.engineId}-prompt-bundle`,
    promptAssetVersionId: `coding-server-${projection.runtime.engineId}-${projection.runtime.modelId}-prompt-asset-version`,
    status,
    inputSnapshotRef: `coding-session:${projection.runtime.codingSessionId}:turn:${turnId}:input`,
    outputSnapshotRef: `coding-session:${projection.runtime.codingSessionId}:turn:${turnId}:output`,
    createdAt,
    updatedAt,
  });

  await repositories.promptEvaluations.save({
    id: `prompt-evaluation-${operationId}`,
    promptRunId,
    evaluator: 'coding-server-projection-store',
    score: resolvePromptEvidenceScore(projection.operation.status),
    summary: {
      operationId,
      eventCount: projection.events.length,
      artifactCount: projection.artifacts.length,
      engineId: projection.runtime.engineId,
      modelId: projection.runtime.modelId,
      runtimeStatus: projection.runtime.status,
    },
    status,
    createdAt,
    updatedAt,
  });
}

function createProjectionStore(
  codingSessionId: string,
  provider: BirdCoderTransactionalStorageProvider,
  bindings: BirdCoderCoreSessionProjectionBindingSet,
): ProviderBackedBirdCoderCoreSessionProjectionStore {
  let providerReadyPromise: Promise<void> | null = null;

  async function ensureProviderReady(): Promise<void> {
    providerReadyPromise ??= (async () => {
      await provider.open();
      await provider.runMigrations([getBirdCoderSchemaMigrationDefinition('coding-server-kernel-v2')]);
    })();

    await providerReadyPromise;
  }

  return {
    bindings,
    provider,
    providerId: provider.providerId,
    async getSessionSnapshot(
      requestedCodingSessionId: string,
    ): Promise<BirdCoderCoreSessionProjectionSnapshot> {
      await ensureProviderReady();

      const sessionId = requestedCodingSessionId || codingSessionId;
      const repositories = createProjectionRepositories(bindings, provider, provider.providerId);
      const [runtimes, events, artifacts, operations] = await Promise.all([
        repositories.runtime.list(),
        repositories.events.list(),
        repositories.artifacts.list(),
        repositories.operations.list(),
      ]);

      return {
        codingSessionId: sessionId,
        runtime: selectLatestRuntime(runtimes),
        events,
        artifacts,
        operations,
      };
    },
    async persistRunProjection(
      projection: BirdCoderCoreSessionRunProjection,
    ): Promise<BirdCoderCoreSessionProjectionSnapshot> {
      await ensureProviderReady();

      const unitOfWork = await provider.beginUnitOfWork();
      await unitOfWork.withinTransaction(async () => {
        const repositories = createProjectionRepositories(bindings, unitOfWork, provider.providerId);

        await Promise.all([
          repositories.runtime.save(projection.runtime),
          repositories.events.saveMany(projection.events),
          repositories.artifacts.saveMany(projection.artifacts),
          repositories.operations.save(projection.operation),
          persistPromptSkillTemplateEvidence(projection, unitOfWork, provider.providerId),
        ]);
      });

      return this.getSessionSnapshot(projection.runtime.codingSessionId);
    },
  };
}

export function buildBirdCoderCoreSessionProjectionBindings(
  codingSessionId: string,
): BirdCoderCoreSessionProjectionBindingSet {
  return {
    runtime: buildSessionScopedBinding(
      BIRDCODER_CODING_SESSION_RUNTIME_STORAGE_BINDING,
      `coding-session-runtimes.${codingSessionId}.v1`,
    ),
    events: buildSessionScopedBinding(
      BIRDCODER_CODING_SESSION_EVENT_STORAGE_BINDING,
      `coding-session-events.${codingSessionId}.v1`,
    ),
    artifacts: buildSessionScopedBinding(
      BIRDCODER_CODING_SESSION_ARTIFACT_STORAGE_BINDING,
      `coding-session-artifacts.${codingSessionId}.v1`,
    ),
    operations: buildSessionScopedBinding(
      BIRDCODER_CODING_SESSION_OPERATION_STORAGE_BINDING,
      `coding-session-operations.${codingSessionId}.v1`,
    ),
  };
}

export function createProviderBackedBirdCoderCoreSessionProjectionStore(
  codingSessionId: string,
  providerInput: BirdCoderCoreSessionProjectionStoreProviderInput =
    BIRDCODER_CODING_SESSION_RUNTIME_STORAGE_BINDING.preferredProvider,
): ProviderBackedBirdCoderCoreSessionProjectionStore {
  const bindings = buildBirdCoderCoreSessionProjectionBindings(codingSessionId);
  const provider =
    typeof providerInput === 'string'
      ? createBirdCoderStorageProvider(providerInput)
      : providerInput;
  return createProjectionStore(codingSessionId, provider, bindings);
}

export function createJsonBirdCoderCoreSessionProjectionStore(
  codingSessionId: string,
): JsonBirdCoderCoreSessionProjectionStore {
  return createProviderBackedBirdCoderCoreSessionProjectionStore(codingSessionId);
}
