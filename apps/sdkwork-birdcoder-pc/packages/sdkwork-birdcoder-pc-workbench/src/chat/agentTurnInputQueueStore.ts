import { useCallback, useSyncExternalStore } from 'react';

import { MAX_AGENT_TURN_INPUT_CHARACTERS } from './draftStore.ts';

type AgentTurnInputQueueListener = () => void;

export interface WorkbenchQueuedAgentTurnInput {
  readonly attachmentContent?: string;
  readonly attachmentNames?: readonly string[];
  readonly driveRefs?: readonly WorkbenchAgentTurnDriveRef[];
  readonly displayText?: string;
  readonly id: string;
  readonly text: string;
  readonly composerSelection?: WorkbenchQueuedAgentTurnInputModelSelection;
}

export interface WorkbenchQueuedAgentTurnInputPresentation {
  readonly attachmentContent?: string;
  readonly attachmentNames?: readonly string[];
  readonly driveRefs?: readonly WorkbenchAgentTurnDriveRef[];
  readonly displayText?: string;
}

export interface WorkbenchAgentTurnDriveRef {
  readonly driveNodeId: string;
  readonly driveSpaceId: string;
  readonly resourceRole: 'attachment' | 'audio' | 'image';
}

export interface WorkbenchQueuedAgentTurnInputModelSelection {
  readonly engineId: string;
  readonly modelId: string;
}

const EMPTY_QUEUED_AGENT_TURN_INPUTS: readonly WorkbenchQueuedAgentTurnInput[] = Object.freeze([]);
export const MAX_QUEUED_AGENT_TURN_INPUTS_PER_SCOPE = 32;
export const MAX_QUEUED_AGENT_TURN_INPUT_SCOPES = 32;
const MAX_QUEUED_AGENT_TURN_INPUT_STORED_CHARACTERS_PER_SCOPE = 4 * 1_048_576;
const MAX_QUEUED_AGENT_TURN_INPUT_STORED_CHARACTERS_TOTAL = 16 * 1_048_576;
const MAX_QUEUED_AGENT_TURN_INPUT_ATTACHMENT_NAMES = 64;
const MAX_QUEUED_AGENT_TURN_INPUT_ATTACHMENT_NAME_CHARACTERS = 256;
const MAX_QUEUED_AGENT_TURN_INPUT_MODEL_ID_CHARACTERS = 128;
const MAX_QUEUED_AGENT_TURN_INPUT_DRIVE_REFS = 64;
const MAX_QUEUED_AGENT_TURN_INPUT_DRIVE_ID_CHARACTERS = 128;
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
  if (input.length > MAX_AGENT_TURN_INPUT_CHARACTERS) {
    throw new RangeError(
      `Queued Agent turn input must be ${MAX_AGENT_TURN_INPUT_CHARACTERS} characters or fewer.`,
    );
  }
  const normalized = input.trim();
  if (normalized.length > MAX_AGENT_TURN_INPUT_CHARACTERS) {
    throw new RangeError(
      `Queued Agent turn input must be ${MAX_AGENT_TURN_INPUT_CHARACTERS} characters or fewer.`,
    );
  }
  return normalized;
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

  if (
    composerSelection.engineId.length > MAX_QUEUED_AGENT_TURN_INPUT_MODEL_ID_CHARACTERS
    || composerSelection.modelId.length > MAX_QUEUED_AGENT_TURN_INPUT_MODEL_ID_CHARACTERS
  ) {
    throw new RangeError('Queued Agent turn model selection exceeds its identity budget.');
  }

  const engineId = composerSelection.engineId.trim();
  const modelId = composerSelection.modelId.trim();
  if (!engineId || !modelId) {
    return undefined;
  }
  if (
    engineId.length > MAX_QUEUED_AGENT_TURN_INPUT_MODEL_ID_CHARACTERS
    || modelId.length > MAX_QUEUED_AGENT_TURN_INPUT_MODEL_ID_CHARACTERS
  ) {
    throw new RangeError('Queued Agent turn model selection exceeds its identity budget.');
  }

  return Object.freeze({ engineId, modelId });
}

