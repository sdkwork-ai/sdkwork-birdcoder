import type { BirdCoderChatMessage } from '@sdkwork/birdcoder-types';

export const MIN_VIRTUALIZED_MESSAGE_COUNT = 96;
export const VIRTUALIZED_OVERSCAN_PX = 720;

interface TranscriptPrefixHeightCacheEntry {
  height: number;
  key: string;
  message: BirdCoderChatMessage;
}

export interface TranscriptPrefixHeightsCache {
  entries: readonly TranscriptPrefixHeightCacheEntry[];
  messageIndexesByKey: ReadonlyMap<string, number>;
  messages: readonly BirdCoderChatMessage[];
  prefixHeights: readonly number[];
}

export interface TranscriptViewport {
  clientHeight: number;
  scrollTop: number;
}

export interface VirtualizedTranscriptWindowState {
  paddingBottom: number;
  paddingTop: number;
  visibleMessages: readonly BirdCoderChatMessage[];
  visibleStartIndex: number;
}

export function resolveTranscriptMessageKey(
  message: BirdCoderChatMessage | undefined,
  index: number,
): string {
  const normalizedMessageId = message?.id.trim() ?? '';
  return `${index}\u0001${normalizedMessageId || 'message'}`;
}

function estimateTranscriptMessageHeight(message: BirdCoderChatMessage): number {
  const lineCount = Math.max(1, message.content.split(/\r?\n/u).length);
  const wrappedLineCount = Math.ceil(message.content.length / 96);
  const contentLineEstimate = Math.max(lineCount, wrappedLineCount);
  const baseHeight = message.role === 'user' ? 84 : 132;
  const contentHeight = Math.min(720, contentLineEstimate * (message.role === 'user' ? 18 : 22));
  const fileChangeHeight = (message.fileChanges?.length ?? 0) * 36;
  const commandHeight = (message.commands?.length ?? 0) * 44;
  const taskProgressHeight = message.taskProgress ? 40 : 0;
  return baseHeight + contentHeight + fileChangeHeight + commandHeight + taskProgressHeight;
}

function resolveTranscriptMessageHeight(
  message: BirdCoderChatMessage,
  index: number,
  measuredHeights: ReadonlyMap<string, number>,
): number {
  const measuredHeight = measuredHeights.get(resolveTranscriptMessageKey(message, index));
  return measuredHeight ?? estimateTranscriptMessageHeight(message);
}

function buildTranscriptPrefixHeightsCache(
  messages: readonly BirdCoderChatMessage[],
  measuredHeights: ReadonlyMap<string, number>,
): TranscriptPrefixHeightsCache {
  const entries: TranscriptPrefixHeightCacheEntry[] = new Array(messages.length);
  const messageIndexesByKey = new Map<string, number>();
  const prefixHeights = new Array<number>(messages.length + 1).fill(0);

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!;
    const key = resolveTranscriptMessageKey(message, index);
    const height = resolveTranscriptMessageHeight(message, index, measuredHeights);
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

    const nextHeight = resolveTranscriptMessageHeight(message, messageIndex, measuredHeights);
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
  messages: readonly BirdCoderChatMessage[],
  measuredHeights: ReadonlyMap<string, number>,
): number[] {
  return buildTranscriptPrefixHeightsCache(messages, measuredHeights).prefixHeights as number[];
}

export function reconcileTranscriptPrefixHeightsCache({
  invalidatedMessageIds = [],
  measuredHeights,
  messages,
  previousCache,
}: {
  invalidatedMessageIds?: readonly string[];
  measuredHeights: ReadonlyMap<string, number>;
  messages: readonly BirdCoderChatMessage[];
  previousCache?: TranscriptPrefixHeightsCache | null;
}): TranscriptPrefixHeightsCache {
  if (!previousCache) {
    return buildTranscriptPrefixHeightsCache(messages, measuredHeights);
  }

  if (previousCache.messages === messages) {
    return reconcileMeasuredTranscriptPrefixHeightsCache(
      previousCache,
      measuredHeights,
      invalidatedMessageIds,
    );
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

    const nextHeight = resolveTranscriptMessageHeight(message, index, measuredHeights);
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
  messages: readonly BirdCoderChatMessage[];
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
