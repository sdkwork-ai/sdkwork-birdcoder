import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
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

interface ProgressiveTranscriptWindowState {
  isLoadingEarlierMessages: boolean;
  transcriptIdentity: string;
  visibleTranscriptStartIndex: number;
}

function createProgressiveTranscriptWindowState(
  transcriptIdentity: string,
  messageCount: number,
): ProgressiveTranscriptWindowState {
  return {
    isLoadingEarlierMessages: false,
    transcriptIdentity,
    visibleTranscriptStartIndex: resolveInitialVisibleTranscriptStartIndex(messageCount),
  };
}

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
  messages: readonly AgentSessionItemView[],
  messagesEndRef: RefObject<HTMLDivElement | null>,
  isActive = true,
  transcriptScopeKey = '',
) {
  const firstMessageId = messages[0]?.id ?? '';
  const normalizedTranscriptScopeKey = transcriptScopeKey.trim();
  const transcriptIdentity = normalizedTranscriptScopeKey || firstMessageId;
  const pendingPrependedScrollMetricsRef = useRef<{
    metrics: TranscriptScrollMetrics;
    transcriptIdentity: string;
  } | null>(null);
  const isTranscriptPointerDragActiveRef = useRef(false);
  const pendingTopLoadAfterPointerReleaseRef = useRef(false);
  const topLoadAnimationFrameRef = useRef<number | null>(null);
  const [transcriptWindowState, setTranscriptWindowState] =
    useState<ProgressiveTranscriptWindowState>(() =>
      createProgressiveTranscriptWindowState(transcriptIdentity, messages.length),
    );
  const currentTranscriptWindowState =
    transcriptWindowState.transcriptIdentity === transcriptIdentity
      ? transcriptWindowState
      : createProgressiveTranscriptWindowState(transcriptIdentity, messages.length);
  const {
    isLoadingEarlierMessages,
    visibleTranscriptStartIndex,
  } = currentTranscriptWindowState;

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

    if (messages.length === 0 && visibleTranscriptStartIndex !== 0) {
      pendingPrependedScrollMetricsRef.current = null;
      setTranscriptWindowState({
        isLoadingEarlierMessages: false,
        transcriptIdentity,
        visibleTranscriptStartIndex: 0,
      });
      return;
    }

    const maxVisibleTranscriptStartIndex = resolveInitialVisibleTranscriptStartIndex(messages.length);
    if (visibleTranscriptStartIndex > maxVisibleTranscriptStartIndex) {
      pendingPrependedScrollMetricsRef.current = null;
      setTranscriptWindowState({
        isLoadingEarlierMessages: false,
        transcriptIdentity,
        visibleTranscriptStartIndex: maxVisibleTranscriptStartIndex,
      });
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

      pendingPrependedScrollMetricsRef.current = {
        metrics: scrollMetrics,
        transcriptIdentity,
      };
      setTranscriptWindowState((previousState) => {
        const activeState = previousState.transcriptIdentity === transcriptIdentity
          ? previousState
          : createProgressiveTranscriptWindowState(transcriptIdentity, messages.length);
        return {
          ...activeState,
          isLoadingEarlierMessages: true,
          visibleTranscriptStartIndex: resolveEarlierTranscriptStartIndex(
            activeState.visibleTranscriptStartIndex,
          ),
        };
      });
    };
    const scheduleEarlierTranscriptPageRequest = () => {
      if (pendingPrependedScrollMetricsRef.current || isLoadingEarlierMessages) {
        return;
      }

      if (topLoadAnimationFrameRef.current !== null) {
        return;
      }

      topLoadAnimationFrameRef.current = window.requestAnimationFrame(() => {
        topLoadAnimationFrameRef.current = null;
        if (isTranscriptPointerDragActiveRef.current) {
          pendingTopLoadAfterPointerReleaseRef.current = shouldLoadEarlierTranscriptPage(
            readTranscriptScrollMetrics(messagesEndRef),
            visibleTranscriptStartIndex,
          );
          return;
        }

        requestEarlierTranscriptPage();
      });
    };
    const handleTranscriptScroll = () => {
      scheduleEarlierTranscriptPageRequest();
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
      if (topLoadAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(topLoadAnimationFrameRef.current);
        topLoadAnimationFrameRef.current = null;
      }
      requestEarlierTranscriptPage();
    };

    scrollContainer.addEventListener('scroll', handleTranscriptScroll, { passive: true });
    scrollContainer.addEventListener('pointerdown', handleTranscriptPointerDown, { passive: true });
    window.addEventListener('pointerup', handleTranscriptPointerRelease, true);
    window.addEventListener('pointercancel', handleTranscriptPointerRelease, true);

    return () => {
      isTranscriptPointerDragActiveRef.current = false;
      pendingTopLoadAfterPointerReleaseRef.current = false;
      if (topLoadAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(topLoadAnimationFrameRef.current);
        topLoadAnimationFrameRef.current = null;
      }
      scrollContainer.removeEventListener('scroll', handleTranscriptScroll);
      scrollContainer.removeEventListener('pointerdown', handleTranscriptPointerDown);
      window.removeEventListener('pointerup', handleTranscriptPointerRelease, true);
      window.removeEventListener('pointercancel', handleTranscriptPointerRelease, true);
    };
  }, [
    isActive,
    isLoadingEarlierMessages,
    messages.length,
    messagesEndRef,
    transcriptIdentity,
    visibleTranscriptStartIndex,
  ]);

  useLayoutEffect(() => {
    if (!isActive) {
      return;
    }

    const pendingPrepend = pendingPrependedScrollMetricsRef.current;
    if (!pendingPrepend || pendingPrepend.transcriptIdentity !== transcriptIdentity) {
      if (pendingPrepend) {
        pendingPrependedScrollMetricsRef.current = null;
      }
      return;
    }

    const scrollContainer = resolveTranscriptScrollContainer(messagesEndRef);
    pendingPrependedScrollMetricsRef.current = null;
    if (!scrollContainer) {
      setTranscriptWindowState((previousState) => (
        previousState.transcriptIdentity === transcriptIdentity
          ? { ...previousState, isLoadingEarlierMessages: false }
          : previousState
      ));
      return;
    }

    const nextScrollTop = computeTranscriptRepairScrollTop(
      pendingPrepend.metrics,
      {
        clientHeight: scrollContainer.clientHeight,
        scrollHeight: scrollContainer.scrollHeight,
        scrollTop: scrollContainer.scrollTop,
      },
    );

    if (Math.abs(scrollContainer.scrollTop - nextScrollTop) > 1) {
      scrollContainer.scrollTop = nextScrollTop;
    }

    setTranscriptWindowState((previousState) => (
      previousState.transcriptIdentity === transcriptIdentity
        ? { ...previousState, isLoadingEarlierMessages: false }
        : previousState
    ));
  }, [
    isActive,
    messagesEndRef,
    renderedMessages.length,
    transcriptIdentity,
  ]);

  return {
    hasEarlierMessages: visibleTranscriptStartIndex > 0,
    isLoadingEarlierMessages,
    renderedMessages,
    visibleTranscriptStartIndex,
  };
}
