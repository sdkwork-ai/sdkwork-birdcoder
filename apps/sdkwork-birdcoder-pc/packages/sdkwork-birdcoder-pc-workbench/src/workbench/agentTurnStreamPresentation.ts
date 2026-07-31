const DEFAULT_FALLBACK_INTERVAL_MS = 16;
const DEFAULT_TARGET_CHARACTERS_PER_FRAME = 24;
const DEFAULT_MAX_DRAIN_FRAMES = 8;

type ScheduledHandle = unknown;

export interface AgentTurnStreamPresentationOptions {
  cancelAnimationFrame?: (handle: ScheduledHandle) => void;
  canUseAnimationFrame?: () => boolean;
  fallbackIntervalMs?: number;
  maxDrainFrames?: number;
  requestAnimationFrame?: (callback: () => void) => ScheduledHandle;
  targetCharactersPerFrame?: number;
}

export interface AgentTurnStreamPresentation {
  close: () => void;
  drain: () => Promise<void>;
  update: (content: string) => void;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value !== undefined
    ? Math.max(1, Math.floor(value))
    : fallback;
}

function canUseBrowserAnimationFrame(): boolean {
  if (
    typeof window === 'undefined'
    || typeof window.requestAnimationFrame !== 'function'
  ) {
    return false;
  }
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

/**
 * Smooths cumulative assistant text using the same frame budget as Codex Desktop.
 * The provider result remains authoritative; this object only owns transient pacing.
 */
export function createAgentTurnStreamPresentation(
  present: (content: string) => void,
  options: AgentTurnStreamPresentationOptions = {},
): AgentTurnStreamPresentation {
  const fallbackIntervalMs = normalizePositiveInteger(
    options.fallbackIntervalMs,
    DEFAULT_FALLBACK_INTERVAL_MS,
  );
  const targetCharactersPerFrame = normalizePositiveInteger(
    options.targetCharactersPerFrame,
    DEFAULT_TARGET_CHARACTERS_PER_FRAME,
  );
  const maxDrainFrames = normalizePositiveInteger(
    options.maxDrainFrames,
    DEFAULT_MAX_DRAIN_FRAMES,
  );
  const requestFrame = options.requestAnimationFrame
    ?? ((callback: () => void) => window.requestAnimationFrame(() => callback()));
  const cancelFrame = options.cancelAnimationFrame
    ?? ((handle: ScheduledHandle) => window.cancelAnimationFrame(handle as number));
  const canUseAnimationFrame = () => options.canUseAnimationFrame?.()
    ?? (options.requestAnimationFrame !== undefined || canUseBrowserAnimationFrame());

  let active = true;
  let presentedContent = '';
  let targetContent = '';
  let scheduledHandle: ScheduledHandle | undefined;
  let scheduledWithAnimationFrame = false;
  let drainFramesRemaining: number | null = null;
  let drainWatchdogHandle: ReturnType<typeof setTimeout> | undefined;
  const drainResolvers: Array<() => void> = [];

  const safelyPresent = (content: string) => {
    try {
      present(content);
    } catch {
      // Presentation failures cannot change the result of an accepted turn command.
    }
  };

  const finishDrain = () => {
    drainFramesRemaining = null;
    if (drainWatchdogHandle !== undefined) {
      clearTimeout(drainWatchdogHandle);
      drainWatchdogHandle = undefined;
    }
    const resolvers = drainResolvers.splice(0);
    for (const resolve of resolvers) {
      resolve();
    }
  };

  const cancelScheduledFlush = () => {
    if (scheduledHandle === undefined) {
      return;
    }
    if (scheduledWithAnimationFrame) {
      cancelFrame(scheduledHandle);
    } else {
      clearTimeout(scheduledHandle as ReturnType<typeof setTimeout>);
    }
    scheduledHandle = undefined;
    scheduledWithAnimationFrame = false;
  };

  const flushNow = () => {
    cancelScheduledFlush();
    if (active && targetContent !== presentedContent) {
      presentedContent = targetContent;
      safelyPresent(presentedContent);
    }
    finishDrain();
  };

  let scheduleFlush: () => void;
  const flushFrame = () => {
    if (!active || targetContent === presentedContent) {
      finishDrain();
      return;
    }

    if (!targetContent.startsWith(presentedContent)) {
      presentedContent = '';
    }
    const remainingCharacters = targetContent.length - presentedContent.length;
    const frameCharacters = drainFramesRemaining === null
      ? targetCharactersPerFrame
      : Math.max(
          targetCharactersPerFrame,
          Math.ceil(remainingCharacters / Math.max(1, drainFramesRemaining)),
        );
    presentedContent = targetContent.slice(
      0,
      presentedContent.length + frameCharacters,
    );
    safelyPresent(presentedContent);

    if (drainFramesRemaining !== null) {
      drainFramesRemaining -= 1;
    }
    if (targetContent !== presentedContent) {
      scheduleFlush();
    } else {
      finishDrain();
    }
  };

  scheduleFlush = () => {
    if (!active || scheduledHandle !== undefined || targetContent === presentedContent) {
      return;
    }
    const useAnimationFrame = canUseAnimationFrame();
    if (useAnimationFrame) {
      scheduledWithAnimationFrame = true;
      scheduledHandle = requestFrame(() => {
        scheduledHandle = undefined;
        scheduledWithAnimationFrame = false;
        flushFrame();
      });
      return;
    }
    scheduledWithAnimationFrame = false;
    scheduledHandle = setTimeout(() => {
      scheduledHandle = undefined;
      flushNow();
    }, fallbackIntervalMs);
  };

  return {
    close() {
      if (!active) {
        return;
      }
      flushNow();
      active = false;
    },
    drain() {
      if (!active || targetContent === presentedContent) {
        return Promise.resolve();
      }
      const pendingCharacters = Math.max(
        0,
        targetContent.length - presentedContent.length,
      );
      const useAnimationFrame = canUseAnimationFrame();
      if (!useAnimationFrame || pendingCharacters <= targetCharactersPerFrame) {
        flushNow();
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        drainResolvers.push(resolve);
        drainFramesRemaining ??= maxDrainFrames;
        drainWatchdogHandle ??= setTimeout(
          flushNow,
          fallbackIntervalMs * maxDrainFrames,
        );
        scheduleFlush();
      });
    },
    update(content) {
      if (!active || content === targetContent) {
        return;
      }
      targetContent = content;
      scheduleFlush();
    },
  };
}
