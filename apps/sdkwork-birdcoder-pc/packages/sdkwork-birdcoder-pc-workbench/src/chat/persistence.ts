import type {
  BirdCoderSavedPrompt,
  IPromptService,
} from '@sdkwork/birdcoder-pc-infrastructure/services/interfaces/IPromptService';

import { createLazyDefaultIdeServices } from '../context/lazyDefaultIdeServices.ts';

const DEFAULT_PROMPT_HISTORY_LIMIT = 100;
const DEFAULT_CHAT_HISTORY_LIMIT = 50;
const MAX_PRESENTATION_SESSION_COUNT = 32;
const MAX_PRESENTATION_HISTORY_ENTRY_CHARACTERS = 16_384;
const MAX_PRESENTATION_HISTORY_SESSION_CHARACTERS = 262_144;
const MAX_PRESENTATION_HISTORY_TOTAL_CHARACTERS = 4 * 1_048_576;

export interface PromptEntryRecord {
  text: string;
  timestamp: number;
}

// Composer recall is presentation state. It must never become a second Session or Prompt store.
const sessionPromptHistoryMemory = new Map<string, PromptEntryRecord[]>();
let defaultIdeServices: ReturnType<typeof createLazyDefaultIdeServices> | null = null;
let promptServiceOverrideForTests: IPromptService | null = null;

function normalizeSessionScopeId(sessionId: string): string {
  return sessionId.trim();
}

function getPromptService(): IPromptService {
  defaultIdeServices ??= createLazyDefaultIdeServices();
  return promptServiceOverrideForTests ?? defaultIdeServices.promptService;
}

function toPromptEntryRecord(prompt: BirdCoderSavedPrompt): PromptEntryRecord {
  const timestamp = prompt.updatedAt ? Date.parse(prompt.updatedAt) : Number.NaN;
  return {
    text: prompt.text,
    timestamp: Number.isNaN(timestamp) ? 0 : timestamp,
  };
}

function writeSessionPromptHistory(
  sessionId: string,
  entries: readonly PromptEntryRecord[],
): PromptEntryRecord[] {
  const normalizedEntries = normalizePromptEntryRecords(entries);
  sessionPromptHistoryMemory.delete(sessionId);
  if (normalizedEntries.length > 0) {
    sessionPromptHistoryMemory.set(sessionId, normalizedEntries);
  }

  while (sessionPromptHistoryMemory.size > MAX_PRESENTATION_SESSION_COUNT) {
    const oldestSessionId = sessionPromptHistoryMemory.keys().next().value as string | undefined;
    if (!oldestSessionId) {
      break;
    }
    sessionPromptHistoryMemory.delete(oldestSessionId);
  }
  let totalCharacters = [...sessionPromptHistoryMemory.values()]
    .reduce((total, sessionEntries) => total + sessionEntries.reduce(
      (sessionTotal, entry) => sessionTotal + entry.text.length,
      0,
    ), 0);
  while (
    totalCharacters > MAX_PRESENTATION_HISTORY_TOTAL_CHARACTERS
    && sessionPromptHistoryMemory.size > 0
  ) {
    const oldestSessionId = sessionPromptHistoryMemory.keys().next().value as string | undefined;
    if (!oldestSessionId) {
      break;
    }
    const removedEntries = sessionPromptHistoryMemory.get(oldestSessionId) ?? [];
    totalCharacters -= removedEntries.reduce((total, entry) => total + entry.text.length, 0);
    sessionPromptHistoryMemory.delete(oldestSessionId);
  }
  return normalizedEntries.map((entry) => ({ ...entry }));
}

export function setPromptServiceOverrideForTests(promptService: IPromptService | null): void {
  promptServiceOverrideForTests = promptService;
}

export function clearChatPresentationMemory(): void {
  sessionPromptHistoryMemory.clear();
}

export const resetChatPresentationMemoryForTests = clearChatPresentationMemory;

