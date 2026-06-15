import { useCallback, useSyncExternalStore } from 'react';

type ChatInputDraftListener = () => void;

const MAX_CHAT_INPUT_DRAFT_ENTRIES = 200;

const chatInputDrafts = new Map<string, string>();
const chatInputDraftListeners = new Map<string, Set<ChatInputDraftListener>>();

function normalizeChatInputDraftKey(key: string | null | undefined): string {
  return typeof key === 'string' ? key.trim() : '';
}

function getChatInputDraftSnapshot(key: string): string {
  return chatInputDrafts.get(key) ?? '';
}

function pruneChatInputDrafts(): void {
  while (chatInputDrafts.size > MAX_CHAT_INPUT_DRAFT_ENTRIES) {
    const oldestPrunableKey = Array.from(chatInputDrafts.keys())
      .find((key) => !chatInputDraftListeners.has(key));

    if (!oldestPrunableKey) {
      return;
    }

    chatInputDrafts.delete(oldestPrunableKey);
  }
}

function emitChatInputDraftSnapshot(key: string): void {
  const listeners = chatInputDraftListeners.get(key);
  if (!listeners || listeners.size === 0) {
    return;
  }

  listeners.forEach((listener) => {
    listener();
  });
}

function subscribeChatInputDraft(
  key: string,
  listener: ChatInputDraftListener,
): () => void {
  let listeners = chatInputDraftListeners.get(key);
  if (!listeners) {
    listeners = new Set<ChatInputDraftListener>();
    chatInputDraftListeners.set(key, listeners);
  }

  listeners.add(listener);

  return () => {
    const currentListeners = chatInputDraftListeners.get(key);
    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);
    if (currentListeners.size === 0) {
      chatInputDraftListeners.delete(key);
    }
  };
}

export function peekWorkbenchChatInputDraft(
  key: string | null | undefined,
): string {
  const normalizedKey = normalizeChatInputDraftKey(key);
  if (!normalizedKey) {
    return '';
  }

  return getChatInputDraftSnapshot(normalizedKey);
}

export function setWorkbenchChatInputDraft(
  key: string | null | undefined,
  nextValue: string | ((previousValue: string) => string),
): string {
  const normalizedKey = normalizeChatInputDraftKey(key);
  if (!normalizedKey) {
    return '';
  }

  const previousValue = getChatInputDraftSnapshot(normalizedKey);
  const resolvedValue =
    typeof nextValue === 'function'
      ? nextValue(previousValue)
      : nextValue;

  if (resolvedValue === previousValue) {
    return previousValue;
  }

  if (resolvedValue) {
    chatInputDrafts.delete(normalizedKey);
    chatInputDrafts.set(normalizedKey, resolvedValue);
    pruneChatInputDrafts();
  } else {
    chatInputDrafts.delete(normalizedKey);
  }

  emitChatInputDraftSnapshot(normalizedKey);
  return resolvedValue;
}

export function clearWorkbenchChatInputDraft(
  key: string | null | undefined,
): void {
  setWorkbenchChatInputDraft(key, '');
}

export function useWorkbenchChatInputDraft(
  key: string | null | undefined,
): {
  clearDraftValue: () => void;
  draftValue: string;
  setDraftValue: (nextValue: string | ((previousValue: string) => string)) => string;
} {
  const normalizedKey = normalizeChatInputDraftKey(key);
  const subscribe = useCallback(
    (listener: ChatInputDraftListener) => {
      if (!normalizedKey) {
        return () => undefined;
      }

      return subscribeChatInputDraft(normalizedKey, listener);
    },
    [normalizedKey],
  );
  const getSnapshot = useCallback(
    () => (normalizedKey ? getChatInputDraftSnapshot(normalizedKey) : ''),
    [normalizedKey],
  );
  const draftValue = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setDraftValue = useCallback(
    (nextValue: string | ((previousValue: string) => string)) =>
      setWorkbenchChatInputDraft(normalizedKey, nextValue),
    [normalizedKey],
  );
  const clearDraftValue = useCallback(() => {
    clearWorkbenchChatInputDraft(normalizedKey);
  }, [normalizedKey]);

  return {
    clearDraftValue,
    draftValue,
    setDraftValue,
  };
}
