import type {
  BirdCoderCodingSessionStatus,
  BirdCoderCodingSessionSummary,
  BirdCoderHostMode,
  BirdCoderListCodingSessionsRequest,
  BirdCoderListNativeSessionsRequest,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import {
  BIRDCODER_CODING_SESSION_STATUSES,
  BIRDCODER_HOST_MODES,
  resolveBirdCoderSessionSortTimestamp,
} from '@sdkwork/birdcoder-types';
import {
  BIRDCODER_CODING_SESSION_STORAGE_BINDING,
} from '@sdkwork/birdcoder-types';
import {
  deserializeStoredValue,
  getStoredRawValue,
  listStoredRawValues,
} from '../storage/localStore.ts';
import {
  listStoredTerminalSessions,
  type TerminalSessionRecord,
} from '../terminal/sessions.ts';
import {
  type StoredCodingSessionInventoryRecord,
  type NativeSessionAuthorityCoreReadService,
} from './nativeSessionAuthority.ts';
export type { StoredCodingSessionInventoryRecord } from './nativeSessionAuthority.ts';

interface StoredCodingSessionPersistedEntry {
  createdAt?: unknown;
  engineId?: unknown;
  hostMode?: unknown;
  id?: unknown;
  lastTurnAt?: unknown;
  modelId?: unknown;
  projectId?: unknown;
  runtimeStatus?: unknown;
  status?: unknown;
  title?: unknown;
  updatedAt?: unknown;
  workspaceId?: unknown;
}

export interface StoredTerminalSessionInventoryRecord extends TerminalSessionRecord {
  kind: 'terminal';
  sortTimestamp: number;
}

export type WorkbenchSessionInventoryRecord =
  | StoredCodingSessionInventoryRecord
  | StoredTerminalSessionInventoryRecord;

export interface ListStoredCodingSessionsOptions {
  limit?: number;
  offset?: number;
  projectId?: string | null;
}

export interface ListStoredSessionInventoryOptions {
  coreReadService?: SessionInventoryCoreReadService;
  includeGlobal?: boolean;
  limit?: number;
  offset?: number;
  projectId?: string | null;
  workspaceId?: string | null;
}

export interface BuildProjectBackedSessionInventoryOptions {
  includeGlobal?: boolean;
  limit?: number;
  offset?: number;
  projectId?: string | null;
  projects: readonly BirdCoderProject[];
  terminalSessions?: readonly TerminalSessionRecord[];
  workspaceId?: string | null;
}

type SessionInventoryCoreReadService =
  NativeSessionAuthorityCoreReadService &
  Pick<
    {
      listCodingSessions(
        request?: BirdCoderListCodingSessionsRequest,
      ): Promise<BirdCoderCodingSessionSummary[]>;
      listNativeSessions(
        request?: BirdCoderListNativeSessionsRequest,
      ): Promise<StoredCodingSessionInventoryRecord[]>;
    },
    'listCodingSessions' | 'listNativeSessions'
  >;

const ZERO_TIMESTAMP = new Date(0).toISOString();
const CODING_SESSION_STATUS_SET = new Set<string>(BIRDCODER_CODING_SESSION_STATUSES);
const HOST_MODE_SET = new Set<string>(BIRDCODER_HOST_MODES);
const CODING_SESSION_TABLE_STORAGE_KEY = [
  BIRDCODER_CODING_SESSION_STORAGE_BINDING.storageMode,
  BIRDCODER_CODING_SESSION_STORAGE_BINDING.preferredProvider,
  BIRDCODER_CODING_SESSION_STORAGE_BINDING.storageKey,
].join('.');

function normalizeIsoTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const parsedValue = Date.parse(value);
  if (Number.isNaN(parsedValue)) {
    return fallback;
  }

  return value;
}

function resolveIsoTimestamp(value: string | null | undefined): number {
  if (typeof value !== 'string') {
    return 0;
  }

  const parsedValue = Date.parse(value);
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
}

function normalizeCodingSessionStatus(value: unknown): BirdCoderCodingSessionStatus {
  return typeof value === 'string' && CODING_SESSION_STATUS_SET.has(value) ? value as BirdCoderCodingSessionStatus : 'draft';
}

