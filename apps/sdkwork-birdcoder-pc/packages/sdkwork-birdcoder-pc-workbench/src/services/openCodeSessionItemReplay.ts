import type { AgentSessionItemSourceRecord } from './agentSessionItemSourceWindow.ts';

const MAX_OPEN_CODE_EVENT_NODES = 128;
const MAX_OPEN_CODE_ID_CHARACTERS = 512;
const MAX_OPEN_CODE_DELTA_CHARACTERS = 64_000;

const OPEN_CODE_PART_EVENT_TYPES = new Set([
  'message.part.delta',
  'message.part.removed',
  'message.part.updated',
  'message.removed',
  'message.updated',
]);

const OPEN_CODE_EVENT_CHILD_KEYS = [
  'data',
  'event',
  'events',
  'payload',
  'response',
  'value',
] as const;

interface OpenCodeEventEnvelope {
  properties: Record<string, unknown>;
  sourceItem: AgentSessionItemSourceRecord;
  type: string;
}

interface OpenCodePartState {
  part: Record<string, unknown>;
  sourceItem: AgentSessionItemSourceRecord;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readStructuredValue(value: unknown): unknown {
  if (typeof value !== 'string' || value.length > MAX_OPEN_CODE_DELTA_CHARACTERS) {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function readIdentifier(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  const normalized = value.trim();
  return normalized.length <= MAX_OPEN_CODE_ID_CHARACTERS ? normalized : '';
}

function normalizeEventType(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[_/\s-]+/gu, '.')
    : '';
}

function buildMessageKey(providerSessionId: string, providerMessageId: string): string {
  return JSON.stringify([providerSessionId, providerMessageId]);
}

function buildPartKey(
  providerSessionId: string,
  providerMessageId: string,
  providerPartId: string,
): string {
  return JSON.stringify([providerSessionId, providerMessageId, providerPartId]);
}

function resolveEventProperties(record: Record<string, unknown>): Record<string, unknown> {
  return readRecord(record.properties)
    ?? readRecord(record.payload)
    ?? readRecord(record.data)
    ?? record;
}

function collectOpenCodeEvents(
  sourceItem: AgentSessionItemSourceRecord,
): OpenCodeEventEnvelope[] {
  const events: OpenCodeEventEnvelope[] = [];
  const pendingValues = [sourceItem.toolResult, sourceItem.toolArguments]
    .filter((value) => value !== null && value !== undefined)
    .map(readStructuredValue);
  let index = 0;
  while (index < pendingValues.length && index < MAX_OPEN_CODE_EVENT_NODES) {
    const value = pendingValues[index];
    index += 1;
    if (Array.isArray(value)) {
      pendingValues.push(...value.map(readStructuredValue));
      continue;
    }
    const record = readRecord(value);
    if (!record) {
      continue;
    }
    const type = normalizeEventType(record.type);
    if (OPEN_CODE_PART_EVENT_TYPES.has(type)) {
      events.push({
        properties: resolveEventProperties(record),
        sourceItem,
        type,
      });
      continue;
    }
    for (const key of OPEN_CODE_EVENT_CHILD_KEYS) {
      const child = record[key];
      if (child !== null && child !== undefined) {
        pendingValues.push(readStructuredValue(child));
      }
    }
  }
  return events;
}

function resolvePartIdentity(part: Record<string, unknown>): {
  providerMessageId: string;
  providerPartId: string;
  providerSessionId: string;
} | null {
  const providerSessionId = readIdentifier(part.sessionID ?? part.sessionId);
  const providerMessageId = readIdentifier(part.messageID ?? part.messageId);
  const providerPartId = readIdentifier(part.id ?? part.partID ?? part.partId);
  return providerSessionId && providerMessageId && providerPartId
    ? { providerMessageId, providerPartId, providerSessionId }
    : null;
}

function resolvePropertiesIdentity(properties: Record<string, unknown>): {
  providerMessageId: string;
  providerPartId: string;
  providerSessionId: string;
} | null {
  const providerSessionId = readIdentifier(
    properties.sessionID ?? properties.sessionId,
  );
  const providerMessageId = readIdentifier(
    properties.messageID ?? properties.messageId,
  );
  const providerPartId = readIdentifier(
    properties.partID ?? properties.partId,
  );
  return providerSessionId && providerMessageId && providerPartId
    ? { providerMessageId, providerPartId, providerSessionId }
    : null;
}

function compareSourceItems(
  left: AgentSessionItemSourceRecord,
  right: AgentSessionItemSourceRecord,
): number {
  try {
    const leftSequence = BigInt(left.sequence);
    const rightSequence = BigInt(right.sequence);
    if (leftSequence !== rightSequence) {
      return leftSequence < rightSequence ? -1 : 1;
    }
  } catch {
    const sequenceOrder = left.sequence.localeCompare(right.sequence);
    if (sequenceOrder !== 0) {
      return sequenceOrder;
    }
  }
  return left.itemId.localeCompare(right.itemId);
}

function buildSnapshotEvent(part: Record<string, unknown>): Record<string, unknown> {
  return {
    type: 'message.part.updated',
    properties: {
      messageID: part.messageID,
      part,
      sessionID: part.sessionID,
    },
  };
}

/**
 * Replays OpenCode's event-only part lifecycle before provider payload
 * projection. Deltas never become standalone canonical transcript rows.
 */
export function replayOpenCodeSessionItemRecords(
  records: readonly AgentSessionItemSourceRecord[],
): AgentSessionItemSourceRecord[] {
  const sortedRecords = records.slice().sort(compareSourceItems);
  const eventItemIds = new Set<string>();
  const messageSourceItems = new Map<string, AgentSessionItemSourceRecord>();
  const messageTombstones = new Set<string>();
  const partTombstones = new Set<string>();
  const partsByKey = new Map<string, OpenCodePartState>();

  for (const sourceItem of sortedRecords) {
    const events = collectOpenCodeEvents(sourceItem);
    if (events.length === 0) {
      continue;
    }
    for (const event of events) {
      if (event.type === 'message.updated') {
        eventItemIds.add(sourceItem.itemId);
        const info = readRecord(event.properties.info) ?? event.properties;
        const providerSessionId = readIdentifier(info.sessionID ?? info.sessionId);
        const providerMessageId = readIdentifier(info.id ?? info.messageID ?? info.messageId);
        if (providerSessionId && providerMessageId) {
          const messageKey = buildMessageKey(providerSessionId, providerMessageId);
          messageTombstones.delete(messageKey);
          if (!messageSourceItems.has(messageKey)) {
            messageSourceItems.set(messageKey, event.sourceItem);
          }
        }
        continue;
      }

      if (event.type === 'message.removed') {
        eventItemIds.add(sourceItem.itemId);
        const providerSessionId = readIdentifier(
          event.properties.sessionID ?? event.properties.sessionId,
        );
        const providerMessageId = readIdentifier(
          event.properties.messageID ?? event.properties.messageId,
        );
        if (!providerSessionId || !providerMessageId) {
          continue;
        }
        const messageKey = buildMessageKey(providerSessionId, providerMessageId);
        messageTombstones.add(messageKey);
        messageSourceItems.delete(messageKey);
        for (const [partKey, state] of partsByKey) {
          const identity = resolvePartIdentity(state.part);
          if (
            identity?.providerSessionId === providerSessionId
            && identity.providerMessageId === providerMessageId
          ) {
            partsByKey.delete(partKey);
            partTombstones.add(partKey);
          }
        }
        continue;
      }

      if (event.type === 'message.part.updated') {
        const part = readRecord(event.properties.part);
        const identity = part ? resolvePartIdentity(part) : null;
        if (!part || !identity) {
          continue;
        }
        eventItemIds.add(sourceItem.itemId);
        const propertiesSessionId = readIdentifier(
          event.properties.sessionID ?? event.properties.sessionId,
        );
        if (propertiesSessionId && propertiesSessionId !== identity.providerSessionId) {
          continue;
        }
        const messageKey = buildMessageKey(
          identity.providerSessionId,
          identity.providerMessageId,
        );
        if (messageTombstones.has(messageKey)) {
          continue;
        }
        const partKey = buildPartKey(
          identity.providerSessionId,
          identity.providerMessageId,
          identity.providerPartId,
        );
        partTombstones.delete(partKey);
        messageSourceItems.set(messageKey, event.sourceItem);
        partsByKey.set(partKey, {
          part: { ...part },
          sourceItem,
        });
        continue;
      }

      const identity = resolvePropertiesIdentity(event.properties);
      eventItemIds.add(sourceItem.itemId);
      if (!identity) {
        continue;
      }
      const messageKey = buildMessageKey(
        identity.providerSessionId,
        identity.providerMessageId,
      );
      const partKey = buildPartKey(
        identity.providerSessionId,
        identity.providerMessageId,
        identity.providerPartId,
      );
      if (event.type === 'message.part.removed') {
        partsByKey.delete(partKey);
        partTombstones.add(partKey);
        continue;
      }
      if (
        event.type !== 'message.part.delta'
        || messageTombstones.has(messageKey)
        || partTombstones.has(partKey)
      ) {
        continue;
      }
      const state = partsByKey.get(partKey);
      const field = readIdentifier(event.properties.field);
      const delta = typeof event.properties.delta === 'string'
        ? event.properties.delta.slice(0, MAX_OPEN_CODE_DELTA_CHARACTERS)
        : '';
      const currentValue = state?.part[field];
      if (
        !state
        || !field
        || !delta
        || (currentValue !== undefined && typeof currentValue !== 'string')
      ) {
        continue;
      }
      state.part = {
        ...state.part,
        [field]: `${currentValue ?? ''}${delta}`.slice(0, MAX_OPEN_CODE_DELTA_CHARACTERS),
      };
    }
  }

  const replayedPartsBySourceItemId = new Map<
    string,
    { parts: Record<string, unknown>[]; sourceItem: AgentSessionItemSourceRecord }
  >();
  for (const state of partsByKey.values()) {
    const identity = resolvePartIdentity(state.part);
    const sourceItem = identity
      ? messageSourceItems.get(buildMessageKey(
          identity.providerSessionId,
          identity.providerMessageId,
        )) ?? state.sourceItem
      : state.sourceItem;
    const sourceItemId = sourceItem.itemId;
    const group = replayedPartsBySourceItemId.get(sourceItemId) ?? {
      parts: [],
      sourceItem,
    };
    group.parts.push(state.part);
    replayedPartsBySourceItemId.set(sourceItemId, group);
  }

  const replayedRecords = [...replayedPartsBySourceItemId.values()].map((group) => ({
    ...group.sourceItem,
    toolArguments: undefined,
    toolResult: {
      parts: group.parts
        .slice()
        .sort((left, right) => readIdentifier(left.id).localeCompare(readIdentifier(right.id)))
        .map(buildSnapshotEvent),
      type: 'message.parts.snapshot',
    },
  }));

  return [
    ...sortedRecords.filter((record) => !eventItemIds.has(record.itemId)),
    ...replayedRecords,
  ].sort(compareSourceItems);
}
