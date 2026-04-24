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
  type RunConfigurationRecord,
  type WorkbenchPreferences,
  type WorkbenchRecoverySnapshot,
} from '@sdkwork/birdcoder-workbench-state';

const WORKBENCH_RECOVERY_SCOPE = 'workbench';
const WORKBENCH_RECOVERY_KEY = 'recovery-context';

let bootstrapShellUserStatePromise: Promise<void> | null = null;
const projectBootstrapPromises = new Map<string, Promise<RunConfigurationRecord[]>>();

async function ensureJsonRecordRepositoryPersisted<TRecord>(
  repository: BirdCoderJsonRecordRepository<TRecord>,
): Promise<TRecord> {
  const storageKey =
    repository.binding.storageMode === 'table'
      ? `${repository.binding.storageMode}.${repository.binding.preferredProvider}.${repository.binding.storageKey}`
      : repository.binding.storageKey;
  const normalizedValue = await repository.read();
  const currentRawValue = await getStoredRawValue(
    repository.binding.storageScope,
    storageKey,
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

async function performBootstrapShellUserState(): Promise<void> {
  await Promise.all([
    ensureJsonRecordRepositoryPersisted(getBirdCoderUserProfileRepository()),
    ensureJsonRecordRepositoryPersisted(getBirdCoderVipMembershipRepository()),
    ensureJsonRecordRepositoryPersisted<WorkbenchPreferences>(getWorkbenchPreferencesRepository()),
    ensureRecoverySnapshotPersisted(),
  ]);
}

export function bootstrapShellUserState(): Promise<void> {
  if (!bootstrapShellUserStatePromise) {
    bootstrapShellUserStatePromise = performBootstrapShellUserState().catch((error) => {
      bootstrapShellUserStatePromise = null;
      throw error;
    });
  }

  return bootstrapShellUserStatePromise;
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
    ensureStoredRunConfigurations(normalizedProjectId).finally(() => {
      projectBootstrapPromises.delete(normalizedProjectId);
    });

  projectBootstrapPromises.set(normalizedProjectId, bootstrapPromise);
  return bootstrapPromise;
}