function normalizeQueuedAgentTurnInputPresentation(
  presentation: WorkbenchQueuedAgentTurnInputPresentation | null | undefined,
): WorkbenchQueuedAgentTurnInputPresentation | undefined {
  if (!presentation) {
    return undefined;
  }

  if (
    (presentation.displayText?.length ?? 0) > MAX_AGENT_TURN_INPUT_CHARACTERS
    || (presentation.attachmentContent?.length ?? 0) > MAX_AGENT_TURN_INPUT_CHARACTERS
  ) {
    throw new RangeError('Queued Agent turn presentation exceeds its in-memory content budget.');
  }

  const displayText = presentation.displayText?.trim() || '';
  const attachmentContent = presentation.attachmentContent?.trim() || '';
  if (
    displayText.length > MAX_AGENT_TURN_INPUT_CHARACTERS
    || attachmentContent.length > MAX_AGENT_TURN_INPUT_CHARACTERS
  ) {
    throw new RangeError('Queued Agent turn presentation exceeds its in-memory content budget.');
  }
  const attachmentNames = Array.from(new Set(
    (presentation.attachmentNames ?? [])
      .slice(0, MAX_QUEUED_AGENT_TURN_INPUT_ATTACHMENT_NAMES)
      .map((attachmentName) => attachmentName
        .slice(0, MAX_QUEUED_AGENT_TURN_INPUT_ATTACHMENT_NAME_CHARACTERS)
        .trim())
      .filter(Boolean),
  ));
  if (
    (presentation.driveRefs?.length ?? 0) > MAX_QUEUED_AGENT_TURN_INPUT_DRIVE_REFS
  ) {
    throw new RangeError(
      `Queued Agent turn input supports at most ${MAX_QUEUED_AGENT_TURN_INPUT_DRIVE_REFS} Drive references.`,
    );
  }
  const driveRefs: WorkbenchAgentTurnDriveRef[] = [];
  const driveRefKeys = new Set<string>();
  for (const driveRef of presentation.driveRefs ?? []) {
    if (
      driveRef.driveNodeId.length > MAX_QUEUED_AGENT_TURN_INPUT_DRIVE_ID_CHARACTERS
      || driveRef.driveSpaceId.length > MAX_QUEUED_AGENT_TURN_INPUT_DRIVE_ID_CHARACTERS
    ) {
      throw new RangeError('Queued Agent turn Drive reference exceeds its identity budget.');
    }
    const driveNodeId = driveRef.driveNodeId.trim();
    const driveSpaceId = driveRef.driveSpaceId.trim();
    if (
      !driveNodeId
      || driveNodeId.length > MAX_QUEUED_AGENT_TURN_INPUT_DRIVE_ID_CHARACTERS
      || !driveSpaceId
      || driveSpaceId.length > MAX_QUEUED_AGENT_TURN_INPUT_DRIVE_ID_CHARACTERS
      || !['attachment', 'audio', 'image'].includes(driveRef.resourceRole)
    ) {
      throw new RangeError('Queued Agent turn Drive reference is invalid or exceeds its identity budget.');
    }
    const key = `${driveRef.resourceRole}\u0001${driveSpaceId}\u0001${driveNodeId}`;
    if (driveRefKeys.has(key)) {
      continue;
    }
    driveRefKeys.add(key);
    driveRefs.push(Object.freeze({
      driveNodeId,
      driveSpaceId,
      resourceRole: driveRef.resourceRole,
    }));
  }
  if (
    !displayText
    && !attachmentContent
    && attachmentNames.length === 0
    && driveRefs.length === 0
  ) {
    return undefined;
  }

  return Object.freeze({
    ...(attachmentContent ? { attachmentContent } : {}),
    ...(attachmentNames.length > 0 ? { attachmentNames: Object.freeze(attachmentNames) } : {}),
    ...(driveRefs.length > 0 ? { driveRefs: Object.freeze(driveRefs) } : {}),
    ...(displayText ? { displayText } : {}),
  });
}

