import type {
  BirdCoderCodingSessionStatus,
  BirdCoderCodingSessionSummary,
  BirdCoderHostMode,
  BirdCoderListCodingSessionsRequest,
  BirdCoderListNativeSessionsRequest,
  BirdCoderNativeSessionSummary,
  BirdCoderProject,
} from '@sdkwork/birdcoder-pc-types';
import {
  normalizeBirdCoderCodeEngineNativeSessionId,
  resolveBirdCoderCodeEngineNativeSessionIdPrefix,
} from '@sdkwork/birdcoder-pc-codeengine';
import {
  BIRDCODER_CODING_SESSION_STATUSES,
  BIRDCODER_HOST_MODES,
  compareBirdCoderLongIntegers,
  normalizeBirdCoderCodeEngineRuntimeStatus,
  resolveBirdCoderSessionSortTimestampString,
} from '@sdkwork/birdcoder-pc-types';
import {
  BIRDCODER_CODING_SESSION_STORAGE_BINDING,
} from '@sdkwork/birdcoder-pc-types';
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
} from './nativeSessionAuthority.ts';
export type { StoredCodingSessionInventoryRecord } from './nativeSessionAuthority.ts';

interface StoredCodingSessionPersistedEntry {
  createdAt?: unknown;
  engineId?: unknown;
  hostMode?: unknown;
  id?: unknown;
  lastTurnAt?: unknown;
  modelId?: unknown;
  nativeSessionId?: unknown;
  nativeAttributes?: unknown;
  projectId?: unknown;
  runtimeLocationId?: unknown;
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
  appRuntimeReadService?: SessionInventoryAppRuntimeReadService;
  includeGlobal?: boolean;
  limit?: number;
  offset?: number;
  projectId?: string | null;
  runtimeLocationId?: string | null;
  workspaceId?: string | null;
}

export interface StoredSessionInventoryPage {
  items: WorkbenchSessionInventoryRecord[];
  hasMore: boolean;
  loadedCount: number;
}

export interface BuildProjectBackedSessionInventoryOptions {
  includeGlobal?: boolean;
  projectId?: string | null;
  projects: readonly BirdCoderProject[];
  terminalSessions?: readonly TerminalSessionRecord[];
  workspaceId?: string | null;
}

interface RuntimeSessionPage<TItem> {
  items: TItem[];
  pageInfo?: {
    hasMore?: boolean;
  };
}

export interface SessionInventoryAppRuntimeReadService {
  readonly codingSessionListIncludesNativeSessions?: boolean;
  listCodingSessions(
    request?: BirdCoderListCodingSessionsRequest,
  ): Promise<BirdCoderCodingSessionSummary[]>;
  listNativeSessions(
    request: BirdCoderListNativeSessionsRequest,
  ): Promise<BirdCoderNativeSessionSummary[]>;
  listCodingSessionPage?: (
    request?: BirdCoderListCodingSessionsRequest,
  ) => Promise<RuntimeSessionPage<BirdCoderCodingSessionSummary>>;
  listNativeSessionPage?: (
    request: BirdCoderListNativeSessionsRequest,
  ) => Promise<RuntimeSessionPage<BirdCoderNativeSessionSummary>>;
}

const ZERO_TIMESTAMP = new Date(0).toISOString();
const CODING_SESSION_STATUS_SET = new Set<string>(BIRDCODER_CODING_SESSION_STATUSES);
const HOST_MODE_SET = new Set<string>(BIRDCODER_HOST_MODES);
const CODING_SESSION_TABLE_STORAGE_KEY = [
  BIRDCODER_CODING_SESSION_STORAGE_BINDING.storageMode,
  BIRDCODER_CODING_SESSION_STORAGE_BINDING.preferredProvider,
  BIRDCODER_CODING_SESSION_STORAGE_BINDING.storageKey,
].join('.');

let terminalSessionInventoryUnavailable = false;

