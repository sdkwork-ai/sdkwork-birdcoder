import type { RefObject } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  CHAT_TRANSCRIPT_USER_SCROLL_SETTLE_MS,
  computeTranscriptBottomScrollTop,
  computeTranscriptRepairScrollTop,
  shouldShowTranscriptJumpToLatest,
  type TranscriptScrollMetrics,
} from './chatScrollBehavior';
import {
  captureTranscriptElementScrollAnchor,
  resolveTranscriptElementAnchorScrollTop,
  type TranscriptElementScrollAnchorSnapshot,
} from './transcriptScrollAnchor';

export const TRANSCRIPT_PREPEND_ANCHOR_SETTLE_MS = 320;

export interface TranscriptPrependTransaction {
  anchor: TranscriptElementScrollAnchorSnapshot | null;
  metrics: TranscriptScrollMetrics;
  scopeKey: string;
  token: number;
}

interface TranscriptScrollOperation {
  anchor?: TranscriptElementScrollAnchorSnapshot | null;
  kind: 'anchor' | 'bottom' | 'offset';
  previousMetrics?: TranscriptScrollMetrics;
  scopeKey: string;
  token?: number;
  top?: number;
}

interface ActiveTranscriptAnchor {
  anchor: TranscriptElementScrollAnchorSnapshot | null;
  expiresAt: number;
  previousMetrics: TranscriptScrollMetrics;
  scopeKey: string;
  token: number;
}

export interface UseTranscriptScrollCoordinatorOptions {
  isActive: boolean;
  latestMessageContentLength: number;
  latestMessageIdentity: string;
  messageCount: number;
  scopeKey: string;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

export interface TranscriptScrollCoordinator {
  beginPrepend: () => TranscriptPrependTransaction | null;
  cancelPrepend: (transaction?: TranscriptPrependTransaction | null) => void;
  completePrepend: (transaction: TranscriptPrependTransaction | null) => void;
  contentRef: RefObject<HTMLDivElement | null>;
  isUserControllingScrollRef: React.MutableRefObject<boolean>;
  jumpToLatest: () => void;
  jumpToLatestVisible: boolean;
  pauseFollowing: () => void;
  requestBottomFollow: () => void;
  scrollToOffset: (top: number) => void;
  shouldStickToBottomRef: React.MutableRefObject<boolean>;
}

interface TranscriptJumpState {
  scopeKey: string;
  visible: boolean;
}

interface TranscriptLayoutSnapshot {
  isActive: boolean;
  latestMessageContentLength: number;
  latestMessageIdentity: string;
  messageCount: number;
  scopeKey: string;
}

const TRANSCRIPT_INTERACTIVE_DESCENDANT_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[contenteditable="true"]',
  '[role="button"]',
].join(',');

