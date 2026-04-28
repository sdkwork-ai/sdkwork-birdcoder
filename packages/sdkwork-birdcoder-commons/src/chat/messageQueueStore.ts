import { useCallback, useSyncExternalStore } from 'react';

type ChatMessageQueueListener = () => void;

export interface WorkbenchChatQueuedMessage {
  readonly id: string;
  readonly text: string;
}

const EMPTY_QUEUED_MESSAGES: readonly WorkbenchChatQueuedMessage[] = Object.freeze([]);
const chatMessageQueues = new Map<string, readonly WorkbenchChatQueuedMessage[]>();
const chatMessageQueueListeners = new Map<string, Set<ChatMessageQueueListener>>();
let queuedMessageSequence = 0;

export interface WorkbenchChatQueueFlushGateState {
  readonly awaitingTurnSettlement: boolean;
  readonly observedBusySinceDispatch: boolean;
}

export interface WorkbenchChatQueuedMessageFlushState {
  readonly disabled: boolean;
  readonly editingQueueIndex: number;
  readonly isActive: boolean;
  readonly isComposerBusy: boolean;
  readonly isQueueExpanded: boolean;
  readonly queueLength: number;
}

const IDLE_CHAT_QUEUE_FLUSH_GATE_STATE: WorkbenchChatQueueFlushGateState = Object.freeze({
  awaitingTurnSettlement: false,
  observedBusySinceDispatch: false,
});

function normalizeChatMessageQueueKey(key: string | null | undefined): string {
  return typeof key === 'string' ? key.trim() : '';
}

function normalizeQueuedMessageText(message: string): string {
  return message.trim();
}

function createWorkbenchChatQueuedMessageId(usedIds?: Set<string>): string {
  let id = '';
  do {
    queuedMessageSequence += 1;
    id = `workbench-chat-queued-message-${queuedMessageSequence}`;
  } while (usedIds?.has(id));
  return id;
}

function normalizeQueuedMessageId(id: string | null | undefined): string {
  return typeof id === 'string' ? id.trim() : '';
}

export function createWorkbenchChatQueuedMessage(
  text: string,
  id?: string | null,
): WorkbenchChatQueuedMessage {
  return Object.freeze({
    id: normalizeQueuedMessageId(id) || createWorkbenchChatQueuedMessageId(),
    text: normalizeQueuedMessageText(text),
  });
}

function normalizeQueuedMessages(
  messages: readonly WorkbenchChatQueuedMessage[],
): readonly WorkbenchChatQueuedMessage[] {
  const usedIds = new Set<string>();
  const normalizedMessages = messages.reduce<WorkbenchChatQueuedMessage[]>((acc, message) => {
    const normalizedText = normalizeQueuedMessageText(message.text);
    if (!normalizedText) {
      return acc;
    }

    const normalizedId = normalizeQueuedMessageId(message.id);
    const nextId =
      normalizedId && !usedIds.has(normalizedId)
        ? normalizedId
        : createWorkbenchChatQueuedMessageId(usedIds);
    usedIds.add(nextId);
    acc.push(Object.freeze({ id: nextId, text: normalizedText }));
    return acc;
  }, []);

  return normalizedMessages.length > 0
    ? Object.freeze([...normalizedMessages])
    : EMPTY_QUEUED_MESSAGES;
}

export function createWorkbenchChatQueueFlushGateState(): WorkbenchChatQueueFlushGateState {
  return IDLE_CHAT_QUEUE_FLUSH_GATE_STATE;
}

export function markWorkbenchChatQueuedTurnDispatchStarted(
  state: WorkbenchChatQueueFlushGateState,
  isBusy: boolean,
): WorkbenchChatQueueFlushGateState {
  const nextState: WorkbenchChatQueueFlushGateState = {
    awaitingTurnSettlement: true,
    observedBusySinceDispatch: Boolean(isBusy),
  };

  return state.awaitingTurnSettlement === nextState.awaitingTurnSettlement &&
    state.observedBusySinceDispatch === nextState.observedBusySinceDispatch
    ? state
    : nextState;
}

