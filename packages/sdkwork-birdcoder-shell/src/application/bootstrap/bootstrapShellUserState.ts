import {
  getBirdCoderUserProfileRepository,
  getBirdCoderVipMembershipRepository,
} from '../../../../sdkwork-birdcoder-appbase/src/storage.ts';
import {
  DEFAULT_WORKBENCH_RECOVERY_SNAPSHOT,
  normalizeWorkbenchRecoverySnapshot,
  type WorkbenchRecoverySnapshot,
} from '../../../../sdkwork-birdcoder-commons/src/workbench/recovery.ts';
import {
  getStoredJson,
  getStoredRawValue,
  serializeStoredValue,
  setStoredJson,
} from '../../../../sdkwork-birdcoder-commons/src/storage/localStore.ts';
import type { BirdCoderJsonRecordRepository } from '../../../../sdkwork-birdcoder-commons/src/storage/dataKernel.ts';
import {
  getRunConfigurationRepository,
  type RunConfigurationRecord,
} from '../../../../sdkwork-birdcoder-commons/src/terminal/runConfigs.ts';
import {
  getWorkbenchPreferencesRepository,
  type WorkbenchPreferences,
} from '../../../../sdkwork-birdcoder-commons/src/workbench/preferences.ts';

const WORKBENCH_RECOVERY_SCOPE = 'workbench';
const WORKBENCH_RECOVERY_KEY = 'recovery-context';

let bootstrapShellUserStatePromise: Promise<void> | null = null;
const projectBootstrapPromises = new Map<string, Promise<RunConfigurationRecord[]>>();

async function ensureJsonRecordRepositoryPersisted<TRecord>(
  repository: BirdCoderJsonRecordRepository<TRecord>,
): Promise<TRecord> {
  const normalizedValue = await repository.read();
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
    ensureJsonRecordRepositoryPersisted<RunConfigurationRecord[]>(
      getRunConfigurationRepository(normalizedProjectId),
    ).catch((error) => {
      projectBootstrapPromises.delete(normalizedProjectId);
      throw error;
    });

  projectBootstrapPromises.set(normalizedProjectId, bootstrapPromise);
  return bootstrapPromise;
}
