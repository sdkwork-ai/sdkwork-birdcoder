import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderDatabaseProviderId,
  BirdCoderHostMode,
  BirdCoderEntityStorageBinding,
} from '@sdkwork/birdcoder-pc-types';
import {
  BIRDCODER_CODING_SESSION_MESSAGE_STORAGE_BINDING,
  BIRDCODER_CODING_SESSION_STORAGE_BINDING,
  BIRDCODER_CODING_SESSION_STATUSES,
  BIRDCODER_CODING_SESSION_MESSAGE_ROLES,
  BIRDCODER_HOST_MODES,
  compareBirdCoderSessionSortTimestamp,
  getBirdCoderEntityDefinition,
  resolveBirdCoderSessionSortTimestampString,
  stringifyBirdCoderLongInteger,
} from '@sdkwork/birdcoder-pc-types';
import { normalizeBirdCoderCodeEngineNativeSessionId } from '@sdkwork/birdcoder-pc-codeengine';
import { clampListPageSize, MAX_LIST_PAGE_SIZE } from '@sdkwork/utils/pagination';
import {
  createBirdCoderTableRecordRepository,
  type BirdCoderStorageAccess,
  type BirdCoderSqlPlanStorageAccess,
  type BirdCoderTableRecordRepository,
} from './dataKernel.ts';
import { createBirdCoderStorageDialect } from './providers.ts';
import {
  createBirdCoderCodingSessionPromptHistoryRepository,
  type BirdCoderCodingSessionPromptHistoryRepository,
} from './codingSessionPromptEntryRepository.ts';
import { coerceBirdCoderSqlEntityRow } from './sqlRowCodec.ts';
import type { BirdCoderSqlPlan, BirdCoderSqlRow } from './sqlPlans.ts';

const ZERO_TIMESTAMP = new Date(0).toISOString();
const CODING_SESSION_STATUS_SET = new Set<string>(BIRDCODER_CODING_SESSION_STATUSES);
const CODING_SESSION_MESSAGE_ROLE_SET = new Set<string>(BIRDCODER_CODING_SESSION_MESSAGE_ROLES);
const HOST_MODE_SET = new Set<string>(BIRDCODER_HOST_MODES);

function normalizeCodingSessionNativeSessionId(
  value: unknown,
  engineId: string | null | undefined,
): string | undefined {
  return typeof value === 'string'
    ? normalizeBirdCoderCodeEngineNativeSessionId(value, engineId) ?? undefined
    : undefined;
}

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
    sortTimestamp?: string;
    transcriptUpdatedAt?: string | null;
    updatedAt: string;
  },