async function readStoredTerminalSessions(options: {
  includeGlobal?: boolean;
  limit?: number;
  projectId?: string | null;
}): Promise<TerminalSessionRecord[]> {
  if (terminalSessionInventoryUnavailable) {
    return [];
  }
  try {
    return listStoredTerminalSessions(options);
  } catch (error) {
    // Terminal inventory is optional for the Code/Studio session authority;
    // an unavailable terminal bridge must not hide provider-backed coding
    // sessions during startup or project hydration.
    terminalSessionInventoryUnavailable = true;
    console.warn('Failed to load terminal session inventory', error);
    return [];
  }
}

function normalizeInventoryNativeSessionId(
  value: unknown,
  engineId: string | null | undefined,
): string | undefined {
  return typeof value === 'string'
    ? normalizeBirdCoderCodeEngineNativeSessionId(value, engineId) ?? undefined
    : undefined;
}

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

function resolveLatestIsoTimestamp(
  left: string | null | undefined,
  right: string | null | undefined,
): string | undefined {
  if (!left) {
    return right ?? undefined;
  }
  if (!right) {
    return left;
  }

  return resolveIsoTimestamp(right) > resolveIsoTimestamp(left) ? right : left;
}

function resolveLatestSortTimestamp(left: string, right: string): string {
  return compareBirdCoderLongIntegers(right, left) > 0 ? right : left;
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
  return normalizeBirdCoderCodeEngineRuntimeStatus(value);
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
    runtimeLocationId:
      typeof value.runtimeLocationId === 'string' && value.runtimeLocationId.trim().length > 0
        ? value.runtimeLocationId.trim()
        : undefined,
    title: typeof value.title === 'string' && value.title.trim().length > 0 ? value.title.trim() : 'New Session',
    status: normalizeCodingSessionStatus(value.status),
    hostMode: normalizeHostMode(value.hostMode),
    engineId,
    modelId: rawModelId,
    nativeSessionId: normalizeInventoryNativeSessionId(value.nativeSessionId, engineId),
    nativeAttributes:
      value.nativeAttributes && typeof value.nativeAttributes === 'object'
        ? value.nativeAttributes as BirdCoderCodingSessionSummary['nativeAttributes']
        : undefined,
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
  return filteredRecords;
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
    nativeSessionId: normalizeInventoryNativeSessionId(
      summary.nativeSessionId,
      summary.engineId,
    ),
    sortTimestamp: resolveBirdCoderSessionSortTimestampString(summary),
    transcriptUpdatedAt: summary.transcriptUpdatedAt ?? null,
  };
}

function toAuthorityBackedNativeCodingSessionInventoryRecord(
  summary: BirdCoderNativeSessionSummary,
): StoredCodingSessionInventoryRecord {
  const nativeSessionId =
    normalizeInventoryNativeSessionId(summary.nativeSessionId ?? summary.id, summary.engineId) ??
    summary.nativeSessionId?.trim() ??
    summary.id.trim();

  return {
    ...summary,
    // Keep the source id while projection/native records are being matched.
    // A native summary can reuse the projection id even when only the native
    // record carries the raw provider session id. Native-only records receive
    // a provider-scoped id after that merge decision is made.
    id: summary.id.trim() || nativeSessionId,
    kind: 'coding',
    nativeSessionId,
    sortTimestamp: resolveBirdCoderSessionSortTimestampString(summary),
    transcriptUpdatedAt: summary.transcriptUpdatedAt ?? null,
  };
}

function buildCodingSessionIdentityKeys(
  summary: Pick<BirdCoderCodingSessionSummary, 'engineId' | 'id' | 'nativeSessionId'>,
): string[] {
  const engineId = normalizeScopedIdentifier(summary.engineId);
  const keys = new Set<string>();
  const addKey = (value: unknown) => {
    const normalizedValue = normalizeInventoryNativeSessionId(value, summary.engineId);
    if (normalizedValue) {
      keys.add(`${engineId}:${normalizedValue}`);
    }
  };

  addKey(summary.id);
  addKey(summary.nativeSessionId);
  return [...keys];
}

