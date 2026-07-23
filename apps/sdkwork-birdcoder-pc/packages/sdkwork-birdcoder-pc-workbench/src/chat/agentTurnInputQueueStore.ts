import { useCallback, useSyncExternalStore } from 'react';

type AgentTurnInputQueueListener = () => void;

export interface WorkbenchQueuedAgentTurnInput {
  readonly id: string;
  readonly text: string;
  readonly composerSelection?: WorkbenchQueuedAgentTurnInputModelSelection;
}

export interface WorkbenchQueuedAgentTurnInputModelSelection {
  readonly engineId: string;
  readonly modelId: string;
}

const EMPTY_QUEUED_AGENT_TURN_INPUTS: readonly WorkbenchQueuedAgentTurnInput[] = Object.freeze([]);
const agentTurnInputQueues = new Map<string, readonly WorkbenchQueuedAgentTurnInput[]>();
const agentTurnInputQueueListeners = new Map<string, Set<AgentTurnInputQueueListener>>();
let queuedAgentTurnInputSequence = 0;

export interface WorkbenchAgentTurnInputQueueFlushGateState {
  readonly awaitingTurnSettlement: boolean;
  readonly observedBusySinceDispatch: boolean;
}

export interface WorkbenchAgentTurnInputQueueFlushState {
  readonly disabled: boolean;
  readonly editingQueueIndex: number;
  readonly isActive: boolean;
  readonly isComposerBusy: boolean;
  readonly isQueueExpanded: boolean;
  readonly queueLength: number;
}

const IDLE_AGENT_TURN_INPUT_QUEUE_FLUSH_GATE_STATE: WorkbenchAgentTurnInputQueueFlushGateState = Object.freeze({
  awaitingTurnSettlement: false,
  observedBusySinceDispatch: false,
});

function normalizeAgentTurnInputQueueKey(key: string | null | undefined): string {
  return typeof key === 'string' ? key.trim() : '';
}

function normalizeQueuedAgentTurnInputText(input: string): string {
  return input.trim();
}

function createWorkbenchQueuedAgentTurnInputId(usedIds?: Set<string>): string {
  let id = '';
  do {
    queuedAgentTurnInputSequence += 1;
    id = `workbench-agent-turn-input-${queuedAgentTurnInputSequence}`;
  } while (usedIds?.has(id));
  return id;
}

function normalizeQueuedAgentTurnInputId(id: string | null | undefined): string {
  return typeof id === 'string' ? id.trim() : '';
}

function normalizeQueuedAgentTurnInputModelSelection(
  composerSelection: WorkbenchQueuedAgentTurnInputModelSelection | null | undefined,
): WorkbenchQueuedAgentTurnInputModelSelection | undefined {
  if (!composerSelection) {
    return undefined;
  }

  const engineId = composerSelection.engineId.trim();
  const modelId = composerSelection.modelId.trim();
  if (!engineId || !modelId) {
    return undefined;
  }

  return Object.freeze({ engineId, modelId });
}

function areQueuedAgentTurnInputModelSelectionsEqual(
  first: WorkbenchQueuedAgentTurnInputModelSelection | undefined,
  second: WorkbenchQueuedAgentTurnInputModelSelection | undefined,
): boolean {
  return (
    (first?.engineId ?? '') === (second?.engineId ?? '') &&
    (first?.modelId ?? '') === (second?.modelId ?? '')
  );
}

export function createWorkbenchQueuedAgentTurnInput(
  text: string,
  id?: string | null,
  composerSelection?: WorkbenchQueuedAgentTurnInputModelSelection | null,
): WorkbenchQueuedAgentTurnInput {
  const normalizedComposerSelection =
    normalizeQueuedAgentTurnInputModelSelection(composerSelection);
  return Object.freeze({
    id: normalizeQueuedAgentTurnInputId(id) || createWorkbenchQueuedAgentTurnInputId(),
    text: normalizeQueuedAgentTurnInputText(text),
    ...(normalizedComposerSelection
      ? { composerSelection: normalizedComposerSelection }
      : {}),
  });
}

