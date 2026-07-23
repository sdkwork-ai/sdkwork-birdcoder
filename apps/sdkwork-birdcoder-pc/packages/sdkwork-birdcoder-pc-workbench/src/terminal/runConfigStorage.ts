import {
  deserializeStoredValue,
  getStoredRawValue,
  removeStoredValue,
  serializeStoredValue,
  setStoredRawValue,
} from '../storage/localStore.ts';
import { getTerminalProfile } from './profiles.ts';
import {
  getDefaultRunConfigurations,
  type RunConfigurationCwdMode,
  type RunConfigurationGroup,
  type RunConfigurationRecord,
} from './runConfigDefinitions.ts';

export {
  getDefaultRunConfigurations,
  type RunConfigurationCwdMode,
  type RunConfigurationGroup,
  type RunConfigurationRecord,
} from './runConfigDefinitions.ts';

const RUN_CONFIGURATION_LIMIT = 20;
const RUN_CONFIGURATION_SCOPE = 'workbench-run-configurations';
const MAX_PROJECT_ID_LENGTH = 256;
const MAX_CONFIGURATION_ID_LENGTH = 128;
const MAX_CONFIGURATION_NAME_LENGTH = 160;
const MAX_COMMAND_LENGTH = 8_192;
const MAX_CUSTOM_CWD_LENGTH = 1_024;

export interface RunConfigurationStore {
  clear(): Promise<void>;
  read(): Promise<RunConfigurationRecord[]>;
  write(value: ReadonlyArray<RunConfigurationRecord>): Promise<RunConfigurationRecord[]>;
}

function normalizeBoundedText(
  value: string | null | undefined,
  fallback: string,
  maxLength: number,
): string {
  return value?.trim().slice(0, maxLength) || fallback;
}

function normalizeRunConfigurationGroup(value: unknown): RunConfigurationGroup {
  return value === 'dev' || value === 'build' || value === 'test' || value === 'custom'
    ? value
    : 'custom';
}

function normalizeRunConfigurationCwdMode(value: unknown): RunConfigurationCwdMode {
  return value === 'project' || value === 'workspace' || value === 'custom'
    ? value
    : 'project';
}

function normalizeRunConfiguration(
  value: Partial<RunConfigurationRecord> | null | undefined,
  index: number,
): RunConfigurationRecord {
  return {
    id: normalizeBoundedText(value?.id, `config-${index + 1}`, MAX_CONFIGURATION_ID_LENGTH),
    name: normalizeBoundedText(value?.name, 'Run Task', MAX_CONFIGURATION_NAME_LENGTH),
    command: normalizeBoundedText(
      value?.command,
      'echo Configure this run command first.',
      MAX_COMMAND_LENGTH,
    ),
    profileId: getTerminalProfile(value?.profileId ?? 'powershell').id,
    group: normalizeRunConfigurationGroup(value?.group),
    cwdMode: normalizeRunConfigurationCwdMode(value?.cwdMode),
    customCwd: value?.customCwd?.trim().slice(0, MAX_CUSTOM_CWD_LENGTH) || '',
  };
}

function areRunConfigurationListsEqual(
  left: ReadonlyArray<RunConfigurationRecord>,
  right: ReadonlyArray<RunConfigurationRecord>,
): boolean {
  return left.length === right.length && left.every((entry, index) => {
    const candidate = right[index];
    return candidate?.id === entry.id
      && candidate.name === entry.name
      && candidate.command === entry.command
      && candidate.profileId === entry.profileId
      && candidate.group === entry.group
      && candidate.cwdMode === entry.cwdMode
      && candidate.customCwd === entry.customCwd;
  });
}

export function buildRunConfigurationStorageKey(
  projectId: string | null | undefined,
): string {
  const normalizedProjectId = projectId?.trim();
  if (normalizedProjectId && normalizedProjectId.length > MAX_PROJECT_ID_LENGTH) {
    throw new Error(
      `Run configuration project id must not exceed ${MAX_PROJECT_ID_LENGTH} characters.`,
    );
  }
  return normalizedProjectId
    ? `project.${encodeURIComponent(normalizedProjectId)}.v1`
    : 'global.v1';
}

