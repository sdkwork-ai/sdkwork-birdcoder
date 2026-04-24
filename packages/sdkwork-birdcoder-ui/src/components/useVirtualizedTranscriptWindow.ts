import type { BirdCoderChatMessage } from '@sdkwork/birdcoder-types';
import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  reconcileTranscriptPrefixHeightsCache,
  resolveVirtualizedTranscriptWindow,
  type TranscriptPrefixHeightsCache,
  type TranscriptViewport,
} from './transcriptVirtualization';

interface VirtualizedTranscriptWindowResult {
  paddingBottom: number;
  paddingTop: number;
  registerMessageElement: (messageId: string) => (element: HTMLDivElement | null) => void;
  visibleMessages: readonly BirdCoderChatMessage[];
  visibleStartIndex: number;
}

const EMPTY_INVALIDATED_MESSAGE_IDS: string[] = [];

interface TranscriptMeasurementState {
  changedMessageIds: readonly string[];
  version: number;
}

export function useVirtualizedTranscriptWindow(
  messages: readonly BirdCoderChatMessage[],
  scrollContainerRef: RefObject<HTMLDivElement | null>,
  isActive = true,
): VirtualizedTranscriptWindowResult {
  const [viewport, setViewport] = useState<TranscriptViewport>({
    clientHeight: 0,
    scrollTop: 0,
  });
  const [measurementState, setMeasurementState] = useState<TranscriptMeasurementState>({
    changedMessageIds: EMPTY_INVALIDATED_MESSAGE_IDS,
    version: 0,
  });
  const measuredHeightsRef = useRef(new Map<string, number>());
  const observedElementsRef = useRef(new Map<string, HTMLDivElement>());
  const messageIdByElementRef = useRef(new Map<HTMLDivElement, string>());
  const messageRefCallbackMapRef = useRef(
    new Map<string, (element: HTMLDivElement | null) => void>(),
  );
  const prefixHeightsCacheRef = useRef<TranscriptPrefixHeightsCache | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const isActiveRef = useRef(isActive);

  const publishMeasurementChange = useCallback((changedMessageIds?: readonly string[]) => {
    const normalizedChangedMessageIds =
      changedMessageIds && changedMessageIds.length > 0
        ? Array.from(
            new Set(
              changedMessageIds
                .map((messageId) => messageId.trim())
                .filter((messageId) => messageId.length > 0),
            ),
          )
        : EMPTY_INVALIDATED_MESSAGE_IDS;

    setMeasurementState((previousState) => ({
      changedMessageIds: normalizedChangedMessageIds,
      version: previousState.version + 1,
    }));
  }, []);

  const updateMeasuredTranscriptElementHeight = useCallback(
    (messageId: string, element: HTMLDivElement): boolean => {
      const nextHeight = Math.max(1, Math.ceil(element.getBoundingClientRect().height));
      const previousHeight = measuredHeightsRef.current.get(messageId);
      if (previousHeight === nextHeight) {
        return false;
      }

      measuredHeightsRef.current.set(messageId, nextHeight);
      return true;
    },
    [],
  );

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    const messageIdSet = new Set(
      messages.map((message, index) => {
        const normalizedMessageId = message.id.trim();
        return normalizedMessageId || `message-${index}`;
      }),
    );
    for (const messageId of measuredHeightsRef.current.keys()) {
      if (messageIdSet.has(messageId)) {
        continue;
      }
      measuredHeightsRef.current.delete(messageId);
    }

    for (const [messageId, element] of observedElementsRef.current.entries()) {
      if (messageIdSet.has(messageId)) {
        continue;
      }
      resizeObserverRef.current?.unobserve(element);
      observedElementsRef.current.delete(messageId);
      messageIdByElementRef.current.delete(element);
    }

    for (const messageId of messageRefCallbackMapRef.current.keys()) {
      if (messageIdSet.has(messageId)) {
        continue;
      }
      messageRefCallbackMapRef.current.delete(messageId);
    }
  }, [messages]);

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

        const messageId = messageIdByElementRef.current.get(element);
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
    resizeObserverRef.current = resizeObserver;

    const initiallyChangedMessageIds: string[] = [];
    for (const element of observedElementsRef.current.values()) {
      resizeObserver.observe(element);
      const messageId = messageIdByElementRef.current.get(element);
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
      if (resizeObserverRef.current === resizeObserver) {
        resizeObserverRef.current = null;
      }
    };
  }, [isActive, publishMeasurementChange, updateMeasuredTranscriptElementHeight]);

  const registerMessageElement = useCallback(
    (messageId: string) => {
      const normalizedMessageId = messageId.trim();
      const cachedCallback = messageRefCallbackMapRef.current.get(normalizedMessageId);
      if (cachedCallback) {
        return cachedCallback;
      }

      const nextCallback = (element: HTMLDivElement | null) => {
        const previousElement = observedElementsRef.current.get(normalizedMessageId);
        if (previousElement === element) {
          return;
        }

        if (previousElement) {
          resizeObserverRef.current?.unobserve(previousElement);
          observedElementsRef.current.delete(normalizedMessageId);
          messageIdByElementRef.current.delete(previousElement);
        }

        if (!element || !normalizedMessageId) {
          return;
        }

        observedElementsRef.current.set(normalizedMessageId, element);
        messageIdByElementRef.current.set(element, normalizedMessageId);
        if (!isActiveRef.current) {
          return;
        }

        resizeObserverRef.current?.observe(element);

        if (updateMeasuredTranscriptElementHeight(normalizedMessageId, element)) {
          publishMeasurementChange([normalizedMessageId]);
        }
      };

      messageRefCallbackMapRef.current.set(normalizedMessageId, nextCallback);
      return nextCallback;
    },
    [publishMeasurementChange, updateMeasuredTranscriptElementHeight],
  );

  const prefixHeightsCache = useMemo(
    () =>
      reconcileTranscriptPrefixHeightsCache({
        invalidatedMessageIds: measurementState.changedMessageIds,
        measuredHeights: measuredHeightsRef.current,
        messages,
        previousCache: prefixHeightsCacheRef.current,
      }),
    [measurementState, messages],
  );
  useEffect(() => {
    prefixHeightsCacheRef.current = prefixHeightsCache;
  }, [prefixHeightsCache]);
  const prefixHeights = prefixHeightsCache.prefixHeights;
  const totalTranscriptHeight = prefixHeights[messages.length] ?? 0;

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
          scrollTop: scrollContainer.scrollTop,
        };
        if (
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
  }, [isActive, messages.length, scrollContainerRef, totalTranscriptHeight]);

  const windowedTranscript = useMemo(
    () =>
      resolveVirtualizedTranscriptWindow({
        isActive,
        messages,
        prefixHeights,
        viewport,
      }),
    [isActive, messages, prefixHeights, viewport],
  );

  return {
    ...windowedTranscript,
    registerMessageElement,
  };
}
