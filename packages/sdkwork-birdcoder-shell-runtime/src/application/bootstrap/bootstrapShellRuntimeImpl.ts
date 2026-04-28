import type { BirdHostDescriptor } from '@sdkwork/birdcoder-host-core';
import type {
  BirdCoderAppAdminApiClient,
  BirdCoderCoreReadApiClient,
  BirdCoderCoreWriteApiClient,
} from '@sdkwork/birdcoder-types';
import {
  bindDefaultBirdCoderIdeServicesRuntime,
  loadDefaultBirdCoderIdeService,
  type BirdCoderRuntimeUserCenterBindingConfig,
} from '@sdkwork/birdcoder-infrastructure-runtime';
import { bootstrapShellUserState } from './bootstrapShellUserState.ts';

const SHELL_RUNTIME_BOOTSTRAP_TIMEOUT_MS = 30_000;

let bootstrapped = false;
let bootstrapShellRuntimePromise: Promise<void> | null = null;
let bootstrapShellRuntimeAttemptId = 0;
const abandonedBootstrapAttemptIds = new Set<number>();

export interface BootstrapShellRuntimeOptions {
  appAdminClient?: BirdCoderAppAdminApiClient;
  apiBaseUrl?: string;
  bootstrapTimeoutMs?: number;
  coreReadClient?: BirdCoderCoreReadApiClient;
  coreWriteClient?: BirdCoderCoreWriteApiClient;
  host?: BirdHostDescriptor;
  userCenter?: BirdCoderRuntimeUserCenterBindingConfig;
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
    const [coreReadService, coreWriteService] = await Promise.all([
      loadDefaultBirdCoderIdeService('coreReadService'),
      loadDefaultBirdCoderIdeService('coreWriteService'),
    ]);
    await bootstrapShellUserState({
      coreReadService,
      coreWriteService,
    });
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