>(left: TRecord, right: TRecord): number {
  return (
    compareBirdCoderSessionSortTimestamp(right, left) ||
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

function normalizeOptionalLongIntegerString(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    return undefined;
  }
  return stringifyBirdCoderLongInteger(value);
}

export interface BirdCoderPersistedCodingSessionRecord {
  archived: boolean;
  createdAt: string;
  engineId: BirdCoderCodingSession['engineId'];
  hostMode: BirdCoderCodingSession['hostMode'];
  id: string;
  lastTurnAt?: string;
  modelId: string;
  nativeSessionId?: string;
  nativeAttributes?: BirdCoderCodingSession['nativeAttributes'];
  pinned: boolean;
  projectId: string;
  sortTimestamp?: string;
  status: BirdCoderCodingSession['status'];
  title: string;
  transcriptUpdatedAt?: string | null;
  unread: boolean;
  updatedAt: string;
  workspaceId: string;
}

function normalizeOptionalSessionAttribute(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeNativeSessionAttributes(
  value: unknown,
): BirdCoderCodingSession['nativeAttributes'] {
  if (!isRecord(value)) {
    return undefined;
  }
  const schemaVersion =
    typeof value.schemaVersion === 'number' && Number.isSafeInteger(value.schemaVersion)
      ? value.schemaVersion
      : 1;
  return {
    schemaVersion,
    sessionTreeId: normalizeOptionalSessionAttribute(value.sessionTreeId),
    parentSessionId: normalizeOptionalSessionAttribute(value.parentSessionId),
    forkedFromSessionId: normalizeOptionalSessionAttribute(value.forkedFromSessionId),
    title: normalizeOptionalSessionAttribute(value.title),
    preview: normalizeOptionalSessionAttribute(value.preview),
    source: normalizeOptionalSessionAttribute(value.source),
    providerVersion: normalizeOptionalSessionAttribute(value.providerVersion),
    modelProvider: normalizeOptionalSessionAttribute(value.modelProvider),
    projectId: normalizeOptionalSessionAttribute(value.projectId),
    cwd: normalizeOptionalSessionAttribute(value.cwd),
    gitBranch: normalizeOptionalSessionAttribute(value.gitBranch),
    gitCommit: normalizeOptionalSessionAttribute(value.gitCommit),
    gitRepositoryUrl: normalizeOptionalSessionAttribute(value.gitRepositoryUrl),
    agentName: normalizeOptionalSessionAttribute(value.agentName),
    agentRole: normalizeOptionalSessionAttribute(value.agentRole),
    isEphemeral: value.isEphemeral === true,
    isSidechain: value.isSidechain === true,
    metadata: isRecord(value.metadata) ? value.metadata : {},
  };
}

function nativeSessionAttributesFromRow(
  row: BirdCoderSqlRow,
): BirdCoderCodingSession['nativeAttributes'] {
  return normalizeNativeSessionAttributes({
    schemaVersion: row.native_schema_version,
    sessionTreeId: row.native_session_tree_id,
    parentSessionId: row.native_parent_session_id,
    forkedFromSessionId: row.native_forked_from_session_id,
    title: row.native_title,
    preview: row.native_preview,
    source: row.native_source,
    providerVersion: row.provider_version,
    modelProvider: row.model_provider,
    projectId: row.native_project_id,
    cwd: row.native_cwd,
    gitBranch: row.native_git_branch,
    gitCommit: row.native_git_commit,
    gitRepositoryUrl: row.native_git_repository_url,
    agentName: row.native_agent_name,
    agentRole: row.native_agent_role,
    isEphemeral: row.native_is_ephemeral === true || row.native_is_ephemeral === 1,
    isSidechain: row.native_is_sidechain === true || row.native_is_sidechain === 1,
    metadata: row.native_metadata_json,
  });
}

export type BirdCoderPersistedCodingSessionMessageRecord = BirdCoderChatMessage;

export interface BirdCoderPersistedCodingSessionMessageMetadata {
  codingSessionId: string;
  latestTranscriptUpdatedAt: string | null;
  messageCount: number;
  nativeTranscriptUpdatedAt: string | null;
}

export interface BirdCoderCodingSessionListFilters {
  engineId?: string;
  projectId?: string;
  workspaceId?: string;
}

export interface BirdCoderCodingSessionListPage {
  items: BirdCoderPersistedCodingSessionRecord[];
  total: number;
}

export interface BirdCoderCodingSessionListPagination {
  limit?: number;
  offset?: number;
}

export interface BirdCoderCodingSessionRepositories {
  deleteMessagesByCodingSessionIds(codingSessionIds: readonly string[]): Promise<void>;
  deleteMessagesByProjectIds(projectIds: readonly string[]): Promise<void>;
  deleteSessionsByProjectIds(projectIds: readonly string[]): Promise<void>;
  listMessagesByCodingSessionIds(
    codingSessionIds: readonly string[],
    pagination?: BirdCoderCodingSessionListPagination,
  ): Promise<BirdCoderPersistedCodingSessionMessageRecord[]>;
  listSessionsByProjectIds(
    projectIds: readonly string[],
  ): Promise<BirdCoderPersistedCodingSessionRecord[]>;
  listSessionsFiltered(
    filters: BirdCoderCodingSessionListFilters,
    pagination: BirdCoderCodingSessionListPagination,
  ): Promise<BirdCoderCodingSessionListPage>;
  messages: BirdCoderTableRecordRepository<BirdCoderPersistedCodingSessionMessageRecord>;
  promptEntries: BirdCoderCodingSessionPromptHistoryRepository;
  readMessageMetadataByCodingSessionIds(
    codingSessionIds: readonly string[],
  ): Promise<Map<string, BirdCoderPersistedCodingSessionMessageMetadata>>;
  sessions: BirdCoderTableRecordRepository<BirdCoderPersistedCodingSessionRecord>;
}

export interface CreateBirdCoderCodingSessionRepositoriesOptions {
  providerId: BirdCoderDatabaseProviderId;
  storage: BirdCoderStorageAccess;
}

const BIRDCODER_PERSISTED_MESSAGE_ID_METADATA_KEY =
  '__sdkworkBirdCoderTranscriptMessageId';
const CODEX_NATIVE_MESSAGE_ID_SEGMENT = ':native-message:';

function buildCodingSessionMessageStorageId(
  value: Pick<BirdCoderChatMessage, 'codingSessionId' | 'id'>,
): string {
  return JSON.stringify([value.codingSessionId.trim(), value.id.trim()]);
}

function readCodingSessionMessageMetadata(
  value: unknown,
): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function readOriginalCodingSessionMessageIdFromMetadata(
  metadata: Record<string, unknown> | undefined,
): string | undefined {
  const originalMessageId = metadata?.[BIRDCODER_PERSISTED_MESSAGE_ID_METADATA_KEY];
  return typeof originalMessageId === 'string' && originalMessageId.trim().length > 0
    ? originalMessageId
    : undefined;
}

function omitCodingSessionMessageStorageMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!metadata || !(BIRDCODER_PERSISTED_MESSAGE_ID_METADATA_KEY in metadata)) {
    return metadata;
  }

  const {
    [BIRDCODER_PERSISTED_MESSAGE_ID_METADATA_KEY]: _originalMessageId,
    ...publicMetadata
  } = metadata;
  void _originalMessageId;
  return Object.keys(publicMetadata).length > 0 ? publicMetadata : undefined;
}

