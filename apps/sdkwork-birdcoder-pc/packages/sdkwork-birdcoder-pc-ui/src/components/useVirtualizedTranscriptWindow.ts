import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { RefObject } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  hasTranscriptMessageKey,
  reconcileTranscriptPrefixHeightsCache,
  resolveMeasurementScopeTranscriptViewport,
  resolvePrependAdjustedTranscriptViewport,
  resolveVirtualizedTranscriptWindow,
  type TranscriptPrefixHeightsCache,
  type TranscriptViewport,
} from './transcriptVirtualization';

interface VirtualizedTranscriptWindowResult {
  measurementVersion: number;
  paddingBottom: number;
  paddingTop: number;
  registerMessageElement: (messageId: string) => (element: HTMLDivElement | null) => void;
  resolveMessageOffset: (messageIndex: number) => number | null;
  visibleMessages: readonly AgentSessionItemView[];
  visibleStartIndex: number;
}

const EMPTY_INVALIDATED_MESSAGE_IDS: string[] = [];

interface TranscriptMeasurementState {
  changedMessageIds: readonly string[];
  publishedThroughSequence: number;
  scope: TranscriptMeasurementScope;
  version: number;
}

interface ScopedTranscriptViewport extends TranscriptViewport {
  measurementScopeKey: string;
}

interface TranscriptMeasurementScope {
  committedPublishedThroughSequence: number;
  isDisposed: boolean;
  key: string;
  measuredHeights: Map<string, number>;
  messageIdByElement: Map<HTMLDivElement, string>;
  messageRefCallbacks: Map<string, (element: HTMLDivElement | null) => void>;
  nextChangeSequence: number;
  observedElements: Map<string, HTMLDivElement>;
  pendingMessageIds: Map<string, number>;
  prefixHeightsCache: TranscriptPrefixHeightsCache | null;
  publishFrameId: number | null;
  resizeObserver: ResizeObserver | null;
}

function createTranscriptMeasurementScope(key: string): TranscriptMeasurementScope {
  return {
    committedPublishedThroughSequence: 0,
    isDisposed: false,
    key,
    measuredHeights: new Map<string, number>(),
    messageIdByElement: new Map<HTMLDivElement, string>(),
    messageRefCallbacks: new Map<string, (element: HTMLDivElement | null) => void>(),
    nextChangeSequence: 0,
    observedElements: new Map<string, HTMLDivElement>(),
    pendingMessageIds: new Map<string, number>(),
    prefixHeightsCache: null,
    publishFrameId: null,
    resizeObserver: null,
  };
}

function disposeTranscriptMeasurementScope(scope: TranscriptMeasurementScope): void {
  scope.isDisposed = true;
  if (scope.publishFrameId !== null && typeof window !== 'undefined') {
    window.cancelAnimationFrame(scope.publishFrameId);
  }
  scope.publishFrameId = null;
  scope.resizeObserver?.disconnect();
  scope.resizeObserver = null;
  scope.observedElements.clear();
  scope.messageIdByElement.clear();
  scope.messageRefCallbacks.clear();
  scope.measuredHeights.clear();
  scope.pendingMessageIds.clear();
  scope.prefixHeightsCache = null;
}