function normalizeHostMode(value: unknown): BirdCoderHostMode {
  return typeof value === 'string' && HOST_MODE_SET.has(value) ? value as BirdCoderHostMode : 'desktop';
}

function normalizeRuntimeStatus(
  value: unknown,
): BirdCoderCodingSessionSummary['runtimeStatus'] {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0
    ? (normalizedValue as BirdCoderCodingSessionSummary['runtimeStatus'])
    : undefined;
}

function normalizeStoredCodingSessionRecord(
  value: StoredCodingSessionPersistedEntry,
): BirdCoderCodingSessionSummary | null {
  const createdAtCandidate =
    typeof value.createdAt === 'string' && !Number.isNaN(Date.parse(value.createdAt))
      ? value.createdAt
      : null;
  const updatedAtCandidate =
    typeof value.updatedAt === 'string' && !Number.isNaN(Date.parse(value.updatedAt))
      ? value.updatedAt
      : null;
  const createdAt = createdAtCandidate ?? updatedAtCandidate ?? ZERO_TIMESTAMP;
  const updatedAt = updatedAtCandidate ?? createdAt;
  const rawEngineId =
    typeof value.engineId === 'string' && value.engineId.trim().length > 0
      ? value.engineId.trim()
      : null;
  if (!rawEngineId) {
    return null;
  }

  const engineId = rawEngineId;
  const rawModelId =
    typeof value.modelId === 'string' && value.modelId.trim().length > 0
      ? value.modelId.trim()
      : null;
  if (!rawModelId) {
    return null;
  }

  return {
    id: value.id as string,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId.trim() : '',
    projectId: typeof value.projectId === 'string' ? value.projectId.trim() : '',
    title: typeof value.title === 'string' && value.title.trim().length > 0 ? value.title.trim() : 'New Session',
    status: normalizeCodingSessionStatus(value.status),
    hostMode: normalizeHostMode(value.hostMode),
    engineId,
    modelId: rawModelId,
    runtimeStatus: normalizeRuntimeStatus(value.runtimeStatus),
    createdAt,
    updatedAt,
    lastTurnAt: normalizeIsoTimestamp(value.lastTurnAt, updatedAt),
  };
}

function normalizeStoredCodingSessionCollection(value: unknown): BirdCoderCodingSessionSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (entry): entry is StoredCodingSessionPersistedEntry =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as StoredCodingSessionPersistedEntry).id === 'string',
    )
    .map(normalizeStoredCodingSessionRecord)
    .filter((entry): entry is BirdCoderCodingSessionSummary => entry !== null)
    .sort((left, right) => resolveIsoTimestamp(right.updatedAt) - resolveIsoTimestamp(left.updatedAt));
}

async function readStoredCodingSessionCollection(): Promise<BirdCoderCodingSessionSummary[]> {
  const entries = await listStoredRawValues(BIRDCODER_CODING_SESSION_STORAGE_BINDING.storageScope);
  const scopedEntry =
    entries.find((entry) => entry.key === CODING_SESSION_TABLE_STORAGE_KEY) ??
    entries.find((entry) => entry.key.endsWith(`.${BIRDCODER_CODING_SESSION_STORAGE_BINDING.storageKey}`));

  const rawValue =
    scopedEntry?.value ??
    (await getStoredRawValue(
      BIRDCODER_CODING_SESSION_STORAGE_BINDING.storageScope,
      CODING_SESSION_TABLE_STORAGE_KEY,
    ));

  return normalizeStoredCodingSessionCollection(deserializeStoredValue(rawValue, [] as unknown[]));
}

export async function listStoredCodingSessions(
  options: ListStoredCodingSessionsOptions = {},
): Promise<BirdCoderCodingSessionSummary[]> {
  const records = await readStoredCodingSessionCollection();
  const filteredRecords =
    options.projectId === undefined
      ? records
      : records.filter((session) => session.projectId === (options.projectId?.trim() ?? ''));
  const offset = Math.max(options.offset ?? 0, 0);
  const pagedRecords = offset > 0 ? filteredRecords.slice(offset) : filteredRecords;
  return typeof options.limit === 'number'
    ? pagedRecords.slice(0, Math.max(options.limit, 0))
    : pagedRecords;
}

