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
) {
  const firstMessageId = messages[0]?.id ?? '';
  const previousTranscriptFirstMessageIdRef = useRef(firstMessageId);
  const pendingPrependedScrollMetricsRef = useRef<TranscriptScrollMetrics | null>(null);
  const [visibleTranscriptStartIndex, setVisibleTranscriptStartIndex] = useState(() =>
    resolveInitialVisibleTranscriptStartIndex(messages.length),
  );
  const [isLoadingEarlierMessages, setIsLoadingEarlierMessages] = useState(false);

  const renderedMessages = useMemo(() => {
    if (visibleTranscriptStartIndex === 0) {
      return messages;
    }

    return messages.slice(visibleTranscriptStartIndex);
  }, [messages, visibleTranscriptStartIndex]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const didTranscriptChange = previousTranscriptFirstMessageIdRef.current !== firstMessageId;
    if (didTranscriptChange) {
      previousTranscriptFirstMessageIdRef.current = firstMessageId;
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
  }, [firstMessageId, isActive, messages.length, visibleTranscriptStartIndex]);

  useEffect(() => {
    if (!isActive || visibleTranscriptStartIndex === 0 || typeof window === 'undefined') {
      return;
    }

    const scrollContainer = resolveTranscriptScrollContainer(messagesEndRef);
    if (!scrollContainer) {
      return;
    }

    const handleTranscriptScroll = () => {
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

    scrollContainer.addEventListener('scroll', handleTranscriptScroll, { passive: true });

    return () => {
      scrollContainer.removeEventListener('scroll', handleTranscriptScroll);
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
    hasEarlierMessages: visibleTranscriptStartIndex > 0,
    isLoadingEarlierMessages,
    renderedMessages,
    visibleTranscriptStartIndex,
  };
}