function buildCodingSessionMessageStorageMetadata(
  value: BirdCoderPersistedCodingSessionMessageRecord,
): Record<string, unknown> | null {
  return {
    ...(isRecord(value.metadata) ? value.metadata : {}),
    [BIRDCODER_PERSISTED_MESSAGE_ID_METADATA_KEY]: value.id,
  };
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
    const sortTimestampCandidate = resolveBirdCoderSessionSortTimestampString({
      createdAt: createdAtCandidate,
      updatedAt: updatedAtCandidate,
      lastTurnAt: lastTurnAtCandidate,
      sortTimestamp: normalizeOptionalLongIntegerString(value.sortTimestamp),
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
      nativeSessionId: normalizeCodingSessionNativeSessionId(
        value.nativeSessionId,
        normalizedEngineId,
      ),
      nativeAttributes: normalizeNativeSessionAttributes(value.nativeAttributes),
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
  const rowSortTimestampCandidate = resolveBirdCoderSessionSortTimestampString({
    createdAt: createdAtCandidate,
    updatedAt: updatedAtCandidate,
    lastTurnAt: lastTurnAtCandidate,
    sortTimestamp: normalizeOptionalLongIntegerString(row.sort_timestamp),
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
    nativeSessionId: normalizeCodingSessionNativeSessionId(
      row.native_session_id,
      normalizedEngineId,
    ),
    nativeAttributes: nativeSessionAttributesFromRow(row),
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
    const metadata = readCodingSessionMessageMetadata(value.metadata);
    return {
      id: value.id,
      codingSessionId: value.codingSessionId,
      turnId: typeof value.turnId === 'string' ? value.turnId : undefined,
      role: normalizeCodingSessionMessageRole(value.role),
      content: typeof value.content === 'string' ? value.content : '',
      metadata: omitCodingSessionMessageStorageMetadata(metadata),
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

  const metadata = readCodingSessionMessageMetadata(row.metadata_json);
  const originalMessageId = readOriginalCodingSessionMessageIdFromMetadata(metadata);
  return {
    id: originalMessageId ?? String(row.id),
    codingSessionId: String(row.coding_session_id),
    turnId: typeof row.turn_id === 'string' ? row.turn_id : undefined,
    role: normalizeCodingSessionMessageRole(row.role),
    content: typeof row.content === 'string' ? row.content : '',
    metadata: omitCodingSessionMessageStorageMetadata(metadata),
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
    entry_surface: 'code',
    host_mode: value.hostMode,
    engine_id: value.engineId,
    model_id: value.modelId,
    native_session_id: value.nativeSessionId ?? null,
    native_session_tree_id: value.nativeAttributes?.sessionTreeId ?? null,
    native_parent_session_id: value.nativeAttributes?.parentSessionId ?? null,
    native_forked_from_session_id: value.nativeAttributes?.forkedFromSessionId ?? null,
    native_title: value.nativeAttributes?.title ?? null,
    native_preview: value.nativeAttributes?.preview ?? null,
    native_source: value.nativeAttributes?.source ?? null,
    provider_version: value.nativeAttributes?.providerVersion ?? null,
    model_provider: value.nativeAttributes?.modelProvider ?? null,
    native_project_id: value.nativeAttributes?.projectId ?? null,
    native_cwd: value.nativeAttributes?.cwd ?? null,
    native_git_branch: value.nativeAttributes?.gitBranch ?? null,
    native_git_commit: value.nativeAttributes?.gitCommit ?? null,
    native_git_repository_url: value.nativeAttributes?.gitRepositoryUrl ?? null,
    native_agent_name: value.nativeAttributes?.agentName ?? null,
    native_agent_role: value.nativeAttributes?.agentRole ?? null,
    native_is_ephemeral: value.nativeAttributes?.isEphemeral === true,
    native_is_sidechain: value.nativeAttributes?.isSidechain === true,
    native_schema_version: value.nativeAttributes?.schemaVersion ?? 1,
    native_metadata_json: value.nativeAttributes?.metadata ?? {},
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
    id: buildCodingSessionMessageStorageId(value),
    coding_session_id: value.codingSessionId,
    turn_id: value.turnId ?? null,
    role: value.role,
    content: value.content,
    metadata_json: buildCodingSessionMessageStorageMetadata(value),
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

function supportsSqlPlanExecution(
  storage: BirdCoderStorageAccess,
): storage is BirdCoderStorageAccess & BirdCoderSqlPlanStorageAccess {
  return (
    'sqlPlanExecutionEnabled' in storage &&
    storage.sqlPlanExecutionEnabled === true &&
    'executeSqlPlan' in storage &&
    typeof storage.executeSqlPlan === 'function'
  );
}

function normalizeBatchIds(values: readonly string[]): string[] {
  const ids: string[] = [];
  const seenIds = new Set<string>();
  for (const value of values) {
    const id = value.trim();
    if (!id || seenIds.has(id)) {
      continue;
    }
    seenIds.add(id);
    ids.push(id);
  }
  return ids;
}

function buildPlaceholderList(
  providerId: BirdCoderDatabaseProviderId,
  startIndex: number,
  count: number,
): string {
  const dialect = createBirdCoderStorageDialect(providerId);
  return Array.from({ length: count }, (_, index) =>
    dialect.buildPlaceholder(startIndex + index),
  ).join(', ');
}

function defaultSoftDeleteValue(providerId: BirdCoderDatabaseProviderId): boolean | number {
  return providerId === 'sqlite' ? 0 : false;
}

function normalizeCodingSessionRows(
  values: readonly unknown[],
): BirdCoderPersistedCodingSessionRecord[] {
  return values
    .map(normalizeCodingSessionStorageRecord)
    .filter((record): record is BirdCoderPersistedCodingSessionRecord => record !== null)
    .sort(sortByUpdatedAtDescending);
}

function normalizeCodingSessionMessageRows(
  values: readonly unknown[],
  options: {
    preserveOrder?: boolean;
  } = {},
): BirdCoderPersistedCodingSessionMessageRecord[] {
  const normalizedRows = values
    .map(normalizeCodingSessionMessageStorageRecord)
    .filter((record): record is BirdCoderPersistedCodingSessionMessageRecord => record !== null);
  if (options.preserveOrder === true) {
    return normalizedRows;
  }

  return normalizedRows.sort(sortByCreatedAtAscending);
}

function normalizeNullableMetadataTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  return Number.isNaN(Date.parse(value)) ? null : value;
}

function normalizeMetadataCount(value: unknown): number {
  const numericValue = typeof value === 'bigint' ? Number(value) : Number(value ?? 0);
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.floor(numericValue) : 0;
}

function readMessageMetadataRowCodingSessionId(value: Record<string, unknown>): string {
  const codingSessionId = value.coding_session_id ?? value.codingSessionId;
  return typeof codingSessionId === 'string' ? codingSessionId.trim() : '';
}

function normalizeMessageMetadataRows(
  values: readonly unknown[],
): Map<string, BirdCoderPersistedCodingSessionMessageMetadata> {
  const metadataByCodingSessionId = new Map<
    string,
    BirdCoderPersistedCodingSessionMessageMetadata
  >();
  for (const value of values) {
    if (!isRecord(value)) {
      continue;
    }

    const codingSessionId = readMessageMetadataRowCodingSessionId(value);
    if (!codingSessionId) {
      continue;
    }

    metadataByCodingSessionId.set(codingSessionId, {
      codingSessionId,
      latestTranscriptUpdatedAt: normalizeNullableMetadataTimestamp(
        value.latest_transcript_updated_at ?? value.latestTranscriptUpdatedAt,
      ),
      messageCount: normalizeMetadataCount(value.message_count ?? value.messageCount),
      nativeTranscriptUpdatedAt: normalizeNullableMetadataTimestamp(
        value.native_transcript_updated_at ?? value.nativeTranscriptUpdatedAt,
      ),
    });
  }
  return metadataByCodingSessionId;
}

function buildCodingSessionListByProjectIdsPlan(
  providerId: BirdCoderDatabaseProviderId,
  projectIds: readonly string[],
  pagination?: BirdCoderCodingSessionListPagination,
): BirdCoderSqlPlan {
  const dialect = createBirdCoderStorageDialect(providerId);
  const limitOffset = pagination
    ? clampListPageSize(pagination.offset, pagination.limit)
    : null;
  const limitPlaceholderIndex = projectIds.length + 2;
  const offsetPlaceholderIndex = projectIds.length + 3;
  const paginationSql = limitOffset
    ? ` LIMIT ${dialect.buildPlaceholder(limitPlaceholderIndex)} OFFSET ${dialect.buildPlaceholder(offsetPlaceholderIndex)}`
    : '';
  const params = limitOffset
    ? [
        defaultSoftDeleteValue(providerId),
        ...projectIds,
        limitOffset.pageSize,
        limitOffset.offset,
      ]
    : [defaultSoftDeleteValue(providerId), ...projectIds];
  return {
    intent: 'read',
    meta: {
      excludeDeleted: true,
      kind: 'coding-session-list-by-project-ids',
      orderBy: [
        { column: 'updated_at', direction: 'desc' },
        { column: 'id', direction: 'asc' },
      ],
      projectIds,
      tableName: 'ai_coding_session',
      ...(limitOffset
        ? {
            pagination: {
              offset: limitOffset.offset,
              limit: limitOffset.pageSize,
            },
          }
        : {}),
    },
    providerId,
    statements: [
      {
        params,
        sql:
          `SELECT * FROM ai_coding_session ` +
          `WHERE is_deleted = ${dialect.buildPlaceholder(1)} ` +
          `AND project_id IN (${buildPlaceholderList(providerId, 2, projectIds.length)}) ` +
          `ORDER BY updated_at DESC, id ASC${paginationSql};`,
      },
    ],
    transactional: false,
  };
}

function buildCodingSessionMessagesBySessionIdsPlan(
  providerId: BirdCoderDatabaseProviderId,
  codingSessionIds: readonly string[],
  pagination?: BirdCoderCodingSessionListPagination,
): BirdCoderSqlPlan {
  const dialect = createBirdCoderStorageDialect(providerId);
  const { offset, pageSize } = pagination
    ? clampListPageSize(pagination.offset, pagination.limit)
    : codingSessionIds.length === 1
      ? { offset: 0, pageSize: MAX_LIST_PAGE_SIZE }
      : { offset: 0, pageSize: MAX_LIST_PAGE_SIZE };
  const softDeletePlaceholder = dialect.buildPlaceholder(1);
  const sessionIdPlaceholders = buildPlaceholderList(providerId, 2, codingSessionIds.length);
  const limitPlaceholder = dialect.buildPlaceholder(codingSessionIds.length + 2);
  const offsetPlaceholder = dialect.buildPlaceholder(codingSessionIds.length + 3);
  return {
    intent: 'read',
    meta: {
      codingSessionIds,
      excludeDeleted: true,
      kind: 'coding-session-messages-by-session-ids',
      orderBy: [
        { column: 'created_at', direction: 'asc' },
        { column: 'id', direction: 'asc' },
      ],
      pagination: { limit: pageSize, offset },
      tableName: 'ai_coding_session_message',
    },
    providerId,
    statements: [
      {
        params: [defaultSoftDeleteValue(providerId), ...codingSessionIds, pageSize, offset],
        sql:
          `SELECT * FROM ai_coding_session_message ` +
          `WHERE is_deleted = ${softDeletePlaceholder} ` +
          `AND coding_session_id IN (${sessionIdPlaceholders}) ` +
          `ORDER BY created_at ASC, id ASC ` +
          `LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder};`,
      },
    ],
    transactional: false,
  };
}

function buildCodingSessionCountFilteredPlan(
  providerId: BirdCoderDatabaseProviderId,
  filters: BirdCoderCodingSessionListFilters,
): BirdCoderSqlPlan {
  const dialect = createBirdCoderStorageDialect(providerId);
  const params: unknown[] = [defaultSoftDeleteValue(providerId)];
  let filterSql = ` WHERE is_deleted = ${dialect.buildPlaceholder(1)}`;
  if (filters.workspaceId?.trim()) {
    params.push(filters.workspaceId.trim());
    filterSql += ` AND workspace_id = ${dialect.buildPlaceholder(params.length)}`;
  }
  if (filters.projectId?.trim()) {
    params.push(filters.projectId.trim());
    filterSql += ` AND project_id = ${dialect.buildPlaceholder(params.length)}`;
  }
  if (filters.engineId?.trim()) {
    params.push(filters.engineId.trim());
    filterSql += ` AND engine_id = ${dialect.buildPlaceholder(params.length)}`;
  }
  return {
    intent: 'read',
    meta: {
      excludeDeleted: true,
      filters,
      kind: 'coding-session-count-filtered',
      tableName: 'ai_coding_session',
    },
    providerId,
    statements: [
      {
        params: [...params],
        sql: `SELECT COUNT(*) AS total FROM ai_coding_session${filterSql};`,
      },
    ],
    transactional: false,
  };
}

function buildCodingSessionListFilteredPlan(
  providerId: BirdCoderDatabaseProviderId,
  filters: BirdCoderCodingSessionListFilters,
  pagination: BirdCoderCodingSessionListPagination,
): BirdCoderSqlPlan {
  const dialect = createBirdCoderStorageDialect(providerId);
  const { offset, pageSize } = clampListPageSize(pagination.offset, pagination.limit);
  const params: unknown[] = [defaultSoftDeleteValue(providerId)];
  let filterSql = ` WHERE is_deleted = ${dialect.buildPlaceholder(1)}`;
  if (filters.workspaceId?.trim()) {
    params.push(filters.workspaceId.trim());
    filterSql += ` AND workspace_id = ${dialect.buildPlaceholder(params.length)}`;
  }
  if (filters.projectId?.trim()) {
    params.push(filters.projectId.trim());
    filterSql += ` AND project_id = ${dialect.buildPlaceholder(params.length)}`;
  }
  if (filters.engineId?.trim()) {
    params.push(filters.engineId.trim());
    filterSql += ` AND engine_id = ${dialect.buildPlaceholder(params.length)}`;
  }
  const limitPlaceholder = dialect.buildPlaceholder(params.length + 1);
  const offsetPlaceholder = dialect.buildPlaceholder(params.length + 2);
  return {
    intent: 'read',
    meta: {
      excludeDeleted: true,
      filters,
      kind: 'coding-session-list-filtered',
      orderBy: [
        { column: 'sort_timestamp', direction: 'desc' },
        { column: 'updated_at', direction: 'desc' },
        { column: 'id', direction: 'asc' },
      ],
      pagination: { limit: pageSize, offset },
      tableName: 'ai_coding_session',
    },
    providerId,
    statements: [
      {
        params: [...params, pageSize, offset],
        sql:
          `SELECT * FROM ai_coding_session${filterSql} ` +
          `ORDER BY sort_timestamp DESC, updated_at DESC, id ASC ` +
          `LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder};`,
      },
    ],
    transactional: false,
  };
}

function buildCodingSessionMessageMetadataBySessionIdsPlan(
  providerId: BirdCoderDatabaseProviderId,
  codingSessionIds: readonly string[],
): BirdCoderSqlPlan {
  const dialect = createBirdCoderStorageDialect(providerId);
  return {
    intent: 'read',
    meta: {
      codingSessionIds,
      excludeDeleted: true,
      kind: 'coding-session-message-metadata-by-session-ids',
      nativeMessageIdSegment: CODEX_NATIVE_MESSAGE_ID_SEGMENT,
      tableName: 'ai_coding_session_message',
    },
    providerId,
    statements: [
      {
        params: [
          `%${CODEX_NATIVE_MESSAGE_ID_SEGMENT}%`,
          defaultSoftDeleteValue(providerId),
          ...codingSessionIds,
        ],
        sql:
          `SELECT coding_session_id, ` +
          `COUNT(id) AS message_count, ` +
          `MAX(created_at) AS latest_transcript_updated_at, ` +
          `MAX(CASE WHEN id LIKE ${dialect.buildPlaceholder(1)} THEN created_at ELSE NULL END) AS native_transcript_updated_at ` +
          `FROM ai_coding_session_message ` +
          `WHERE is_deleted = ${dialect.buildPlaceholder(2)} ` +
          `AND coding_session_id IN (${buildPlaceholderList(providerId, 3, codingSessionIds.length)}) ` +
          `GROUP BY coding_session_id ` +
          `ORDER BY coding_session_id ASC;`,
      },
    ],
    transactional: false,
  };
}

function buildCodingSessionMessagesDeleteByProjectIdsPlan(
  providerId: BirdCoderDatabaseProviderId,
  projectIds: readonly string[],
): BirdCoderSqlPlan {
  return {
    intent: 'write',
    meta: {
      kind: 'coding-session-messages-delete-by-project-ids',
      projectIds,
      sessionTableName: 'ai_coding_session',
      tableName: 'ai_coding_session_message',
    },
    providerId,
    statements: [
      {
        params: [...projectIds],
        sql:
          `DELETE FROM ai_coding_session_message ` +
          `WHERE coding_session_id IN (` +
          `SELECT id FROM ai_coding_session ` +
          `WHERE project_id IN (${buildPlaceholderList(providerId, 1, projectIds.length)})` +
          `);`,
      },
    ],
    transactional: true,
  };
}

function buildCodingSessionMessagesDeleteBySessionIdsPlan(
  providerId: BirdCoderDatabaseProviderId,
  codingSessionIds: readonly string[],
): BirdCoderSqlPlan {
  return {
    intent: 'write',
    meta: {
      codingSessionIds,
      kind: 'coding-session-messages-delete-by-session-ids',
      tableName: 'ai_coding_session_message',
    },
    providerId,
    statements: [
      {
        params: [...codingSessionIds],
        sql:
          `DELETE FROM ai_coding_session_message ` +
          `WHERE coding_session_id IN (${buildPlaceholderList(providerId, 1, codingSessionIds.length)});`,
      },
    ],
    transactional: true,
  };
}

function buildCodingSessionsDeleteByProjectIdsPlan(
  providerId: BirdCoderDatabaseProviderId,
  projectIds: readonly string[],
): BirdCoderSqlPlan {
  return {
    intent: 'write',
    meta: {
      kind: 'coding-session-delete-by-project-ids',
      projectIds,
      tableName: 'ai_coding_session',
    },
    providerId,
    statements: [
      {
        params: [...projectIds],
        sql:
          `DELETE FROM ai_coding_session ` +
          `WHERE project_id IN (${buildPlaceholderList(providerId, 1, projectIds.length)});`,
      },
    ],
    transactional: true,
  };
}

function accumulateMessageMetadata(
  metadataByCodingSessionId: Map<string, BirdCoderPersistedCodingSessionMessageMetadata>,
  message: BirdCoderPersistedCodingSessionMessageRecord,
): void {
  const metadata = metadataByCodingSessionId.get(message.codingSessionId) ?? {
    codingSessionId: message.codingSessionId,
    latestTranscriptUpdatedAt: null,
    messageCount: 0,
    nativeTranscriptUpdatedAt: null,
  };
  const createdAt = normalizeNullableMetadataTimestamp(message.createdAt);
  metadata.messageCount += 1;
  if (
    createdAt &&
    (
      metadata.latestTranscriptUpdatedAt === null ||
      Date.parse(createdAt) > Date.parse(metadata.latestTranscriptUpdatedAt)
    )
  ) {
    metadata.latestTranscriptUpdatedAt = createdAt;
  }
  if (
    message.id.includes(CODEX_NATIVE_MESSAGE_ID_SEGMENT) &&
    createdAt &&
    (
      metadata.nativeTranscriptUpdatedAt === null ||
      Date.parse(createdAt) > Date.parse(metadata.nativeTranscriptUpdatedAt)
    )
  ) {
    metadata.nativeTranscriptUpdatedAt = createdAt;
  }
  metadataByCodingSessionId.set(message.codingSessionId, metadata);
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
  const sessions = createCodingSessionRepository({
    binding: BIRDCODER_CODING_SESSION_STORAGE_BINDING,
    providerId,
    storage,
    identify(value) {
      return value.id;
    },
    normalize: normalizeCodingSessionStorageRecord,
    sort: sortByUpdatedAtDescending,
    toRow: toCodingSessionStorageRow,
  });
  const promptEntries = createBirdCoderCodingSessionPromptHistoryRepository({
    providerId,
    storage,
  });
  const messages = createCodingSessionRepository({
    binding: BIRDCODER_CODING_SESSION_MESSAGE_STORAGE_BINDING,
    providerId,
    storage,
    identify(value) {
      return buildCodingSessionMessageStorageId(value);
    },
    normalize: normalizeCodingSessionMessageStorageRecord,
    sort: sortByCreatedAtAscending,
    toRow: toCodingSessionMessageStorageRow,
  });

  return {
    async deleteMessagesByCodingSessionIds(codingSessionIds) {
      const normalizedCodingSessionIds = normalizeBatchIds(codingSessionIds);
      if (normalizedCodingSessionIds.length === 0) {
        return;
      }

      if (supportsSqlPlanExecution(storage)) {
        try {
          await storage.executeSqlPlan(
            buildCodingSessionMessagesDeleteBySessionIdsPlan(
              providerId,
              normalizedCodingSessionIds,
            ),
          );
          return;
        } catch {
        }
      }

      const codingSessionIdSet = new Set(normalizedCodingSessionIds);
      for (const message of await messages.list()) {
        if (!codingSessionIdSet.has(message.codingSessionId)) {
          continue;
        }

        await messages.delete(buildCodingSessionMessageStorageId(message));
        await messages.delete(message.id);
      }
    },
    async deleteMessagesByProjectIds(projectIds) {
      const normalizedProjectIds = normalizeBatchIds(projectIds);
      if (normalizedProjectIds.length === 0) {
        return;
      }

      if (supportsSqlPlanExecution(storage)) {
        try {
          await storage.executeSqlPlan(
            buildCodingSessionMessagesDeleteByProjectIdsPlan(
              providerId,
              normalizedProjectIds,
            ),
          );
          return;
        } catch {
        }
      }

      const projectIdSet = new Set(normalizedProjectIds);
      const deletedSessionIds = new Set(
        (await sessions.list())
          .filter((session) => projectIdSet.has(session.projectId))
          .map((session) => session.id),
      );
      for (const message of await messages.list()) {
        if (!deletedSessionIds.has(message.codingSessionId)) {
          continue;
        }

        await messages.delete(buildCodingSessionMessageStorageId(message));
        await messages.delete(message.id);
      }
    },
    async deleteSessionsByProjectIds(projectIds) {
      const normalizedProjectIds = normalizeBatchIds(projectIds);
      if (normalizedProjectIds.length === 0) {
        return;
      }

      if (supportsSqlPlanExecution(storage)) {
        try {
          await storage.executeSqlPlan(
            buildCodingSessionsDeleteByProjectIdsPlan(providerId, normalizedProjectIds),
          );
          return;
        } catch {
        }
      }

      const projectIdSet = new Set(normalizedProjectIds);
      for (const session of await sessions.list()) {
        if (projectIdSet.has(session.projectId)) {
          await sessions.delete(session.id);
        }
      }
    },
    async listMessagesByCodingSessionIds(codingSessionIds, pagination) {
      const normalizedCodingSessionIds = normalizeBatchIds(codingSessionIds);
      if (normalizedCodingSessionIds.length === 0) {
        return [];
      }

      if (supportsSqlPlanExecution(storage)) {
        try {
          const result = await storage.executeSqlPlan(
            buildCodingSessionMessagesBySessionIdsPlan(
              providerId,
              normalizedCodingSessionIds,
              pagination,
            ),
          );
          return normalizeCodingSessionMessageRows(result.rows ?? [], {
            preserveOrder: true,
          });
        } catch (error) {
          if (pagination) {
            throw new Error(
              'Paginated coding-session message listing requires SQL plan execution.',
              { cause: error },
            );
          }
        }
      }

      if (pagination) {
        throw new Error('Paginated coding-session message listing requires SQL plan execution.');
      }

      const codingSessionIdSet = new Set(normalizedCodingSessionIds);
      return (await messages.list()).filter((message) =>
        codingSessionIdSet.has(message.codingSessionId),
      );
    },
    async listSessionsFiltered(filters, pagination) {
      const { offset, pageSize } = clampListPageSize(pagination.offset, pagination.limit);
      if (supportsSqlPlanExecution(storage)) {
        try {
          const countResult = await storage.executeSqlPlan(
            buildCodingSessionCountFilteredPlan(providerId, filters),
          );
          const listResult = await storage.executeSqlPlan(
            buildCodingSessionListFilteredPlan(providerId, filters, {
              offset,
              limit: pageSize,
            }),
          );
          const countRow = countResult.rows?.[0] as Record<string, unknown> | undefined;
          const totalValue = countRow?.total ?? countRow?.['COUNT(*)'];
          const total =
            typeof totalValue === 'number'
              ? totalValue
              : typeof totalValue === 'string'
                ? Number.parseInt(totalValue, 10)
                : 0;
          return {
            items: normalizeCodingSessionRows(listResult.rows ?? []),
            total: Number.isFinite(total) ? total : 0,
          };
        } catch (error) {
          throw new Error(
            'Filtered coding-session listing requires SQL plan execution.',
            { cause: error },
          );
        }
      }

      throw new Error('Filtered coding-session listing requires SQL plan execution.');
    },
    async listSessionsByProjectIds(projectIds) {
      const normalizedProjectIds = normalizeBatchIds(projectIds);
      if (normalizedProjectIds.length === 0) {
        return [];
      }

      if (supportsSqlPlanExecution(storage)) {
        try {
          const collected: BirdCoderPersistedCodingSessionRecord[] = [];
          let offset = 0;
          while (true) {
            const { offset: pageOffset, pageSize } = clampListPageSize(
              offset,
              MAX_LIST_PAGE_SIZE,
            );
            const result = await storage.executeSqlPlan(
              buildCodingSessionListByProjectIdsPlan(
                providerId,
                normalizedProjectIds,
                { offset: pageOffset, limit: pageSize },
              ),
            );
            const page = normalizeCodingSessionRows(result.rows ?? []);
            collected.push(...page);
            if (page.length < pageSize) {
              return collected;
            }
            offset = pageOffset + pageSize;
          }
        } catch {
        }
      }

      const projectIdSet = new Set(normalizedProjectIds);
      return (await sessions.list()).filter((session) => projectIdSet.has(session.projectId));
    },
    messages,
    promptEntries,
    async readMessageMetadataByCodingSessionIds(codingSessionIds) {
      const normalizedCodingSessionIds = normalizeBatchIds(codingSessionIds);
      if (normalizedCodingSessionIds.length === 0) {
        return new Map();
      }

      if (supportsSqlPlanExecution(storage)) {
        try {
          const result = await storage.executeSqlPlan(
            buildCodingSessionMessageMetadataBySessionIdsPlan(
              providerId,
              normalizedCodingSessionIds,
            ),
          );
          return normalizeMessageMetadataRows(result.rows ?? []);
        } catch {
        }
      }

      const codingSessionIdSet = new Set(normalizedCodingSessionIds);
      const metadataByCodingSessionId = new Map<
        string,
        BirdCoderPersistedCodingSessionMessageMetadata
      >();
      for (const message of await messages.list()) {
        if (!codingSessionIdSet.has(message.codingSessionId)) {
          continue;
        }
        accumulateMessageMetadata(metadataByCodingSessionId, message);
      }
      return metadataByCodingSessionId;
    },
    sessions,
  };
}