export function normalizePromptEntryRecords(
  value: unknown,
  limit = DEFAULT_PROMPT_HISTORY_LIMIT,
): PromptEntryRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedLimit = Math.max(Math.trunc(limit), 0);
  const normalizedEntries: PromptEntryRecord[] = [];
  let totalCharacters = 0;
  for (const entry of value) {
    if (
      normalizedEntries.length >= normalizedLimit
      || typeof entry !== 'object'
      || entry === null
      || typeof (entry as PromptEntryRecord).text !== 'string'
      || typeof (entry as PromptEntryRecord).timestamp !== 'number'
    ) {
      continue;
    }
    const normalizedEntry = {
      text: (entry as PromptEntryRecord).text.trim(),
      timestamp: (entry as PromptEntryRecord).timestamp,
    };
    if (
      !normalizedEntry.text
      || normalizedEntry.text.length > MAX_PRESENTATION_HISTORY_ENTRY_CHARACTERS
      || !Number.isFinite(normalizedEntry.timestamp)
      || totalCharacters + normalizedEntry.text.length
        > MAX_PRESENTATION_HISTORY_SESSION_CHARACTERS
    ) {
      continue;
    }
    normalizedEntries.push(normalizedEntry);
    totalCharacters += normalizedEntry.text.length;
  }
  return normalizedEntries;
}

export function mergePromptEntryRecord(
  entries: ReadonlyArray<PromptEntryRecord>,
  text: string,
  timestamp = Date.now(),
  limit = DEFAULT_PROMPT_HISTORY_LIMIT,
): PromptEntryRecord[] {
  const normalizedText = text.trim();
  if (
    !normalizedText
    || normalizedText.length > MAX_PRESENTATION_HISTORY_ENTRY_CHARACTERS
  ) {
    return normalizePromptEntryRecords(entries, limit);
  }

  return [
    { text: normalizedText, timestamp },
    ...normalizePromptEntryRecords(entries, limit).filter((entry) => entry.text !== normalizedText),
  ].slice(0, Math.max(limit, 0));
}

export async function listSessionPromptHistory(sessionId: string): Promise<PromptEntryRecord[]> {
  const normalizedSessionId = normalizeSessionScopeId(sessionId);
  if (!normalizedSessionId) {
    return [];
  }

  return normalizePromptEntryRecords(sessionPromptHistoryMemory.get(normalizedSessionId));
}

export async function saveSessionPromptHistoryEntry(
  text: string,
  sessionId: string,
): Promise<PromptEntryRecord[]> {
  const normalizedSessionId = normalizeSessionScopeId(sessionId);
  if (!normalizedSessionId || !text.trim()) {
    return [];
  }

  return writeSessionPromptHistory(
    normalizedSessionId,
    mergePromptEntryRecord(sessionPromptHistoryMemory.get(normalizedSessionId) ?? [], text),
  );
}

export async function deleteSessionPromptHistoryEntry(
  text: string,
  sessionId: string,
): Promise<PromptEntryRecord[]> {
  const normalizedSessionId = normalizeSessionScopeId(sessionId);
  const normalizedText = text.trim();
  if (!normalizedSessionId || !normalizedText) {
    return [];
  }

  return writeSessionPromptHistory(
    normalizedSessionId,
    (sessionPromptHistoryMemory.get(normalizedSessionId) ?? [])
      .filter((entry) => entry.text !== normalizedText),
  );
}

export async function listSavedPrompts(): Promise<PromptEntryRecord[]> {
  return (await getPromptService().listSavedPrompts(DEFAULT_PROMPT_HISTORY_LIMIT))
    .map(toPromptEntryRecord);
}

export async function saveSavedPrompt(text: string): Promise<PromptEntryRecord[]> {
  await getPromptService().saveSavedPrompt(text);
  return listSavedPrompts();
}

export async function deleteSavedPrompt(text: string): Promise<PromptEntryRecord[]> {
  await getPromptService().deleteSavedPrompt(text);
  return listSavedPrompts();
}

export function normalizeSessionChatInputHistory(
  value: unknown,
  limit = DEFAULT_CHAT_HISTORY_LIMIT,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, Math.max(limit, 0));
}

export async function listSessionChatInputHistory(sessionId: string): Promise<string[]> {
  return normalizeSessionChatInputHistory(
    (await listSessionPromptHistory(sessionId)).map((entry) => entry.text),
  );
}

export async function saveSessionChatInputHistoryEntry(
  sessionId: string,
  text: string,
  limit = DEFAULT_CHAT_HISTORY_LIMIT,
): Promise<string[]> {
  const normalizedSessionId = normalizeSessionScopeId(sessionId);
  if (!normalizedSessionId || !text.trim()) {
    return [];
  }

  return normalizeSessionChatInputHistory(
    (await saveSessionPromptHistoryEntry(text, normalizedSessionId)).map((entry) => entry.text),
    limit,
  );
}
