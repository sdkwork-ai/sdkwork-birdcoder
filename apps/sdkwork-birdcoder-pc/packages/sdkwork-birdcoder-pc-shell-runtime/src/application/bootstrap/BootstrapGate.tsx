import { useEffect, useRef, useState, type ReactNode } from 'react';

type BootstrapStatus = 'booting' | 'failed' | 'ready';
const DEFAULT_BOOTSTRAP_TIMEOUT_MS = 30_000;
const BOOTSTRAP_IDLE_START_TIMEOUT_MS = 250;

export interface BootstrapGateMessages {
  bootingDescription: string;
  retry: string;
  startingTitle: string;
  startupFailed: string;
  startupTimeout: (seconds: number) => string;
  unknownFailure: string;
}

export interface BootstrapGateProps {
  bootstrap: () => Promise<void>;
  bootstrapTimeoutMs?: number;
  children: ReactNode;
  messages: BootstrapGateMessages;
}

interface DeferredBootstrapStart {
  cancel: () => void;
}

interface BootstrapIdleDeadline {
  didTimeout: boolean;
  timeRemaining: () => number;
}

type BootstrapIdleCallback = (deadline: BootstrapIdleDeadline) => void;
type BootstrapRequestIdleCallback = (
  callback: BootstrapIdleCallback,
  options?: {
    timeout?: number;
  },
) => number;
type BootstrapCancelIdleCallback = (handle: number) => void;
type BootstrapSchedulingGlobal = typeof globalThis & {
  cancelIdleCallback?: BootstrapCancelIdleCallback;
  requestIdleCallback?: BootstrapRequestIdleCallback;
};

const BOOTSTRAP_TIMEOUT_ERROR = 'BIRDCODER_BOOTSTRAP_TIMEOUT';
const BOOTSTRAP_UNKNOWN_ERROR = 'BIRDCODER_BOOTSTRAP_UNKNOWN';

function normalizeBootstrapError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(BOOTSTRAP_UNKNOWN_ERROR);
}

function normalizeBootstrapTimeoutMs(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : DEFAULT_BOOTSTRAP_TIMEOUT_MS;
}

function createBootstrapTimeoutPromise(timeoutMs: number): {
  clear: () => void;
  promise: Promise<never>;
} {
  let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | null = null;
  const promise = new Promise<never>((_, reject) => {
    timeoutHandle = globalThis.setTimeout(() => {
      reject(new Error(BOOTSTRAP_TIMEOUT_ERROR));
    }, timeoutMs);
  });

  return {
    clear: () => {
      if (timeoutHandle === null) {
        return;
      }

      globalThis.clearTimeout(timeoutHandle);
      timeoutHandle = null;
    },
    promise,
  };
}

function scheduleBootstrapStart(callback: () => void): DeferredBootstrapStart {
  const schedulingGlobal = globalThis as BootstrapSchedulingGlobal;
  const requestIdleCallback = schedulingGlobal.requestIdleCallback;
  const cancelIdleCallback = schedulingGlobal.cancelIdleCallback;

  if (typeof requestIdleCallback === 'function' && typeof cancelIdleCallback === 'function') {
    const idleCallbackHandle = requestIdleCallback(callback, {
      timeout: BOOTSTRAP_IDLE_START_TIMEOUT_MS,
    });

    return {
      cancel: () => {
        cancelIdleCallback(idleCallbackHandle);
      },
    };
  }

  const timeoutHandle = globalThis.setTimeout(callback, 0);
  return {
    cancel: () => {
      globalThis.clearTimeout(timeoutHandle);
    },
  };
}

export function BootstrapGate({
  bootstrap,
  bootstrapTimeoutMs = DEFAULT_BOOTSTRAP_TIMEOUT_MS,
  children,
  messages,
}: BootstrapGateProps) {
  const bootstrapRef = useRef(bootstrap);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<BootstrapStatus>('booting');
  const timeoutSeconds = Math.ceil(normalizeBootstrapTimeoutMs(bootstrapTimeoutMs) / 1000);

  const resolveErrorMessage = (bootstrapError: Error) => {
    if (bootstrapError.message === BOOTSTRAP_TIMEOUT_ERROR) {
      return messages.startupTimeout(timeoutSeconds);
    }

    if (bootstrapError.message === BOOTSTRAP_UNKNOWN_ERROR) {
      return messages.unknownFailure;
    }

    return bootstrapError.message;
  };

  useEffect(() => {
    bootstrapRef.current = bootstrap;
  }, [bootstrap]);

  useEffect(() => {
    let isDisposed = false;
    let hasBootstrapSettled = false;
    let bootstrapStart: DeferredBootstrapStart | null = null;

    setError(null);
    setStatus('booting');

    const timeoutBoundary = createBootstrapTimeoutPromise(
      normalizeBootstrapTimeoutMs(bootstrapTimeoutMs),
    );

    const deferredBootstrapPromise = new Promise<void>((resolve, reject) => {
      bootstrapStart = scheduleBootstrapStart(() => {
        if (isDisposed || hasBootstrapSettled) {
          resolve();
          return;
        }

        bootstrapRef.current().then(resolve, reject);
      });
    });

    void Promise.race([
      deferredBootstrapPromise,
      timeoutBoundary.promise,
    ])
      .then(() => {
        hasBootstrapSettled = true;
        if (!isDisposed) {
          setStatus('ready');
        }
      })
      .catch((caughtError) => {
        hasBootstrapSettled = true;
        bootstrapStart?.cancel();
        if (!isDisposed) {
          setError(normalizeBootstrapError(caughtError));
          setStatus('failed');
        }
      })
      .finally(() => {
        timeoutBoundary.clear();
      });

    return () => {
      isDisposed = true;
      bootstrapStart?.cancel();
      timeoutBoundary.clear();
    };
  }, [attempt, bootstrapTimeoutMs]);

  if (status === 'ready') {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0e0e11] px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#18181b] p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-white/80" />
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">{messages.startingTitle}</div>
            <div className="mt-1 text-sm text-gray-400">
              {status === 'failed'
                ? messages.startupFailed
                : messages.bootingDescription}
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error ? resolveErrorMessage(error) : null}
          </div>
        ) : null}

        {status === 'failed' ? (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-gray-200"
              onClick={() => setAttempt((previousAttempt) => previousAttempt + 1)}
            >
              {messages.retry}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