function indexNativeCodingSessionRecordsByIdentity(
  records: readonly StoredCodingSessionInventoryRecord[],
): Map<string, StoredCodingSessionInventoryRecord> {
  const recordsByIdentity = new Map<string, StoredCodingSessionInventoryRecord>();
  for (const record of records) {
    for (const key of buildCodingSessionIdentityKeys(record)) {
      if (!recordsByIdentity.has(key)) {
        recordsByIdentity.set(key, record);
      }
    }
  }
  return recordsByIdentity;
}

function findNativeCodingSessionRecord(
  record: StoredCodingSessionInventoryRecord,
  recordsByIdentity: ReadonlyMap<string, StoredCodingSessionInventoryRecord>,
): StoredCodingSessionInventoryRecord | null {
  for (const key of buildCodingSessionIdentityKeys(record)) {
    const nativeRecord = recordsByIdentity.get(key);
    if (nativeRecord) {
      return nativeRecord;
    }
  }
  return null;
}

const DEFAULT_SESSION_INVENTORY_LIMIT = 20;
const AUTHORITY_SESSION_PAGE_SIZE = 200;
const MAX_SESSION_INVENTORY_PREFIX = 200_000;

function normalizeSessionInventoryLimit(value: number | undefined): number {
  if (!Number.isSafeInteger(value) || value === undefined || value <= 0) {
    return DEFAULT_SESSION_INVENTORY_LIMIT;
  }
  return Math.min(value, MAX_SESSION_INVENTORY_PREFIX);
}

function normalizeSessionInventoryOffset(value: number | undefined): number {
  if (!Number.isSafeInteger(value) || value === undefined || value < 0) {
    return 0;
  }
  return Math.min(value, MAX_SESSION_INVENTORY_PREFIX);
}

function resolveSessionInventoryTargetEnd(offset: number, limit: number): number {
  return Math.min(MAX_SESSION_INVENTORY_PREFIX, offset + limit);
}

function mergeCodingSessionInventoryRecords(
  primary: StoredCodingSessionInventoryRecord,
  secondary: StoredCodingSessionInventoryRecord,
): StoredCodingSessionInventoryRecord {
  const secondaryHasNewerActivity =
    compareBirdCoderLongIntegers(secondary.sortTimestamp, primary.sortTimestamp) > 0;
  const activitySource = secondaryHasNewerActivity ? secondary : primary;
  return {
    ...primary,
    title: activitySource.title,
    status: activitySource.status,
    hostMode: activitySource.hostMode,
    modelId: activitySource.modelId,
    runtimeStatus: activitySource.runtimeStatus,
    nativeSessionId: primary.nativeSessionId ?? secondary.nativeSessionId,
    runtimeLocationId: primary.runtimeLocationId ?? secondary.runtimeLocationId,
    nativeAttributes: activitySource.nativeAttributes
      ?? primary.nativeAttributes
      ?? secondary.nativeAttributes,
    updatedAt:
      resolveLatestIsoTimestamp(primary.updatedAt, secondary.updatedAt) ??
      primary.updatedAt,
    lastTurnAt: resolveLatestIsoTimestamp(primary.lastTurnAt, secondary.lastTurnAt),
    sortTimestamp: resolveLatestSortTimestamp(primary.sortTimestamp, secondary.sortTimestamp),
    transcriptUpdatedAt:
      resolveLatestIsoTimestamp(primary.transcriptUpdatedAt, secondary.transcriptUpdatedAt) ??
      null,
  };
}