function normalizeQueuedAgentTurnInputs(
  inputs: readonly WorkbenchQueuedAgentTurnInput[],
): readonly WorkbenchQueuedAgentTurnInput[] {
  const usedIds = new Set<string>();
  const normalizedInputs = inputs.reduce<WorkbenchQueuedAgentTurnInput[]>((acc, input) => {
    const normalizedText = normalizeQueuedAgentTurnInputText(input.text);
    if (!normalizedText) {
      return acc;
    }

    const normalizedId = normalizeQueuedAgentTurnInputId(input.id);
    const nextId =
      normalizedId && !usedIds.has(normalizedId)
        ? normalizedId
        : createWorkbenchQueuedAgentTurnInputId(usedIds);
    usedIds.add(nextId);
    acc.push(createWorkbenchQueuedAgentTurnInput(
      normalizedText,
      nextId,
      input.composerSelection,
    ));
    return acc;
  }, []);

  return normalizedInputs.length > 0
    ? Object.freeze([...normalizedInputs])
    : EMPTY_QUEUED_AGENT_TURN_INPUTS;
}

export function createWorkbenchAgentTurnInputQueueFlushGateState(): WorkbenchAgentTurnInputQueueFlushGateState {
  return IDLE_AGENT_TURN_INPUT_QUEUE_FLUSH_GATE_STATE;
}

export function markWorkbenchQueuedAgentTurnDispatchStarted(
  state: WorkbenchAgentTurnInputQueueFlushGateState,
  isBusy: boolean,
): WorkbenchAgentTurnInputQueueFlushGateState {
  const nextState: WorkbenchAgentTurnInputQueueFlushGateState = {
    awaitingTurnSettlement: true,
    observedBusySinceDispatch: Boolean(isBusy),
  };

  return state.awaitingTurnSettlement === nextState.awaitingTurnSettlement &&
    state.observedBusySinceDispatch === nextState.observedBusySinceDispatch
    ? state
    : nextState;
}

export function observeWorkbenchQueuedAgentTurnBusyState(
  state: WorkbenchAgentTurnInputQueueFlushGateState,
  isBusy: boolean,
): WorkbenchAgentTurnInputQueueFlushGateState {
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
    return IDLE_AGENT_TURN_INPUT_QUEUE_FLUSH_GATE_STATE;
  }

  return state;
}

export function settleWorkbenchQueuedAgentTurnDispatch(
  state: WorkbenchAgentTurnInputQueueFlushGateState,
): WorkbenchAgentTurnInputQueueFlushGateState {
  return state.awaitingTurnSettlement ? IDLE_AGENT_TURN_INPUT_QUEUE_FLUSH_GATE_STATE : state;
}

export function canFlushWorkbenchQueuedAgentTurnInputs(
  gateState: WorkbenchAgentTurnInputQueueFlushGateState,
  flushState: WorkbenchAgentTurnInputQueueFlushState,
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

function getAgentTurnInputQueueSnapshot(key: string): readonly WorkbenchQueuedAgentTurnInput[] {
  return agentTurnInputQueues.get(key) ?? EMPTY_QUEUED_AGENT_TURN_INPUTS;
}

function emitAgentTurnInputQueueSnapshot(key: string): void {
  const listeners = agentTurnInputQueueListeners.get(key);
  if (!listeners || listeners.size === 0) {
    return;
  }

  listeners.forEach((listener) => {
    listener();
  });
}

function subscribeAgentTurnInputQueue(
  key: string,
  listener: AgentTurnInputQueueListener,
): () => void {
  let listeners = agentTurnInputQueueListeners.get(key);
  if (!listeners) {
    listeners = new Set<AgentTurnInputQueueListener>();
    agentTurnInputQueueListeners.set(key, listeners);
  }

  listeners.add(listener);

  return () => {
    const currentListeners = agentTurnInputQueueListeners.get(key);
    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);
    if (currentListeners.size === 0) {
      agentTurnInputQueueListeners.delete(key);
    }
  };
}

