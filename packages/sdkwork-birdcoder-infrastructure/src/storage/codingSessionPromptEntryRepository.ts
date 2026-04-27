import type {
  BirdCoderDatabaseProviderId,
  BirdCoderEntityStorageBinding,
} from '@sdkwork/birdcoder-types';
import {
  BIRDCODER_CODING_SESSION_PROMPT_ENTRY_STORAGE_BINDING,
  getBirdCoderEntityDefinition,
} from '@sdkwork/birdcoder-types';
import {
  createBirdCoderTableRecordRepository,
  type BirdCoderStorageAccess,
} from './dataKernel.ts';
import {
  buildBirdCoderPromptEntryIdentityParts,
  normalizeBirdCoderPromptEntryUseCount,
  normalizeBirdCoderPromptEntryText,
  resolveBirdCoderMonotonicPromptTimestamp,
} from './promptEntryText.ts';
import { coerceBirdCoderSqlEntityRow } from './sqlRowCodec.ts';
import type { BirdCoderSqlRow } from './sqlPlans.ts';

const DEFAULT_PROMPT_ENTRY_LIMIT = 100;
const ZERO_TIMESTAMP = new Date(0).toISOString();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  return Number.isNaN(Date.parse(value)) ? fallback : value;
}

function resolveSortTimestamp(value: string): number {
  const parsedValue = Date.parse(value);
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
}

function sortPromptEntriesByLastUsedDescending(
  left: BirdCoderPersistedCodingSessionPromptEntryRecord,
  right: BirdCoderPersistedCodingSessionPromptEntryRecord,
): number {
  return (
    resolveSortTimestamp(right.lastUsedAt) - resolveSortTimestamp(left.lastUsedAt) ||
    resolveSortTimestamp(right.updatedAt) - resolveSortTimestamp(left.updatedAt) ||
    left.id.localeCompare(right.id)
  );
}

function toPromptEntryStorageRow(
  value: BirdCoderPersistedCodingSessionPromptEntryRecord,
): BirdCoderSqlRow {
  return {
    id: value.id,
    coding_session_id: value.codingSessionId,
    prompt_text: value.promptText,
    normalized_prompt_text: value.normalizedPromptText,
    last_used_at: value.lastUsedAt,
    use_count: value.useCount,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
  };
}

function normalizePromptEntryStorageRecord(
  value: unknown,
): BirdCoderPersistedCodingSessionPromptEntryRecord | null {
  if (isRecord(value) && typeof value.id === 'string' && typeof value.codingSessionId === 'string') {
    const normalizedPromptText = normalizeBirdCoderCodingSessionPromptEntryText(
      typeof value.promptText === 'string' ? value.promptText : '',
    );
    const normalizedLookupText =
      typeof value.normalizedPromptText === 'string' && value.normalizedPromptText.trim().length > 0
        ? value.normalizedPromptText.trim()
        : normalizedPromptText;
    if (!normalizedPromptText || !normalizedLookupText) {
      return null;
    }

    const createdAtCandidate = normalizeTimestamp(value.createdAt, ZERO_TIMESTAMP);
    const updatedAtCandidate = normalizeTimestamp(value.updatedAt, createdAtCandidate);

    return {
      id: value.id,
      codingSessionId: value.codingSessionId,
      promptText: normalizedPromptText,
      normalizedPromptText: normalizedLookupText,
      lastUsedAt: normalizeTimestamp(value.lastUsedAt, updatedAtCandidate),
      useCount: normalizeBirdCoderPromptEntryUseCount(value.useCount),
      createdAt: createdAtCandidate,
      updatedAt: updatedAtCandidate,
    };
  }

  const row = coerceBirdCoderSqlEntityRow(
    getBirdCoderEntityDefinition('coding_session_prompt_entry'),
    value,
  );
  if (
    !row ||
    typeof row.id !== 'string' ||
    typeof row.coding_session_id !== 'string' ||
    typeof row.prompt_text !== 'string'
  ) {
    return null;
  }

  const normalizedPromptText = normalizeBirdCoderCodingSessionPromptEntryText(row.prompt_text);
  const normalizedLookupText =
    typeof row.normalized_prompt_text === 'string' && row.normalized_prompt_text.trim().length > 0
      ? row.normalized_prompt_text.trim()
      : normalizedPromptText;
  if (!normalizedPromptText || !normalizedLookupText) {
    return null;
  }

  const createdAtCandidate = normalizeTimestamp(row.created_at, ZERO_TIMESTAMP);
  const updatedAtCandidate = normalizeTimestamp(row.updated_at, createdAtCandidate);

  return {
    id: String(row.id),
    codingSessionId: String(row.coding_session_id),
    promptText: normalizedPromptText,
    normalizedPromptText: normalizedLookupText,
    lastUsedAt: normalizeTimestamp(row.last_used_at, updatedAtCandidate),
    useCount: normalizeBirdCoderPromptEntryUseCount(row.use_count),
    createdAt: createdAtCandidate,
    updatedAt: updatedAtCandidate,
  };
}

export interface BirdCoderPersistedCodingSessionPromptEntryRecord {
  codingSessionId: string;
  createdAt: string;
  id: string;
  lastUsedAt: string;
  normalizedPromptText: string;
  promptText: string;
  updatedAt: string;
  useCount: number;
}

