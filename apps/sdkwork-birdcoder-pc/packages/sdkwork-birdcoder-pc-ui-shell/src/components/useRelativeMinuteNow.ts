import { useCallback, useSyncExternalStore } from 'react';

const RELATIVE_MINUTE_TICK_INTERVAL_MS = 60 * 1000;

type RelativeMinuteNowListener = () => void;
type UseRelativeMinuteNowOptions = {
  isEnabled?: boolean;
};

const relativeMinuteNowListeners = new Set<RelativeMinuteNowListener>();
let relativeMinuteNowValue = Date.now();
let relativeMinuteNowTimer: number | null = null;
let isRelativeMinuteNowVisibilityListenerRegistered = false;

function emitRelativeMinuteNow(): void {
  relativeMinuteNowListeners.forEach((listener) => {
    listener();
  });
}

function resolveRelativeMinuteNowDelay(now: number): number {
  const normalizedNow = Number.isFinite(now) ? Math.max(0, now) : Date.now();
  const offsetWithinMinute = normalizedNow % RELATIVE_MINUTE_TICK_INTERVAL_MS;
  return offsetWithinMinute === 0
    ? RELATIVE_MINUTE_TICK_INTERVAL_MS
    : RELATIVE_MINUTE_TICK_INTERVAL_MS - offsetWithinMinute;
}

function disposeRelativeMinuteNowTimer(): void {
  if (relativeMinuteNowTimer === null || typeof window === 'undefined') {
    return;
  }

  window.clearTimeout(relativeMinuteNowTimer);
  relativeMinuteNowTimer = null;
}

function scheduleRelativeMinuteNow(): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    disposeRelativeMinuteNowTimer();
    return;
  }

  disposeRelativeMinuteNowTimer();
  relativeMinuteNowValue = Date.now();
  emitRelativeMinuteNow();

  if (relativeMinuteNowListeners.size === 0) {
    return;
  }

  relativeMinuteNowTimer = window.setTimeout(() => {
    relativeMinuteNowTimer = null;
    scheduleRelativeMinuteNow();
  }, resolveRelativeMinuteNowDelay(relativeMinuteNowValue));
}

function handleRelativeMinuteNowVisibilityChange(): void {
  if (typeof document === 'undefined') {
    return;
  }

  if (document.visibilityState === 'hidden') {
    disposeRelativeMinuteNowTimer();
    return;
  }

  if (relativeMinuteNowListeners.size === 0) {
    return;
  }

  scheduleRelativeMinuteNow();
}

function ensureRelativeMinuteNowVisibilityListener(): void {
  if (typeof document === 'undefined' || isRelativeMinuteNowVisibilityListenerRegistered) {
    return;
  }

  document.addEventListener('visibilitychange', handleRelativeMinuteNowVisibilityChange);
  isRelativeMinuteNowVisibilityListenerRegistered = true;
}

function disposeRelativeMinuteNowVisibilityListener(): void {
  if (typeof document === 'undefined' || !isRelativeMinuteNowVisibilityListenerRegistered) {
    return;
  }

  document.removeEventListener('visibilitychange', handleRelativeMinuteNowVisibilityChange);
  isRelativeMinuteNowVisibilityListenerRegistered = false;
}

function subscribeRelativeMinuteNow(listener: RelativeMinuteNowListener): () => void {
  const shouldStartRelativeMinuteNow = relativeMinuteNowListeners.size === 0;
  relativeMinuteNowListeners.add(listener);
  ensureRelativeMinuteNowVisibilityListener();
  if (shouldStartRelativeMinuteNow || relativeMinuteNowTimer === null) {
    scheduleRelativeMinuteNow();
  }

  return () => {
    relativeMinuteNowListeners.delete(listener);
    if (relativeMinuteNowListeners.size === 0) {
      disposeRelativeMinuteNowTimer();
      disposeRelativeMinuteNowVisibilityListener();
    }
  };
}

function getRelativeMinuteNowSnapshot(): number {
  return relativeMinuteNowValue;
}

export function useRelativeMinuteNow(options: UseRelativeMinuteNowOptions = {}): number {
  const { isEnabled = true } = options;
  const subscribe = useCallback(
    (listener: RelativeMinuteNowListener) => {
      if (!isEnabled) {
        return () => undefined;
      }

      return subscribeRelativeMinuteNow(listener);
    },
    [isEnabled],
  );

  return useSyncExternalStore(
    subscribe,
    getRelativeMinuteNowSnapshot,
    getRelativeMinuteNowSnapshot,
  );
}
