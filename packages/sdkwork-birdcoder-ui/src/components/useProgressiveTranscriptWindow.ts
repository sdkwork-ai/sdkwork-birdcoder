import type { BirdCoderChatMessage } from '@sdkwork/birdcoder-types';
import type { RefObject } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  computeTranscriptRepairScrollTop,
  type TranscriptScrollMetrics,
} from './chatScrollBehavior';
import {
  resolveEarlierTranscriptStartIndex,
  resolveInitialVisibleTranscriptStartIndex,
  shouldLoadEarlierTranscriptPage,
} from './transcriptPagination';

const INITIAL_TRANSCRIPT_RENDER_COUNT = 48;

function resolveTranscriptScrollContainer(
  messagesEndRef: RefObject<HTMLDivElement | null>,
): HTMLDivElement | null {
  const scrollContainer = messagesEndRef.current?.parentElement;
  return scrollContainer instanceof HTMLDivElement ? scrollContainer : null;
}

function readTranscriptScrollMetrics(
  messagesEndRef: RefObject<HTMLDivElement | null>,
): TranscriptScrollMetrics | null {
  const scrollContainer = resolveTranscriptScrollContainer(messagesEndRef);
  if (!scrollContainer) {
    return null;
  }

  return {
    clientHeight: scrollContainer.clientHeight,
    scrollHeight: scrollContainer.scrollHeight,
    scrollTop: scrollContainer.scrollTop,
  };
}