export function peekWorkbenchQueuedAgentTurnInputs(
  key: string | null | undefined,
): WorkbenchQueuedAgentTurnInput[] {
  const normalizedKey = normalizeAgentTurnInputQueueKey(key);
  if (!normalizedKey) {
    return [];
  }

  return [...getAgentTurnInputQueueSnapshot(normalizedKey)];
}

export function setWorkbenchQueuedAgentTurnInputs(
  key: string | null | undefined,
  nextInputs:
    | readonly WorkbenchQueuedAgentTurnInput[]
    | ((
        previousInputs: readonly WorkbenchQueuedAgentTurnInput[],
      ) => readonly WorkbenchQueuedAgentTurnInput[]),
): WorkbenchQueuedAgentTurnInput[] {
  const normalizedKey = normalizeAgentTurnInputQueueKey(key);
  if (!normalizedKey) {
    return [];
  }

  const previousInputs = getAgentTurnInputQueueSnapshot(normalizedKey);
  const resolvedInputs =
    typeof nextInputs === 'function'
      ? nextInputs(previousInputs)
      : nextInputs;
  const normalizedInputs = normalizeQueuedAgentTurnInputs(resolvedInputs);

  if (
    normalizedInputs.length === previousInputs.length &&
    normalizedInputs.every((input, index) => {
      const previousInput = previousInputs[index];
      return (
        input.id === previousInput?.id &&
        input.text === previousInput.text &&
        areQueuedAgentTurnInputModelSelectionsEqual(
          input.composerSelection,
          previousInput.composerSelection,
        )
      );
    })
  ) {
    return [...previousInputs];
  }

  if (normalizedInputs.length > 0) {
    agentTurnInputQueues.set(normalizedKey, normalizedInputs);
  } else {
    agentTurnInputQueues.delete(normalizedKey);
  }

  emitAgentTurnInputQueueSnapshot(normalizedKey);
  return [...normalizedInputs];
}

export function enqueueWorkbenchQueuedAgentTurnInput(
  key: string | null | undefined,
  input: string,
  composerSelection?: WorkbenchQueuedAgentTurnInputModelSelection | null,
): WorkbenchQueuedAgentTurnInput[] {
  const normalizedInput = normalizeQueuedAgentTurnInputText(input);
  if (!normalizedInput) {
    return peekWorkbenchQueuedAgentTurnInputs(key);
  }

  return setWorkbenchQueuedAgentTurnInputs(key, (previousInputs) => [
    ...previousInputs,
    createWorkbenchQueuedAgentTurnInput(normalizedInput, null, composerSelection),
  ]);
}

export function dequeueWorkbenchQueuedAgentTurnInput(
  key: string | null | undefined,
): WorkbenchQueuedAgentTurnInput | undefined {
  const normalizedKey = normalizeAgentTurnInputQueueKey(key);
  if (!normalizedKey) {
    return undefined;
  }

  const previousInputs = getAgentTurnInputQueueSnapshot(normalizedKey);
  const [nextInput, ...remainingInputs] = previousInputs;
  if (!nextInput) {
    return undefined;
  }

  setWorkbenchQueuedAgentTurnInputs(normalizedKey, remainingInputs);
  return nextInput;
}

export function restoreWorkbenchQueuedAgentTurnInputsToFront(
  key: string | null | undefined,
  inputs: readonly WorkbenchQueuedAgentTurnInput[],
): WorkbenchQueuedAgentTurnInput[] {
  const normalizedInputs = normalizeQueuedAgentTurnInputs(inputs);
  if (normalizedInputs.length === 0) {
    return peekWorkbenchQueuedAgentTurnInputs(key);
  }

  const restoredInputIds = new Set(normalizedInputs.map((input) => input.id));
  return setWorkbenchQueuedAgentTurnInputs(key, (previousInputs) => {
    const remainingInputs = previousInputs.filter(
      (input) => !restoredInputIds.has(input.id),
    );
    return [...normalizedInputs, ...remainingInputs];
  });
}