function scopeNativeOnlyCodingSessionRecord(
  record: StoredCodingSessionInventoryRecord,
): StoredCodingSessionInventoryRecord {
  const nativeSessionId =
    normalizeInventoryNativeSessionId(record.nativeSessionId ?? record.id, record.engineId) ??
    record.nativeSessionId?.trim() ??
    record.id;
  const providerPrefix = resolveBirdCoderCodeEngineNativeSessionIdPrefix(record.engineId);
  const scopedId = providerPrefix
    ? `${providerPrefix}${nativeSessionId}`
    : `${record.engineId.trim()}:${nativeSessionId}`;
  return scopedId === record.id ? record : { ...record, id: scopedId };
}

/**
 * Collapse snapshots which describe one provider session. Keeping the newest
 * snapshot as the primary record preserves titles/status while still carrying
 * forward native location and the latest activity timestamps.
 */
function collapseAuthorityCodingSessionRecords(
  records: readonly StoredCodingSessionInventoryRecord[],
): StoredCodingSessionInventoryRecord[] {
  const activeRecords = new Set<StoredCodingSessionInventoryRecord>();
  const recordsByIdentity = new Map<string, StoredCodingSessionInventoryRecord>();
  const identityKeysByRecord = new Map<StoredCodingSessionInventoryRecord, Set<string>>();

  const newestFirst = [...records].sort(compareSessionInventoryRecords);
  for (const record of newestFirst) {
    const recordKeys = new Set(buildCodingSessionIdentityKeys(record));
    if (recordKeys.size === 0) {
      activeRecords.add(record);
      identityKeysByRecord.set(record, recordKeys);
      continue;
    }

    const matchingRecords = new Set<StoredCodingSessionInventoryRecord>();
    for (const key of recordKeys) {
      const matchingRecord = recordsByIdentity.get(key);
      if (matchingRecord) {
        matchingRecords.add(matchingRecord);
      }
    }

    if (matchingRecords.size === 0) {
      activeRecords.add(record);
      identityKeysByRecord.set(record, recordKeys);
      for (const key of recordKeys) {
        recordsByIdentity.set(key, record);
      }
      continue;
    }

    const [firstMatchingRecord] = matchingRecords;
    if (!firstMatchingRecord) {
      continue;
    }
    let mergedRecord = firstMatchingRecord;
    const mergedKeys = new Set(identityKeysByRecord.get(firstMatchingRecord) ?? []);
    for (const matchingRecord of matchingRecords) {
      if (matchingRecord !== firstMatchingRecord) {
        mergedRecord = mergeCodingSessionInventoryRecords(mergedRecord, matchingRecord);
        for (const key of identityKeysByRecord.get(matchingRecord) ?? []) {
          mergedKeys.add(key);
        }
        activeRecords.delete(matchingRecord);
        identityKeysByRecord.delete(matchingRecord);
      }
    }
    mergedRecord = mergeCodingSessionInventoryRecords(mergedRecord, record);
    for (const key of recordKeys) {
      mergedKeys.add(key);
    }
    activeRecords.delete(firstMatchingRecord);
    identityKeysByRecord.delete(firstMatchingRecord);
    activeRecords.add(mergedRecord);
    identityKeysByRecord.set(mergedRecord, mergedKeys);
    for (const key of mergedKeys) {
      recordsByIdentity.set(key, mergedRecord);
    }
  }

  return [...activeRecords].sort(compareSessionInventoryRecords);
}

