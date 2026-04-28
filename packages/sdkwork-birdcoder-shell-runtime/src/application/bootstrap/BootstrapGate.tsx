import { useEffect, useRef, useState, type ReactNode } from 'react';

type BootstrapStatus = 'booting' | 'failed' | 'ready';
const DEFAULT_BOOTSTRAP_TIMEOUT_MS = 30_000;

export interface BootstrapGateProps {
  bootstrap: () => Promise<void>;
  bootstrapTimeoutMs?: number;
  bootingDescription?: string;
  children: ReactNode;
  title?: string;
}

function normalizeBootstrapError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === 'string' ? error : 'Unknown bootstrap failure');
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
      reject(new Error(`Startup did not complete within ${Math.ceil(timeoutMs / 1000)} seconds.`));
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

export function BootstrapGate({
  bootstrap,
  bootstrapTimeoutMs = DEFAULT_BOOTSTRAP_TIMEOUT_MS,
  bootingDescription = 'Preparing the local runtime and loading the application shell.',
  children,
  title = 'Starting SDKWork BirdCoder',
}: BootstrapGateProps) {
  const bootstrapRef = useRef(bootstrap);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<BootstrapStatus>('booting');

  useEffect(() => {
    bootstrapRef.current = bootstrap;
  }, [bootstrap]);

  useEffect(() => {
    let isDisposed = false;

    setError(null);
    setStatus('booting');

    const timeoutBoundary = createBootstrapTimeoutPromise(
      normalizeBootstrapTimeoutMs(bootstrapTimeoutMs),
    );

    void Promise.race([
      bootstrapRef.current(),
      timeoutBoundary.promise,
    ])
      .then(() => {
        if (!isDisposed) {
          setStatus('ready');
        }
      })
      .catch((caughtError) => {
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
            <div className="truncate text-base font-semibold">{title}</div>
            <div className="mt-1 text-sm text-gray-400">
              {status === 'failed'
                ? 'Startup did not complete. Review the error and retry.'
                : bootingDescription}
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error.message}
          </div>
        ) : null}

        {status === 'failed' ? (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-gray-200"
              onClick={() => setAttempt((previousAttempt) => previousAttempt + 1)}
            >
              Retry
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
