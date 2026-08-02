/**
 * Shared polling tick scheduler.
 *
 * Multiple session surfaces poll independently (selected-session refresh,
 * workspace inbox sync, pending interactions). Independent `setInterval`s
 * fire at the same wall-clock phase, so every 15s boundary issues a burst of
 * requests. This module shares ONE coarse tick and lets each subscriber
 * advance on its own schedule with a random phase offset (jitter), which
 * spreads the requests across the window instead of aligning them (M1).
 */

export interface PollingSubscription {
  dispose: () => void;
}

const TICK_MS = 1_000;

const tickListeners = new Set<() => void>();
let sharedTickHandle: number | null = null;

function ensureSharedTick(): void {
  if (sharedTickHandle === null) {
    sharedTickHandle = window.setInterval(() => {
      for (const listener of tickListeners) {
        listener();
      }
    }, TICK_MS);
  }
}

function releaseSharedTickIfIdle(): void {
  if (tickListeners.size > 0 || sharedTickHandle === null) {
    return;
  }
  window.clearInterval(sharedTickHandle);
  sharedTickHandle = null;
}

/**
 * Subscribes `listener` to the shared tick, firing at most once per
 * `intervalMs`. The first fire is delayed by up to `jitterMs` (random) so
 * subscribers do not align on the same wall-clock phase.
 */
export function schedulePollingTick(
  listener: () => void,
  intervalMs: number,
  jitterMs = 0,
): PollingSubscription {
  let nextAt = Date.now() + (jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0);
  const wrapped = () => {
    const now = Date.now();
    if (now < nextAt) {
      return;
    }
    nextAt = now + intervalMs;
    listener();
  };
  tickListeners.add(wrapped);
  ensureSharedTick();
  return {
    dispose: () => {
      tickListeners.delete(wrapped);
      releaseSharedTickIfIdle();
    },
  };
}