function mergeAuthorityBackedCodingSessionRecords(
  projectionRecords: readonly StoredCodingSessionInventoryRecord[],
  nativeRecords: readonly StoredCodingSessionInventoryRecord[],
): StoredCodingSessionInventoryRecord[] {
  const collapsedProjectionRecords = collapseAuthorityCodingSessionRecords(projectionRecords);
  const collapsedNativeRecords = collapseAuthorityCodingSessionRecords(nativeRecords);
  const nativeRecordsByIdentity = indexNativeCodingSessionRecordsByIdentity(collapsedNativeRecords);
  const consumedNativeRecords = new Set<StoredCodingSessionInventoryRecord>();

  const mergedProjectedRecords = collapsedProjectionRecords.map((record) => {
    const matchingNativeRecord = findNativeCodingSessionRecord(record, nativeRecordsByIdentity);
    if (!matchingNativeRecord) {
      return record;
    }
    consumedNativeRecords.add(matchingNativeRecord);
    return mergeCodingSessionInventoryRecords(record, matchingNativeRecord);
  });

  const nativeOnlyRecords = collapsedNativeRecords
    .filter((record) => !consumedNativeRecords.has(record))
    .map(scopeNativeOnlyCodingSessionRecord);
  const mergedRecords = [...mergedProjectedRecords, ...nativeOnlyRecords].sort(
    compareSessionInventoryRecords,
  );

  // Native tools are allowed to reuse the same opaque id in different
  // providers. Scope every member of a collision group up front, so a later
  // activity reorder cannot swap which provider owns the unprefixed UI key.
  const idCounts = new Map<string, number>();
  for (const record of mergedRecords) {
    idCounts.set(record.id, (idCounts.get(record.id) ?? 0) + 1);
  }
  const usedIds = new Set(
    mergedRecords
      .filter((record) => (idCounts.get(record.id) ?? 0) === 1)
      .map((record) => record.id),
  );
  return mergedRecords.map((record) => {
    if ((idCounts.get(record.id) ?? 0) === 1) {
      return record;
    }

    const nativeId = normalizeInventoryNativeSessionId(
      record.nativeSessionId ?? record.id,
      record.engineId,
    );
    const prefix = resolveBirdCoderCodeEngineNativeSessionIdPrefix(record.engineId);
    const scopedBase = prefix && nativeId ? `${prefix}${nativeId}` : `${record.engineId}:${record.id}`;
    let scopedId = scopedBase;
    let suffix = 2;
    while (usedIds.has(scopedId)) {
      scopedId = `${scopedBase}:${suffix}`;
      suffix += 1;
    }
    usedIds.add(scopedId);
    return { ...record, id: scopedId };
  });
}

function selectBoundedInventoryWindow<T>(
  records: readonly T[],
  offset: number,
  endExclusive: number,
): T[] {
  // The authority readers above only materialize the requested bounded
  // prefix. Keep the final cross-source window explicit instead of using a
  // client-pagination slice pattern that obscures that bound.
  const items: T[] = [];
  const start = Math.min(Math.max(0, offset), records.length);
  const end = Math.min(Math.max(start, endExclusive), records.length);
  for (let index = start; index < end; index += 1) {
    const item = records[index];
    if (item !== undefined) {
      items.push(item);
    }
  }
  return items;
}

interface AuthorityCodingSessionSourceState {
  exhausted: boolean;
  hasMore: boolean;
  offset: number;
  records: StoredCodingSessionInventoryRecord[];
  seenIdentityKeys: Set<string>;
}

function createAuthorityCodingSessionSourceState(): AuthorityCodingSessionSourceState {
  return {
    exhausted: false,
    hasMore: false,
    offset: 0,
    records: [],
    seenIdentityKeys: new Set<string>(),
  };
}

function appendAuthoritySourceRecords(
  state: AuthorityCodingSessionSourceState,
  records: readonly StoredCodingSessionInventoryRecord[],
): boolean {
  let madeProgress = false;
  for (const record of records) {
    const identityKeys = buildCodingSessionIdentityKeys(record);
    if (identityKeys.some((key) => !state.seenIdentityKeys.has(key))) {
      madeProgress = true;
    }
    for (const key of identityKeys) {
      state.seenIdentityKeys.add(key);
    }
    state.records.push(record);
  }
  return madeProgress;
}

function countAuthoritySourceSessions(
  state: AuthorityCodingSessionSourceState,
): number {
  return collapseAuthorityCodingSessionRecords(state.records).length;
}