export function useVirtualizedTranscriptWindow(
  messages: readonly AgentSessionItemView[],
  scrollContainerRef: RefObject<HTMLDivElement | null>,
  isActive = true,
  measurementScopeKey = '',
  layout: 'sidebar' | 'main' = 'main',
  engineId?: string,
): VirtualizedTranscriptWindowResult {
  const normalizedMeasurementScopeKey = measurementScopeKey.trim();
  const measurementScope = useMemo(
    () => createTranscriptMeasurementScope(normalizedMeasurementScopeKey),
    [normalizedMeasurementScopeKey],
  );
  const [viewport, setViewport] = useState<ScopedTranscriptViewport>({
    clientHeight: 0,
    measurementScopeKey: normalizedMeasurementScopeKey,
    scrollTop: 0,
  });
  const [measurementState, setMeasurementState] = useState<TranscriptMeasurementState>({
    changedMessageIds: EMPTY_INVALIDATED_MESSAGE_IDS,
    publishedThroughSequence: 0,
    scope: measurementScope,
    version: 0,
  });
  const isActiveRef = useRef(isActive);
  const committedMeasurementScopeRef = useRef(measurementScope);

  useLayoutEffect(() => {
    const previousScope = committedMeasurementScopeRef.current;
    if (previousScope === measurementScope) {
      return;
    }

    disposeTranscriptMeasurementScope(previousScope);
    committedMeasurementScopeRef.current = measurementScope;
  }, [measurementScope]);

  const publishPendingMeasurementChanges = useCallback(() => {
    measurementScope.publishFrameId = null;
    if (measurementScope.isDisposed || measurementScope.pendingMessageIds.size === 0) {
      return;
    }

    const changedMessageIds = Array.from(measurementScope.pendingMessageIds.keys());
    const publishedThroughSequence = measurementScope.nextChangeSequence;
    setMeasurementState((previousState) => {
      if (measurementScope.isDisposed) {
        return previousState;
      }

      const hasUncommittedMeasurementBatch =
        previousState.scope === measurementScope
        && previousState.publishedThroughSequence
          > measurementScope.committedPublishedThroughSequence;
      const nextChangedMessageIds = hasUncommittedMeasurementBatch
        ? Array.from(new Set([
            ...previousState.changedMessageIds,
            ...changedMessageIds,
          ]))
        : changedMessageIds;

      return {
        changedMessageIds: nextChangedMessageIds,
        publishedThroughSequence,
        scope: measurementScope,
        version: previousState.version + 1,
      };
    });
  }, [measurementScope]);

  const publishMeasurementChange = useCallback((changedMessageIds?: readonly string[]) => {
    if (measurementScope.isDisposed || !changedMessageIds || changedMessageIds.length === 0) {
      return;
    }

    let didQueueMeasurement = false;
    for (const messageId of changedMessageIds) {
      const normalizedMessageId = messageId.trim();
      if (!normalizedMessageId) {
        continue;
      }

      measurementScope.nextChangeSequence += 1;
      measurementScope.pendingMessageIds.set(
        normalizedMessageId,
        measurementScope.nextChangeSequence,
      );
      didQueueMeasurement = true;
    }

    if (!didQueueMeasurement || measurementScope.publishFrameId !== null) {
      return;
    }

    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      publishPendingMeasurementChanges();
      return;
    }
    measurementScope.publishFrameId = window.requestAnimationFrame(
      publishPendingMeasurementChanges,
    );
  }, [measurementScope, publishPendingMeasurementChanges]);

  const updateMeasuredTranscriptElementHeight = useCallback(
    (messageId: string, element: HTMLDivElement): boolean => {
      const nextHeight = Math.max(1, Math.ceil(element.getBoundingClientRect().height));
      const previousHeight = measurementScope.measuredHeights.get(messageId);
      if (previousHeight === nextHeight) {
        return false;
      }

      measurementScope.measuredHeights.set(messageId, nextHeight);
      return true;
    },
    [measurementScope],
  );

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const previousPrefixHeightsCache = measurementScope.prefixHeightsCache;
  const invalidatedMessageIds =
    measurementState.scope === measurementScope
    && measurementState.publishedThroughSequence
      > measurementScope.committedPublishedThroughSequence
    ? measurementState.changedMessageIds
    : EMPTY_INVALIDATED_MESSAGE_IDS;
  const prefixHeightsCache = useMemo(
    () =>
      reconcileTranscriptPrefixHeightsCache({
        invalidatedMessageIds,
        measuredHeights: measurementScope.measuredHeights,
        messages,
        options: { layout, engineId },
        previousCache: measurementScope.prefixHeightsCache,
      }),
    [engineId, invalidatedMessageIds, layout, measurementScope, messages],
  );
  const messageIndexesByKey = prefixHeightsCache.messageIndexesByKey;

  useEffect(() => {
    for (const messageId of measurementScope.measuredHeights.keys()) {
      if (hasTranscriptMessageKey(messageIndexesByKey, messageId)) {
        continue;
      }
      measurementScope.measuredHeights.delete(messageId);
    }

    for (const [messageId, element] of measurementScope.observedElements.entries()) {
      if (hasTranscriptMessageKey(messageIndexesByKey, messageId)) {
        continue;
      }
      measurementScope.resizeObserver?.unobserve(element);
      measurementScope.observedElements.delete(messageId);
      measurementScope.messageIdByElement.delete(element);
    }

    for (const messageId of measurementScope.messageRefCallbacks.keys()) {
      if (hasTranscriptMessageKey(messageIndexesByKey, messageId)) {
        continue;
      }
      measurementScope.messageRefCallbacks.delete(messageId);
    }
  }, [measurementScope, messageIndexesByKey]);

  useEffect(() => {
    if (!isActive || typeof ResizeObserver !== 'function') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const changedMessageIds: string[] = [];
      for (const entry of entries) {
        const element = entry.target;
        if (!(element instanceof HTMLDivElement)) {
          continue;
        }

        const messageId = measurementScope.messageIdByElement.get(element);
        if (!messageId) {
          continue;
        }

        if (updateMeasuredTranscriptElementHeight(messageId, element)) {
          changedMessageIds.push(messageId);
        }
      }

      if (changedMessageIds.length > 0) {
        publishMeasurementChange(changedMessageIds);
      }
    });
    measurementScope.resizeObserver = resizeObserver;

    const initiallyChangedMessageIds: string[] = [];
    for (const element of measurementScope.observedElements.values()) {
      resizeObserver.observe(element);
      const messageId = measurementScope.messageIdByElement.get(element);
      if (!messageId) {
        continue;
      }

      if (updateMeasuredTranscriptElementHeight(messageId, element)) {
        initiallyChangedMessageIds.push(messageId);
      }
    }

    if (initiallyChangedMessageIds.length > 0) {
      publishMeasurementChange(initiallyChangedMessageIds);
    }

    return () => {
      resizeObserver.disconnect();
      if (measurementScope.resizeObserver === resizeObserver) {
        measurementScope.resizeObserver = null;
      }
    };
  }, [
    isActive,
    measurementScope,
    publishMeasurementChange,
    updateMeasuredTranscriptElementHeight,
  ]);

  const registerMessageElement = useCallback(
    (messageId: string) => {
      const normalizedMessageId = messageId.trim();
      const cachedCallback = measurementScope.messageRefCallbacks.get(normalizedMessageId);
      if (cachedCallback) {
        return cachedCallback;
      }

      const nextCallback = (element: HTMLDivElement | null) => {
        const previousElement = measurementScope.observedElements.get(normalizedMessageId);
        if (previousElement === element) {
          return;
        }

        if (previousElement) {
          measurementScope.resizeObserver?.unobserve(previousElement);
          measurementScope.observedElements.delete(normalizedMessageId);
          measurementScope.messageIdByElement.delete(previousElement);
        }

        if (!element || !normalizedMessageId) {
          return;
        }

        measurementScope.observedElements.set(normalizedMessageId, element);
        measurementScope.messageIdByElement.set(element, normalizedMessageId);
        if (!isActiveRef.current) {
          return;
        }

        measurementScope.resizeObserver?.observe(element);

        if (updateMeasuredTranscriptElementHeight(normalizedMessageId, element)) {
          publishMeasurementChange([normalizedMessageId]);
        }
      };

      measurementScope.messageRefCallbacks.set(normalizedMessageId, nextCallback);
      return nextCallback;
    },
    [measurementScope, publishMeasurementChange, updateMeasuredTranscriptElementHeight],
  );

  useLayoutEffect(() => {
    measurementScope.prefixHeightsCache = prefixHeightsCache;
    if (measurementState.scope !== measurementScope) {
      return;
    }

    measurementScope.committedPublishedThroughSequence = Math.max(
      measurementScope.committedPublishedThroughSequence,
      measurementState.publishedThroughSequence,
    );
    for (const [messageId, changeSequence] of measurementScope.pendingMessageIds) {
      if (changeSequence <= measurementState.publishedThroughSequence) {
        measurementScope.pendingMessageIds.delete(messageId);
      }
    }
  }, [measurementScope, measurementState, prefixHeightsCache]);
  const prefixHeights = prefixHeightsCache.prefixHeights;
  const totalTranscriptHeight = prefixHeights[messages.length] ?? 0;
  const effectiveViewport = resolveMeasurementScopeTranscriptViewport({
    didChangeScope: viewport.measurementScopeKey !== normalizedMeasurementScopeKey,
    isActive,
    totalHeight: totalTranscriptHeight,
    viewport,
  });
  const windowViewport = useMemo(
    () => resolvePrependAdjustedTranscriptViewport({
      currentCache: prefixHeightsCache,
      previousCache: previousPrefixHeightsCache,
      viewport: effectiveViewport,
    }),
    [effectiveViewport, prefixHeightsCache, previousPrefixHeightsCache],
  );

  useEffect(() => {
    if (!isActive || typeof window === 'undefined') {
      return undefined;
    }

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return undefined;
    }

    let animationFrameId = 0;
    let isTrackingTranscriptScroll = false;
    const syncTranscriptScrollTracking = (shouldTrackTranscriptScroll: boolean) => {
      if (shouldTrackTranscriptScroll === isTrackingTranscriptScroll) {
        return;
      }

      isTrackingTranscriptScroll = shouldTrackTranscriptScroll;
      if (shouldTrackTranscriptScroll) {
        scrollContainer.addEventListener('scroll', scheduleViewportPublish, { passive: true });
        return;
      }

      scrollContainer.removeEventListener('scroll', scheduleViewportPublish);
    };
    const publishViewport = () => {
      animationFrameId = 0;
      const shouldTrackTranscriptScroll = totalTranscriptHeight > scrollContainer.clientHeight;
      syncTranscriptScrollTracking(shouldTrackTranscriptScroll);
      setViewport((previousViewport) => {
        const nextViewport = {
          clientHeight: scrollContainer.clientHeight,
          measurementScopeKey: normalizedMeasurementScopeKey,
          scrollTop: scrollContainer.scrollTop,
        };
        if (
          previousViewport.measurementScopeKey === nextViewport.measurementScopeKey &&
          previousViewport.clientHeight === nextViewport.clientHeight &&
          previousViewport.scrollTop === nextViewport.scrollTop
        ) {
          return previousViewport;
        }
        return nextViewport;
      });
    };
    const scheduleViewportPublish = () => {
      if (animationFrameId !== 0) {
        return;
      }
      animationFrameId = window.requestAnimationFrame(publishViewport);
    };

    scheduleViewportPublish();

    let containerResizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver === 'function') {
      containerResizeObserver = new ResizeObserver(() => {
        scheduleViewportPublish();
      });
      containerResizeObserver.observe(scrollContainer);
    }

    return () => {
      syncTranscriptScrollTracking(false);
      containerResizeObserver?.disconnect();
      if (animationFrameId !== 0) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [
    isActive,
    messages.length,
    normalizedMeasurementScopeKey,
    scrollContainerRef,
    totalTranscriptHeight,
  ]);

  const windowedTranscript = useMemo(
    () =>
      resolveVirtualizedTranscriptWindow({
        isActive,
        messages,
        prefixHeights,
        viewport: windowViewport,
      }),
    [isActive, messages, prefixHeights, windowViewport],
  );
  const resolveMessageOffset = useCallback((messageIndex: number): number | null => {
    if (
      !Number.isInteger(messageIndex)
      || messageIndex < 0
      || messageIndex >= messages.length
    ) {
      return null;
    }
    return prefixHeights[messageIndex] ?? null;
  }, [messages.length, prefixHeights]);

  return {
    ...windowedTranscript,
    measurementVersion: measurementState.version,
    registerMessageElement,
    resolveMessageOffset,
  };
}
