import { useEffect, useRef, useState, type ReactNode } from 'react';

const DEFAULT_BOOTSTRAP_TIMEOUT_MS = 30_000;
const BOOTSTRAP_TIMEOUT_ERROR = 'BIRDCODER_H5_BOOTSTRAP_TIMEOUT';

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

function normalizeTimeoutMs(value: number): number {
  return Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : DEFAULT_BOOTSTRAP_TIMEOUT_MS;
}

function createTimeout(timeoutMs: number): {
  cancel(): void;
  promise: Promise<never>;
} {
  let handle: ReturnType<typeof globalThis.setTimeout> | undefined;
  return {
    cancel() {
      if (handle !== undefined) {
        globalThis.clearTimeout(handle);
        handle = undefined;
      }
    },
    promise: new Promise((_, reject) => {
      handle = globalThis.setTimeout(
        () => reject(new Error(BOOTSTRAP_TIMEOUT_ERROR)),
        timeoutMs,
      );
    }),
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
  const [ready, setReady] = useState(false);
  const timeoutMs = normalizeTimeoutMs(bootstrapTimeoutMs);

  useEffect(() => {
    bootstrapRef.current = bootstrap;
  }, [bootstrap]);

  useEffect(() => {
    let active = true;
    const timeout = createTimeout(timeoutMs);
    setError(null);
    setReady(false);

    void Promise.race([bootstrapRef.current(), timeout.promise])
      .then(() => {
        if (active) {
          setReady(true);
        }
      })
      .catch((caughtError: unknown) => {
        if (active) {
          setError(caughtError instanceof Error ? caughtError : new Error(messages.unknownFailure));
        }
      })
      .finally(() => timeout.cancel());

    return () => {
      active = false;
      timeout.cancel();
    };
  }, [attempt, messages.unknownFailure, timeoutMs]);

  if (ready) {
    return children;
  }

  const errorMessage = error?.message === BOOTSTRAP_TIMEOUT_ERROR
    ? messages.startupTimeout(Math.ceil(timeoutMs / 1000))
    : error?.message;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section aria-live="polite" className="w-full max-w-sm text-center" role="status">
        <h1 className="text-lg font-semibold">
          {error ? messages.startupFailed : messages.startingTitle}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {errorMessage ?? messages.bootingDescription}
        </p>
        {error ? (
          <button
            className="mt-5 rounded-lg border border-border px-4 py-2 text-sm font-medium"
            onClick={() => setAttempt((current) => current + 1)}
            type="button"
          >
            {messages.retry}
          </button>
        ) : null}
      </section>
    </main>
  );
}
