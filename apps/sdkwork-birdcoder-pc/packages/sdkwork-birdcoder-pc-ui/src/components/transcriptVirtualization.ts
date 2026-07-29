import {
  estimateTranscriptSessionItemHeight,
  type AgentSessionItemView,
} from '@sdkwork/birdcoder-pc-contracts-commons';

export const MIN_VIRTUALIZED_MESSAGE_COUNT = 96;
export const VIRTUALIZED_OVERSCAN_PX = 720;

export interface TranscriptHeightEstimateOptions {
  engineId?: string;
  layout?: 'sidebar' | 'main';
}

interface TranscriptPrefixHeightCacheEntry {
  height: number;
  key: string;
  message: AgentSessionItemView;
}

export interface TranscriptPrefixHeightsCache {
  entries: readonly TranscriptPrefixHeightCacheEntry[];
  messageIndexesByKey: ReadonlyMap<string, number>;
  messages: readonly AgentSessionItemView[];
  prefixHeights: readonly number[];
}

export interface TranscriptViewport {
  clientHeight: number;
  scrollTop: number;
}

export function resolveMeasurementScopeTranscriptViewport({
  didChangeScope,
  isActive,
  totalHeight,
  viewport,
}: {
  didChangeScope: boolean;
  isActive: boolean;
  totalHeight: number;
  viewport: TranscriptViewport;
}): TranscriptViewport {
  if (!didChangeScope) {
    return viewport;
  }

  const clientHeight = Math.max(0, viewport.clientHeight);
  return {
    clientHeight,
    scrollTop: isActive
      ? Math.max(0, totalHeight - clientHeight)
      : 0,
  };
}

export interface VirtualizedTranscriptWindowState {
  paddingBottom: number;
  paddingTop: number;
  visibleMessages: readonly AgentSessionItemView[];
  visibleStartIndex: number;
}

function hasHighVarianceTranscriptLayout(message: AgentSessionItemView): boolean {
  return Boolean(
    message.taskProgress
    || message.tool_calls?.length
    || message.commands?.length
    || message.fileChanges?.length
    || message.reasoning?.length
    || message.resources?.length
    || message.lifecycleEvents?.length
  );
}

export function resolvePrependAdjustedTranscriptViewport({
  currentCache,
  previousCache,
  viewport,
}: {
  currentCache: TranscriptPrefixHeightsCache;
  previousCache: TranscriptPrefixHeightsCache | null;
  viewport: TranscriptViewport;
}): TranscriptViewport {
  if (
    !previousCache
    || previousCache.entries.length === 0
    || currentCache.entries.length <= previousCache.entries.length
  ) {
    return viewport;
  }

  const previousFirstKey = previousCache.entries[0]?.key;
  const shiftedFirstIndex = previousFirstKey
    ? currentCache.messageIndexesByKey.get(previousFirstKey)
    : undefined;
  if (shiftedFirstIndex === undefined || shiftedFirstIndex <= 0) {
    return viewport;
  }

  const prependedHeight = currentCache.prefixHeights[shiftedFirstIndex] ?? 0;
  if (prependedHeight <= 0) {
    return viewport;
  }

  return {
    ...viewport,
    scrollTop: viewport.scrollTop + prependedHeight,
  };
}

function resolveTranscriptMessageSequence(
  message: AgentSessionItemView | undefined,
): string {
  const sequence = message?.metadata?.agentItemSequence;
  if (typeof sequence === 'bigint') {
    return sequence.toString();
  }
  if (typeof sequence === 'number') {
    return Number.isFinite(sequence) ? String(sequence) : '';
  }
  if (typeof sequence !== 'string') {
    return '';
  }

  const normalizedSequence = sequence.trim();
  if (!/^[0-9]+$/u.test(normalizedSequence)) {
    return normalizedSequence;
  }

  return BigInt(normalizedSequence).toString();
}

export function resolveTranscriptMessageKey(
  message: AgentSessionItemView | undefined,
  index: number,
): string {
  const normalizedMessageId = message?.id?.trim() ?? '';
  const normalizedSessionId = message?.sessionId?.trim() ?? '';
  const normalizedTurnId = message?.turnId?.trim() ?? '';
  const normalizedCreatedAt = message?.createdAt?.trim() ?? '';
  const normalizedSequence = resolveTranscriptMessageSequence(message);

  if (normalizedMessageId) {
    return JSON.stringify([
      'message',
      normalizedSessionId,
      normalizedMessageId,
      normalizedSequence,
      normalizedCreatedAt,
    ]);
  }

  if (normalizedSequence || normalizedTurnId || normalizedCreatedAt) {
    return JSON.stringify([
      'message-fallback',
      normalizedSessionId,
      normalizedSequence,
      normalizedTurnId,
      message?.role ?? '',
      normalizedCreatedAt,
    ]);
  }

  return JSON.stringify(['message-index-fallback', index]);
}