export function observeWorkbenchChatQueuedTurnBusyState(
  state: WorkbenchChatQueueFlushGateState,
  isBusy: boolean,
): WorkbenchChatQueueFlushGateState {
  if (!state.awaitingTurnSettlement) {
    return state;
  }

  if (isBusy) {
    if (state.observedBusySinceDispatch) {
      return state;
    }

    return {
      awaitingTurnSettlement: true,
      observedBusySinceDispatch: true,
    };
  }

  if (state.observedBusySinceDispatch) {
    return IDLE_CHAT_QUEUE_FLUSH_GATE_STATE;
  }

  return state;
}

export function settleWorkbenchChatQueuedTurnDispatch(
  state: WorkbenchChatQueueFlushGateState,
): WorkbenchChatQueueFlushGateState {
  return state.awaitingTurnSettlement ? IDLE_CHAT_QUEUE_FLUSH_GATE_STATE : state;
}

export function canFlushWorkbenchChatQueuedMessages(
  gateState: WorkbenchChatQueueFlushGateState,
  flushState: WorkbenchChatQueuedMessageFlushState,
): boolean {
  return (
    flushState.isActive &&
    !flushState.disabled &&
    !flushState.isComposerBusy &&
    !flushState.isQueueExpanded &&
    flushState.editingQueueIndex < 0 &&
    flushState.queueLength > 0 &&
    !gateState.awaitingTurnSettlement
  );
}

function getChatMessageQueueSnapshot(key: string): readonly WorkbenchChatQueuedMessage[] {
  return chatMessageQueues.get(key) ?? EMPTY_QUEUED_MESSAGES;
}

function emitChatMessageQueueSnapshot(key: string): void {
  const listeners = chatMessageQueueListeners.get(key);
  if (!listeners || listeners.size === 0) {
    return;
  }

  listeners.forEach((listener) => {
    listener();
  });
}

function subscribeChatMessageQueue(
  key: string,
  listener: ChatMessageQueueListener,
): () => void {
  let listeners = chatMessageQueueListeners.get(key);
  if (!listeners) {
    listeners = new Set<ChatMessageQueueListener>();
    chatMessageQueueListeners.set(key, listeners);
  }

  listeners.add(listener);

  return () => {
    const currentListeners = chatMessageQueueListeners.get(key);
    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);
    if (currentListeners.size === 0) {
      chatMessageQueueListeners.delete(key);
    }
  };
}

export function peekWorkbenchChatQueuedMessages(
  key: string | null | undefined,
): WorkbenchChatQueuedMessage[] {
  const normalizedKey = normalizeChatMessageQueueKey(key);
  if (!normalizedKey) {
    return [];
  }

  return [...getChatMessageQueueSnapshot(normalizedKey)];
}

export function setWorkbenchChatQueuedMessages(
  key: string | null | undefined,
  nextMessages:
    | readonly WorkbenchChatQueuedMessage[]
    | ((
        previousMessages: readonly WorkbenchChatQueuedMessage[],
      ) => readonly WorkbenchChatQueuedMessage[]),
): WorkbenchChatQueuedMessage[] {
  const normalizedKey = normalizeChatMessageQueueKey(key);
  if (!normalizedKey) {
    return [];
  }

  const previousMessages = getChatMessageQueueSnapshot(normalizedKey);
  const resolvedMessages =
    typeof nextMessages === 'function'
      ? nextMessages(previousMessages)
      : nextMessages;
  const normalizedMessages = normalizeQueuedMessages(resolvedMessages);

  if (
    normalizedMessages.length === previousMessages.length &&
    normalizedMessages.every((message, index) => {
      const previousMessage = previousMessages[index];
      return message.id === previousMessage?.id && message.text === previousMessage.text;
    })
  ) {
    return [...previousMessages];
  }

  if (normalizedMessages.length > 0) {
    chatMessageQueues.set(normalizedKey, normalizedMessages);
  } else {
    chatMessageQueues.delete(normalizedKey);
  }

  emitChatMessageQueueSnapshot(normalizedKey);
  return [...normalizedMessages];
}

export function enqueueWorkbenchChatQueuedMessage(
  key: string | null | undefined,
  message: string,
): WorkbenchChatQueuedMessage[] {
  const normalizedMessage = normalizeQueuedMessageText(message);
  if (!normalizedMessage) {
    return peekWorkbenchChatQueuedMessages(key);
  }

  return setWorkbenchChatQueuedMessages(key, (previousMessages) => [
    ...previousMessages,
    createWorkbenchChatQueuedMessage(normalizedMessage),
  ]);
}

