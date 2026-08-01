import type { AgentSessionView } from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import {
  AGENT_SESSION_ITEM_RETENTION_MAX_CHARACTERS,
  AGENT_SESSION_ITEM_RETENTION_MAX_ESTIMATE_NODES,
  AGENT_SESSION_ITEM_RETENTION_MAX_ITEMS,
  estimateAgentSessionItemRetentionCharacters,
} from './agentSessionItemRetention.ts';

export type AgentSessionItemSourceRecord = Awaited<
  ReturnType<IAgentSessionService['listSessionItems']>
>['items'][number];

const agentSessionItemSourceWindowKey = Symbol('agentSessionItemSourceWindow');
const agentSessionItemSourceRecordsRetentionKey = Symbol(
  'agentSessionItemSourceRecordsRetention',
);

const FNV_OFFSET_BASIS = 2_166_136_261;
const FNV_PRIME = 16_777_619;

interface AgentSessionItemSourceWindow {
  records: AgentSessionItemSourceRecord[];
  retentionLimitReached: boolean;
  signature: string;
}

type RetainedAgentSessionItemSourceRecords = AgentSessionItemSourceRecord[] & {
  [agentSessionItemSourceRecordsRetentionKey]?: true;
};

type AgentSessionViewWithItemSourceWindow = AgentSessionView & {
  [agentSessionItemSourceWindowKey]?: AgentSessionItemSourceWindow;
};

function compareLongIntegers(left: string, right: string): number {
  try {
    const leftValue = BigInt(left);
    const rightValue = BigInt(right);
    return leftValue === rightValue ? 0 : leftValue < rightValue ? -1 : 1;
  } catch {
    return left.localeCompare(right);
  }
}

function buildSourceRecordKey(record: AgentSessionItemSourceRecord): string {
  return `${record.sessionId.trim()}\u0000${record.itemId.trim()}`;
}

function updateFingerprint(hash: number, value: string): number {
  let nextHash = hash;
  for (let index = 0; index < value.length; index += 1) {
    nextHash = Math.imul(nextHash ^ value.charCodeAt(index), FNV_PRIME);
  }
  return nextHash >>> 0;
}

function buildSourceRecordPayloadFingerprint(value: unknown): string {
  const visited = new WeakSet<object>();
  const pending: unknown[] = [value];
  let remainingCharacters = AGENT_SESSION_ITEM_RETENTION_MAX_CHARACTERS;
  let remainingNodes = AGENT_SESSION_ITEM_RETENTION_MAX_ESTIMATE_NODES;
  let hash = FNV_OFFSET_BASIS;

  const append = (token: string): void => {
    if (remainingCharacters <= 0) {
      return;
    }
    if (token.length <= remainingCharacters) {
      hash = updateFingerprint(hash, token);
      remainingCharacters -= token.length;
      return;
    }
    const prefixLength = Math.ceil(remainingCharacters / 2);
    const suffixLength = remainingCharacters - prefixLength;
    hash = updateFingerprint(hash, token.slice(0, prefixLength));
    if (suffixLength > 0) {
      hash = updateFingerprint(hash, token.slice(-suffixLength));
    }
    remainingCharacters = 0;
  };

  while (pending.length > 0 && remainingNodes > 0 && remainingCharacters > 0) {
    const candidate = pending.pop();
    remainingNodes -= 1;
    if (candidate === null) {
      append('null;');
      continue;
    }
    if (candidate === undefined) {
      append('undefined;');
      continue;
    }
    if (typeof candidate === 'string') {
      append(`string:${candidate.length}:`);
      append(candidate);
      continue;
    }
    if (typeof candidate !== 'object') {
      append(`${typeof candidate}:${String(candidate)};`);
      continue;
    }
    if (visited.has(candidate)) {
      append('circular;');
      continue;
    }
    visited.add(candidate);
    if (Array.isArray(candidate)) {
      append(`array:${candidate.length};`);
      for (let index = candidate.length - 1; index >= 0; index -= 1) {
        pending.push(candidate[index]);
      }
      continue;
    }
    const record = candidate as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    append(`object:${keys.length};`);
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index]!;
      pending.push(record[key]);
      pending.push(`key:${key};`);
    }
  }
  if (pending.length > 0 || remainingNodes <= 0) {
    hash = updateFingerprint(hash, 'truncated;');
  }
  return hash.toString(16).padStart(8, '0');
}

function buildSourceWindowSignature(
  records: readonly AgentSessionItemSourceRecord[],
): string {
  return records.map((record) => [
    record.sessionId,
    record.itemId,
    record.sequence,
    record.status,
    record.version ?? '',
    record.updatedAt ?? '',
    buildSourceRecordPayloadFingerprint(record),
  ].join('\u0001')).join('\u0002');
}

function hasSourceRecordRetentionLimit(
  records: readonly AgentSessionItemSourceRecord[],
): boolean {
  return (records as RetainedAgentSessionItemSourceRecords)[
    agentSessionItemSourceRecordsRetentionKey
  ] === true;
}

function markSourceRecordRetentionLimit(
  records: AgentSessionItemSourceRecord[],
  retentionLimitReached: boolean,
): AgentSessionItemSourceRecord[] {
  if (retentionLimitReached) {
    Object.defineProperty(records, agentSessionItemSourceRecordsRetentionKey, {
      configurable: false,
      enumerable: false,
      value: true,
      writable: false,
    });
  }
  return records;
}