export function hasTranscriptMessageKey(
  messageKeys: Pick<ReadonlySet<string>, 'has'>,
  messageKey: string,
): boolean {
  const normalizedMessageKey = messageKey.trim();
  return normalizedMessageKey.length > 0 && messageKeys.has(normalizedMessageKey);
}

function estimateTranscriptMessageHeightForLayout(
  message: AgentSessionItemView,
  options: TranscriptHeightEstimateOptions = {},
): number {
  return estimateTranscriptSessionItemHeight(message, {
    engineId: options.engineId,
    layout: options.layout ?? 'main',
  });
}

function resolveTranscriptMessageHeight(
  message: AgentSessionItemView,
  index: number,
  measuredHeights: ReadonlyMap<string, number>,
  options: TranscriptHeightEstimateOptions = {},
): number {
  const measuredHeight = measuredHeights.get(resolveTranscriptMessageKey(message, index));
  return measuredHeight ?? estimateTranscriptMessageHeightForLayout(message, options);
}

function buildTranscriptPrefixHeightsCache(
  messages: readonly AgentSessionItemView[],
  measuredHeights: ReadonlyMap<string, number>,
  options: TranscriptHeightEstimateOptions = {},
): TranscriptPrefixHeightsCache {
  const entries: TranscriptPrefixHeightCacheEntry[] = new Array(messages.length);
  const messageIndexesByKey = new Map<string, number>();
  const prefixHeights = new Array<number>(messages.length + 1).fill(0);

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!;
    const key = resolveTranscriptMessageKey(message, index);
    const height = resolveTranscriptMessageHeight(message, index, measuredHeights, options);
    entries[index] = {
      height,
      key,
      message,
    };
    messageIndexesByKey.set(key, index);
    prefixHeights[index + 1] = prefixHeights[index] + height;
  }

  return {
    entries,
    messageIndexesByKey,
    messages,
    prefixHeights,
  };
}
function reconcileMeasuredTranscriptPrefixHeightsCache(
  previousCache: TranscriptPrefixHeightsCache,
  measuredHeights: ReadonlyMap<string, number>,
  invalidatedMessageIds: readonly string[],
  options: TranscriptHeightEstimateOptions = {},
): TranscriptPrefixHeightsCache {
  if (invalidatedMessageIds.length === 0) {
    return previousCache;
  }

  let earliestChangedIndex = Number.POSITIVE_INFINITY;
  let nextEntries: TranscriptPrefixHeightCacheEntry[] | null = null;

  for (const invalidatedMessageKey of invalidatedMessageIds) {
    const normalizedMessageKey = invalidatedMessageKey.trim();
    if (!normalizedMessageKey) {
      continue;
    }

    const messageIndex = previousCache.messageIndexesByKey.get(normalizedMessageKey);
    if (messageIndex === undefined) {
      continue;
    }

    const previousEntry = (nextEntries ?? previousCache.entries)[messageIndex];
    const message = previousCache.messages[messageIndex];
    if (!previousEntry || !message) {
      continue;
    }

    const nextHeight = resolveTranscriptMessageHeight(
      message,
      messageIndex,
      measuredHeights,
      options,
    );
    if (previousEntry.height === nextHeight) {
      continue;
    }

    if (nextEntries === null) {
      nextEntries = previousCache.entries.slice();
    }

    nextEntries[messageIndex] = {
      ...previousEntry,
      height: nextHeight,
    };
    earliestChangedIndex = Math.min(earliestChangedIndex, messageIndex);
  }

  if (nextEntries === null || earliestChangedIndex === Number.POSITIVE_INFINITY) {
    return previousCache;
  }

  const nextPrefixHeights = previousCache.prefixHeights.slice(0, earliestChangedIndex + 1);
  nextPrefixHeights.length = nextEntries.length + 1;
  for (let index = earliestChangedIndex; index < nextEntries.length; index += 1) {
    nextPrefixHeights[index + 1] = nextPrefixHeights[index] + nextEntries[index]!.height;
  }

  return {
    entries: nextEntries,
    messageIndexesByKey: previousCache.messageIndexesByKey,
    messages: previousCache.messages,
    prefixHeights: nextPrefixHeights,
  };
}