function readTranscriptScrollClock(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function readTranscriptMetrics(
  scrollContainer: HTMLDivElement,
): TranscriptScrollMetrics {
  return {
    clientHeight: scrollContainer.clientHeight,
    scrollHeight: scrollContainer.scrollHeight,
    scrollTop: scrollContainer.scrollTop,
  };
}

function resolveOperationPriority(operation: TranscriptScrollOperation): number {
  if (operation.kind === 'offset') return 3;
  if (operation.kind === 'anchor') return 2;
  return 1;
}

export function useTranscriptScrollCoordinator({
  isActive,
  latestMessageContentLength,
  latestMessageIdentity,
  messageCount,
  scopeKey,
  scrollContainerRef,
}: UseTranscriptScrollCoordinatorOptions): TranscriptScrollCoordinator {
  const normalizedScopeKey = scopeKey.trim();
  const contentRef = useRef<HTMLDivElement>(null);
  const currentScopeKeyRef = useRef(normalizedScopeKey);
  const isActiveRef = useRef(isActive);
  const shouldStickToBottomRef = useRef(true);
  const isUserControllingScrollRef = useRef(false);
  const isPointerScrollActiveRef = useRef(false);
  const pendingOperationRef = useRef<TranscriptScrollOperation | null>(null);
  const scrollAnimationFrameRef = useRef<number | null>(null);
  const scrollAnchorReadAnimationFrameRef = useRef<number | null>(null);
  const userScrollSettleTimerRef = useRef<number | null>(null);
  const prependAnchorSettleTimerRef = useRef<number | null>(null);
  const prependTokenRef = useRef(0);
  const activeAnchorRef = useRef<ActiveTranscriptAnchor | null>(null);
  const readingAnchorRef = useRef<TranscriptElementScrollAnchorSnapshot | null>(null);
  const lastLayoutSnapshotRef = useRef<TranscriptLayoutSnapshot | null>(null);
  const lastProgrammaticScrollRef = useRef({
    at: 0,
    top: Number.NaN,
  });
  const [jumpState, setJumpState] = useState<TranscriptJumpState>(() => ({
    scopeKey: normalizedScopeKey,
    visible: false,
  }));

  isActiveRef.current = isActive;

  const publishJumpVisibility = useCallback((visible: boolean) => {
    const activeScopeKey = currentScopeKeyRef.current;
    setJumpState((previousState) => (
      previousState.scopeKey === activeScopeKey
      && previousState.visible === visible
        ? previousState
        : {
            scopeKey: activeScopeKey,
            visible,
          }
    ));
  }, []);

  const clearScrollAnimationFrame = useCallback(() => {
    if (scrollAnimationFrameRef.current === null || typeof window === 'undefined') {
      return;
    }
    window.cancelAnimationFrame(scrollAnimationFrameRef.current);
    scrollAnimationFrameRef.current = null;
  }, []);

  const clearScrollAnchorReadAnimationFrame = useCallback(() => {
    if (
      scrollAnchorReadAnimationFrameRef.current === null
      || typeof window === 'undefined'
    ) {
      return;
    }
    window.cancelAnimationFrame(scrollAnchorReadAnimationFrameRef.current);
    scrollAnchorReadAnimationFrameRef.current = null;
  }, []);

  const clearPrependAnchorTimer = useCallback(() => {
    if (prependAnchorSettleTimerRef.current === null || typeof window === 'undefined') {
      return;
    }
    window.clearTimeout(prependAnchorSettleTimerRef.current);
    prependAnchorSettleTimerRef.current = null;
  }, []);

  const updateReadingAnchor = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    readingAnchorRef.current = scrollContainer
      ? captureTranscriptElementScrollAnchor(scrollContainer)
      : null;
  }, [scrollContainerRef]);

  const updateStickiness = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    const shouldShowJump = shouldShowTranscriptJumpToLatest(
      readTranscriptMetrics(scrollContainer),
    );
    shouldStickToBottomRef.current = !shouldShowJump;
    publishJumpVisibility(shouldShowJump);
  }, [publishJumpVisibility, scrollContainerRef]);

  const flushScheduledAnchorRead = useCallback(() => {
    scrollAnchorReadAnimationFrameRef.current = null;
    if (!isActiveRef.current) {
      return;
    }
    updateReadingAnchor();
  }, [updateReadingAnchor]);

  const scheduleAnchorRead = useCallback(() => {
    if (
      scrollAnchorReadAnimationFrameRef.current !== null
      || typeof window === 'undefined'
    ) {
      return;
    }
    scrollAnchorReadAnimationFrameRef.current = window.requestAnimationFrame(
      flushScheduledAnchorRead,
    );
  }, [flushScheduledAnchorRead]);

  const performScrollOperation = useCallback((operation: TranscriptScrollOperation) => {
    if (
      !isActiveRef.current
      || operation.scopeKey !== currentScopeKeyRef.current
    ) {
      return;
    }

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    const metrics = readTranscriptMetrics(scrollContainer);
    let nextScrollTop: number | null = null;
    if (operation.kind === 'bottom') {
      if (
        !shouldStickToBottomRef.current
        || isUserControllingScrollRef.current
        || activeAnchorRef.current
      ) {
        return;
      }
      nextScrollTop = computeTranscriptBottomScrollTop(metrics);
    } else if (operation.kind === 'offset') {
      nextScrollTop = Math.max(
        0,
        Math.min(
          operation.top ?? 0,
          Math.max(0, metrics.scrollHeight - metrics.clientHeight),
        ),
      );
    } else {
      if (
        operation.token !== undefined
        && operation.token !== prependTokenRef.current
      ) {
        return;
      }
      nextScrollTop = resolveTranscriptElementAnchorScrollTop(
        scrollContainer,
        operation.anchor ?? null,
      );
      if (nextScrollTop === null && operation.previousMetrics) {
        nextScrollTop = computeTranscriptRepairScrollTop(
          operation.previousMetrics,
          metrics,
        );
      }
    }

    if (nextScrollTop === null) {
      return;
    }

    if (Math.abs(scrollContainer.scrollTop - nextScrollTop) > 1) {
      scrollContainer.scrollTop = nextScrollTop;
      lastProgrammaticScrollRef.current = {
        at: readTranscriptScrollClock(),
        top: nextScrollTop,
      };
    }

    if (operation.kind === 'bottom') {
      shouldStickToBottomRef.current = true;
      publishJumpVisibility(false);
      readingAnchorRef.current = null;
      return;
    }

    shouldStickToBottomRef.current = false;
    publishJumpVisibility(shouldShowTranscriptJumpToLatest(
      readTranscriptMetrics(scrollContainer),
    ));
  }, [publishJumpVisibility, scrollContainerRef]);

  const flushScheduledOperation = useCallback(() => {
    scrollAnimationFrameRef.current = null;
    const operation = pendingOperationRef.current;
    pendingOperationRef.current = null;
    if (operation) {
      performScrollOperation(operation);
    }
  }, [performScrollOperation]);

  const scheduleOperation = useCallback((operation: TranscriptScrollOperation) => {
    const pendingOperation = pendingOperationRef.current;
    if (
      !pendingOperation
      || resolveOperationPriority(operation) >= resolveOperationPriority(pendingOperation)
    ) {
      pendingOperationRef.current = operation;
    }

    if (
      scrollAnimationFrameRef.current !== null
      || typeof window === 'undefined'
    ) {
      return;
    }
    scrollAnimationFrameRef.current = window.requestAnimationFrame(flushScheduledOperation);
  }, [flushScheduledOperation]);

  const cancelPrepend = useCallback((transaction?: TranscriptPrependTransaction | null) => {
    if (transaction && transaction.token !== prependTokenRef.current) {
      return;
    }

    prependTokenRef.current += 1;
    activeAnchorRef.current = null;
    clearPrependAnchorTimer();
    if (pendingOperationRef.current?.kind === 'anchor') {
      pendingOperationRef.current = null;
    }
  }, [clearPrependAnchorTimer]);

  const cancelBottomFollow = useCallback(() => {
    if (pendingOperationRef.current?.kind === 'bottom') {
      pendingOperationRef.current = null;
    }
  }, []);

  const pauseFollowing = useCallback(() => {
    cancelBottomFollow();
    shouldStickToBottomRef.current = false;
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      publishJumpVisibility(shouldShowTranscriptJumpToLatest(
        readTranscriptMetrics(scrollContainer),
      ));
      updateReadingAnchor();
    }
  }, [cancelBottomFollow, publishJumpVisibility, scrollContainerRef, updateReadingAnchor]);

  const beginPrepend = useCallback((): TranscriptPrependTransaction | null => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return null;
    }

    cancelPrepend();
    const token = prependTokenRef.current;
    cancelBottomFollow();
    shouldStickToBottomRef.current = false;
    const anchor = captureTranscriptElementScrollAnchor(scrollContainer);
    readingAnchorRef.current = anchor;
    return {
      anchor,
      metrics: readTranscriptMetrics(scrollContainer),
      scopeKey: currentScopeKeyRef.current,
      token,
    };
  }, [cancelBottomFollow, cancelPrepend, scrollContainerRef]);

  const completePrepend = useCallback((transaction: TranscriptPrependTransaction | null) => {
    if (
      !transaction
      || transaction.scopeKey !== currentScopeKeyRef.current
      || transaction.token !== prependTokenRef.current
    ) {
      return;
    }

    const activeAnchor: ActiveTranscriptAnchor = {
      anchor: transaction.anchor,
      expiresAt: readTranscriptScrollClock() + TRANSCRIPT_PREPEND_ANCHOR_SETTLE_MS,
      previousMetrics: transaction.metrics,
      scopeKey: transaction.scopeKey,
      token: transaction.token,
    };
    activeAnchorRef.current = activeAnchor;
    readingAnchorRef.current = transaction.anchor;
    const operation: TranscriptScrollOperation = {
      anchor: transaction.anchor,
      kind: 'anchor',
      previousMetrics: transaction.metrics,
      scopeKey: transaction.scopeKey,
      token: transaction.token,
    };

    clearScrollAnimationFrame();
    pendingOperationRef.current = null;
    performScrollOperation(operation);

    clearPrependAnchorTimer();
    if (typeof window !== 'undefined') {
      prependAnchorSettleTimerRef.current = window.setTimeout(() => {
        prependAnchorSettleTimerRef.current = null;
        if (activeAnchorRef.current?.token === transaction.token) {
          activeAnchorRef.current = null;
          updateReadingAnchor();
        }
      }, TRANSCRIPT_PREPEND_ANCHOR_SETTLE_MS);
    }
  }, [
    clearPrependAnchorTimer,
    clearScrollAnimationFrame,
    performScrollOperation,
    updateReadingAnchor,
  ]);

  const requestBottomFollow = useCallback(() => {
    if (
      !shouldStickToBottomRef.current
      || isUserControllingScrollRef.current
      || activeAnchorRef.current
    ) {
      return;
    }
    scheduleOperation({
      kind: 'bottom',
      scopeKey: currentScopeKeyRef.current,
    });
  }, [scheduleOperation]);

  const jumpToLatest = useCallback(() => {
    if (userScrollSettleTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(userScrollSettleTimerRef.current);
      userScrollSettleTimerRef.current = null;
    }
    isPointerScrollActiveRef.current = false;
    isUserControllingScrollRef.current = false;
    cancelPrepend();
    shouldStickToBottomRef.current = true;
    clearScrollAnimationFrame();
    pendingOperationRef.current = null;
    performScrollOperation({
      kind: 'bottom',
      scopeKey: currentScopeKeyRef.current,
    });
  }, [cancelPrepend, clearScrollAnimationFrame, performScrollOperation]);

  const scrollToOffset = useCallback((top: number) => {
    cancelPrepend();
    pauseFollowing();
    clearScrollAnimationFrame();
    pendingOperationRef.current = null;
    performScrollOperation({
      kind: 'offset',
      scopeKey: currentScopeKeyRef.current,
      top,
    });
    updateReadingAnchor();
  }, [
    cancelPrepend,
    clearScrollAnimationFrame,
    pauseFollowing,
    performScrollOperation,
    updateReadingAnchor,
  ]);

  useLayoutEffect(() => {
    const previousLayoutSnapshot = lastLayoutSnapshotRef.current;
    lastLayoutSnapshotRef.current = {
      isActive,
      latestMessageContentLength,
      latestMessageIdentity,
      messageCount,
      scopeKey: normalizedScopeKey,
    };

    if (!isActive) {
      clearScrollAnimationFrame();
      clearScrollAnchorReadAnimationFrame();
      pendingOperationRef.current = null;
      return;
    }

    const didChangeScope = currentScopeKeyRef.current !== normalizedScopeKey;
    if (didChangeScope) {
      currentScopeKeyRef.current = normalizedScopeKey;
      prependTokenRef.current += 1;
      activeAnchorRef.current = null;
      readingAnchorRef.current = null;
      isUserControllingScrollRef.current = false;
      isPointerScrollActiveRef.current = false;
      shouldStickToBottomRef.current = true;
      clearPrependAnchorTimer();
      clearScrollAnimationFrame();
      clearScrollAnchorReadAnimationFrame();
      pendingOperationRef.current = null;
    }

    if (messageCount === 0) {
      shouldStickToBottomRef.current = true;
      publishJumpVisibility(false);
      return;
    }

    if (
      !shouldStickToBottomRef.current
      || isUserControllingScrollRef.current
      || activeAnchorRef.current
    ) {
      return;
    }

    const requiresImmediateBottomPlacement =
      !previousLayoutSnapshot
      || !previousLayoutSnapshot.isActive
      || didChangeScope
      || previousLayoutSnapshot.scopeKey !== normalizedScopeKey
      || previousLayoutSnapshot.messageCount !== messageCount
      || previousLayoutSnapshot.latestMessageIdentity !== latestMessageIdentity;
    if (requiresImmediateBottomPlacement) {
      clearScrollAnimationFrame();
      pendingOperationRef.current = null;
      performScrollOperation({
        kind: 'bottom',
        scopeKey: normalizedScopeKey,
      });
      return;
    }

    if (
      previousLayoutSnapshot.latestMessageContentLength
      !== latestMessageContentLength
    ) {
      requestBottomFollow();
    }
  }, [
    clearPrependAnchorTimer,
    clearScrollAnchorReadAnimationFrame,
    clearScrollAnimationFrame,
    isActive,
    latestMessageContentLength,
    latestMessageIdentity,
    messageCount,
    normalizedScopeKey,
    performScrollOperation,
    publishJumpVisibility,
    requestBottomFollow,
  ]);

  useEffect(() => {
    if (!isActive || typeof ResizeObserver !== 'function') {
      return undefined;
    }

    const scrollContainer = scrollContainerRef.current;
    const content = contentRef.current;
    if (!scrollContainer || !content) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => {
      if (isUserControllingScrollRef.current) {
        scheduleAnchorRead();
        return;
      }

      const activeAnchor = activeAnchorRef.current;
      if (
        activeAnchor
        && activeAnchor.scopeKey === currentScopeKeyRef.current
        && activeAnchor.expiresAt >= readTranscriptScrollClock()
        && !isUserControllingScrollRef.current
      ) {
        scheduleOperation({
          anchor: activeAnchor.anchor,
          kind: 'anchor',
          previousMetrics: activeAnchor.previousMetrics,
          scopeKey: activeAnchor.scopeKey,
          token: activeAnchor.token,
        });
        return;
      }

      if (
        shouldStickToBottomRef.current
        && !isUserControllingScrollRef.current
      ) {
        requestBottomFollow();
        return;
      }

      if (readingAnchorRef.current) {
        scheduleOperation({
          anchor: readingAnchorRef.current,
          kind: 'anchor',
          scopeKey: currentScopeKeyRef.current,
        });
      }
      updateStickiness();
    });
    resizeObserver.observe(scrollContainer);
    resizeObserver.observe(content);

    return () => {
      resizeObserver.disconnect();
    };
  }, [
    isActive,
    requestBottomFollow,
    scheduleAnchorRead,
    scheduleOperation,
    scrollContainerRef,
    updateStickiness,
  ]);

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return undefined;
    }

    const releaseUserScrollControl = () => {
      userScrollSettleTimerRef.current = null;
      if (isPointerScrollActiveRef.current) {
        userScrollSettleTimerRef.current = window.setTimeout(
          releaseUserScrollControl,
          CHAT_TRANSCRIPT_USER_SCROLL_SETTLE_MS,
        );
        return;
      }

      isUserControllingScrollRef.current = false;
      updateStickiness();
      scheduleAnchorRead();
    };
    const scheduleUserScrollRelease = () => {
      if (userScrollSettleTimerRef.current !== null) {
        window.clearTimeout(userScrollSettleTimerRef.current);
      }
      userScrollSettleTimerRef.current = window.setTimeout(
        releaseUserScrollControl,
        CHAT_TRANSCRIPT_USER_SCROLL_SETTLE_MS,
      );
    };
    const markUserScrollIntent = () => {
      isUserControllingScrollRef.current = true;
      cancelPrepend();
      cancelBottomFollow();
      clearScrollAnimationFrame();
      scheduleUserScrollRelease();
    };
    const handleScroll = () => {
      const lastProgrammaticScroll = lastProgrammaticScrollRef.current;
      if (
        !isUserControllingScrollRef.current
        && readTranscriptScrollClock() - lastProgrammaticScroll.at < 80
        && Math.abs(scrollContainer.scrollTop - lastProgrammaticScroll.top) <= 1
      ) {
        return;
      }
      updateStickiness();
      scheduleAnchorRead();
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.target !== scrollContainer) {
        return;
      }
      if (
        event.target instanceof Element
        && event.target !== scrollContainer
        && event.target.closest(TRANSCRIPT_INTERACTIVE_DESCENDANT_SELECTOR)
      ) {
        return;
      }
      isPointerScrollActiveRef.current = true;
      markUserScrollIntent();
    };
    const handlePointerRelease = () => {
      if (!isPointerScrollActiveRef.current) {
        return;
      }
      isPointerScrollActiveRef.current = false;
      scheduleUserScrollRelease();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof Element
        && event.target !== scrollContainer
        && event.target.closest(TRANSCRIPT_INTERACTIVE_DESCENDANT_SELECTOR)
      ) {
        return;
      }
      if (
        event.key === 'ArrowDown'
        || event.key === 'ArrowUp'
        || event.key === 'End'
        || event.key === 'Home'
        || event.key === 'PageDown'
        || event.key === 'PageUp'
        || event.key === ' '
      ) {
        markUserScrollIntent();
      }
    };

    updateStickiness();
    updateReadingAnchor();
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    scrollContainer.addEventListener('wheel', markUserScrollIntent, { passive: true });
    scrollContainer.addEventListener('touchstart', markUserScrollIntent, { passive: true });
    scrollContainer.addEventListener('touchmove', markUserScrollIntent, { passive: true });
    scrollContainer.addEventListener('pointerdown', handlePointerDown, { passive: true });
    scrollContainer.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerup', handlePointerRelease, { passive: true });
    window.addEventListener('pointercancel', handlePointerRelease, { passive: true });

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      scrollContainer.removeEventListener('wheel', markUserScrollIntent);
      scrollContainer.removeEventListener('touchstart', markUserScrollIntent);
      scrollContainer.removeEventListener('touchmove', markUserScrollIntent);
      scrollContainer.removeEventListener('pointerdown', handlePointerDown);
      scrollContainer.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerup', handlePointerRelease);
      window.removeEventListener('pointercancel', handlePointerRelease);
      if (userScrollSettleTimerRef.current !== null) {
        window.clearTimeout(userScrollSettleTimerRef.current);
        userScrollSettleTimerRef.current = null;
      }
      isUserControllingScrollRef.current = false;
      isPointerScrollActiveRef.current = false;
    };
  }, [
    cancelBottomFollow,
    cancelPrepend,
    clearScrollAnimationFrame,
    isActive,
    normalizedScopeKey,
    scheduleAnchorRead,
    scrollContainerRef,
    updateReadingAnchor,
    updateStickiness,
  ]);

  useEffect(() => () => {
    clearScrollAnimationFrame();
    clearScrollAnchorReadAnimationFrame();
    clearPrependAnchorTimer();
    if (userScrollSettleTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(userScrollSettleTimerRef.current);
      userScrollSettleTimerRef.current = null;
    }
  }, [
    clearPrependAnchorTimer,
    clearScrollAnchorReadAnimationFrame,
    clearScrollAnimationFrame,
  ]);

  return {
    beginPrepend,
    cancelPrepend,
    completePrepend,
    contentRef,
    isUserControllingScrollRef,
    jumpToLatest,
    jumpToLatestVisible:
      isActive
      && jumpState.scopeKey === normalizedScopeKey
      && jumpState.visible,
    pauseFollowing,
    requestBottomFollow,
    scrollToOffset,
    shouldStickToBottomRef,
  };
}
