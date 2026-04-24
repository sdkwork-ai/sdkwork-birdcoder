import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderDatabaseProviderId,
  BirdCoderHostMode,
  BirdCoderEntityStorageBinding,
} from '@sdkwork/birdcoder-types';
import {
  BIRDCODER_CODING_SESSION_MESSAGE_STORAGE_BINDING,
  BIRDCODER_CODING_SESSION_STORAGE_BINDING,
  BIRDCODER_CODING_SESSION_STATUSES,
  BIRDCODER_CODING_SESSION_MESSAGE_ROLES,
  BIRDCODER_HOST_MODES,
  getBirdCoderEntityDefinition,
  resolveBirdCoderSessionSortTimestamp,
} from '@sdkwork/birdcoder-types';
import {
  createBirdCoderTableRecordRepository,
  type BirdCoderStorageAccess,
  type BirdCoderTableRecordRepository,
} from './dataKernel.ts';
import {
  createBirdCoderCodingSessionPromptHistoryRepository,
  type BirdCoderCodingSessionPromptHistoryRepository,
} from './codingSessionPromptEntryRepository.ts';
import { coerceBirdCoderSqlEntityRow } from './sqlRowCodec.ts';
import type { BirdCoderSqlRow } from './sqlPlans.ts';

const ZERO_TIMESTAMP = new Date(0).toISOString();
const CODING_SESSION_STATUS_SET = new Set<string>(BIRDCODER_CODING_SESSION_STATUSES);
const CODING_SESSION_MESSAGE_ROLE_SET = new Set<string>(BIRDCODER_CODING_SESSION_MESSAGE_ROLES);
const HOST_MODE_SET = new Set<string>(BIRDCODER_HOST_MODES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  return Number.isNaN(Date.parse(value)) ? fallback : value;
}

function resolveSortTimestamp(value: string | undefined): number {
  if (typeof value !== 'string') {
    return 0;
  }

  const parsedValue = Date.parse(value);
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
}

function normalizeHostMode(value: unknown): BirdCoderHostMode {
  return typeof value === 'string' && HOST_MODE_SET.has(value)
    ? (value as BirdCoderHostMode)
    : 'desktop';
}

function normalizeCodingSessionStatus(value: unknown): BirdCoderCodingSession['status'] {
  return typeof value === 'string' && CODING_SESSION_STATUS_SET.has(value)
    ? (value as BirdCoderCodingSession['status'])
    : 'draft';
}

function normalizeCodingSessionMessageRole(value: unknown): BirdCoderChatMessage['role'] {
  return typeof value === 'string' && CODING_SESSION_MESSAGE_ROLE_SET.has(value)
    ? (value as BirdCoderChatMessage['role'])
    : 'user';
}

function sortByUpdatedAtDescending<
  TRecord extends {
    createdAt: string;
    id: string;
    lastTurnAt?: string;
    sortTimestamp?: number;
    transcriptUpdatedAt?: string | null;
    updatedAt: string;
  },
>(left: TRecord, right: TRecord): number {
  return (
    resolveBirdCoderSessionSortTimestamp(right) -
      resolveBirdCoderSessionSortTimestamp(left) ||
    resolveSortTimestamp(right.updatedAt) - resolveSortTimestamp(left.updatedAt) ||
    left.id.localeCompare(right.id)
  );
}

function sortByCreatedAtAscending<
  TRecord extends {
    createdAt: string;
    id: string;
  },