export interface BirdCoderCodingSessionPromptHistoryRepository {
  binding: BirdCoderEntityStorageBinding;
  clear(): Promise<void>;
  count(): Promise<number>;
  delete(id: string): Promise<void>;
  deleteByText(codingSessionId: string, text: string): Promise<void>;
  findById(id: string): Promise<BirdCoderPersistedCodingSessionPromptEntryRecord | null>;
  findByText(
    codingSessionId: string,
    text: string,
  ): Promise<BirdCoderPersistedCodingSessionPromptEntryRecord | null>;
  list(): Promise<BirdCoderPersistedCodingSessionPromptEntryRecord[]>;
  listBySessionId(
    codingSessionId: string,
    limit?: number,
  ): Promise<BirdCoderPersistedCodingSessionPromptEntryRecord[]>;
  recordPromptUsage(
    codingSessionId: string,
    text: string,
    timestamp?: string,
  ): Promise<BirdCoderPersistedCodingSessionPromptEntryRecord[]>;
  save(
    value: BirdCoderPersistedCodingSessionPromptEntryRecord,
  ): Promise<BirdCoderPersistedCodingSessionPromptEntryRecord>;
  saveMany(
    values: readonly BirdCoderPersistedCodingSessionPromptEntryRecord[],
  ): Promise<BirdCoderPersistedCodingSessionPromptEntryRecord[]>;
}

export interface CreateBirdCoderCodingSessionPromptHistoryRepositoryOptions {
  providerId: BirdCoderDatabaseProviderId;
  storage: BirdCoderStorageAccess;
}

export function normalizeBirdCoderCodingSessionPromptEntryText(text: string): string {
  return normalizeBirdCoderPromptEntryText(text);
}

export function buildBirdCoderCodingSessionPromptEntryId(
  codingSessionId: string,
  normalizedPromptText: string,
): string {
  const normalizedSessionId = codingSessionId.trim();
  const normalizedText = normalizeBirdCoderCodingSessionPromptEntryText(normalizedPromptText);
  const [preview, lengthToken, hash] = buildBirdCoderPromptEntryIdentityParts(normalizedText);
  return [
    'coding-session-prompt-entry',
    normalizedSessionId,
    preview,
    lengthToken,
    hash,
  ].join(':');
}

export function createBirdCoderCodingSessionPromptHistoryRepository({
  providerId,
  storage,
}: CreateBirdCoderCodingSessionPromptHistoryRepositoryOptions): BirdCoderCodingSessionPromptHistoryRepository {
  const repository = createBirdCoderTableRecordRepository({
    binding: BIRDCODER_CODING_SESSION_PROMPT_ENTRY_STORAGE_BINDING,
    definition: getBirdCoderEntityDefinition(
      BIRDCODER_CODING_SESSION_PROMPT_ENTRY_STORAGE_BINDING.entityName,
    ),
    providerId,
    storage,
    identify(value) {
      return value.id;
    },
    normalize: normalizePromptEntryStorageRecord,
    sort: sortPromptEntriesByLastUsedDescending,
    toRow: toPromptEntryStorageRow,
  });

  async function listBySessionId(
    codingSessionId: string,
    limit = DEFAULT_PROMPT_ENTRY_LIMIT,
  ): Promise<BirdCoderPersistedCodingSessionPromptEntryRecord[]> {
    const normalizedSessionId = codingSessionId.trim();
    if (!normalizedSessionId) {
      return [];
    }

    const normalizedLimit = Math.max(0, Math.trunc(limit));
    const records = (await repository.list()).filter(
      (entry) => entry.codingSessionId === normalizedSessionId,
    );
    records.sort(sortPromptEntriesByLastUsedDescending);
    return normalizedLimit === 0 ? [] : records.slice(0, normalizedLimit);
  }

  return {
    binding: repository.binding,
    clear() {
      return repository.clear();
    },
    count() {
      return repository.count();
    },
    delete(id) {
      return repository.delete(id);
    },
    async deleteByText(codingSessionId, text) {
      const promptEntry = await this.findByText(codingSessionId, text);
      if (!promptEntry) {
        return;
      }
      await repository.delete(promptEntry.id);
    },
    findById(id) {
      return repository.findById(id);
    },
    async findByText(codingSessionId, text) {
      const normalizedSessionId = codingSessionId.trim();
      const normalizedPromptText = normalizeBirdCoderCodingSessionPromptEntryText(text);
      if (!normalizedSessionId || !normalizedPromptText) {
        return null;
      }
      return repository.findById(
        buildBirdCoderCodingSessionPromptEntryId(normalizedSessionId, normalizedPromptText),
      );
    },
    list() {
      return repository.list();
    },
    listBySessionId,
    async recordPromptUsage(codingSessionId, text, timestamp) {
      const normalizedSessionId = codingSessionId.trim();
      const normalizedPromptText = normalizeBirdCoderCodingSessionPromptEntryText(text);
      if (!normalizedSessionId || !normalizedPromptText) {
        return [];
      }

      const currentEntries = await listBySessionId(normalizedSessionId);
      const now = resolveBirdCoderMonotonicPromptTimestamp(
        normalizeTimestamp(timestamp, new Date().toISOString()),
        currentEntries.map((entry) => entry.lastUsedAt),
      );
      const recordId = buildBirdCoderCodingSessionPromptEntryId(
        normalizedSessionId,
        normalizedPromptText,
      );
      const existingRecord = await repository.findById(recordId);

      await repository.save({
        id: recordId,
        codingSessionId: normalizedSessionId,
        promptText: normalizedPromptText,
        normalizedPromptText,
        lastUsedAt: now,
        useCount: existingRecord ? existingRecord.useCount + 1 : 1,
        createdAt: existingRecord?.createdAt ?? now,
        updatedAt: now,
      });

      return listBySessionId(normalizedSessionId);
    },
    save(value) {
      return repository.save(value);
    },
    saveMany(values) {
      return repository.saveMany(values);
    },
  };
}