function reconcileAppendOnlyTranscriptPrefixHeightsCache(
  previousCache: TranscriptPrefixHeightsCache,
  measuredHeights: ReadonlyMap<string, number>,
  messages: readonly AgentSessionItemView[],
  invalidatedMessageIds: readonly string[],
  options: TranscriptHeightEstimateOptions = {},
): TranscriptPrefixHeightsCache | null {
  if (
    invalidatedMessageIds.length > 0 ||
    messages.length <= previousCache.messages.length
  ) {
    return null;
  }

  const previousMessages = previousCache.messages;
  for (let index = 0; index < previousMessages.length; index += 1) {
    if (messages[index] !== previousMessages[index]) {
      return null;
    }
  }

  const nextEntries = previousCache.entries.slice();
  const nextMessageIndexesByKey = new Map(previousCache.messageIndexesByKey);
  const nextPrefixHeights = previousCache.prefixHeights.slice();

  for (let index = previousMessages.length; index < messages.length; index += 1) {
    const message = messages[index]!;
    const key = resolveTranscriptMessageKey(message, index);
    const height = resolveTranscriptMessageHeight(message, index, measuredHeights, options);
    nextEntries.push({
      height,
      key,
      message,
    });
    nextMessageIndexesByKey.set(key, index);
    nextPrefixHeights[index + 1] = nextPrefixHeights[index]! + height;
  }

  return {
    entries: nextEntries,
    messageIndexesByKey: nextMessageIndexesByKey,
    messages,
    prefixHeights: nextPrefixHeights,
  };
}

function resolveVisibleStartIndex(prefixHeights: readonly number[], offset: number): number {
  const messageCount = prefixHeights.length - 1;
  if (messageCount <= 0) {
    return 0;
  }

  let low = 0;
  let high = messageCount - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (prefixHeights[middle + 1] <= offset) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return Math.max(0, Math.min(messageCount - 1, low));
}

function resolveVisibleEndIndex(prefixHeights: readonly number[], offset: number): number {
  const messageCount = prefixHeights.length - 1;
  if (messageCount <= 0) {
    return 0;
  }

  let low = 0;
  let high = messageCount;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (prefixHeights[middle] < offset) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return Math.max(1, Math.min(messageCount, low));
}

export function buildTranscriptPrefixHeights(
  messages: readonly AgentSessionItemView[],
  measuredHeights: ReadonlyMap<string, number>,
  options: TranscriptHeightEstimateOptions = {},
): number[] {
  return buildTranscriptPrefixHeightsCache(messages, measuredHeights, options).prefixHeights as number[];
}

