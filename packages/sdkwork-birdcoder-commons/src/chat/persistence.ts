import { createLazyDefaultIdeServices } from '../context/lazyDefaultIdeServices.ts';
import type { IPromptService } from '../../../sdkwork-birdcoder-infrastructure/src/services/interfaces/IPromptService.ts';

const DEFAULT_PROMPT_HISTORY_LIMIT = 100;
const DEFAULT_CHAT_HISTORY_LIMIT = 50;

export interface PromptEntryRecord {
  text: string;
  timestamp: number;
}

let defaultIdeServices = createLazyDefaultIdeServices();
let promptServiceOverrideForTests: IPromptService | null = null;

function normalizeSessionScopeId(sessionId: string): string {
  return sessionId.trim();
}

function getPromptService() {
  return promptServiceOverrideForTests ?? defaultIdeServices.promptService;
}

export function setPromptServiceOverrideForTests(promptService: IPromptService | null): void {
  promptServiceOverrideForTests = promptService;
}

export function normalizePromptEntryRecords(
  value: unknown,
  limit = DEFAULT_PROMPT_HISTORY_LIMIT,
): PromptEntryRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (entry): entry is PromptEntryRecord =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as PromptEntryRecord).text === 'string' &&
        typeof (entry as PromptEntryRecord).timestamp === 'number',
    )
    .map((entry) => ({
      text: entry.text.trim(),
      timestamp: entry.timestamp,
    }))
    .filter((entry) => entry.text.length > 0)
    .slice(0, Math.max(limit, 0));
}

export function mergePromptEntryRecord(
  entries: ReadonlyArray<PromptEntryRecord>,
  text: string,
  timestamp = Date.now(),
  limit = DEFAULT_PROMPT_HISTORY_LIMIT,
): PromptEntryRecord[] {
  const normalizedText = text.trim();
  if (!normalizedText) {
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

  return (
    await getPromptService().listSessionPromptHistory(
      normalizedSessionId,
      DEFAULT_PROMPT_HISTORY_LIMIT,
    )
  ).map((entry) => ({
    text: entry.text,
    timestamp: entry.timestamp,
  }));
}

export async function saveSessionPromptHistoryEntry(
  text: string,
  sessionId: string,
): Promise<PromptEntryRecord[]> {
  const normalizedSessionId = normalizeSessionScopeId(sessionId);
  if (!normalizedSessionId) {
    return [];
  }

  return (
    await getPromptService().recordSessionPromptUsage(
      normalizedSessionId,
      text,
      DEFAULT_PROMPT_HISTORY_LIMIT,
    )
  )
    .map((entry) => ({
      text: entry.text,
      timestamp: entry.timestamp,
    }));
}

export async function deleteSessionPromptHistoryEntry(
  text: string,
  sessionId: string,
): Promise<PromptEntryRecord[]> {
  const normalizedSessionId = normalizeSessionScopeId(sessionId);
  if (!normalizedSessionId) {
    return [];
  }

  await getPromptService().deleteSessionPromptHistoryEntry(normalizedSessionId, text);
  return (
    await getPromptService().listSessionPromptHistory(
      normalizedSessionId,
      DEFAULT_PROMPT_HISTORY_LIMIT,
    )
  ).map((entry) => ({
    text: entry.text,
    timestamp: entry.timestamp,
  }));
}

export async function listSavedPrompts(): Promise<PromptEntryRecord[]> {
  return (await getPromptService().listSavedPrompts(DEFAULT_PROMPT_HISTORY_LIMIT)).map((entry) => ({
    text: entry.text,
    timestamp: entry.timestamp,
  }));
}

export async function saveSavedPrompt(text: string): Promise<PromptEntryRecord[]> {
  return (await getPromptService().saveSavedPrompt(text, DEFAULT_PROMPT_HISTORY_LIMIT)).map(
    (entry) => ({
      text: entry.text,
      timestamp: entry.timestamp,
    }),
  );
}

export async function deleteSavedPrompt(text: string): Promise<PromptEntryRecord[]> {
  return (await getPromptService().deleteSavedPrompt(text)).map((entry) => ({
    text: entry.text,
    timestamp: entry.timestamp,
  }));
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
    (
      await saveSessionPromptHistoryEntry(text, normalizedSessionId)
    ).map((entry) => entry.text),
    limit,
  );
}