function areQueuedAgentTurnInputPresentationsEqual(
  first: WorkbenchQueuedAgentTurnInput,
  second: WorkbenchQueuedAgentTurnInput,
): boolean {
  return (
    (first.displayText ?? '') === (second.displayText ?? '')
    && (first.attachmentContent ?? '') === (second.attachmentContent ?? '')
    && (first.attachmentNames?.length ?? 0) === (second.attachmentNames?.length ?? 0)
    && (first.attachmentNames ?? []).every(
      (attachmentName, index) => attachmentName === second.attachmentNames?.[index],
    )
    && (first.driveRefs?.length ?? 0) === (second.driveRefs?.length ?? 0)
    && (first.driveRefs ?? []).every((driveRef, index) => {
      const secondDriveRef = second.driveRefs?.[index];
      return driveRef.resourceRole === secondDriveRef?.resourceRole
        && driveRef.driveSpaceId === secondDriveRef.driveSpaceId
        && driveRef.driveNodeId === secondDriveRef.driveNodeId;
    })
  );
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

function countQueuedAgentTurnInputStoredCharacters(
  input: WorkbenchQueuedAgentTurnInput,
): number {
  return input.text.length
    + (input.displayText?.length ?? 0)
    + (input.attachmentContent?.length ?? 0)
    + (input.attachmentNames ?? []).reduce(
      (total, attachmentName) => total + attachmentName.length,
      0,
    )
    + (input.driveRefs ?? []).reduce(
      (total, driveRef) => total
        + driveRef.resourceRole.length
        + driveRef.driveSpaceId.length
        + driveRef.driveNodeId.length,
      0,
    )
    + (input.composerSelection?.engineId.length ?? 0)
    + (input.composerSelection?.modelId.length ?? 0);
}

function countQueuedAgentTurnInputsStoredCharacters(
  inputs: readonly WorkbenchQueuedAgentTurnInput[],
): number {
  return inputs.reduce(
    (total, input) => total + countQueuedAgentTurnInputStoredCharacters(input),
    0,
  );
}

export function createWorkbenchQueuedAgentTurnInput(
  text: string,
  id?: string | null,
  composerSelection?: WorkbenchQueuedAgentTurnInputModelSelection | null,
  presentation?: WorkbenchQueuedAgentTurnInputPresentation | null,
): WorkbenchQueuedAgentTurnInput {
  const normalizedComposerSelection =
    normalizeQueuedAgentTurnInputModelSelection(composerSelection);
  const normalizedPresentation = normalizeQueuedAgentTurnInputPresentation(presentation);
  return Object.freeze({
    id: normalizeQueuedAgentTurnInputId(id) || createWorkbenchQueuedAgentTurnInputId(),
    text: normalizeQueuedAgentTurnInputText(text),
    ...(normalizedComposerSelection
      ? { composerSelection: normalizedComposerSelection }
      : {}),
    ...normalizedPresentation,
  });
}

function normalizeQueuedAgentTurnInputs(
  inputs: readonly WorkbenchQueuedAgentTurnInput[],
): readonly WorkbenchQueuedAgentTurnInput[] {
  const usedIds = new Set<string>();
  let totalStoredCharacters = 0;
  const normalizedInputs = inputs.reduce<WorkbenchQueuedAgentTurnInput[]>((acc, input) => {
    const normalizedText = normalizeQueuedAgentTurnInputText(input.text);
    if (!normalizedText) {
      return acc;
    }
    if (acc.length >= MAX_QUEUED_AGENT_TURN_INPUTS_PER_SCOPE) {
      throw new RangeError(
        `Agent turn input queue supports at most ${MAX_QUEUED_AGENT_TURN_INPUTS_PER_SCOPE} messages.`,
      );
    }
    const normalizedId = normalizeQueuedAgentTurnInputId(input.id);
    const nextId =
      normalizedId && !usedIds.has(normalizedId)
        ? normalizedId
        : createWorkbenchQueuedAgentTurnInputId(usedIds);
    usedIds.add(nextId);
    const normalizedInput = createWorkbenchQueuedAgentTurnInput(
      normalizedText,
      nextId,
      input.composerSelection,
      input,
    );
    totalStoredCharacters += countQueuedAgentTurnInputStoredCharacters(normalizedInput);
    if (
      totalStoredCharacters
      > MAX_QUEUED_AGENT_TURN_INPUT_STORED_CHARACTERS_PER_SCOPE
    ) {
      throw new RangeError('Agent turn input queue exceeds its in-memory content budget.');
    }
    acc.push(normalizedInput);
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
        && areQueuedAgentTurnInputPresentationsEqual(input, previousInput)
      );
    })
  ) {
    return [...previousInputs];
  }

  if (
    normalizedInputs.length > 0
    && previousInputs.length === 0
    && agentTurnInputQueues.size >= MAX_QUEUED_AGENT_TURN_INPUT_SCOPES
  ) {
    throw new RangeError(
      `Agent turn input queues support at most ${MAX_QUEUED_AGENT_TURN_INPUT_SCOPES} session scopes.`,
    );
  }
  const retainedCharacters = [...agentTurnInputQueues.entries()].reduce(
    (total, [key, inputs]) => normalizedKey === key
      ? total
      : total + countQueuedAgentTurnInputsStoredCharacters(inputs),
    0,
  );
  if (
    retainedCharacters + countQueuedAgentTurnInputsStoredCharacters(normalizedInputs)
    > MAX_QUEUED_AGENT_TURN_INPUT_STORED_CHARACTERS_TOTAL
  ) {
    throw new RangeError('Agent turn input queues exceed their global in-memory content budget.');
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
  presentation?: WorkbenchQueuedAgentTurnInputPresentation | null,
): WorkbenchQueuedAgentTurnInput[] {
  const normalizedInput = normalizeQueuedAgentTurnInputText(input);
  if (!normalizedInput) {
    return peekWorkbenchQueuedAgentTurnInputs(key);
  }

  return setWorkbenchQueuedAgentTurnInputs(key, (previousInputs) => [
    ...previousInputs,
    createWorkbenchQueuedAgentTurnInput(normalizedInput, null, composerSelection, presentation),
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

export function clearWorkbenchAgentTurnInputQueueMemory(): void {
  const changedKeys = [...agentTurnInputQueues.keys()];
  agentTurnInputQueues.clear();
  for (const key of changedKeys) {
    emitAgentTurnInputQueueSnapshot(key);
  }
}

export function useWorkbenchAgentTurnInputQueue(
  key: string | null | undefined,
): {
  clearQueuedTurnInputs: () => void;
  dequeueQueuedTurnInput: () => WorkbenchQueuedAgentTurnInput | undefined;
  enqueueQueuedTurnInput: (
    input: string,
    composerSelection?: WorkbenchQueuedAgentTurnInputModelSelection | null,
    presentation?: WorkbenchQueuedAgentTurnInputPresentation | null,
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
      presentation?: WorkbenchQueuedAgentTurnInputPresentation | null,
    ) => enqueueWorkbenchQueuedAgentTurnInput(
      normalizedKey,
      input,
      composerSelection,
      presentation,
    ),
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