async function readAuthoritySessionPage<
  TItem,
  TRequest extends { limit: number; offset: number },
>(options: {
  list: (request: TRequest) => Promise<TItem[]>;
  page?: (request: TRequest) => Promise<RuntimeSessionPage<TItem>>;
  request: TRequest;
}): Promise<{ items: TItem[]; hasMore: boolean }> {
  if (options.page) {
    const page = await options.page(options.request);
    const items = Array.isArray(page?.items) ? page.items : [];
    const hasMore =
      typeof page?.pageInfo?.hasMore === 'boolean'
        ? page.pageInfo.hasMore
        : items.length >= options.request.limit;
    return { hasMore, items };
  }

  const items = await options.list(options.request);
  return {
    hasMore: items.length >= options.request.limit,
    items: Array.isArray(items) ? items : [],
  };
}

function toAuthorityProjectionRecords(
  summaries: readonly BirdCoderCodingSessionSummary[],
): StoredCodingSessionInventoryRecord[] {
  return summaries
    .filter(isProjectScopedCodingSession)
    .map(toAuthorityBackedCodingSessionInventoryRecord);
}

function toAuthorityNativeRecords(
  summaries: readonly BirdCoderNativeSessionSummary[],
): StoredCodingSessionInventoryRecord[] {
  return summaries
    .filter(
      (summary) =>
        summary.kind === 'coding' &&
        summary.projectId.trim().length > 0 &&
        summary.workspaceId.trim().length > 0,
    )
    .map(toAuthorityBackedNativeCodingSessionInventoryRecord);
}

export async function listAuthorityBackedCodingSessionInventoryPage(
  options: ListStoredSessionInventoryOptions = {},
): Promise<{ items: StoredCodingSessionInventoryRecord[]; hasMore: boolean; loadedCount: number }> {
  const service = options.appRuntimeReadService;
  if (!service) {
    return { hasMore: false, items: [], loadedCount: 0 };
  }

  const limit = normalizeSessionInventoryLimit(options.limit);
  const offset = normalizeSessionInventoryOffset(options.offset);
  const targetEnd = resolveSessionInventoryTargetEnd(offset, limit);
  const pageSize =
    targetEnd <= AUTHORITY_SESSION_PAGE_SIZE
      ? Math.max(1, targetEnd)
      : AUTHORITY_SESSION_PAGE_SIZE;
  const requestScope = {
    projectId: options.projectId?.trim() || undefined,
    runtimeLocationId: options.runtimeLocationId?.trim() || undefined,
    workspaceId: options.workspaceId?.trim() || undefined,
  };
  const projectionState = createAuthorityCodingSessionSourceState();
  const nativeState = createAuthorityCodingSessionSourceState();
  const readNativeSource = service.codingSessionListIncludesNativeSessions !== true;

  while (true) {
    const projectionNeedsMore =
      !projectionState.exhausted && countAuthoritySourceSessions(projectionState) < targetEnd;
    const nativeNeedsMore =
      readNativeSource &&
      !nativeState.exhausted &&
      countAuthoritySourceSessions(nativeState) < targetEnd;
    if (!projectionNeedsMore && !nativeNeedsMore) {
      break;
    }

    const reads: Promise<{
      source: 'projection' | 'native';
      page: { items: BirdCoderCodingSessionSummary[] | BirdCoderNativeSessionSummary[]; hasMore: boolean };
    }>[] = [];
    if (projectionNeedsMore) {
      const request = { ...requestScope, limit: pageSize, offset: projectionState.offset };
      reads.push(
        readAuthoritySessionPage({
          list: (nextRequest) => service.listCodingSessions(nextRequest),
          page: service.listCodingSessionPage
            ? (nextRequest) => service.listCodingSessionPage!(nextRequest)
            : undefined,
          request,
        }).then((page) => ({ source: 'projection' as const, page })),
      );
    }
    if (
      nativeNeedsMore &&
      requestScope.projectId &&
      requestScope.runtimeLocationId &&
      requestScope.workspaceId
    ) {
      const request: BirdCoderListNativeSessionsRequest & { limit: number; offset: number } = {
        projectId: requestScope.projectId,
        runtimeLocationId: requestScope.runtimeLocationId,
        workspaceId: requestScope.workspaceId,
        limit: pageSize,
        offset: nativeState.offset,
      };
      reads.push(
        readAuthoritySessionPage({
          list: (nextRequest) => service.listNativeSessions(nextRequest),
          page: service.listNativeSessionPage
            ? (nextRequest) => service.listNativeSessionPage!(nextRequest)
            : undefined,
          request,
        }).then((page) => ({ source: 'native' as const, page })),
      );
    } else if (nativeNeedsMore) {
      nativeState.exhausted = true;
    }
    const pages = await Promise.all(reads);
    for (const { source, page } of pages) {
      const state = source === 'projection' ? projectionState : nativeState;
      const records =
        source === 'projection'
          ? toAuthorityProjectionRecords(page.items as BirdCoderCodingSessionSummary[])
          : toAuthorityNativeRecords(page.items as BirdCoderNativeSessionSummary[]);
      appendAuthoritySourceRecords(state, records);
      state.hasMore = page.hasMore;
      state.offset += pageSize;
      if (!page.hasMore) {
        state.exhausted = true;
      }
    }
  }

  const mergedRecords = mergeAuthorityBackedCodingSessionRecords(
    projectionState.records,
    nativeState.records,
  );
  const items = selectBoundedInventoryWindow(mergedRecords, offset, targetEnd);
  const hasMore =
    mergedRecords.length > targetEnd || projectionState.hasMore || nativeState.hasMore;
  return {
    hasMore,
    items,
    loadedCount: items.length,
  };
}