function isProjectScopedCodingSession(summary: BirdCoderCodingSessionSummary): boolean {
  return summary.workspaceId.trim().length > 0 && summary.projectId.trim().length > 0;
}

function toAuthorityBackedCodingSessionInventoryRecord(
  summary: BirdCoderCodingSessionSummary,
): StoredCodingSessionInventoryRecord {
  return {
    ...summary,
    kind: 'coding',
    nativeCwd: null,
    sortTimestamp: resolveBirdCoderSessionSortTimestamp(summary),
    transcriptUpdatedAt: summary.transcriptUpdatedAt ?? null,
  };
}

async function listAuthorityBackedCodingSessions(
  options: ListStoredSessionInventoryOptions,
): Promise<StoredCodingSessionInventoryRecord[]> {
  if (!options.coreReadService) {
    return [];
  }

  const [projectionSummaries, nativeSummaries] = await Promise.all([
    options.coreReadService.listCodingSessions({
      limit: options.limit,
      offset: options.offset,
      projectId: options.projectId ?? undefined,
      workspaceId: options.workspaceId ?? undefined,
    }),
    options.coreReadService.listNativeSessions({
      limit: options.limit,
      offset: options.offset,
      projectId: options.projectId ?? undefined,
      workspaceId: options.workspaceId ?? undefined,
    }),
  ]);

  const nativeRecordsById = new Map(
    nativeSummaries
      .filter(
        (summary) =>
          summary.kind === 'coding' &&
          summary.projectId.trim().length > 0 &&
          summary.workspaceId.trim().length > 0,
      )
      .map(
        (summary) =>
          [summary.id, summary] satisfies [string, StoredCodingSessionInventoryRecord],
      ),
  );

  return projectionSummaries
    .filter(isProjectScopedCodingSession)
    .map(toAuthorityBackedCodingSessionInventoryRecord)
    .map((record) => {
      const matchingNativeRecord = nativeRecordsById.get(record.id);
      if (!matchingNativeRecord) {
        return record;
      }

      return {
        ...record,
        nativeCwd: matchingNativeRecord.nativeCwd ?? record.nativeCwd ?? null,
        sortTimestamp: matchingNativeRecord.sortTimestamp || record.sortTimestamp,
        transcriptUpdatedAt:
          matchingNativeRecord.transcriptUpdatedAt ?? record.transcriptUpdatedAt ?? null,
      };
    });
}

function compareSessionInventoryRecords(
  left: WorkbenchSessionInventoryRecord,
  right: WorkbenchSessionInventoryRecord,
): number {
  return (
    right.sortTimestamp - left.sortTimestamp ||
    left.kind.localeCompare(right.kind) ||
    left.id.localeCompare(right.id)
  );
}