function normalizeAgentSessionItemSourceRecordWindow(
  records: readonly AgentSessionItemSourceRecord[],
  sessionId?: string,
  inheritedRetentionLimitReached = hasSourceRecordRetentionLimit(records),
): AgentSessionItemSourceWindow {
  const normalizedSessionId = sessionId?.trim();
  const recordsByIdentity = new Map<string, AgentSessionItemSourceRecord>();
  for (const record of records) {
    if (
      (normalizedSessionId && record.sessionId.trim() !== normalizedSessionId)
      || !record.itemId.trim()
    ) {
      continue;
    }
    recordsByIdentity.set(buildSourceRecordKey(record), record);
  }
  const normalizedRecords = [...recordsByIdentity.values()].sort((left, right) =>
    compareLongIntegers(left.sequence, right.sequence)
    || left.itemId.localeCompare(right.itemId));
  const retainedRecords: AgentSessionItemSourceRecord[] = [];
  let retainedCharacters = 0;
  const estimateBudget = {
    remainingNodes: AGENT_SESSION_ITEM_RETENTION_MAX_ESTIMATE_NODES,
  };
  for (
    let index = normalizedRecords.length - 1;
    index >= 0 && retainedRecords.length < AGENT_SESSION_ITEM_RETENTION_MAX_ITEMS;
    index -= 1
  ) {
    const record = normalizedRecords[index]!;
    const recordCharacters = estimateAgentSessionItemRetentionCharacters(
      record,
      AGENT_SESSION_ITEM_RETENTION_MAX_CHARACTERS - retainedCharacters,
      estimateBudget,
    );
    if (
      retainedCharacters + recordCharacters
      > AGENT_SESSION_ITEM_RETENTION_MAX_CHARACTERS
    ) {
      continue;
    }
    retainedRecords.push(record);
    retainedCharacters += recordCharacters;
  }
  retainedRecords.reverse();
  const retentionLimitReached = inheritedRetentionLimitReached
    || retainedRecords.length !== normalizedRecords.length;
  const retainedSourceRecords = markSourceRecordRetentionLimit(
    retainedRecords,
    retentionLimitReached,
  );
  return {
    records: retainedSourceRecords,
    retentionLimitReached,
    signature: buildSourceWindowSignature(retainedSourceRecords),
  };
}

export function normalizeAgentSessionItemSourceRecords(
  records: readonly AgentSessionItemSourceRecord[],
  sessionId?: string,
): AgentSessionItemSourceRecord[] {
  return normalizeAgentSessionItemSourceRecordWindow(records, sessionId).records;
}

export function mergeAgentSessionItemSourceRecords(
  existingRecords: readonly AgentSessionItemSourceRecord[],
  incomingRecords: readonly AgentSessionItemSourceRecord[],
  sessionId?: string,
): AgentSessionItemSourceRecord[] {
  const inheritedRetentionLimitReached = hasSourceRecordRetentionLimit(existingRecords)
    || hasSourceRecordRetentionLimit(incomingRecords);
  return normalizeAgentSessionItemSourceRecordWindow(
    [...existingRecords, ...incomingRecords],
    sessionId,
    inheritedRetentionLimitReached,
  ).records;
}

export function readAgentSessionItemSourceRecords(
  session: AgentSessionView,
): readonly AgentSessionItemSourceRecord[] | undefined {
  return (session as AgentSessionViewWithItemSourceWindow)[agentSessionItemSourceWindowKey]
    ?.records;
}

export function hasAgentSessionItemSourceWindow(session: AgentSessionView): boolean {
  return agentSessionItemSourceWindowKey in (session as AgentSessionViewWithItemSourceWindow);
}

export function attachAgentSessionItemSourceWindow<TSession extends AgentSessionView>(
  session: TSession,
  records: readonly AgentSessionItemSourceRecord[],
): TSession {
  const sourceWindow = normalizeAgentSessionItemSourceRecordWindow(records, session.id);
  if (
    sourceWindow.retentionLimitReached
    && session.itemPageInfo
    && session.itemPageInfo.retentionLimitReached !== true
  ) {
    Object.assign(session, {
      itemPageInfo: {
        ...session.itemPageInfo,
        retentionLimitReached: true,
      },
    });
  }
  Object.defineProperty(session, agentSessionItemSourceWindowKey, {
    configurable: true,
    enumerable: false,
    value: sourceWindow,
    writable: true,
  });
  return session;
}

export function inheritAgentSessionItemSourceWindow<TSession extends AgentSessionView>(
  session: TSession,
  preferred: AgentSessionView,
  fallback?: AgentSessionView,
): TSession {
  const source = hasAgentSessionItemSourceWindow(preferred)
    ? preferred
    : fallback && hasAgentSessionItemSourceWindow(fallback)
      ? fallback
      : undefined;
  const sourceWindow = source
    ? (source as AgentSessionViewWithItemSourceWindow)[agentSessionItemSourceWindowKey]
    : undefined;
  if (!sourceWindow) {
    return session;
  }
  const records = markSourceRecordRetentionLimit(
    sourceWindow.records.slice(),
    sourceWindow.retentionLimitReached,
  );
  return attachAgentSessionItemSourceWindow(session, records);
}

export function areAgentSessionItemSourceWindowsEquivalent(
  left: AgentSessionView,
  right: AgentSessionView,
): boolean {
  const leftWindow = (left as AgentSessionViewWithItemSourceWindow)[
    agentSessionItemSourceWindowKey
  ];
  const rightWindow = (right as AgentSessionViewWithItemSourceWindow)[
    agentSessionItemSourceWindowKey
  ];
  if (leftWindow === rightWindow) {
    return true;
  }
  if (!leftWindow || !rightWindow) {
    return false;
  }
  return leftWindow.retentionLimitReached === rightWindow.retentionLimitReached
    && leftWindow.signature === rightWindow.signature;
}