export function reconcileTranscriptPrefixHeightsCache({
  invalidatedMessageIds = [],
  measuredHeights,
  messages,
  options = {},
  previousCache,
}: {
  invalidatedMessageIds?: readonly string[];
  measuredHeights: ReadonlyMap<string, number>;
  messages: readonly AgentSessionItemView[];
  options?: TranscriptHeightEstimateOptions;
  previousCache?: TranscriptPrefixHeightsCache | null;
}): TranscriptPrefixHeightsCache {
  if (!previousCache) {
    return buildTranscriptPrefixHeightsCache(messages, measuredHeights, options);
  }

  if (previousCache.messages === messages) {
    return reconcileMeasuredTranscriptPrefixHeightsCache(
      previousCache,
      measuredHeights,
      invalidatedMessageIds,
      options,
    );
  }

  const appendOnlyCache = reconcileAppendOnlyTranscriptPrefixHeightsCache(
    previousCache,
    measuredHeights,
    messages,
    invalidatedMessageIds,
    options,
  );
  if (appendOnlyCache) {
    return appendOnlyCache;
  }

  const invalidatedMessageKeySet = new Set(
    invalidatedMessageIds.map((messageKey) => messageKey.trim()).filter(Boolean),
  );
  const nextEntries: TranscriptPrefixHeightCacheEntry[] = new Array(messages.length);
  const nextMessageIndexesByKey = new Map<string, number>();
  const didMessageCountChange = messages.length !== previousCache.entries.length;
  let didEntriesChange = didMessageCountChange;
  let didKeyIndexesChange = didMessageCountChange;
  let firstChangedHeightIndex = didMessageCountChange
    ? Math.min(messages.length, previousCache.entries.length)
    : messages.length;

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!;
    const key = resolveTranscriptMessageKey(message, index);
    nextMessageIndexesByKey.set(key, index);
    const previousEntry = previousCache.entries[index];
    const previousKeyedEntryIndex = previousCache.messageIndexesByKey.get(key);
    const previousKeyedEntry = previousKeyedEntryIndex === undefined
      ? undefined
      : previousCache.entries[previousKeyedEntryIndex];

    let nextEntry: TranscriptPrefixHeightCacheEntry;
    if (
      previousKeyedEntry &&
      previousKeyedEntry.message === message &&
      !invalidatedMessageKeySet.has(key)
    ) {
      nextEntry = previousKeyedEntry;
    } else {
      nextEntry = {
        height: resolveTranscriptMessageHeight(message, index, measuredHeights, options),
        key,
        message,
      };
    }
    nextEntries[index] = nextEntry;

    if (previousEntry !== nextEntry) {
      didEntriesChange = true;
    }
    if (previousEntry?.key !== key) {
      didKeyIndexesChange = true;
    }
    if (previousEntry?.height !== nextEntry.height) {
      firstChangedHeightIndex = Math.min(firstChangedHeightIndex, index);
    }
  }

  let nextPrefixHeights: readonly number[] = previousCache.prefixHeights;
  if (firstChangedHeightIndex < messages.length || didMessageCountChange) {
    const mutablePrefixHeights = firstChangedHeightIndex > 0
      ? previousCache.prefixHeights.slice(0, firstChangedHeightIndex + 1)
      : new Array<number>(messages.length + 1).fill(0);
    mutablePrefixHeights.length = messages.length + 1;
    if (firstChangedHeightIndex === 0) {
      mutablePrefixHeights[0] = 0;
    }
    for (let index = firstChangedHeightIndex; index < nextEntries.length; index += 1) {
      mutablePrefixHeights[index + 1] =
        mutablePrefixHeights[index]! + nextEntries[index]!.height;
    }
    nextPrefixHeights = mutablePrefixHeights;
  }

  return {
    entries: didEntriesChange ? nextEntries : previousCache.entries,
    messageIndexesByKey: didKeyIndexesChange
      ? nextMessageIndexesByKey
      : previousCache.messageIndexesByKey,
    messages,
    prefixHeights: nextPrefixHeights,
  };
}

export function resolveVirtualizedTranscriptWindow({
  isActive,
  messages,
  minVirtualizedMessageCount = MIN_VIRTUALIZED_MESSAGE_COUNT,
  overscanPx = VIRTUALIZED_OVERSCAN_PX,
  prefixHeights,
  viewport,
}: {
  isActive: boolean;
  messages: readonly AgentSessionItemView[];
  minVirtualizedMessageCount?: number;
  overscanPx?: number;
  prefixHeights: readonly number[];
  viewport: TranscriptViewport;
}): VirtualizedTranscriptWindowState {
  if (messages.length === 0) {
    return {
      paddingBottom: 0,
      paddingTop: 0,
      visibleMessages: messages,
      visibleStartIndex: 0,
    };
  }

  if (
    messages.length <= minVirtualizedMessageCount
    || messages.some(hasHighVarianceTranscriptLayout)
  ) {
    return {
      paddingBottom: 0,
      paddingTop: 0,
      visibleMessages: messages,
      visibleStartIndex: 0,
    };
  }

  const totalHeight = prefixHeights[messages.length] ?? 0;
  const effectiveViewport = viewport.clientHeight > 0
    ? viewport
    : {
        clientHeight: 1,
        scrollTop: isActive
          ? totalHeight
          : Math.max(0, Math.min(viewport.scrollTop, totalHeight)),
      };
  const visibleStartOffset = Math.max(0, effectiveViewport.scrollTop - overscanPx);
  const visibleEndOffset =
    effectiveViewport.scrollTop + effectiveViewport.clientHeight + overscanPx;
  const visibleStartIndex = resolveVisibleStartIndex(prefixHeights, visibleStartOffset);
  const visibleEndIndex = Math.max(
    visibleStartIndex + 1,
    resolveVisibleEndIndex(prefixHeights, visibleEndOffset),
  );
  return {
    paddingBottom: Math.max(0, totalHeight - (prefixHeights[visibleEndIndex] ?? 0)),
    paddingTop: prefixHeights[visibleStartIndex] ?? 0,
    visibleMessages: messages.slice(visibleStartIndex, visibleEndIndex),
    visibleStartIndex,
  };
}