function readRawRunConfigurations(raw: string | null): unknown {
  return raw === null ? null : deserializeStoredValue<unknown>(raw, null);
}

function createRunConfigurationStore(
  projectId: string | null | undefined,
): RunConfigurationStore {
  const storageKey = buildRunConfigurationStorageKey(projectId);
  return {
    async clear() {
      await removeStoredValue(RUN_CONFIGURATION_SCOPE, storageKey);
    },
    async read() {
      const raw = await getStoredRawValue(RUN_CONFIGURATION_SCOPE, storageKey);
      if (raw === null) {
        return [];
      }
      return normalizeRunConfigurations(readRawRunConfigurations(raw));
    },
    async write(value) {
      const normalized = normalizeRunConfigurations(value);
      await setStoredRawValue(
        RUN_CONFIGURATION_SCOPE,
        storageKey,
        serializeStoredValue(normalized),
      );
      return normalized;
    },
  };
}

const runConfigurationStores = new Map<string, RunConfigurationStore>();

export function getRunConfigurationStore(
  projectId: string | null | undefined,
): RunConfigurationStore {
  const key = buildRunConfigurationStorageKey(projectId);
  const existing = runConfigurationStores.get(key);
  if (existing) {
    return existing;
  }
  const store = createRunConfigurationStore(projectId);
  runConfigurationStores.set(key, store);
  return store;
}

export function normalizeRunConfigurations(value: unknown): RunConfigurationRecord[] {
  if (!Array.isArray(value)) {
    return getDefaultRunConfigurations();
  }
  const seenIds = new Set<string>();
  const normalized = value
    .map((entry, index) => normalizeRunConfiguration(
      typeof entry === 'object' && entry !== null
        ? entry as Partial<RunConfigurationRecord>
        : {},
      index,
    ))
    .filter((entry) => {
      if (seenIds.has(entry.id)) {
        return false;
      }
      seenIds.add(entry.id);
      return true;
    })
    .slice(0, RUN_CONFIGURATION_LIMIT);
  return normalized.length > 0 ? normalized : getDefaultRunConfigurations();
}

export async function listStoredRunConfigurations(
  projectId: string | null | undefined,
): Promise<RunConfigurationRecord[]> {
  return getRunConfigurationStore(projectId).read();
}

export async function ensureStoredRunConfigurations(
  projectId: string | null | undefined,
): Promise<RunConfigurationRecord[]> {
  const key = buildRunConfigurationStorageKey(projectId);
  const raw = await getStoredRawValue(RUN_CONFIGURATION_SCOPE, key);
  const normalized = normalizeRunConfigurations(readRawRunConfigurations(raw));
  const normalizedRaw = serializeStoredValue(normalized);
  if (raw !== normalizedRaw) {
    await setStoredRawValue(RUN_CONFIGURATION_SCOPE, key, normalizedRaw);
  }
  return normalized;
}

export async function saveStoredRunConfigurations(
  projectId: string | null | undefined,
  configurations: ReadonlyArray<RunConfigurationRecord>,
): Promise<RunConfigurationRecord[]> {
  return getRunConfigurationStore(projectId).write(configurations);
}

export async function upsertStoredRunConfiguration(
  projectId: string | null | undefined,
  configuration: RunConfigurationRecord,
): Promise<RunConfigurationRecord[]> {
  const existing = await listStoredRunConfigurations(projectId);
  const normalizedConfiguration = normalizeRunConfiguration(configuration, existing.length);
  const next = [
    normalizedConfiguration,
    ...existing.filter((item) => item.id !== normalizedConfiguration.id),
  ].slice(0, RUN_CONFIGURATION_LIMIT);
  if (areRunConfigurationListsEqual(existing, next)) {
    return existing;
  }
  return saveStoredRunConfigurations(projectId, next);
}
