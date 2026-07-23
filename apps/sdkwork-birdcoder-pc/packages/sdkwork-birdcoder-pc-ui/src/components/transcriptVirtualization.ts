import {
  estimateTranscriptMessageHeight,
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

export interface VirtualizedTranscriptWindowState {
  paddingBottom: number;
  paddingTop: number;
  visibleMessages: readonly AgentSessionItemView[];
  visibleStartIndex: number;
}

export function resolveTranscriptMessageKey(
  message: AgentSessionItemView | undefined,
  index: number,
): string {
  const normalizedMessageId = message?.id.trim() ?? '';
  return `${index}\u0001${normalizedMessageId || 'message'}`;
}

export function hasTranscriptMessageKey(
  messages: readonly AgentSessionItemView[],
  messageKey: string,
): boolean {
  const separatorIndex = messageKey.indexOf('\u0001');
  if (separatorIndex <= 0) {
    return false;
  }

  const index = Number(messageKey.slice(0, separatorIndex));
  if (!Number.isInteger(index) || index < 0 || index >= messages.length) {
    return false;
  }

  return resolveTranscriptMessageKey(messages[index], index) === messageKey;
}

function estimateTranscriptMessageHeightForLayout(
  message: AgentSessionItemView,
  options: TranscriptHeightEstimateOptions = {},
): number {
  return estimateTranscriptMessageHeight(message, {
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
  let firstChangedIndex =
    messages.length === previousCache.entries.length
      ? messages.length
      : Math.min(messages.length, previousCache.entries.length);

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!;
    const key = resolveTranscriptMessageKey(message, index);
    nextMessageIndexesByKey.set(key, index);
    const previousEntry = previousCache.entries[index];

    if (
      previousEntry &&
      previousEntry.key === key &&
      previousEntry.message === message &&
      !invalidatedMessageKeySet.has(key)
    ) {
      nextEntries[index] = previousEntry;
      continue;
    }

    const nextHeight = resolveTranscriptMessageHeight(message, index, measuredHeights, options);
    if (
      firstChangedIndex === messages.length &&
      (
        !previousEntry ||
        previousEntry.key !== key ||
        previousEntry.message !== message ||
        previousEntry.height !== nextHeight
      )
    ) {
      firstChangedIndex = index;
    }

    nextEntries[index] = {
      height: nextHeight,
      key,
      message,
    };
  }

  if (firstChangedIndex === messages.length) {
    return {
      entries: previousCache.entries,
      messageIndexesByKey: previousCache.messageIndexesByKey,
      messages,
      prefixHeights: previousCache.prefixHeights,
    };
  }

  const nextPrefixHeights =
    firstChangedIndex > 0
      ? previousCache.prefixHeights.slice(0, firstChangedIndex + 1)
      : new Array<number>(messages.length + 1).fill(0);
  nextPrefixHeights.length = messages.length + 1;
  if (firstChangedIndex === 0) {
    nextPrefixHeights[0] = 0;
  }
  for (let index = firstChangedIndex; index < nextEntries.length; index += 1) {
    nextPrefixHeights[index + 1] = nextPrefixHeights[index] + nextEntries[index]!.height;
  }

  return {
    entries: nextEntries,
    messageIndexesByKey: nextMessageIndexesByKey,
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
    !isActive ||
    viewport.clientHeight <= 0 ||
    messages.length <= minVirtualizedMessageCount
  ) {
    return {
      paddingBottom: 0,
      paddingTop: 0,
      visibleMessages: messages,
      visibleStartIndex: 0,
    };
  }

  const visibleStartOffset = Math.max(0, viewport.scrollTop - overscanPx);
  const visibleEndOffset = viewport.scrollTop + viewport.clientHeight + overscanPx;
  const visibleStartIndex = resolveVisibleStartIndex(prefixHeights, visibleStartOffset);
  const visibleEndIndex = Math.max(
    visibleStartIndex + 1,
    resolveVisibleEndIndex(prefixHeights, visibleEndOffset),
  );
  const totalHeight = prefixHeights[messages.length] ?? 0;

  return {
    paddingBottom: Math.max(0, totalHeight - (prefixHeights[visibleEndIndex] ?? 0)),
    paddingTop: prefixHeights[visibleStartIndex] ?? 0,
    visibleMessages: messages.slice(visibleStartIndex, visibleEndIndex),
    visibleStartIndex,
  };
}