function compareSessionInventoryRecords(
  left: WorkbenchSessionInventoryRecord,
  right: WorkbenchSessionInventoryRecord,
): number {
  const leftSortTimestamp =
    left.kind === 'terminal' ? left.sortTimestamp : resolveBirdCoderSessionSortTimestampString(left);
  const rightSortTimestamp =
    right.kind === 'terminal' ? right.sortTimestamp : resolveBirdCoderSessionSortTimestampString(right);
  return (
    compareBirdCoderLongIntegers(rightSortTimestamp, leftSortTimestamp) ||
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
    runtimeLocationId: codingSession.runtimeLocationId,
    title: codingSession.title,
    status: codingSession.status,
    hostMode: codingSession.hostMode,
    engineId: codingSession.engineId,
    modelId: codingSession.modelId,
    nativeSessionId: normalizeInventoryNativeSessionId(
      codingSession.nativeSessionId,
      codingSession.engineId,
    ),
    runtimeStatus: codingSession.runtimeStatus,
    createdAt: codingSession.createdAt,
    updatedAt: codingSession.updatedAt,
    lastTurnAt: codingSession.lastTurnAt,
    kind: 'coding',
    sortTimestamp: resolveBirdCoderSessionSortTimestampString(codingSession),
    transcriptUpdatedAt: codingSession.transcriptUpdatedAt ?? null,
  };
}

