import {
  getStoredJson,
  getStoredRawValue,
  serializeStoredValue,
  setStoredJson,
  type BirdCoderJsonRecordRepository,
} from '@sdkwork/birdcoder-workbench-storage';
import {
  DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
  ensureStoredRunConfigurations,
  getBirdCoderUserProfileRepository,
  getBirdCoderVipMembershipRepository,
  getWorkbenchPreferencesRepository,
  normalizeWorkbenchRecoverySnapshot,
  syncWorkbenchCodeEngineModelConfig,
  type RunConfigurationRecord,
  type SyncWorkbenchCodeEngineModelConfigOptions,
  type WorkbenchPreferences,
  type WorkbenchRecoverySnapshot,
} from '@sdkwork/birdcoder-workbench-state';

const WORKBENCH_RECOVERY_SCOPE = 'workbench';
const WORKBENCH_RECOVERY_KEY = 'recovery-context';
const SHELL_USER_STATE_BOOTSTRAP_TIMEOUT_MS = 30_000;
const MODEL_CONFIG_SYNC_BOOTSTRAP_TIMEOUT_MS = 15_000;
const PROJECT_WORKBENCH_BOOTSTRAP_TIMEOUT_MS = 15_000;

let bootstrapShellLocalUserStatePromise: Promise<void> | null = null;
let modelConfigSyncPromise: Promise<void> | null = null;
let hasSynchronizedModelConfig = false;
const projectBootstrapPromises = new Map<string, Promise<RunConfigurationRecord[]>>();

export type BootstrapShellUserStateOptions =
  Partial<SyncWorkbenchCodeEngineModelConfigOptions>;

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
      reject(
        new Error(
          `Timed out during ${operationName} after ${Math.ceil(timeoutMs / 1000)} seconds.`,
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

function runBootstrapTaskWithTimeout<T>(
  operationName: string,
  task: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const timeoutBoundary = createBootstrapTaskTimeoutPromise(operationName, timeoutMs);
  return Promise.race([
    task,
    timeoutBoundary.promise,
  ]).finally(() => {
    timeoutBoundary.clear();
  });
}

async function ensureJsonRecordRepositoryPersisted<TRecord>(
  repository: BirdCoderJsonRecordRepository<TRecord>,
): Promise<TRecord> {
  const normalizedValue = await repository.read();

  if (repository.binding.storageMode === 'table') {
    await repository.write(normalizedValue);
    return normalizedValue;
  }

  const currentRawValue = await getStoredRawValue(
    repository.binding.storageScope,
    repository.binding.storageKey,
  );
  const nextRawValue = serializeStoredValue(normalizedValue);

  if (currentRawValue !== nextRawValue) {
    await repository.write(normalizedValue);
  }

  return normalizedValue;
}

async function ensureRecoverySnapshotPersisted(): Promise<WorkbenchRecoverySnapshot> {
  const currentRawValue = await getStoredRawValue(WORKBENCH_RECOVERY_SCOPE, WORKBENCH_RECOVERY_KEY);
  const normalizedValue = normalizeWorkbenchRecoverySnapshot(
    await getStoredJson(
      WORKBENCH_RECOVERY_SCOPE,
      WORKBENCH_RECOVERY_KEY,
      DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
    ),
  );
  const nextRawValue = serializeStoredValue(normalizedValue);

  if (currentRawValue !== nextRawValue) {
    await setStoredJson(WORKBENCH_RECOVERY_SCOPE, WORKBENCH_RECOVERY_KEY, normalizedValue);
  }

  return normalizedValue;
}

function hasModelConfigSyncServices(
  options: BootstrapShellUserStateOptions,
): options is SyncWorkbenchCodeEngineModelConfigOptions {
  return Boolean(options.coreReadService && options.coreWriteService);
}

async function runCodeEngineModelConfigSynchronization(
  options: SyncWorkbenchCodeEngineModelConfigOptions,
): Promise<boolean> {
  try {
    await runBootstrapTaskWithTimeout(
      'code engine model config synchronization',
      syncWorkbenchCodeEngineModelConfig({
        coreReadService: options.coreReadService,
        coreWriteService: options.coreWriteService,
      }),
      MODEL_CONFIG_SYNC_BOOTSTRAP_TIMEOUT_MS,
    );
    return true;
  } catch {
    // Startup must remain local-first if a remote model-config authority is unavailable.
    return false;
  }
}

function ensureCodeEngineModelConfigSynchronized(
  options: BootstrapShellUserStateOptions,
): Promise<void> {
  if (hasSynchronizedModelConfig || !hasModelConfigSyncServices(options)) {
    return Promise.resolve();
  }

  if (!modelConfigSyncPromise) {
    modelConfigSyncPromise = runCodeEngineModelConfigSynchronization(options)
      .then((didSynchronize) => {
        if (didSynchronize) {
          hasSynchronizedModelConfig = true;
        }
      })
      .finally(() => {
        modelConfigSyncPromise = null;
      });
  }

  return modelConfigSyncPromise;
}

function persistLocalUserState(): Promise<void> {
  return Promise.all([
    ensureJsonRecordRepositoryPersisted(getBirdCoderUserProfileRepository()),
    ensureJsonRecordRepositoryPersisted(getBirdCoderVipMembershipRepository()),
    ensureJsonRecordRepositoryPersisted<WorkbenchPreferences>(getWorkbenchPreferencesRepository()),
    ensureRecoverySnapshotPersisted(),
  ]).then(() => undefined);
}

function ensureLocalUserStatePersisted(): Promise<void> {
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

export function bootstrapShellUserState(
  options: BootstrapShellUserStateOptions = {},
): Promise<void> {
  if (!bootstrapShellLocalUserStatePromise && hasModelConfigSyncServices(options)) {
    bootstrapShellLocalUserStatePromise = runBootstrapTaskWithTimeout(
      'shell local user state bootstrap',
      ensureCodeEngineModelConfigSynchronized(options)
        .then(() => persistLocalUserState()),
      SHELL_USER_STATE_BOOTSTRAP_TIMEOUT_MS,
    )
      .catch((error) => {
        bootstrapShellLocalUserStatePromise = null;
        throw error;
      });

    return bootstrapShellLocalUserStatePromise;
  }

  const localUserStatePromise = ensureLocalUserStatePersisted();
  if (!hasModelConfigSyncServices(options)) {
    return localUserStatePromise;
  }

  return localUserStatePromise
    .then(() => ensureCodeEngineModelConfigSynchronized(options))
    .then(() => undefined);
}

export function bootstrapProjectWorkbenchState(
  projectId: string | null | undefined,
): Promise<RunConfigurationRecord[]> {
  const normalizedProjectId = projectId?.trim();
  if (!normalizedProjectId) {
    return Promise.resolve([]);
  }

  const cachedPromise = projectBootstrapPromises.get(normalizedProjectId);
  if (cachedPromise) {
    return cachedPromise;
  }

  const bootstrapPromise: Promise<RunConfigurationRecord[]> =
    runBootstrapTaskWithTimeout(
      'project workbench state bootstrap',
      ensureStoredRunConfigurations(normalizedProjectId),
      PROJECT_WORKBENCH_BOOTSTRAP_TIMEOUT_MS,
    ).finally(() => {
      if (projectBootstrapPromises.get(normalizedProjectId) === bootstrapPromise) {
        projectBootstrapPromises.delete(normalizedProjectId);
      }
    });

  projectBootstrapPromises.set(normalizedProjectId, bootstrapPromise);
  return bootstrapPromise;
}