export function dequeueWorkbenchChatQueuedMessage(
  key: string | null | undefined,
): WorkbenchChatQueuedMessage | undefined {
  const normalizedKey = normalizeChatMessageQueueKey(key);
  if (!normalizedKey) {
    return undefined;
  }

  const previousMessages = getChatMessageQueueSnapshot(normalizedKey);
  const [nextMessage, ...remainingMessages] = previousMessages;
  if (!nextMessage) {
    return undefined;
  }

  setWorkbenchChatQueuedMessages(normalizedKey, remainingMessages);
  return nextMessage;
}

export function restoreWorkbenchChatQueuedMessagesToFront(
  key: string | null | undefined,
  messages: readonly WorkbenchChatQueuedMessage[],
): WorkbenchChatQueuedMessage[] {
  const normalizedMessages = normalizeQueuedMessages(messages);
  if (normalizedMessages.length === 0) {
    return peekWorkbenchChatQueuedMessages(key);
  }

  const restoredMessageIds = new Set(normalizedMessages.map((message) => message.id));
  return setWorkbenchChatQueuedMessages(key, (previousMessages) => {
    const remainingMessages = previousMessages.filter(
      (message) => !restoredMessageIds.has(message.id),
    );
    return [...normalizedMessages, ...remainingMessages];
  });
}

export function clearWorkbenchChatQueuedMessages(
  key: string | null | undefined,
): void {
  setWorkbenchChatQueuedMessages(key, EMPTY_QUEUED_MESSAGES);
}

export function useWorkbenchChatMessageQueue(
  key: string | null | undefined,
): {
  clearQueuedMessages: () => void;
  dequeueQueuedMessage: () => WorkbenchChatQueuedMessage | undefined;
  enqueueQueuedMessage: (message: string) => WorkbenchChatQueuedMessage[];
  queuedMessages: readonly WorkbenchChatQueuedMessage[];
  restoreQueuedMessagesToFront: (
    messages: readonly WorkbenchChatQueuedMessage[],
  ) => WorkbenchChatQueuedMessage[];
  setQueuedMessages: (
    nextMessages:
      | readonly WorkbenchChatQueuedMessage[]
      | ((
          previousMessages: readonly WorkbenchChatQueuedMessage[],
        ) => readonly WorkbenchChatQueuedMessage[]),
  ) => WorkbenchChatQueuedMessage[];
} {
  const normalizedKey = normalizeChatMessageQueueKey(key);
  const subscribe = useCallback(
    (listener: ChatMessageQueueListener) => {
      if (!normalizedKey) {
        return () => undefined;
      }

      return subscribeChatMessageQueue(normalizedKey, listener);
    },
    [normalizedKey],
  );
  const getSnapshot = useCallback(
    () => (normalizedKey ? getChatMessageQueueSnapshot(normalizedKey) : EMPTY_QUEUED_MESSAGES),
    [normalizedKey],
  );
  const queuedMessages = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setQueuedMessages = useCallback(
    (
      nextMessages:
        | readonly WorkbenchChatQueuedMessage[]
        | ((
            previousMessages: readonly WorkbenchChatQueuedMessage[],
          ) => readonly WorkbenchChatQueuedMessage[]),
    ) => setWorkbenchChatQueuedMessages(normalizedKey, nextMessages),
    [normalizedKey],
  );
  const enqueueQueuedMessage = useCallback(
    (message: string) => enqueueWorkbenchChatQueuedMessage(normalizedKey, message),
    [normalizedKey],
  );
  const dequeueQueuedMessage = useCallback(
    () => dequeueWorkbenchChatQueuedMessage(normalizedKey),
    [normalizedKey],
  );
  const restoreQueuedMessagesToFront = useCallback(
    (messages: readonly WorkbenchChatQueuedMessage[]) =>
      restoreWorkbenchChatQueuedMessagesToFront(normalizedKey, messages),
    [normalizedKey],
  );
  const clearQueuedMessages = useCallback(() => {
    clearWorkbenchChatQueuedMessages(normalizedKey);
  }, [normalizedKey]);

  return {
    clearQueuedMessages,
    dequeueQueuedMessage,
    enqueueQueuedMessage,
    queuedMessages,
    restoreQueuedMessagesToFront,
    setQueuedMessages,
  };
}
