import { useCallback, useSyncExternalStore } from 'react';

import type {
  AgentTurnInputQueueDriveRef,
  AgentTurnInputQueueEntry,
} from '@sdkwork/birdcoder-pc-core/sdk/agents-app';

type AgentTurnInputQueueListener = () => void;

export type WorkbenchAgentTurnDriveRef = AgentTurnInputQueueDriveRef;
export type WorkbenchQueuedAgentTurnInput = AgentTurnInputQueueEntry;

const EMPTY_QUEUED_AGENT_TURN_INPUTS: readonly WorkbenchQueuedAgentTurnInput[] =
  Object.freeze([]);
export const MAX_QUEUED_AGENT_TURN_INPUTS_PER_SCOPE = 32;
export const MAX_QUEUED_AGENT_TURN_INPUT_SCOPES = 32;
const MAX_QUEUED_AGENT_TURN_INPUT_STORED_CHARACTERS_PER_SCOPE = 4 * 1_048_576;
const MAX_QUEUED_AGENT_TURN_INPUT_STORED_CHARACTERS_TOTAL = 16 * 1_048_576;

const agentTurnInputQueues = new Map<
  string,
  readonly WorkbenchQueuedAgentTurnInput[]
>();
const agentTurnInputQueueListeners = new Map<
  string,
  Set<AgentTurnInputQueueListener>
>();

function normalizeAgentTurnInputQueueKey(key: string | null | undefined): string {
  return typeof key === 'string' ? key.trim() : '';
}

function countStoredCharacters(input: WorkbenchQueuedAgentTurnInput): number {
  return input.content.length
    + input.displayText.length
    + input.contentType.length
    + input.attachmentNames.reduce((total, name) => total + name.length, 0)
    + input.driveRefs.reduce(
      (total, driveRef) => total
        + driveRef.resourceRole.length
        + driveRef.driveSpaceId.length
        + driveRef.driveNodeId.length,
      0,
    )
    + (input.runtimeBindingId?.length ?? 0)
    + (input.requestedModelId?.length ?? 0)
    + (input.accessModeId?.length ?? 0)
    + input.idempotencyKey.length
    + input.payloadHash.length
    + input.clientRequestId.length;
}

function normalizeProjection(
  inputs: readonly WorkbenchQueuedAgentTurnInput[],
): readonly WorkbenchQueuedAgentTurnInput[] {
  if (inputs.length > MAX_QUEUED_AGENT_TURN_INPUTS_PER_SCOPE) {
    throw new RangeError(
      `Agent Turn input queue supports at most ${MAX_QUEUED_AGENT_TURN_INPUTS_PER_SCOPE} entries.`,
    );
  }

  const queueEntryIds = new Set<string>();
  let storedCharacters = 0;
  const projection = inputs.map((input) => {
    const queueEntryId = input.queueEntryId.trim();
    if (!queueEntryId || queueEntryIds.has(queueEntryId)) {
      throw new Error('Agent Turn input queue projection contains an invalid or duplicate entry ID.');
    }
    queueEntryIds.add(queueEntryId);
    storedCharacters += countStoredCharacters(input);
    if (storedCharacters > MAX_QUEUED_AGENT_TURN_INPUT_STORED_CHARACTERS_PER_SCOPE) {
      throw new RangeError('Agent Turn input queue projection exceeds its Session memory budget.');
    }
    return Object.freeze({
      ...input,
      attachmentNames: Object.freeze([...input.attachmentNames]),
      driveRefs: Object.freeze(input.driveRefs.map((driveRef) => Object.freeze({ ...driveRef }))),
    }) as WorkbenchQueuedAgentTurnInput;
  });

  return projection.length > 0
    ? Object.freeze(projection)
    : EMPTY_QUEUED_AGENT_TURN_INPUTS;
}

function areEntriesEqual(
  first: WorkbenchQueuedAgentTurnInput,
  second: WorkbenchQueuedAgentTurnInput,
): boolean {
  return first.queueEntryId === second.queueEntryId
    && first.version === second.version
    && first.status === second.status
    && first.position === second.position
    && first.updatedAt === second.updatedAt;
}

function getSnapshot(key: string): readonly WorkbenchQueuedAgentTurnInput[] {
  return agentTurnInputQueues.get(key) ?? EMPTY_QUEUED_AGENT_TURN_INPUTS;
}

function emitSnapshot(key: string): void {
  agentTurnInputQueueListeners.get(key)?.forEach((listener) => listener());
}

function subscribe(
  key: string,
  listener: AgentTurnInputQueueListener,
): () => void {
  const listeners = agentTurnInputQueueListeners.get(key)
    ?? new Set<AgentTurnInputQueueListener>();
  listeners.add(listener);
  agentTurnInputQueueListeners.set(key, listeners);

  return () => {
    const currentListeners = agentTurnInputQueueListeners.get(key);
    currentListeners?.delete(listener);
    if (currentListeners?.size === 0) {
      agentTurnInputQueueListeners.delete(key);
    }
  };
}