export function clearWorkbenchQueuedAgentTurnInputs(
  key: string | null | undefined,
): void {
  setWorkbenchQueuedAgentTurnInputs(key, EMPTY_QUEUED_AGENT_TURN_INPUTS);
}

export function useWorkbenchAgentTurnInputQueue(
  key: string | null | undefined,
): {
  clearQueuedTurnInputs: () => void;
  dequeueQueuedTurnInput: () => WorkbenchQueuedAgentTurnInput | undefined;
  enqueueQueuedTurnInput: (
    input: string,
    composerSelection?: WorkbenchQueuedAgentTurnInputModelSelection | null,
  ) => WorkbenchQueuedAgentTurnInput[];
  queuedTurnInputs: readonly WorkbenchQueuedAgentTurnInput[];
  restoreQueuedTurnInputsToFront: (
    inputs: readonly WorkbenchQueuedAgentTurnInput[],
  ) => WorkbenchQueuedAgentTurnInput[];
  setQueuedTurnInputs: (
    nextInputs:
      | readonly WorkbenchQueuedAgentTurnInput[]
      | ((
          previousInputs: readonly WorkbenchQueuedAgentTurnInput[],
        ) => readonly WorkbenchQueuedAgentTurnInput[]),
  ) => WorkbenchQueuedAgentTurnInput[];
} {
  const normalizedKey = normalizeAgentTurnInputQueueKey(key);
  const subscribe = useCallback(
    (listener: AgentTurnInputQueueListener) => {
      if (!normalizedKey) {
        return () => undefined;
      }

      return subscribeAgentTurnInputQueue(normalizedKey, listener);
    },
    [normalizedKey],
  );
  const getSnapshot = useCallback(
    () => (normalizedKey ? getAgentTurnInputQueueSnapshot(normalizedKey) : EMPTY_QUEUED_AGENT_TURN_INPUTS),
    [normalizedKey],
  );
  const queuedTurnInputs = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setQueuedTurnInputs = useCallback(
    (
      nextInputs:
        | readonly WorkbenchQueuedAgentTurnInput[]
        | ((
            previousInputs: readonly WorkbenchQueuedAgentTurnInput[],
          ) => readonly WorkbenchQueuedAgentTurnInput[]),
    ) => setWorkbenchQueuedAgentTurnInputs(normalizedKey, nextInputs),
    [normalizedKey],
  );
  const enqueueQueuedTurnInput = useCallback(
    (
      input: string,
      composerSelection?: WorkbenchQueuedAgentTurnInputModelSelection | null,
    ) => enqueueWorkbenchQueuedAgentTurnInput(normalizedKey, input, composerSelection),
    [normalizedKey],
  );
  const dequeueQueuedTurnInput = useCallback(
    () => dequeueWorkbenchQueuedAgentTurnInput(normalizedKey),
    [normalizedKey],
  );
  const restoreQueuedTurnInputsToFront = useCallback(
    (inputs: readonly WorkbenchQueuedAgentTurnInput[]) =>
      restoreWorkbenchQueuedAgentTurnInputsToFront(normalizedKey, inputs),
    [normalizedKey],
  );
  const clearQueuedTurnInputs = useCallback(() => {
    clearWorkbenchQueuedAgentTurnInputs(normalizedKey);
  }, [normalizedKey]);

  return {
    clearQueuedTurnInputs,
    dequeueQueuedTurnInput,
    enqueueQueuedTurnInput,
    queuedTurnInputs,
    restoreQueuedTurnInputsToFront,
    setQueuedTurnInputs,
  };
}

