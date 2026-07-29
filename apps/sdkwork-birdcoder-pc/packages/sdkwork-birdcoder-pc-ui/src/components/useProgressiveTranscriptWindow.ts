import type { AgentSessionItemView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { RefObject } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { TranscriptScrollMetrics } from './chatScrollBehavior';
import {
  isTranscriptWithinTopLoadThreshold,
  resolveEarlierTranscriptStartIndex,
  resolveInitialVisibleTranscriptStartIndex,
  shouldLoadEarlierTranscriptPage,
} from './transcriptPagination';
import type {
  TranscriptPrependTransaction,
  TranscriptScrollCoordinator,
} from './useTranscriptScrollCoordinator';

interface ProgressiveTranscriptWindowState {
  isLoadingEarlierMessages: boolean;
  transcriptIdentity: string;
  visibleTranscriptStartIndex: number;
}

type EarlierTranscriptPageRequestResult = 'blocked' | 'not-at-top' | 'started';

const TRANSCRIPT_INTERACTIVE_DESCENDANT_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[contenteditable="true"]',
  '[role="button"]',
].join(',');

export interface ProgressiveTranscriptRemoteHistory {
  hasMoreMessages: boolean;
  isLoadingMessages: boolean;
  onLoadMoreMessages?: () => void | Promise<void>;
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

function readTranscriptScrollMetrics(
  scrollContainerRef: RefObject<HTMLDivElement | null>,
): TranscriptScrollMetrics | null {
  const scrollContainer = scrollContainerRef.current;
  if (!scrollContainer) {
    return null;
  }

  return {
    clientHeight: scrollContainer.clientHeight,
    scrollHeight: scrollContainer.scrollHeight,
    scrollTop: scrollContainer.scrollTop,
  };
}

function isTranscriptInteractiveDescendant(
  eventTarget: EventTarget | null,
  scrollContainer: HTMLDivElement,
): boolean {
  return eventTarget instanceof Element
    && eventTarget !== scrollContainer
    && eventTarget.closest(TRANSCRIPT_INTERACTIVE_DESCENDANT_SELECTOR) !== null;
}

export function useProgressiveTranscriptWindow(
  messages: readonly AgentSessionItemView[],
  scrollContainerRef: RefObject<HTMLDivElement | null>,
  isActive = true,
  transcriptScopeKey = '',
  remoteHistory?: ProgressiveTranscriptRemoteHistory,
  scrollCoordinator?: Pick<
    TranscriptScrollCoordinator,
    'beginPrepend' | 'cancelPrepend' | 'completePrepend'
  >,
  requestedMessageIndex?: number | null,
) {
  const firstMessageId = messages[0]?.id ?? '';
  const normalizedTranscriptScopeKey = transcriptScopeKey.trim();
  const transcriptIdentity = normalizedTranscriptScopeKey || firstMessageId;
  const pendingPrependTransactionRef = useRef<TranscriptPrependTransaction | null>(null);
  const isTranscriptPointerDragActiveRef = useRef(false);
  const pendingTopLoadIntentRef = useRef(false);
  const pendingTopLoadAfterPointerReleaseRef = useRef(false);
  const pendingTopLoadAfterRemoteRequestRef = useRef(false);
  const topLoadAnimationFrameRef = useRef<number | null>(null);
  const remoteHistoryRef = useRef(remoteHistory);
  const remoteLoadRequestRef = useRef<Promise<void> | null>(null);
  const remoteLoadRequestScopeRef = useRef(transcriptIdentity);
  const handledRemoteTopLoadContinuationVersionRef = useRef(0);
  const pendingRemoteTopLoadAfterLocalExpansionRef = useRef(false);
  const [remoteTopLoadRearmVersion, setRemoteTopLoadRearmVersion] = useState(0);
  const [remoteTopLoadContinuationVersion, setRemoteTopLoadContinuationVersion] = useState(0);
  remoteHistoryRef.current = remoteHistory;
  if (remoteLoadRequestScopeRef.current !== transcriptIdentity) {
    remoteLoadRequestScopeRef.current = transcriptIdentity;
    remoteLoadRequestRef.current = null;
    pendingTopLoadIntentRef.current = false;
    pendingTopLoadAfterRemoteRequestRef.current = false;
    handledRemoteTopLoadContinuationVersionRef.current = remoteTopLoadContinuationVersion;
    pendingRemoteTopLoadAfterLocalExpansionRef.current = false;
  }
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

  useLayoutEffect(() => {
    if (
      !isActive
      || requestedMessageIndex === null
      || requestedMessageIndex === undefined
      || !Number.isInteger(requestedMessageIndex)
      || messages.length === 0
    ) {
      return;
    }

    const targetIndex = Math.max(0, Math.min(messages.length - 1, requestedMessageIndex));
    if (targetIndex >= visibleTranscriptStartIndex) {
      return;
    }

    const pendingPrepend = pendingPrependTransactionRef.current;
    if (pendingPrepend) {
      scrollCoordinator?.cancelPrepend(pendingPrepend);
      pendingPrependTransactionRef.current = null;
    }
    setTranscriptWindowState((previousState) => {
      const activeState = previousState.transcriptIdentity === transcriptIdentity
        ? previousState
        : createProgressiveTranscriptWindowState(transcriptIdentity, messages.length);
      const nextVisibleTranscriptStartIndex = Math.min(
        activeState.visibleTranscriptStartIndex,
        targetIndex,
      );
      if (
        !activeState.isLoadingEarlierMessages
        && nextVisibleTranscriptStartIndex === activeState.visibleTranscriptStartIndex
      ) {
        return previousState;
      }
      return {
        isLoadingEarlierMessages: false,
        transcriptIdentity,
        visibleTranscriptStartIndex: nextVisibleTranscriptStartIndex,
      };
    });
  }, [
    isActive,
    messages.length,
    requestedMessageIndex,
    scrollCoordinator,
    transcriptIdentity,
    visibleTranscriptStartIndex,
  ]);

  useEffect(() => {
    if (
      !isActive
      || remoteHistory?.isLoadingMessages
      || remoteLoadRequestRef.current
      || !pendingTopLoadAfterRemoteRequestRef.current
    ) {
      return;
    }

    setRemoteTopLoadRearmVersion((version) => version + 1);
  }, [isActive, remoteHistory?.isLoadingMessages, transcriptIdentity]);

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
      const pendingPrepend = pendingPrependTransactionRef.current;
      if (pendingPrepend) {
        scrollCoordinator?.cancelPrepend(pendingPrepend);
      }
      pendingPrependTransactionRef.current = null;
      setTranscriptWindowState({
        isLoadingEarlierMessages: false,
        transcriptIdentity,
        visibleTranscriptStartIndex: 0,
      });
      return;
    }