export function setWorkbenchQueuedAgentTurnInputs(
  key: string | null | undefined,
  inputs: readonly WorkbenchQueuedAgentTurnInput[],
): readonly WorkbenchQueuedAgentTurnInput[] {
  const normalizedKey = normalizeAgentTurnInputQueueKey(key);
  if (!normalizedKey) {
    return EMPTY_QUEUED_AGENT_TURN_INPUTS;
  }

  const previousProjection = getSnapshot(normalizedKey);
  const nextProjection = normalizeProjection(inputs);
  if (
    previousProjection.length === nextProjection.length
    && previousProjection.every((entry, index) => {
      const nextEntry = nextProjection[index];
      return Boolean(nextEntry && areEntriesEqual(entry, nextEntry));
    })
  ) {
    return previousProjection;
  }

  if (
    previousProjection.length === 0
    && nextProjection.length > 0
    && !agentTurnInputQueues.has(normalizedKey)
    && agentTurnInputQueues.size >= MAX_QUEUED_AGENT_TURN_INPUT_SCOPES
  ) {
    throw new RangeError(
      `Agent Turn input queue projections support at most ${MAX_QUEUED_AGENT_TURN_INPUT_SCOPES} Session scopes.`,
    );
  }

  const retainedCharacters = [...agentTurnInputQueues.entries()].reduce(
    (total, [scopeKey, entries]) => scopeKey === normalizedKey
      ? total
      : total + entries.reduce(
        (entryTotal, entry) => entryTotal + countStoredCharacters(entry),
        0,
      ),
    0,
  );
  const nextCharacters = nextProjection.reduce(
    (total, entry) => total + countStoredCharacters(entry),
    0,
  );
  if (
    retainedCharacters + nextCharacters
    > MAX_QUEUED_AGENT_TURN_INPUT_STORED_CHARACTERS_TOTAL
  ) {
    throw new RangeError('Agent Turn input queue projections exceed their global memory budget.');
  }

  if (nextProjection.length > 0) {
    agentTurnInputQueues.set(normalizedKey, nextProjection);
  } else {
    agentTurnInputQueues.delete(normalizedKey);
  }
  emitSnapshot(normalizedKey);
  return nextProjection;
}

export function upsertWorkbenchQueuedAgentTurnInput(
  key: string | null | undefined,
  entry: WorkbenchQueuedAgentTurnInput,
): readonly WorkbenchQueuedAgentTurnInput[] {
  const normalizedKey = normalizeAgentTurnInputQueueKey(key);
  if (!normalizedKey) {
    return EMPTY_QUEUED_AGENT_TURN_INPUTS;
  }
  const previousProjection = getSnapshot(normalizedKey);
  const existingIndex = previousProjection.findIndex(
    (candidate) => candidate.queueEntryId === entry.queueEntryId,
  );
  const nextProjection = [...previousProjection];
  if (existingIndex >= 0) {
    nextProjection[existingIndex] = entry;
  } else {
    nextProjection.push(entry);
  }
  nextProjection.sort((first, second) => {
    const firstPosition = BigInt(first.position);
    const secondPosition = BigInt(second.position);
    return firstPosition < secondPosition ? -1 : firstPosition > secondPosition ? 1 : 0;
  });
  return setWorkbenchQueuedAgentTurnInputs(normalizedKey, nextProjection);
}

export function removeWorkbenchQueuedAgentTurnInputProjection(
  key: string | null | undefined,
  queueEntryId: string,
): readonly WorkbenchQueuedAgentTurnInput[] {
  const normalizedKey = normalizeAgentTurnInputQueueKey(key);
  if (!normalizedKey) {
    return EMPTY_QUEUED_AGENT_TURN_INPUTS;
  }
  return setWorkbenchQueuedAgentTurnInputs(
    normalizedKey,
    getSnapshot(normalizedKey).filter((entry) => entry.queueEntryId !== queueEntryId),
  );
}

export function clearWorkbenchAgentTurnInputQueueMemory(): void {
  const changedKeys = [...agentTurnInputQueues.keys()];
  agentTurnInputQueues.clear();
  changedKeys.forEach(emitSnapshot);
}

export function useWorkbenchAgentTurnInputQueueProjection(
  key: string | null | undefined,
): {
  queuedTurnInputs: readonly WorkbenchQueuedAgentTurnInput[];
  removeQueuedTurnInputProjection: (queueEntryId: string) => void;
  replaceQueuedTurnInputProjection: (
    inputs: readonly WorkbenchQueuedAgentTurnInput[],
  ) => void;
  upsertQueuedTurnInputProjection: (entry: WorkbenchQueuedAgentTurnInput) => void;
} {
  const normalizedKey = normalizeAgentTurnInputQueueKey(key);
  const subscribeToProjection = useCallback(
    (listener: AgentTurnInputQueueListener) => normalizedKey
      ? subscribe(normalizedKey, listener)
      : () => undefined,
    [normalizedKey],
  );
  const readProjection = useCallback(
    () => normalizedKey ? getSnapshot(normalizedKey) : EMPTY_QUEUED_AGENT_TURN_INPUTS,
    [normalizedKey],
  );
  const queuedTurnInputs = useSyncExternalStore(
    subscribeToProjection,
    readProjection,
    readProjection,
  );
  const replaceQueuedTurnInputProjection = useCallback(
    (inputs: readonly WorkbenchQueuedAgentTurnInput[]) => {
      setWorkbenchQueuedAgentTurnInputs(normalizedKey, inputs);
    },
    [normalizedKey],
  );
  const upsertQueuedTurnInputProjection = useCallback(
    (entry: WorkbenchQueuedAgentTurnInput) => {
      upsertWorkbenchQueuedAgentTurnInput(normalizedKey, entry);
    },
    [normalizedKey],
  );
  const removeQueuedTurnInputProjection = useCallback((queueEntryId: string) => {
    removeWorkbenchQueuedAgentTurnInputProjection(normalizedKey, queueEntryId);
  }, [normalizedKey]);

  return {
    queuedTurnInputs,
    removeQueuedTurnInputProjection,
    replaceQueuedTurnInputProjection,
    upsertQueuedTurnInputProjection,
  };
}
