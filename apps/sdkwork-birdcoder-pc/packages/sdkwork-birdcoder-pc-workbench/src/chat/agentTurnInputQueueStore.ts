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
export const MAX_QUEUED_AGENT_TURN_INPUT_STORED_BYTES_PER_SCOPE = 4 * 1_048_576;
export const MAX_QUEUED_AGENT_TURN_INPUT_STORED_BYTES_TOTAL = 16 * 1_048_576;

const agentTurnInputQueues = new Map<
  string,
  readonly WorkbenchQueuedAgentTurnInput[]
>();
const agentTurnInputQueueListeners = new Map<
  string,
  Set<AgentTurnInputQueueListener>
>();
const agentTurnInputQueueStoredBytes = new Map<string, number>();
let totalAgentTurnInputQueueStoredBytes = 0;

function normalizeAgentTurnInputQueueKey(key: string | null | undefined): string {
  return typeof key === 'string' ? key.trim() : '';
}

function getUtf8ByteLength(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }
  let byteLength = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index) ?? 0;
    if (codePoint <= 0x7f) {
      byteLength += 1;
    } else if (codePoint <= 0x7ff) {
      byteLength += 2;
    } else if (codePoint <= 0xffff) {
      byteLength += 3;
    } else {
      byteLength += 4;
      index += 1;
    }
  }
  return byteLength;
}

function countStoredBytes(input: WorkbenchQueuedAgentTurnInput): number {
  let storedBytes = getUtf8ByteLength(input.queueEntryId)
    + getUtf8ByteLength(input.sessionId)
    + getUtf8ByteLength(input.agentId)
    + getUtf8ByteLength(input.content)
    + getUtf8ByteLength(input.displayText)
    + getUtf8ByteLength(input.contentType)
    + getUtf8ByteLength(input.turnMode)
    + getUtf8ByteLength(input.runtimeBindingId)
    + getUtf8ByteLength(input.requestedModelId)
    + getUtf8ByteLength(input.accessModeId)
    + getUtf8ByteLength(input.idempotencyKey)
    + getUtf8ByteLength(input.payloadHash)
    + getUtf8ByteLength(input.clientRequestId)
    + getUtf8ByteLength(input.position)
    + getUtf8ByteLength(input.status)
    + getUtf8ByteLength(input.claimOwner)
    + getUtf8ByteLength(input.claimExpiresAt)
    + getUtf8ByteLength(input.fencingToken)
    + getUtf8ByteLength(input.errorCode)
    + getUtf8ByteLength(input.errorDetail)
    + getUtf8ByteLength(input.version)
    + getUtf8ByteLength(input.createdAt)
    + getUtf8ByteLength(input.updatedAt)
    + getUtf8ByteLength(input.claimedAt)
    + getUtf8ByteLength(input.failedAt);
  for (const attachmentName of input.attachmentNames) {
    storedBytes += getUtf8ByteLength(attachmentName);
  }
  for (const driveRef of input.driveRefs) {
    storedBytes += getUtf8ByteLength(driveRef.resourceRole)
      + getUtf8ByteLength(driveRef.driveSpaceId)
      + getUtf8ByteLength(driveRef.driveNodeId);
  }
  return storedBytes;
}

function areStringArraysEqual(
  first: readonly string[],
  second: readonly string[],
): boolean {
  return first.length === second.length
    && first.every((value, index) => value === second[index]);
}

function areDriveRefsEqual(
  first: WorkbenchAgentTurnDriveRef,
  second: WorkbenchAgentTurnDriveRef,
): boolean {
  return first.resourceRole === second.resourceRole
    && first.driveSpaceId === second.driveSpaceId
    && first.driveNodeId === second.driveNodeId;
}

