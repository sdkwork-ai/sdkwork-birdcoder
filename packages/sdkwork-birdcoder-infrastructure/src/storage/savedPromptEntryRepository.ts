import type {
  BirdCoderDatabaseProviderId,
  BirdCoderEntityStorageBinding,
} from '@sdkwork/birdcoder-types';
import {
  BIRDCODER_SAVED_PROMPT_ENTRY_STORAGE_BINDING,
  getBirdCoderEntityDefinition,
} from '@sdkwork/birdcoder-types';
import {
  createBirdCoderTableRecordRepository,
  type BirdCoderStorageAccess,
} from './dataKernel.ts';
import {
  buildBirdCoderPromptEntryIdentityParts,
  normalizeBirdCoderPromptEntryText,
  resolveBirdCoderMonotonicPromptTimestamp,
} from './promptEntryText.ts';
import { coerceBirdCoderSqlEntityRow } from './sqlRowCodec.ts';
import type { BirdCoderSqlRow } from './sqlPlans.ts';

const DEFAULT_SAVED_PROMPT_LIMIT = 100;
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

function normalizeUseCount(value: unknown): number {
  const normalizedValue =
    typeof value === 'number' && Number.isFinite(value)
      ? Math.trunc(value)
      : typeof value === 'string'
        ? Math.trunc(Number(value))
        : 0;
  return normalizedValue > 0 ? normalizedValue : 1;
}

function resolveSortTimestamp(value: string): number {
  const parsedValue = Date.parse(value);
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
}

function sortSavedPromptEntriesByLastSavedDescending(
  left: BirdCoderPersistedSavedPromptEntryRecord,
  right: BirdCoderPersistedSavedPromptEntryRecord,
): number {
  return (
    resolveSortTimestamp(right.lastSavedAt) - resolveSortTimestamp(left.lastSavedAt) ||
    resolveSortTimestamp(right.updatedAt) - resolveSortTimestamp(left.updatedAt) ||
    left.id.localeCompare(right.id)
  );
}

function toSavedPromptEntryStorageRow(
  value: BirdCoderPersistedSavedPromptEntryRecord,
): BirdCoderSqlRow {
  return {
    id: value.id,
    prompt_text: value.promptText,
    normalized_prompt_text: value.normalizedPromptText,
    last_saved_at: value.lastSavedAt,
    use_count: value.useCount,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
  };
}

function normalizeSavedPromptEntryStorageRecord(
  value: unknown,
): BirdCoderPersistedSavedPromptEntryRecord | null {
  if (isRecord(value) && typeof value.id === 'string') {
    const normalizedPromptText = normalizeBirdCoderSavedPromptEntryText(
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
      promptText: normalizedPromptText,
      normalizedPromptText: normalizedLookupText,
      lastSavedAt: normalizeTimestamp(value.lastSavedAt, updatedAtCandidate),
      useCount: normalizeUseCount(value.useCount),
      createdAt: createdAtCandidate,
      updatedAt: updatedAtCandidate,
    };
  }

  const row = coerceBirdCoderSqlEntityRow(
    getBirdCoderEntityDefinition('saved_prompt_entry'),
    value,
  );
  if (!row || typeof row.id !== 'string' || typeof row.prompt_text !== 'string') {
    return null;
  }

  const normalizedPromptText = normalizeBirdCoderSavedPromptEntryText(row.prompt_text);
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
    promptText: normalizedPromptText,
    normalizedPromptText: normalizedLookupText,
    lastSavedAt: normalizeTimestamp(row.last_saved_at, updatedAtCandidate),
    useCount: normalizeUseCount(row.use_count),
    createdAt: createdAtCandidate,
    updatedAt: updatedAtCandidate,
  };
}

export interface BirdCoderPersistedSavedPromptEntryRecord {
  createdAt: string;
  id: string;
  lastSavedAt: string;
  normalizedPromptText: string;
  promptText: string;
  updatedAt: string;
  useCount: number;
}

