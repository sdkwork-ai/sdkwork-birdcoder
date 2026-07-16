import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StartupScreen } from '@sdkwork/birdcoder-pc-ui-shell';
import { BirdCoderApiReadyError } from './bootstrapServerApiReady';

type BootstrapStatus = 'booting' | 'failed' | 'ready';
const DEFAULT_BOOTSTRAP_TIMEOUT_MS = 30_000;
const BOOTSTRAP_IDLE_START_TIMEOUT_MS = 250;

export interface BootstrapGateMessages {
  bootingDescription: string;
  desktopApiUnavailable: (apiBaseUrl: string) => string;
  localApiUnavailable: (apiBaseUrl: string) => string;
  runtimeStage: string;
  sessionStage: string;
  workspaceStage: string;
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
    if (bootstrapError instanceof BirdCoderApiReadyError) {
      return bootstrapError.runtimeTarget === 'desktop'
        ? messages.desktopApiUnavailable(bootstrapError.apiBaseUrl)
        : messages.localApiUnavailable(bootstrapError.apiBaseUrl);
    }

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
    <StartupScreen
      description={messages.bootingDescription}
      errorMessage={error ? resolveErrorMessage(error) : undefined}
      onRetry={status === 'failed' ? () => setAttempt((previousAttempt) => previousAttempt + 1) : undefined}
      progress={34}
      retryLabel={messages.retry}
      stage="runtime"
      stageLabels={{
        runtime: messages.runtimeStage,
        session: messages.sessionStage,
        workspace: messages.workspaceStage,
      }}
      startupFailedLabel={messages.startupFailed}
      title={messages.startingTitle}
    />
  );
}
