import { getStoredJson, setStoredJson } from '../storage/localStore.ts';

const CHAT_STORAGE_SCOPE = 'chat';
const GLOBAL_PROMPT_HISTORY_KEY = 'prompt-history';
const SAVED_PROMPTS_KEY = 'saved-prompts';
const DEFAULT_PROMPT_HISTORY_LIMIT = 100;
const DEFAULT_CHAT_HISTORY_LIMIT = 50;

export interface StoredPromptEntry {
  text: string;
  timestamp: number;
}

export function buildChatHistoryStorageKey(chatId: string): string {
  return `history.${chatId}`;
}

export function normalizeStoredPromptEntries(
  value: unknown,
  limit = DEFAULT_PROMPT_HISTORY_LIMIT,
): StoredPromptEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (entry): entry is StoredPromptEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as StoredPromptEntry).text === 'string' &&
        typeof (entry as StoredPromptEntry).timestamp === 'number',
    )
    .map((entry) => ({
      text: entry.text.trim(),
      timestamp: entry.timestamp,
    }))
    .filter((entry) => entry.text.length > 0)
    .slice(0, Math.max(limit, 0));
}

export function mergeStoredPromptEntry(
  entries: ReadonlyArray<StoredPromptEntry>,
  text: string,
  timestamp = Date.now(),
  limit = DEFAULT_PROMPT_HISTORY_LIMIT,
): StoredPromptEntry[] {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return normalizeStoredPromptEntries(entries, limit);
  }

  return [
    { text: normalizedText, timestamp },
    ...normalizeStoredPromptEntries(entries, limit).filter((entry) => entry.text !== normalizedText),
  ].slice(0, Math.max(limit, 0));
}

async function readPromptEntries(key: string, limit = DEFAULT_PROMPT_HISTORY_LIMIT) {
  const storedEntries = await getStoredJson<StoredPromptEntry[]>(CHAT_STORAGE_SCOPE, key, []);
  return normalizeStoredPromptEntries(storedEntries, limit);
}

async function writePromptEntries(key: string, entries: ReadonlyArray<StoredPromptEntry>) {
  await setStoredJson(CHAT_STORAGE_SCOPE, key, normalizeStoredPromptEntries(entries));
}

export async function listStoredPromptHistory(): Promise<StoredPromptEntry[]> {
  return readPromptEntries(GLOBAL_PROMPT_HISTORY_KEY);
}

export async function saveStoredPromptHistoryEntry(text: string): Promise<StoredPromptEntry[]> {
  const nextEntries = mergeStoredPromptEntry(await listStoredPromptHistory(), text);
  await writePromptEntries(GLOBAL_PROMPT_HISTORY_KEY, nextEntries);
  return nextEntries;
}

export async function deleteStoredPromptHistoryEntry(text: string): Promise<StoredPromptEntry[]> {
  const nextEntries = (await listStoredPromptHistory()).filter((entry) => entry.text !== text.trim());
  await writePromptEntries(GLOBAL_PROMPT_HISTORY_KEY, nextEntries);
  return nextEntries;
}

export async function listSavedPrompts(): Promise<StoredPromptEntry[]> {
  return readPromptEntries(SAVED_PROMPTS_KEY);
}

export async function saveSavedPrompt(text: string): Promise<StoredPromptEntry[]> {
  const nextEntries = mergeStoredPromptEntry(await listSavedPrompts(), text);
  await writePromptEntries(SAVED_PROMPTS_KEY, nextEntries);
  return nextEntries;
}

export async function deleteSavedPrompt(text: string): Promise<StoredPromptEntry[]> {
  const nextEntries = (await listSavedPrompts()).filter((entry) => entry.text !== text.trim());
  await writePromptEntries(SAVED_PROMPTS_KEY, nextEntries);
  return nextEntries;
}

function normalizeChatInputHistory(value: unknown, limit = DEFAULT_CHAT_HISTORY_LIMIT): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, Math.max(limit, 0));
}

export async function listChatInputHistory(chatId: string): Promise<string[]> {
  if (!chatId.trim()) {
    return [];
  }

  const storedEntries = await getStoredJson<string[]>(
    CHAT_STORAGE_SCOPE,
    buildChatHistoryStorageKey(chatId),
    [],
  );
  return normalizeChatInputHistory(storedEntries);
}

export async function saveChatInputHistoryEntry(
  chatId: string,
  text: string,
  limit = DEFAULT_CHAT_HISTORY_LIMIT,
): Promise<string[]> {
  const normalizedChatId = chatId.trim();
  const normalizedText = text.trim();
  if (!normalizedChatId || !normalizedText) {
    return [];
  }

  const nextEntries = [
    normalizedText,
    ...(await listChatInputHistory(normalizedChatId)).filter((entry) => entry !== normalizedText),
  ].slice(0, Math.max(limit, 0));

  await setStoredJson(
    CHAT_STORAGE_SCOPE,
    buildChatHistoryStorageKey(normalizedChatId),
    nextEntries,
  );
  return nextEntries;
}