export interface BirdCoderSavedPromptEntryRepository {
  binding: BirdCoderEntityStorageBinding;
  clear(): Promise<void>;
  count(): Promise<number>;
  delete(id: string): Promise<void>;
  deleteByText(text: string): Promise<void>;
  findById(id: string): Promise<BirdCoderPersistedSavedPromptEntryRecord | null>;
  findByText(text: string): Promise<BirdCoderPersistedSavedPromptEntryRecord | null>;
  list(): Promise<BirdCoderPersistedSavedPromptEntryRecord[]>;
  listRecent(limit?: number): Promise<BirdCoderPersistedSavedPromptEntryRecord[]>;
  recordPromptSave(
    text: string,
    timestamp?: string,
  ): Promise<BirdCoderPersistedSavedPromptEntryRecord[]>;
  save(
    value: BirdCoderPersistedSavedPromptEntryRecord,
  ): Promise<BirdCoderPersistedSavedPromptEntryRecord>;
  saveMany(
    values: readonly BirdCoderPersistedSavedPromptEntryRecord[],
  ): Promise<BirdCoderPersistedSavedPromptEntryRecord[]>;
}

export interface CreateBirdCoderSavedPromptEntryRepositoryOptions {
  providerId: BirdCoderDatabaseProviderId;
  storage: BirdCoderStorageAccess;
}

export function normalizeBirdCoderSavedPromptEntryText(text: string): string {
  return normalizeBirdCoderPromptEntryText(text);
}

export function buildBirdCoderSavedPromptEntryId(normalizedPromptText: string): string {
  const normalizedText = normalizeBirdCoderSavedPromptEntryText(normalizedPromptText);
  const [preview, lengthToken, hash] = buildBirdCoderPromptEntryIdentityParts(normalizedText);
  return ['saved-prompt-entry', preview, lengthToken, hash].join(':');
}

export function createBirdCoderSavedPromptEntryRepository({
  providerId,
  storage,
}: CreateBirdCoderSavedPromptEntryRepositoryOptions): BirdCoderSavedPromptEntryRepository {
  const repository = createBirdCoderTableRecordRepository({
    binding: BIRDCODER_SAVED_PROMPT_ENTRY_STORAGE_BINDING,
    definition: getBirdCoderEntityDefinition(
      BIRDCODER_SAVED_PROMPT_ENTRY_STORAGE_BINDING.entityName,
    ),
    providerId,
    storage,
    identify(value) {
      return value.id;
    },
    normalize: normalizeSavedPromptEntryStorageRecord,
    sort: sortSavedPromptEntriesByLastSavedDescending,
    toRow: toSavedPromptEntryStorageRow,
  });

  async function listRecent(
    limit = DEFAULT_SAVED_PROMPT_LIMIT,
  ): Promise<BirdCoderPersistedSavedPromptEntryRecord[]> {
    const normalizedLimit = Math.max(0, Math.trunc(limit));
    const records = await repository.list();
    records.sort(sortSavedPromptEntriesByLastSavedDescending);
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
    async deleteByText(text) {
      const promptEntry = await this.findByText(text);
      if (!promptEntry) {
        return;
      }
      await repository.delete(promptEntry.id);
    },
    findById(id) {
      return repository.findById(id);
    },
    async findByText(text) {
      const normalizedPromptText = normalizeBirdCoderSavedPromptEntryText(text);
      if (!normalizedPromptText) {
        return null;
      }
      return repository.findById(buildBirdCoderSavedPromptEntryId(normalizedPromptText));
    },
    list() {
      return repository.list();
    },
    listRecent,
    async recordPromptSave(text, timestamp) {
      const normalizedPromptText = normalizeBirdCoderSavedPromptEntryText(text);
      if (!normalizedPromptText) {
        return [];
      }

      const currentEntries = await listRecent();
      const now = resolveBirdCoderMonotonicPromptTimestamp(
        normalizeTimestamp(timestamp, new Date().toISOString()),
        currentEntries.map((entry) => entry.lastSavedAt),
      );
      const recordId = buildBirdCoderSavedPromptEntryId(normalizedPromptText);
      const existingRecord = await repository.findById(recordId);

      await repository.save({
        id: recordId,
        promptText: normalizedPromptText,
        normalizedPromptText,
        lastSavedAt: now,
        useCount: existingRecord ? existingRecord.useCount + 1 : 1,
        createdAt: existingRecord?.createdAt ?? now,
        updatedAt: now,
      });

      return listRecent();
    },
    save(value) {
      return repository.save(value);
    },
    saveMany(values) {
      return repository.saveMany(values);
    },
  };
}
