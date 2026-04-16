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
} from '@sdkwork/birdcoder-types';
import {
  createBirdCoderTableRecordRepository,
  type BirdCoderStorageAccess,
  type BirdCoderTableRecordRepository,
} from './dataKernel.ts';
import { coerceBirdCoderSqlEntityRow } from './sqlRowCodec.ts';

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
    id: string;
    updatedAt: string;
  },
>(left: TRecord, right: TRecord): number {
  return (
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
  modelId?: string;
  pinned: boolean;
  projectId: string;
  status: BirdCoderCodingSession['status'];
  title: string;
  unread: boolean;
  updatedAt: string;
  workspaceId: string;
}

export type BirdCoderPersistedCodingSessionMessageRecord = BirdCoderChatMessage;

export interface BirdCoderCodingSessionRepositories {
  messages: BirdCoderTableRecordRepository<BirdCoderPersistedCodingSessionMessageRecord>;
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

    return {
      id: value.id,
      workspaceId: value.workspaceId,
      projectId: value.projectId,
      title:
        typeof value.title === 'string' && value.title.trim().length > 0
          ? value.title.trim()
          : 'New Thread',
      status: normalizeCodingSessionStatus(value.status),
      hostMode: normalizeHostMode(value.hostMode),
      engineId:
        typeof value.engineId === 'string' && value.engineId.trim().length > 0
          ? (value.engineId as BirdCoderCodingSession['engineId'])
          : 'codex',
      modelId: typeof value.modelId === 'string' ? value.modelId : undefined,
      createdAt: createdAtCandidate,
      updatedAt: updatedAtCandidate,
      lastTurnAt: normalizeTimestamp(value.lastTurnAt, updatedAtCandidate),
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

  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    projectId: String(row.project_id),
    title: typeof row.title === 'string' && row.title.trim().length > 0 ? row.title.trim() : 'New Thread',
    status: normalizeCodingSessionStatus(row.status),
    hostMode: normalizeHostMode(undefined),
    engineId:
      typeof row.engine_id === 'string' && row.engine_id.trim().length > 0
        ? (row.engine_id as BirdCoderCodingSession['engineId'])
        : 'codex',
    modelId: typeof row.model_id === 'string' ? row.model_id : undefined,
    createdAt: createdAtCandidate,
    updatedAt: updatedAtCandidate,
    lastTurnAt: normalizeTimestamp(row.last_turn_at, updatedAtCandidate),
    pinned: false,
    archived: normalizeCodingSessionStatus(row.status) === 'archived',
    unread: false,
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
  };
}

function createCodingSessionRepository<TEntity>({
  binding,
  identify,
  normalize,
  providerId,
  sort,
  storage,
}: {
  binding: BirdCoderEntityStorageBinding;
  identify: (value: TEntity) => string;
  normalize: (value: unknown) => TEntity | null;
  providerId: BirdCoderDatabaseProviderId;
  sort: (left: TEntity, right: TEntity) => number;
  storage: BirdCoderStorageAccess;
}): BirdCoderTableRecordRepository<TEntity> {
  return createBirdCoderTableRecordRepository({
    binding,
    definition: getBirdCoderEntityDefinition(binding.entityName),
    providerId,
    storage,
    identify,
    normalize,
    sort,
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
    }),
  };
}
