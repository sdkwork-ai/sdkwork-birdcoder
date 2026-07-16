import type { BirdHostDescriptor } from '@sdkwork/birdcoder-pc-host-core';
import { bindDefaultBirdCoderIdeServicesRuntime } from '@sdkwork/birdcoder-pc-infrastructure-runtime/defaultIdeServices';
import type {
  BirdCoderAppSdkApiClient,
  BirdCoderBackendSdkApiClient,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';
import { bootstrapBirdCoderMembershipSdk } from '@sdkwork/birdcoder-pc-infrastructure-runtime/membershipSdkBootstrap';
import { bootstrapBirdCoderDriveSandboxExplorer } from '@sdkwork/birdcoder-pc-infrastructure-runtime/driveSandboxExplorer';
import type { BirdCoderRealtimeTransportPreference } from './bootstrapShellRuntime.ts';
import { bootstrapShellUserState } from './bootstrapShellUserState.ts';

const SHELL_RUNTIME_BOOTSTRAP_TIMEOUT_MS = 30_000;

let bootstrapped = false;
let bootstrapShellRuntimePromise: Promise<void> | null = null;
let bootstrapShellRuntimeAttemptId = 0;
const abandonedBootstrapAttemptIds = new Set<number>();

export interface BootstrapShellRuntimeOptions {
  appClient?: BirdCoderAppSdkApiClient;
  apiBaseUrl?: string;
  backendClient?: BirdCoderBackendSdkApiClient;
  bootstrapTimeoutMs?: number;
  host?: BirdHostDescriptor;
  realtimeTransport?: BirdCoderRealtimeTransportPreference;
}

interface ShellRuntimeBootstrapTimeoutBoundary {
  clear: () => void;
  promise: Promise<never>;
}

function normalizeShellRuntimeBootstrapTimeoutMs(timeoutMs: number | null | undefined): number {
  return Number.isFinite(timeoutMs) && typeof timeoutMs === 'number' && timeoutMs > 0
    ? timeoutMs
    : SHELL_RUNTIME_BOOTSTRAP_TIMEOUT_MS;
}

function createShellRuntimeBootstrapTimeoutPromise(
  attemptId: number,
  timeoutMs: number,
): ShellRuntimeBootstrapTimeoutBoundary {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const promise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      abandonedBootstrapAttemptIds.add(attemptId);
      reject(
        new Error(
          `Startup shell runtime did not complete within ${Math.ceil(timeoutMs / 1000)} seconds.`,
        ),
      );
    }, timeoutMs);
  });

  return {
    clear: () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    },
    promise,
  };
}

async function runBootstrapShellRuntimeOnce(attemptId: number): Promise<void> {
  try {
    await bootstrapShellUserState();
    if (
      attemptId === bootstrapShellRuntimeAttemptId &&
      !abandonedBootstrapAttemptIds.has(attemptId)
    ) {
      bootstrapped = true;
    }
  } finally {
    abandonedBootstrapAttemptIds.delete(attemptId);
  }
}

function runBootstrapShellRuntimeWithTimeout(
  attemptId: number,
  timeoutMs: number,
): Promise<void> {
  const timeoutBoundary = createShellRuntimeBootstrapTimeoutPromise(attemptId, timeoutMs);
  return Promise.race([
    runBootstrapShellRuntimeOnce(attemptId),
    timeoutBoundary.promise,
  ]).finally(() => {
    timeoutBoundary.clear();
  });
}

export async function bootstrapShellRuntimeImpl(
  options: BootstrapShellRuntimeOptions = {},
): Promise<void> {
  bindDefaultBirdCoderIdeServicesRuntime(options);
  bootstrapBirdCoderMembershipSdk();
  bootstrapBirdCoderDriveSandboxExplorer();

  if (bootstrapped) {
    return;
  }

  if (bootstrapShellRuntimePromise) {
    return bootstrapShellRuntimePromise;
  }

  const attemptId = bootstrapShellRuntimeAttemptId + 1;
  bootstrapShellRuntimeAttemptId = attemptId;
  const nextBootstrapPromise = runBootstrapShellRuntimeWithTimeout(
    attemptId,
    normalizeShellRuntimeBootstrapTimeoutMs(options.bootstrapTimeoutMs),
  ).finally(() => {
    if (bootstrapShellRuntimePromise === nextBootstrapPromise) {
      bootstrapShellRuntimePromise = null;
    }
  });
  bootstrapShellRuntimePromise = nextBootstrapPromise;

  return bootstrapShellRuntimePromise;
}