export function useProgressiveTranscriptWindow(
  messages: readonly BirdCoderChatMessage[],
  messagesEndRef: RefObject<HTMLDivElement | null>,
  isActive = true,
  transcriptScopeKey = '',
) {
  const firstMessageId = messages[0]?.id ?? '';
  const normalizedTranscriptScopeKey = transcriptScopeKey.trim();
  const transcriptIdentity = `${normalizedTranscriptScopeKey}\u0001${firstMessageId}`;
  const previousTranscriptIdentityRef = useRef(transcriptIdentity);
  const pendingPrependedScrollMetricsRef = useRef<TranscriptScrollMetrics | null>(null);
  const isTranscriptPointerDragActiveRef = useRef(false);
  const pendingTopLoadAfterPointerReleaseRef = useRef(false);
  const [visibleTranscriptStartIndex, setVisibleTranscriptStartIndex] = useState(() =>
    resolveInitialVisibleTranscriptStartIndex(messages.length),
  );
  const [isLoadingEarlierMessages, setIsLoadingEarlierMessages] = useState(false);
  const didTranscriptChangeBeforeEffect =
    previousTranscriptIdentityRef.current !== transcriptIdentity;
  const effectiveVisibleTranscriptStartIndex = didTranscriptChangeBeforeEffect
    ? resolveInitialVisibleTranscriptStartIndex(messages.length)
    : visibleTranscriptStartIndex;

  const renderedMessages = useMemo(() => {
    if (effectiveVisibleTranscriptStartIndex === 0) {
      return messages;
    }

    return messages.slice(effectiveVisibleTranscriptStartIndex);
  }, [effectiveVisibleTranscriptStartIndex, messages]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const didTranscriptChange = previousTranscriptIdentityRef.current !== transcriptIdentity;
    if (didTranscriptChange) {
      previousTranscriptIdentityRef.current = transcriptIdentity;
      pendingPrependedScrollMetricsRef.current = null;
      setIsLoadingEarlierMessages(false);
      setVisibleTranscriptStartIndex(Math.max(0, messages.length - INITIAL_TRANSCRIPT_RENDER_COUNT));
      return;
    }

    if (messages.length === 0 && visibleTranscriptStartIndex !== 0) {
      pendingPrependedScrollMetricsRef.current = null;
      setIsLoadingEarlierMessages(false);
      setVisibleTranscriptStartIndex(0);
      return;
    }

    const maxVisibleTranscriptStartIndex = resolveInitialVisibleTranscriptStartIndex(messages.length);
    if (visibleTranscriptStartIndex > maxVisibleTranscriptStartIndex) {
      pendingPrependedScrollMetricsRef.current = null;
      setIsLoadingEarlierMessages(false);
      setVisibleTranscriptStartIndex(maxVisibleTranscriptStartIndex);
    }
  }, [isActive, messages.length, transcriptIdentity, visibleTranscriptStartIndex]);

  useEffect(() => {
    if (!isActive || visibleTranscriptStartIndex === 0 || typeof window === 'undefined') {
      return;
    }

    const scrollContainer = resolveTranscriptScrollContainer(messagesEndRef);
    if (!scrollContainer) {
      return;
    }

    const requestEarlierTranscriptPage = () => {
      if (pendingPrependedScrollMetricsRef.current || isLoadingEarlierMessages) {
        return;
      }

      const scrollMetrics = readTranscriptScrollMetrics(messagesEndRef);
      if (!shouldLoadEarlierTranscriptPage(scrollMetrics, visibleTranscriptStartIndex)) {
        return;
      }

      if (!scrollMetrics) {
        return;
      }

      pendingPrependedScrollMetricsRef.current = scrollMetrics;
      setIsLoadingEarlierMessages(true);
      setVisibleTranscriptStartIndex((previousVisibleTranscriptStartIndex) =>
        resolveEarlierTranscriptStartIndex(previousVisibleTranscriptStartIndex),
      );
    };
    const handleTranscriptScroll = () => {
      if (pendingPrependedScrollMetricsRef.current || isLoadingEarlierMessages) {
        return;
      }

      if (isTranscriptPointerDragActiveRef.current) {
        pendingTopLoadAfterPointerReleaseRef.current = shouldLoadEarlierTranscriptPage(
          readTranscriptScrollMetrics(messagesEndRef),
          visibleTranscriptStartIndex,
        );
        return;
      }

      requestEarlierTranscriptPage();
    };
    const handleTranscriptPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }

      isTranscriptPointerDragActiveRef.current = true;
      pendingTopLoadAfterPointerReleaseRef.current = false;
    };
    const handleTranscriptPointerRelease = () => {
      if (!isTranscriptPointerDragActiveRef.current) {
        return;
      }

      isTranscriptPointerDragActiveRef.current = false;
      if (!pendingTopLoadAfterPointerReleaseRef.current) {
        return;
      }

      pendingTopLoadAfterPointerReleaseRef.current = false;
      requestEarlierTranscriptPage();
    };

    scrollContainer.addEventListener('scroll', handleTranscriptScroll, { passive: true });
    scrollContainer.addEventListener('pointerdown', handleTranscriptPointerDown, { passive: true });
    window.addEventListener('pointerup', handleTranscriptPointerRelease, true);
    window.addEventListener('pointercancel', handleTranscriptPointerRelease, true);

    return () => {
      isTranscriptPointerDragActiveRef.current = false;
      pendingTopLoadAfterPointerReleaseRef.current = false;
      scrollContainer.removeEventListener('scroll', handleTranscriptScroll);
      scrollContainer.removeEventListener('pointerdown', handleTranscriptPointerDown);
      window.removeEventListener('pointerup', handleTranscriptPointerRelease, true);
      window.removeEventListener('pointercancel', handleTranscriptPointerRelease, true);
    };
  }, [isActive, isLoadingEarlierMessages, messagesEndRef, visibleTranscriptStartIndex]);

  useLayoutEffect(() => {
    if (!isActive) {
      return;
    }

    const pendingPrependedScrollMetrics = pendingPrependedScrollMetricsRef.current;
    if (!pendingPrependedScrollMetrics) {
      return;
    }

    const scrollContainer = resolveTranscriptScrollContainer(messagesEndRef);
    pendingPrependedScrollMetricsRef.current = null;
    if (!scrollContainer) {
      setIsLoadingEarlierMessages(false);
      return;
    }

    const nextScrollTop = computeTranscriptRepairScrollTop(
      pendingPrependedScrollMetrics,
      {
        clientHeight: scrollContainer.clientHeight,
        scrollHeight: scrollContainer.scrollHeight,
        scrollTop: scrollContainer.scrollTop,
      },
    );

    if (Math.abs(scrollContainer.scrollTop - nextScrollTop) > 1) {
      scrollContainer.scrollTop = nextScrollTop;
    }

    setIsLoadingEarlierMessages(false);
  }, [
    isActive,
    messagesEndRef,
    renderedMessages.length,
  ]);

  return {
    hasEarlierMessages: effectiveVisibleTranscriptStartIndex > 0,
    isLoadingEarlierMessages,
    renderedMessages,
    visibleTranscriptStartIndex: effectiveVisibleTranscriptStartIndex,
  };
}
