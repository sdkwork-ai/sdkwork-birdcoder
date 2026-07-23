import {
  getStoredJson,
  getStoredRawValue,
  serializeStoredValue,
  setStoredJson,
} from '@sdkwork/birdcoder-pc-workbench-storage';
import {
  DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
  ensureWorkbenchPreferences,
  normalizeWorkbenchRecoverySnapshot,
  type RunConfigurationRecord,
  type WorkbenchRecoverySnapshot,
} from '@sdkwork/birdcoder-pc-workbench-state';

const WORKBENCH_RECOVERY_SCOPE = 'workbench';
const WORKBENCH_RECOVERY_KEY = 'recovery-context';
const SHELL_USER_STATE_BOOTSTRAP_TIMEOUT_MS = 30_000;
const PROJECT_WORKBENCH_BOOTSTRAP_TIMEOUT_MS = 15_000;

let bootstrapShellLocalUserStatePromise: Promise<void> | null = null;
const projectBootstrapPromises = new Map<string, Promise<RunConfigurationRecord[]>>();

interface BootstrapTaskTimeoutBoundary {
  clear: () => void;
  promise: Promise<never>;
}

function createBootstrapTaskTimeoutPromise(
  operationName: string,
  timeoutMs: number,
): BootstrapTaskTimeoutBoundary {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const promise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(
        `Timed out during ${operationName} after ${Math.ceil(timeoutMs / 1_000)} seconds.`,
      ));
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

function runBootstrapTaskWithTimeout<T>(
  operationName: string,
  task: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const timeoutBoundary = createBootstrapTaskTimeoutPromise(operationName, timeoutMs);
  return Promise.race([task, timeoutBoundary.promise]).finally(timeoutBoundary.clear);
}

async function ensureRecoverySnapshotPersisted(): Promise<WorkbenchRecoverySnapshot> {
  const raw = await getStoredRawValue(WORKBENCH_RECOVERY_SCOPE, WORKBENCH_RECOVERY_KEY);
  const normalized = normalizeWorkbenchRecoverySnapshot(
    await getStoredJson(
      WORKBENCH_RECOVERY_SCOPE,
      WORKBENCH_RECOVERY_KEY,
      DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
    ),
  );
  if (raw !== serializeStoredValue(normalized)) {
    await setStoredJson(WORKBENCH_RECOVERY_SCOPE, WORKBENCH_RECOVERY_KEY, normalized);
  }
  return normalized;
}

function persistLocalUserState(): Promise<void> {
  return Promise.all([
    ensureWorkbenchPreferences(),
    ensureRecoverySnapshotPersisted(),
  ]).then(() => undefined);
}

export function bootstrapShellUserState(): Promise<void> {
  if (!bootstrapShellLocalUserStatePromise) {
    bootstrapShellLocalUserStatePromise = runBootstrapTaskWithTimeout(
      'shell local user state bootstrap',
      persistLocalUserState(),
      SHELL_USER_STATE_BOOTSTRAP_TIMEOUT_MS,
    ).catch((error) => {
      bootstrapShellLocalUserStatePromise = null;
      throw error;
    });
  }
  return bootstrapShellLocalUserStatePromise;
}

export function bootstrapProjectWorkbenchState(
  projectId: string | null | undefined,
): Promise<RunConfigurationRecord[]> {
  const normalizedProjectId = projectId?.trim();
  if (!normalizedProjectId) {
    return Promise.resolve([]);
  }
  const cached = projectBootstrapPromises.get(normalizedProjectId);
  if (cached) {
    return cached;
  }
  const bootstrapPromise = runBootstrapTaskWithTimeout(
    'project workbench state bootstrap',
    import('@sdkwork/birdcoder-pc-workbench-state/runConfigurations').then(
      ({ ensureStoredRunConfigurations }) => ensureStoredRunConfigurations(normalizedProjectId),
    ),
    PROJECT_WORKBENCH_BOOTSTRAP_TIMEOUT_MS,
  ).finally(() => {
    if (projectBootstrapPromises.get(normalizedProjectId) === bootstrapPromise) {
      projectBootstrapPromises.delete(normalizedProjectId);
    }
  });
  projectBootstrapPromises.set(normalizedProjectId, bootstrapPromise);
  return bootstrapPromise;
}