function normalizeScopedIdentifier(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function matchesWorkspaceScope(
  recordWorkspaceId: string | null | undefined,
  workspaceId: string | null | undefined,
): boolean {
  const normalizedWorkspaceId = normalizeScopedIdentifier(workspaceId);
  if (!normalizedWorkspaceId) {
    return true;
  }

  return normalizeScopedIdentifier(recordWorkspaceId) === normalizedWorkspaceId;
}

function matchesProjectScope(
  recordProjectId: string | null | undefined,
  projectId: string | null | undefined,
  includeGlobal: boolean,
): boolean {
  const normalizedProjectId = normalizeScopedIdentifier(projectId);
  const normalizedRecordProjectId = normalizeScopedIdentifier(recordProjectId);
  if (!normalizedProjectId) {
    return true;
  }

  if (!normalizedRecordProjectId) {
    return includeGlobal;
  }

  return normalizedRecordProjectId === normalizedProjectId;
}

function toProjectBackedCodingSessionInventoryRecord(
  codingSession: BirdCoderProject['codingSessions'][number],
): StoredCodingSessionInventoryRecord {
  return {
    id: codingSession.id,
    workspaceId: codingSession.workspaceId,
    projectId: codingSession.projectId,
    title: codingSession.title,
    status: codingSession.status,
    hostMode: codingSession.hostMode,
    engineId: codingSession.engineId,
    modelId: codingSession.modelId,
    runtimeStatus: codingSession.runtimeStatus,
    createdAt: codingSession.createdAt,
    updatedAt: codingSession.updatedAt,
    lastTurnAt: codingSession.lastTurnAt,
    kind: 'coding',
    nativeCwd: null,
    sortTimestamp: resolveBirdCoderSessionSortTimestamp(codingSession),
    transcriptUpdatedAt: codingSession.transcriptUpdatedAt ?? null,
  };
}

export function buildProjectBackedSessionInventory(
  options: BuildProjectBackedSessionInventoryOptions,
): WorkbenchSessionInventoryRecord[] {
  const normalizedWorkspaceId = normalizeScopedIdentifier(options.workspaceId);
  const normalizedProjectId = normalizeScopedIdentifier(options.projectId);
  const includeGlobal = options.includeGlobal ?? true;

  const codingSessions = options.projects
    .filter((project) => matchesWorkspaceScope(project.workspaceId, normalizedWorkspaceId))
    .filter((project) =>
      normalizedProjectId.length === 0 ? true : project.id === normalizedProjectId,
    )
    .flatMap((project) =>
      project.codingSessions
        .filter((codingSession) =>
          matchesWorkspaceScope(codingSession.workspaceId, normalizedWorkspaceId),
        )
        .filter((codingSession) =>
          matchesProjectScope(codingSession.projectId, normalizedProjectId, false),
        )
        .map(toProjectBackedCodingSessionInventoryRecord),
    );

  const terminalSessions = (options.terminalSessions ?? [])
    .filter((session) => matchesWorkspaceScope(session.workspaceId, normalizedWorkspaceId))
    .filter((session) =>
      matchesProjectScope(session.projectId, normalizedProjectId, includeGlobal),
    )
    .map((session) => ({
      ...session,
      kind: 'terminal' as const,
      sortTimestamp: session.updatedAt,
    }));

  const records: WorkbenchSessionInventoryRecord[] = [
    ...terminalSessions,
    ...codingSessions,
  ].sort(compareSessionInventoryRecords);

  const offset = Math.max(options.offset ?? 0, 0);
  if (typeof options.limit === 'number') {
    return records.slice(offset, offset + Math.max(options.limit, 0));
  }

  return offset > 0 ? records.slice(offset) : records;
}

export async function listProjectBackedSessionInventory(
  options: BuildProjectBackedSessionInventoryOptions,
): Promise<WorkbenchSessionInventoryRecord[]> {
  const terminalSessions =
    options.terminalSessions ??
    (await listStoredTerminalSessions({
      includeGlobal: options.includeGlobal,
      limit: undefined,
      projectId: options.projectId,
    }));

  return buildProjectBackedSessionInventory({
    ...options,
    terminalSessions,
  });
}

export async function listStoredSessionInventory(
  options: ListStoredSessionInventoryOptions = {},
): Promise<WorkbenchSessionInventoryRecord[]> {
  const [terminalSessions, storedCodingSessions, authoritativeCodingSessions] = await Promise.all([
    listStoredTerminalSessions({
      includeGlobal: options.includeGlobal,
      limit: undefined,
      projectId: options.projectId,
    }),
    options.coreReadService
      ? Promise.resolve([] as BirdCoderCodingSessionSummary[])
      : listStoredCodingSessions({
        limit: undefined,
        offset: options.offset,
        projectId: options.projectId,
      }),
    listAuthorityBackedCodingSessions(options),
  ]);

  const codingSessions =
    authoritativeCodingSessions.length > 0
      ? authoritativeCodingSessions
      : storedCodingSessions.map((session) => ({
          ...session,
          kind: 'coding' as const,
          nativeCwd: null,
          sortTimestamp: resolveBirdCoderSessionSortTimestamp(session),
          transcriptUpdatedAt: session.transcriptUpdatedAt ?? null,
        }));

  const records: WorkbenchSessionInventoryRecord[] = [
    ...terminalSessions.map((session) => ({
      ...session,
      kind: 'terminal' as const,
      sortTimestamp: session.updatedAt,
    })),
    ...codingSessions,
  ].sort(compareSessionInventoryRecords);

  const offset = Math.max(options.offset ?? 0, 0);
  if (typeof options.limit === 'number') {
    return records.slice(offset, offset + Math.max(options.limit, 0));
  }

  return offset > 0 ? records.slice(offset) : records;
}
