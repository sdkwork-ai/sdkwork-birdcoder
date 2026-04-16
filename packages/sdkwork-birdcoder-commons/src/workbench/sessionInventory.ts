import type {
  BirdCoderCodingSessionStatus,
  BirdCoderCodingSessionSummary,
  BirdCoderHostMode,
} from '@sdkwork/birdcoder-types';
import {
  BIRDCODER_CODING_SESSION_STATUSES,
  BIRDCODER_HOST_MODES,
} from '@sdkwork/birdcoder-types';
import {
  BIRDCODER_CODING_SESSION_STORAGE_BINDING,
} from '@sdkwork/birdcoder-types/storageBindings';
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
  normalizeWorkbenchCodeEngineId,
  normalizeWorkbenchCodeModelId,
} from './preferences.ts';
import {
  listNativeCodexSessions,
} from './nativeCodexSessionStore.ts';
import type { StoredCodingSessionInventoryRecord } from './nativeCodexSessionStore.ts';
export type { StoredCodingSessionInventoryRecord } from './nativeCodexSessionStore.ts';

interface StoredCodingSessionPersistedEntry {
  createdAt?: unknown;
  engineId?: unknown;
  hostMode?: unknown;
  id?: unknown;
  lastTurnAt?: unknown;
  modelId?: unknown;
  projectId?: unknown;
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
  projectId?: string | null;
}

export interface ListStoredSessionInventoryOptions {
  includeGlobal?: boolean;
  limit?: number;
  projectId?: string | null;
}

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

function normalizeStoredCodingSessionRecord(
  value: StoredCodingSessionPersistedEntry,
): BirdCoderCodingSessionSummary {
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
  const engineId = normalizeWorkbenchCodeEngineId(
    typeof value.engineId === 'string' ? value.engineId : null,
  );

  return {
    id: value.id as string,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId.trim() : '',
    projectId: typeof value.projectId === 'string' ? value.projectId.trim() : '',
    title: typeof value.title === 'string' && value.title.trim().length > 0 ? value.title.trim() : 'New Thread',
    status: normalizeCodingSessionStatus(value.status),
    hostMode: normalizeHostMode(value.hostMode),
    engineId,
    modelId: normalizeWorkbenchCodeModelId(
      engineId,
      typeof value.modelId === 'string' ? value.modelId : null,
    ),
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

  if (typeof options.limit === 'number') {
    return filteredRecords.slice(0, Math.max(options.limit, 0));
  }

  return filteredRecords;
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

export async function listStoredSessionInventory(
  options: ListStoredSessionInventoryOptions = {},
): Promise<WorkbenchSessionInventoryRecord[]> {
  const shouldIncludeNativeCodexSessions =
    options.projectId === undefined ||
    (options.projectId?.trim() ?? '').length === 0 ||
    options.includeGlobal !== false;

  const [terminalSessions, codingSessions, nativeCodexSessions] = await Promise.all([
    listStoredTerminalSessions({
      includeGlobal: options.includeGlobal,
      limit: undefined,
      projectId: options.projectId,
    }),
    listStoredCodingSessions({
      limit: undefined,
      projectId: options.projectId,
    }),
    shouldIncludeNativeCodexSessions
      ? listNativeCodexSessions(options.limit)
      : Promise.resolve([] as StoredCodingSessionInventoryRecord[]),
  ]);

  const records: WorkbenchSessionInventoryRecord[] = [
    ...terminalSessions.map((session) => ({
      ...session,
      kind: 'terminal' as const,
      sortTimestamp: session.updatedAt,
    })),
    ...codingSessions.map((session) => ({
      ...session,
      kind: 'coding' as const,
      sortTimestamp: resolveIsoTimestamp(session.updatedAt),
    })),
    ...nativeCodexSessions,
  ].sort(compareSessionInventoryRecords);

  if (typeof options.limit === 'number') {
    return records.slice(0, Math.max(options.limit, 0));
  }

  return records;
}