function areEntriesEqual(
  first: WorkbenchQueuedAgentTurnInput,
  second: WorkbenchQueuedAgentTurnInput,
): boolean {
  return first.queueEntryId === second.queueEntryId
    && first.sessionId === second.sessionId
    && first.agentId === second.agentId
    && first.content === second.content
    && first.displayText === second.displayText
    && first.contentType === second.contentType
    && areStringArraysEqual(first.attachmentNames, second.attachmentNames)
    && first.driveRefs.length === second.driveRefs.length
    && first.driveRefs.every((driveRef, index) => {
      const nextDriveRef = second.driveRefs[index];
      return Boolean(nextDriveRef && areDriveRefsEqual(driveRef, nextDriveRef));
    })
    && first.turnMode === second.turnMode
    && first.runtimeBindingId === second.runtimeBindingId
    && first.requestedModelId === second.requestedModelId
    && first.accessModeId === second.accessModeId
    && first.idempotencyKey === second.idempotencyKey
    && first.payloadHash === second.payloadHash
    && first.clientRequestId === second.clientRequestId
    && first.position === second.position
    && first.status === second.status
    && first.claimOwner === second.claimOwner
    && first.claimExpiresAt === second.claimExpiresAt
    && first.fencingToken === second.fencingToken
    && first.errorCode === second.errorCode
    && first.errorDetail === second.errorDetail
    && first.version === second.version
    && first.createdAt === second.createdAt
    && first.updatedAt === second.updatedAt
    && first.claimedAt === second.claimedAt
    && first.failedAt === second.failedAt;
}

interface NormalizedProjection {
  projection: readonly WorkbenchQueuedAgentTurnInput[];
  storedBytes: number;
}

function normalizeProjection(
  inputs: readonly WorkbenchQueuedAgentTurnInput[],
  previousProjection: readonly WorkbenchQueuedAgentTurnInput[],
): NormalizedProjection {
  if (inputs.length > MAX_QUEUED_AGENT_TURN_INPUTS_PER_SCOPE) {
    throw new RangeError(
      `Agent Turn input queue supports at most ${MAX_QUEUED_AGENT_TURN_INPUTS_PER_SCOPE} entries.`,
    );
  }

  const queueEntryIds = new Set<string>();
  let storedBytes = 0;
  let isUnchanged = inputs.length === previousProjection.length;
  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index];
    if (!input) {
      throw new Error('Agent Turn input queue projection contains a missing entry.');
    }
    const queueEntryId = input.queueEntryId.trim();
    if (!queueEntryId || queueEntryIds.has(queueEntryId)) {
      throw new Error('Agent Turn input queue projection contains an invalid or duplicate entry ID.');
    }
    queueEntryIds.add(queueEntryId);
    storedBytes += countStoredBytes(input);
    if (storedBytes > MAX_QUEUED_AGENT_TURN_INPUT_STORED_BYTES_PER_SCOPE) {
      throw new RangeError('Agent Turn input queue projection exceeds its Session UTF-8 byte budget.');
    }
    isUnchanged = isUnchanged && Boolean(
      previousProjection[index]
      && areEntriesEqual(previousProjection[index], input),
    );
  }

  if (isUnchanged) {
    return { projection: previousProjection, storedBytes };
  }

  const projection = inputs.map((input) => Object.freeze({
      ...input,
      attachmentNames: Object.freeze([...input.attachmentNames]),
      driveRefs: Object.freeze(input.driveRefs.map((driveRef) => Object.freeze({ ...driveRef }))),
    }) as WorkbenchQueuedAgentTurnInput);

  return {
    projection: projection.length > 0
      ? Object.freeze(projection)
      : EMPTY_QUEUED_AGENT_TURN_INPUTS,
    storedBytes,
  };
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
  const normalizedProjection = normalizeProjection(inputs, previousProjection);
  const { projection: nextProjection, storedBytes: nextStoredBytes } = normalizedProjection;
  if (previousProjection === nextProjection) {
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

  const previousStoredBytes = agentTurnInputQueueStoredBytes.get(normalizedKey) ?? 0;
  const nextTotalStoredBytes = totalAgentTurnInputQueueStoredBytes
    - previousStoredBytes
    + nextStoredBytes;
  if (
    nextTotalStoredBytes > MAX_QUEUED_AGENT_TURN_INPUT_STORED_BYTES_TOTAL
  ) {
    throw new RangeError('Agent Turn input queue projections exceed their global UTF-8 byte budget.');
  }

  if (nextProjection.length > 0) {
    agentTurnInputQueues.set(normalizedKey, nextProjection);
    agentTurnInputQueueStoredBytes.set(normalizedKey, nextStoredBytes);
  } else {
    agentTurnInputQueues.delete(normalizedKey);
    agentTurnInputQueueStoredBytes.delete(normalizedKey);
  }
  totalAgentTurnInputQueueStoredBytes = nextTotalStoredBytes;
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
  agentTurnInputQueueStoredBytes.clear();
  totalAgentTurnInputQueueStoredBytes = 0;
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
