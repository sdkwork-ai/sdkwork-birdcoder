import {
  MAX_MULTI_WINDOW_PANES,
  normalizeMultiWindowActiveWindowCount,
} from './multiWindowLayout.ts';

export interface MultiWindowPendingAddProgress {
  currentWindowNumber: number;
  remainingWindowCount: number;
  targetWindowCount: number;
}

interface BuildMultiWindowPendingAddProgressOptions {
  paneIndex: number;
  pendingWindowCountTarget: number | null | undefined;
  windowCount: number;
}

export function resolveNextMultiWindowAddWindowCount(windowCount: number): number {
  const normalizedWindowCount = normalizeMultiWindowActiveWindowCount(windowCount);
  if (normalizedWindowCount >= MAX_MULTI_WINDOW_PANES) {
    return normalizedWindowCount;
  }

  return normalizeMultiWindowActiveWindowCount(normalizedWindowCount + 1);
}

export function buildMultiWindowPendingAddProgress({
  paneIndex,
  pendingWindowCountTarget,
  windowCount,
}: BuildMultiWindowPendingAddProgressOptions): MultiWindowPendingAddProgress | null {
  if (
    typeof pendingWindowCountTarget !== 'number' ||
    !Number.isFinite(pendingWindowCountTarget) ||
    !Number.isInteger(paneIndex)
  ) {
    return null;
  }

  const normalizedWindowCount = normalizeMultiWindowActiveWindowCount(windowCount);
  const targetWindowCount = normalizeMultiWindowActiveWindowCount(pendingWindowCountTarget);
  if (
    paneIndex < normalizedWindowCount ||
    paneIndex < 0 ||
    paneIndex >= MAX_MULTI_WINDOW_PANES ||
    targetWindowCount <= normalizedWindowCount
  ) {
    return null;
  }

  const currentWindowNumber = paneIndex + 1;
  if (currentWindowNumber > targetWindowCount) {
    return null;
  }

  return {
    currentWindowNumber,
    remainingWindowCount: Math.max(0, targetWindowCount - currentWindowNumber),
    targetWindowCount,
  };
}