    const maxVisibleTranscriptStartIndex = resolveInitialVisibleTranscriptStartIndex(messages.length);
    if (visibleTranscriptStartIndex > maxVisibleTranscriptStartIndex) {
      const pendingPrepend = pendingPrependTransactionRef.current;
      if (pendingPrepend) {
        scrollCoordinator?.cancelPrepend(pendingPrepend);
      }
      pendingPrependTransactionRef.current = null;
      setTranscriptWindowState({
        isLoadingEarlierMessages: false,
        transcriptIdentity,
        visibleTranscriptStartIndex: maxVisibleTranscriptStartIndex,
      });
    }
  }, [isActive, messages.length, transcriptIdentity, visibleTranscriptStartIndex]);

  useEffect(() => {
    const canLoadRemoteMessages = Boolean(
      remoteHistory?.hasMoreMessages
      && remoteHistory.onLoadMoreMessages,
    );
    if (
      !isActive
      || (visibleTranscriptStartIndex === 0 && !canLoadRemoteMessages)
      || typeof window === 'undefined'
    ) {
      return;
    }

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    const isEarlierPageThresholdReached = () => {
      const scrollMetrics = readTranscriptScrollMetrics(
        scrollContainerRef,
      );
      if (!isTranscriptWithinTopLoadThreshold(scrollMetrics)) {
        return false;
      }

      const currentRemoteHistory = remoteHistoryRef.current;
      return visibleTranscriptStartIndex > 0 || Boolean(
        currentRemoteHistory?.hasMoreMessages
        && currentRemoteHistory.onLoadMoreMessages,
      );
    };
    const requestRemoteMessages = (): EarlierTranscriptPageRequestResult => {
      const currentRemoteHistory = remoteHistoryRef.current;
      if (
        !currentRemoteHistory?.hasMoreMessages
        || !currentRemoteHistory.onLoadMoreMessages
      ) {
        return 'not-at-top';
      }
      if (currentRemoteHistory.isLoadingMessages || remoteLoadRequestRef.current) {
        pendingTopLoadAfterRemoteRequestRef.current = true;
        return 'blocked';
      }

      const requestScope = transcriptIdentity;
      const request = Promise.resolve()
        .then(() => currentRemoteHistory.onLoadMoreMessages?.())
        .catch((error: unknown) => {
          console.error('Failed to load earlier transcript messages', error);
        })
        .finally(() => {
          if (
            remoteLoadRequestScopeRef.current === requestScope
            && remoteLoadRequestRef.current === request
          ) {
            const shouldRearmTopLoad = pendingTopLoadAfterRemoteRequestRef.current;
            remoteLoadRequestRef.current = null;
            if (
              shouldRearmTopLoad
              && !remoteHistoryRef.current?.isLoadingMessages
            ) {
              setRemoteTopLoadRearmVersion((version) => version + 1);
            }
          }
        });
      remoteLoadRequestRef.current = request;
      return 'started';
    };
    const requestEarlierTranscriptPage = (): EarlierTranscriptPageRequestResult => {
      const isRemoteRequestBlocked = Boolean(
        remoteHistoryRef.current?.isLoadingMessages
        || remoteLoadRequestRef.current,
      );
      if (
        pendingPrependTransactionRef.current
        || isLoadingEarlierMessages
        || isRemoteRequestBlocked
      ) {
        if (isRemoteRequestBlocked) {
          pendingTopLoadAfterRemoteRequestRef.current = true;
        }
        return 'blocked';
      }

      const scrollMetrics = readTranscriptScrollMetrics(
        scrollContainerRef,
      );
      if (!isTranscriptWithinTopLoadThreshold(scrollMetrics)) {
        return 'not-at-top';
      }

      if (visibleTranscriptStartIndex === 0) {
        return requestRemoteMessages();
      }

      if (
        !scrollMetrics
        || !shouldLoadEarlierTranscriptPage(scrollMetrics, visibleTranscriptStartIndex)
      ) {
        return 'not-at-top';
      }

      const prependTransaction = scrollCoordinator?.beginPrepend() ?? null;
      if (!prependTransaction) {
        return 'blocked';
      }
      pendingPrependTransactionRef.current = prependTransaction;
      const nextVisibleTranscriptStartIndex = resolveEarlierTranscriptStartIndex(
        visibleTranscriptStartIndex,
      );
      pendingRemoteTopLoadAfterLocalExpansionRef.current = Boolean(
        nextVisibleTranscriptStartIndex === 0
        && remoteHistoryRef.current?.hasMoreMessages
        && remoteHistoryRef.current.onLoadMoreMessages,
      );
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
      return 'started';
    };
    const scheduleEarlierTranscriptPageRequest = () => {
      if (pendingPrependTransactionRef.current || isLoadingEarlierMessages) {
        return;
      }

      if (topLoadAnimationFrameRef.current !== null) {
        return;
      }

      topLoadAnimationFrameRef.current = window.requestAnimationFrame(() => {
        topLoadAnimationFrameRef.current = null;
        if (isTranscriptPointerDragActiveRef.current) {
          pendingTopLoadAfterPointerReleaseRef.current = isEarlierPageThresholdReached();
          return;
        }

        const requestResult = requestEarlierTranscriptPage();
        if (requestResult !== 'blocked') {
          pendingTopLoadIntentRef.current = false;
          pendingTopLoadAfterRemoteRequestRef.current = false;
        }
      });
    };
    const handleTranscriptScroll = () => {
      if (pendingTopLoadIntentRef.current) {
        scheduleEarlierTranscriptPageRequest();
      }
    };
    const markPendingTopLoadIntent = (event?: Event) => {
      if (
        event
        && isTranscriptInteractiveDescendant(event.target, scrollContainer)
      ) {
        return;
      }

      pendingTopLoadIntentRef.current = true;
      if (
        remoteLoadRequestRef.current
        || remoteHistoryRef.current?.isLoadingMessages
      ) {
        pendingTopLoadAfterRemoteRequestRef.current = true;
        return;
      }
      scheduleEarlierTranscriptPageRequest();
    };
    const handleTranscriptKeyDown = (event: KeyboardEvent) => {
      if (isTranscriptInteractiveDescendant(event.target, scrollContainer)) {
        return;
      }

      if (
        event.key === 'ArrowUp'
        || event.key === 'Home'
        || event.key === 'PageUp'
      ) {
        markPendingTopLoadIntent();
      }
    };
    const handleTranscriptPointerDown = (event: PointerEvent) => {
      if (
        isTranscriptInteractiveDescendant(event.target, scrollContainer)
        || (event.pointerType === 'mouse' && event.button !== 0)
      ) {
        return;
      }

      isTranscriptPointerDragActiveRef.current = true;
      pendingTopLoadAfterPointerReleaseRef.current = false;
      markPendingTopLoadIntent();
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
      const requestResult = requestEarlierTranscriptPage();
      if (requestResult !== 'blocked') {
        pendingTopLoadIntentRef.current = false;
        pendingTopLoadAfterRemoteRequestRef.current = false;
      }
    };
    scrollContainer.addEventListener('scroll', handleTranscriptScroll, { passive: true });
    scrollContainer.addEventListener('wheel', markPendingTopLoadIntent, { passive: true });
    scrollContainer.addEventListener('touchstart', markPendingTopLoadIntent, { passive: true });
    scrollContainer.addEventListener('keydown', handleTranscriptKeyDown);
    scrollContainer.addEventListener('pointerdown', handleTranscriptPointerDown, { passive: true });
    window.addEventListener('pointerup', handleTranscriptPointerRelease, true);
    window.addEventListener('pointercancel', handleTranscriptPointerRelease, true);
    if (pendingTopLoadIntentRef.current) {
      scheduleEarlierTranscriptPageRequest();
    }
    if (
      handledRemoteTopLoadContinuationVersionRef.current
      < remoteTopLoadContinuationVersion
    ) {
      handledRemoteTopLoadContinuationVersionRef.current = remoteTopLoadContinuationVersion;
      requestRemoteMessages();
    }

    return () => {
      isTranscriptPointerDragActiveRef.current = false;
      pendingTopLoadAfterPointerReleaseRef.current = false;
      if (topLoadAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(topLoadAnimationFrameRef.current);
        topLoadAnimationFrameRef.current = null;
      }
      scrollContainer.removeEventListener('scroll', handleTranscriptScroll);
      scrollContainer.removeEventListener('wheel', markPendingTopLoadIntent);
      scrollContainer.removeEventListener('touchstart', markPendingTopLoadIntent);
      scrollContainer.removeEventListener('keydown', handleTranscriptKeyDown);
      scrollContainer.removeEventListener('pointerdown', handleTranscriptPointerDown);
      window.removeEventListener('pointerup', handleTranscriptPointerRelease, true);
      window.removeEventListener('pointercancel', handleTranscriptPointerRelease, true);
    };
  }, [
    isActive,
    isLoadingEarlierMessages,
    messages.length,
    scrollContainerRef,
    remoteHistory?.hasMoreMessages,
    remoteTopLoadContinuationVersion,
    remoteTopLoadRearmVersion,
    transcriptIdentity,
    visibleTranscriptStartIndex,
    scrollCoordinator,
  ]);

  useLayoutEffect(() => {
    if (!isActive) {
      return;
    }

    const pendingPrepend = pendingPrependTransactionRef.current;
    if (!pendingPrepend || pendingPrepend.scopeKey !== transcriptIdentity) {
      if (pendingPrepend) {
        scrollCoordinator?.cancelPrepend(pendingPrepend);
        pendingPrependTransactionRef.current = null;
      }
      return;
    }

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      scrollCoordinator?.cancelPrepend(pendingPrepend);
      pendingPrependTransactionRef.current = null;
      setTranscriptWindowState((previousState) => (
        previousState.transcriptIdentity === transcriptIdentity
          ? { ...previousState, isLoadingEarlierMessages: false }
          : previousState
      ));
      return;
    }

    const finishAnchorRepair = () => {
      scrollCoordinator?.completePrepend(pendingPrepend);
      pendingPrependTransactionRef.current = null;
      if (pendingRemoteTopLoadAfterLocalExpansionRef.current) {
        pendingRemoteTopLoadAfterLocalExpansionRef.current = false;
        setRemoteTopLoadContinuationVersion((version) => version + 1);
      }
    };
    finishAnchorRepair();

    setTranscriptWindowState((previousState) => (
      previousState.transcriptIdentity === transcriptIdentity
        ? { ...previousState, isLoadingEarlierMessages: false }
        : previousState
    ));
  }, [
    isActive,
    renderedMessages.length,
    scrollContainerRef,
    scrollCoordinator,
    transcriptIdentity,
  ]);

  useEffect(() => () => {
    const pendingPrepend = pendingPrependTransactionRef.current;
    if (pendingPrepend) {
      scrollCoordinator?.cancelPrepend(pendingPrepend);
    }
    pendingPrependTransactionRef.current = null;
  }, [scrollCoordinator]);

  return {
    hasEarlierMessages: visibleTranscriptStartIndex > 0,
    isLoadingEarlierMessages,
    renderedMessages,
    visibleTranscriptStartIndex,
  };
}