>(left: TRecord, right: TRecord): number {
  return (
    resolveSortTimestamp(left.createdAt) - resolveSortTimestamp(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

export interface BirdCoderPersistedCodingSessionRecord {
  archived: boolean;
  createdAt: string;
  engineId: BirdCoderCodingSession['engineId'];
  hostMode: BirdCoderCodingSession['hostMode'];
  id: string;
  lastTurnAt?: string;
  modelId: string;
  pinned: boolean;
  projectId: string;
  sortTimestamp?: number;
  status: BirdCoderCodingSession['status'];
  title: string;
  transcriptUpdatedAt?: string | null;
  unread: boolean;
  updatedAt: string;
  workspaceId: string;
}

export type BirdCoderPersistedCodingSessionMessageRecord = BirdCoderChatMessage;

export interface BirdCoderCodingSessionRepositories {
  messages: BirdCoderTableRecordRepository<BirdCoderPersistedCodingSessionMessageRecord>;
  promptEntries: BirdCoderCodingSessionPromptHistoryRepository;
  sessions: BirdCoderTableRecordRepository<BirdCoderPersistedCodingSessionRecord>;
}

export interface CreateBirdCoderCodingSessionRepositoriesOptions {
  providerId: BirdCoderDatabaseProviderId;
  storage: BirdCoderStorageAccess;
}

function normalizeCodingSessionStorageRecord(
  value: unknown,
): BirdCoderPersistedCodingSessionRecord | null {
  if (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.workspaceId === 'string' &&
    typeof value.projectId === 'string'
  ) {
    const createdAtCandidate = normalizeTimestamp(value.createdAt, ZERO_TIMESTAMP);
    const updatedAtCandidate = normalizeTimestamp(value.updatedAt, createdAtCandidate);
    const lastTurnAtCandidate = normalizeTimestamp(value.lastTurnAt, updatedAtCandidate);
    const transcriptUpdatedAtCandidate =
      typeof value.transcriptUpdatedAt === 'string' &&
      !Number.isNaN(Date.parse(value.transcriptUpdatedAt))
        ? value.transcriptUpdatedAt
        : null;
    const sortTimestampCandidate =
      typeof value.sortTimestamp === 'number' && Number.isFinite(value.sortTimestamp)
        ? value.sortTimestamp
        : resolveBirdCoderSessionSortTimestamp({
            createdAt: createdAtCandidate,
            updatedAt: updatedAtCandidate,
            lastTurnAt: lastTurnAtCandidate,
            transcriptUpdatedAt: transcriptUpdatedAtCandidate,
          });
    const normalizedEngineId =
      typeof value.engineId === 'string' && value.engineId.trim().length > 0
        ? (value.engineId.trim() as BirdCoderCodingSession['engineId'])
        : null;
    if (!normalizedEngineId) {
      return null;
    }
    const normalizedModelId =
      typeof value.modelId === 'string' && value.modelId.trim().length > 0
        ? value.modelId.trim()
        : null;
    if (!normalizedModelId) {
      return null;
    }

    return {
      id: value.id,
      workspaceId: value.workspaceId,
      projectId: value.projectId,
      title:
        typeof value.title === 'string' && value.title.trim().length > 0
          ? value.title.trim()
          : 'New Session',
      status: normalizeCodingSessionStatus(value.status),
      hostMode: normalizeHostMode(value.hostMode),
      engineId: normalizedEngineId,
      modelId: normalizedModelId,
      createdAt: createdAtCandidate,
      updatedAt: updatedAtCandidate,
      lastTurnAt: lastTurnAtCandidate,
      sortTimestamp: sortTimestampCandidate,
      transcriptUpdatedAt: transcriptUpdatedAtCandidate,
      pinned: value.pinned === true,
      archived:
        value.archived === true || normalizeCodingSessionStatus(value.status) === 'archived',
      unread: value.unread === true,
    };
  }

  const row = coerceBirdCoderSqlEntityRow(getBirdCoderEntityDefinition('coding_session'), value);
  if (!row || typeof row.workspace_id !== 'string' || typeof row.project_id !== 'string') {
    return null;
  }

  const createdAtCandidate = normalizeTimestamp(row.created_at, ZERO_TIMESTAMP);
  const updatedAtCandidate = normalizeTimestamp(row.updated_at, createdAtCandidate);
  const lastTurnAtCandidate = normalizeTimestamp(row.last_turn_at, updatedAtCandidate);
  const transcriptUpdatedAtCandidate =
    typeof row.transcript_updated_at === 'string' &&
    !Number.isNaN(Date.parse(row.transcript_updated_at))
      ? row.transcript_updated_at
      : null;
  const rowSortTimestampCandidate =
    typeof row.sort_timestamp === 'number' && Number.isFinite(row.sort_timestamp)
      ? row.sort_timestamp
      : resolveBirdCoderSessionSortTimestamp({
          createdAt: createdAtCandidate,
          updatedAt: updatedAtCandidate,
          lastTurnAt: lastTurnAtCandidate,
          transcriptUpdatedAt: transcriptUpdatedAtCandidate,
        });
  const normalizedEngineId =
    typeof row.engine_id === 'string' && row.engine_id.trim().length > 0
      ? (row.engine_id.trim() as BirdCoderCodingSession['engineId'])
      : null;
  if (!normalizedEngineId) {
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
    workspaceId: String(row.workspace_id),
    projectId: String(row.project_id),
    title: typeof row.title === 'string' && row.title.trim().length > 0 ? row.title.trim() : 'New Session',
    status: normalizeCodingSessionStatus(row.status),
    hostMode: normalizeHostMode(row.host_mode),
    engineId: normalizedEngineId,
    modelId: normalizedModelId,
    createdAt: createdAtCandidate,
    updatedAt: updatedAtCandidate,
    lastTurnAt: lastTurnAtCandidate,
    sortTimestamp: rowSortTimestampCandidate,
    transcriptUpdatedAt: transcriptUpdatedAtCandidate,
    pinned: row.pinned === true,
    archived:
      row.archived === true || normalizeCodingSessionStatus(row.status) === 'archived',
    unread: row.unread === true,
  };
}

function normalizeCodingSessionMessageStorageRecord(
  value: unknown,
): BirdCoderPersistedCodingSessionMessageRecord | null {
  if (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.codingSessionId === 'string'
  ) {
    return {
      id: value.id,
      codingSessionId: value.codingSessionId,
      turnId: typeof value.turnId === 'string' ? value.turnId : undefined,
      role: normalizeCodingSessionMessageRole(value.role),
      content: typeof value.content === 'string' ? value.content : '',
      metadata: isRecord(value.metadata) ? value.metadata : undefined,
      createdAt: normalizeTimestamp(value.createdAt, ZERO_TIMESTAMP),
      timestamp: typeof value.timestamp === 'number' ? value.timestamp : undefined,
      name: typeof value.name === 'string' ? value.name : undefined,
      tool_calls: Array.isArray(value.tool_calls) ? value.tool_calls : undefined,
      tool_call_id: typeof value.tool_call_id === 'string' ? value.tool_call_id : undefined,
      fileChanges: Array.isArray(value.fileChanges) ? value.fileChanges as BirdCoderChatMessage['fileChanges'] : undefined,
      commands: Array.isArray(value.commands) ? value.commands as BirdCoderChatMessage['commands'] : undefined,
      taskProgress: isRecord(value.taskProgress)
        ? (value.taskProgress as unknown as BirdCoderChatMessage['taskProgress'])
        : undefined,
    };
  }

  const row = coerceBirdCoderSqlEntityRow(
    getBirdCoderEntityDefinition('coding_session_message'),
    value,
  );
  if (!row || typeof row.coding_session_id !== 'string') {
    return null;
  }

  return {
    id: String(row.id),
    codingSessionId: String(row.coding_session_id),
    turnId: typeof row.turn_id === 'string' ? row.turn_id : undefined,
    role: normalizeCodingSessionMessageRole(row.role),
    content: typeof row.content === 'string' ? row.content : '',
    metadata: isRecord(row.metadata_json) ? row.metadata_json : undefined,
    createdAt: normalizeTimestamp(row.created_at, ZERO_TIMESTAMP),
    timestamp: typeof row.timestamp_ms === 'number' && Number.isFinite(row.timestamp_ms)
      ? row.timestamp_ms
      : undefined,
    name: typeof row.name === 'string' ? row.name : undefined,
    tool_calls: Array.isArray(row.tool_calls_json) ? row.tool_calls_json : undefined,
    tool_call_id: typeof row.tool_call_id === 'string' ? row.tool_call_id : undefined,
    fileChanges: Array.isArray(row.file_changes_json)
      ? (row.file_changes_json as BirdCoderChatMessage['fileChanges'])
      : undefined,
    commands: Array.isArray(row.commands_json)
      ? (row.commands_json as BirdCoderChatMessage['commands'])
      : undefined,
    taskProgress: isRecord(row.task_progress_json)
      ? (row.task_progress_json as unknown as BirdCoderChatMessage['taskProgress'])
      : undefined,
  };
}

function toCodingSessionStorageRow(
  value: BirdCoderPersistedCodingSessionRecord,
): BirdCoderSqlRow {
  return {
    id: value.id,
    workspace_id: value.workspaceId,
    project_id: value.projectId,
    title: value.title,
    status: value.status,
    entry_surface: null,
    host_mode: value.hostMode,
    engine_id: value.engineId,
    model_id: value.modelId,
    last_turn_at: value.lastTurnAt ?? null,
    sort_timestamp: value.sortTimestamp ?? null,
    transcript_updated_at: value.transcriptUpdatedAt ?? null,
    pinned: value.pinned === true,
    archived: value.archived === true,
    unread: value.unread === true,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
  };
}

function toCodingSessionMessageStorageRow(
  value: BirdCoderPersistedCodingSessionMessageRecord,
): BirdCoderSqlRow {
  return {
    id: value.id,
    coding_session_id: value.codingSessionId,
    turn_id: value.turnId ?? null,
    role: value.role,
    content: value.content,
    metadata_json: value.metadata ?? null,
    timestamp_ms: value.timestamp ?? null,
    name: value.name ?? null,
    tool_calls_json: value.tool_calls ?? null,
    tool_call_id: value.tool_call_id ?? null,
    file_changes_json: value.fileChanges ?? null,
    commands_json: value.commands ?? null,
    task_progress_json: value.taskProgress ?? null,
    created_at: value.createdAt,
    updated_at: value.createdAt,
  };
}

function createCodingSessionRepository<TEntity>({
  binding,
  identify,
  normalize,
  providerId,
  sort,
  storage,
  toRow,
}: {
  binding: BirdCoderEntityStorageBinding;
  identify: (value: TEntity) => string;
  normalize: (value: unknown) => TEntity | null;
  providerId: BirdCoderDatabaseProviderId;
  sort: (left: TEntity, right: TEntity) => number;
  storage: BirdCoderStorageAccess;
  toRow?: (value: TEntity) => BirdCoderSqlRow;
}): BirdCoderTableRecordRepository<TEntity> {
  return createBirdCoderTableRecordRepository({
    binding,
    definition: getBirdCoderEntityDefinition(binding.entityName),
    providerId,
    storage,
    identify,
    normalize,
    sort,
    toRow,
  });
}

export function createBirdCoderCodingSessionRepositories({
  providerId,
  storage,
}: CreateBirdCoderCodingSessionRepositoriesOptions): BirdCoderCodingSessionRepositories {
  return {
    sessions: createCodingSessionRepository({
      binding: BIRDCODER_CODING_SESSION_STORAGE_BINDING,
      providerId,
      storage,
      identify(value) {
        return value.id;
      },
      normalize: normalizeCodingSessionStorageRecord,
      sort: sortByUpdatedAtDescending,
      toRow: toCodingSessionStorageRow,
    }),
    promptEntries: createBirdCoderCodingSessionPromptHistoryRepository({
      providerId,
      storage,
    }),
    messages: createCodingSessionRepository({
      binding: BIRDCODER_CODING_SESSION_MESSAGE_STORAGE_BINDING,
      providerId,
      storage,
      identify(value) {
        return value.id;
      },
      normalize: normalizeCodingSessionMessageStorageRecord,
      sort: sortByCreatedAtAscending,
      toRow: toCodingSessionMessageStorageRow,
    }),
  };
}