export function buildProjectBackedSessionInventory(
  options: BuildProjectBackedSessionInventoryOptions,
): WorkbenchSessionInventoryRecord[] {
  const normalizedWorkspaceId = normalizeScopedIdentifier(options.workspaceId);
  const normalizedProjectId = normalizeScopedIdentifier(options.projectId);
  const includeGlobal = options.includeGlobal ?? true;
  const records: WorkbenchSessionInventoryRecord[] = [];

  for (const project of options.projects) {
    if (!matchesWorkspaceScope(project.workspaceId, normalizedWorkspaceId)) {
      continue;
    }
    if (normalizedProjectId.length > 0 && project.id !== normalizedProjectId) {
      continue;
    }

    for (const codingSession of project.codingSessions) {
      if (!matchesWorkspaceScope(codingSession.workspaceId, normalizedWorkspaceId)) {
        continue;
      }
      if (!matchesProjectScope(codingSession.projectId, normalizedProjectId, false)) {
        continue;
      }
      records.push(toProjectBackedCodingSessionInventoryRecord(codingSession));
    }
  }

  for (const session of options.terminalSessions ?? []) {
    if (!matchesWorkspaceScope(session.workspaceId, normalizedWorkspaceId)) {
      continue;
    }
    if (!matchesProjectScope(session.projectId, normalizedProjectId, includeGlobal)) {
      continue;
    }
    records.push({
      ...session,
      kind: 'terminal' as const,
      sortTimestamp: session.updatedAt,
    });
  }

  records.sort(compareSessionInventoryRecords);

  return records;
}

export async function listProjectBackedSessionInventory(
  options: BuildProjectBackedSessionInventoryOptions,
): Promise<WorkbenchSessionInventoryRecord[]> {
  const terminalSessions =
    options.terminalSessions ??
    (await readStoredTerminalSessions({
      includeGlobal: options.includeGlobal,
      limit: undefined,
      projectId: options.projectId,
    }));

  return buildProjectBackedSessionInventory({
    ...options,
    terminalSessions,
  });
}

export async function listStoredSessionInventoryPage(
  options: ListStoredSessionInventoryOptions = {},
): Promise<StoredSessionInventoryPage> {
  const limit = normalizeSessionInventoryLimit(options.limit);
  const offset = normalizeSessionInventoryOffset(options.offset);
  const targetEnd = resolveSessionInventoryTargetEnd(offset, limit);
  const [terminalSessions, storedCodingSessions] = await Promise.all([
    readStoredTerminalSessions({
      includeGlobal: options.includeGlobal,
      limit: undefined,
      projectId: options.projectId,
    }),
    options.appRuntimeReadService
      ? Promise.resolve([] as BirdCoderCodingSessionSummary[])
      : listStoredCodingSessions({ projectId: options.projectId }),
  ]);
  const terminalRecords = terminalSessions
    .filter((session) => matchesWorkspaceScope(session.workspaceId, options.workspaceId))
    .map((session) => ({
      ...session,
      kind: 'terminal' as const,
      sortTimestamp: session.updatedAt,
    }));
  const authorityPrefix = resolveSessionInventoryTargetEnd(
    targetEnd,
    terminalRecords.length,
  );
  const authorityPage = options.appRuntimeReadService
    ? await listAuthorityBackedCodingSessionInventoryPage({
        ...options,
        limit: authorityPrefix,
        offset: 0,
      })
    : { hasMore: false, items: [], loadedCount: 0 };
  const codingSessions = options.appRuntimeReadService
    ? authorityPage.items
    : storedCodingSessions
        .filter((session) => matchesWorkspaceScope(session.workspaceId, options.workspaceId))
        .map((session) => ({
          ...session,
          kind: 'coding' as const,
          sortTimestamp: resolveBirdCoderSessionSortTimestampString(session),
          transcriptUpdatedAt: session.transcriptUpdatedAt ?? null,
        }));

  const records: WorkbenchSessionInventoryRecord[] = [
    ...terminalRecords,
    ...codingSessions,
  ].sort(compareSessionInventoryRecords);
  const items = selectBoundedInventoryWindow(records, offset, targetEnd);

  return {
    hasMore: authorityPage.hasMore || records.length > targetEnd,
    items,
    loadedCount: items.length,
  };
}

export async function listStoredSessionInventory(
  options: ListStoredSessionInventoryOptions = {},
): Promise<WorkbenchSessionInventoryRecord[]> {
  return (await listStoredSessionInventoryPage(options)).items;
}

