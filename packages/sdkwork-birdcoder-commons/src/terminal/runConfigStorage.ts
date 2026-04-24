import {
  coerceBirdCoderSqlEntityRow,
  createBirdCoderTableRecordRepository,
  type BirdCoderJsonRecordRepository,
  type BirdCoderTableRecordRepository,
} from '../storage/dataKernel.ts';
import { getTerminalProfile, type TerminalProfileId } from './profiles.ts';
import {
  BIRDCODER_RUN_CONFIGURATION_STORAGE_BINDING,
  getBirdCoderEntityDefinition,
} from '@sdkwork/birdcoder-types';

const RUN_CONFIGURATION_LIMIT = 20;
const RUN_CONFIGURATION_GLOBAL_SCOPE_ID = 'global';

export type RunConfigurationGroup = 'dev' | 'build' | 'test' | 'custom';
export type RunConfigurationCwdMode = 'project' | 'workspace' | 'custom';

export interface RunConfigurationRecord {
  id: string;
  name: string;
  command: string;
  profileId: TerminalProfileId;
  group: RunConfigurationGroup;
  cwdMode: RunConfigurationCwdMode;
  customCwd: string;
}

interface PersistedRunConfigurationRecord extends RunConfigurationRecord {
  createdAt: string;
  updatedAt: string;
  configKey: string;
  scopeType: 'global' | 'project';
  scopeId: string;
  projectId?: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
}

interface RunConfigurationScope {
  projectId: string | null;
  scopeId: string;
  scopeType: PersistedRunConfigurationRecord['scopeType'];
}

const RUN_CONFIGURATION_DEFINITION = getBirdCoderEntityDefinition('run_configuration');

const DEFAULT_RUN_CONFIGURATIONS: ReadonlyArray<RunConfigurationRecord> = [
  {
    id: 'dev',
    name: 'Start Development Server',
    command: 'npm run dev',
    profileId: 'powershell',
    group: 'dev',
    cwdMode: 'project',
    customCwd: '',
  },
  {
    id: 'build',
    name: 'Build Project',
    command: 'npm run build',
    profileId: 'powershell',
    group: 'build',
    cwdMode: 'project',
    customCwd: '',
  },
  {
    id: 'test',
    name: 'Run Tests',
    command: 'npm test',
    profileId: 'powershell',
    group: 'test',
    cwdMode: 'project',
    customCwd: '',
  },
] as const;

const runConfigurationRepositoryCache = new Map<
  string,
  BirdCoderJsonRecordRepository<RunConfigurationRecord[]>
>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function resolveRunConfigurationScope(projectId: string | null | undefined): RunConfigurationScope {
  const normalizedProjectId = projectId?.trim() || null;
  return {
    projectId: normalizedProjectId,
    scopeId: normalizedProjectId ?? RUN_CONFIGURATION_GLOBAL_SCOPE_ID,
    scopeType: normalizedProjectId ? 'project' : 'global',
  };
}

function buildRunConfigurationStorageId(scope: RunConfigurationScope, configId: string): string {
  return `run-config:${scope.scopeType}:${scope.scopeId}:${configId}`;
}

function extractPublicRunConfigurationId(
  storageId: string | null | undefined,
  scope: RunConfigurationScope,
): string | null {
  const normalizedStorageId = storageId?.trim();
  if (!normalizedStorageId) {
    return null;
  }

  const prefix = `run-config:${scope.scopeType}:${scope.scopeId}:`;
  return normalizedStorageId.startsWith(prefix)
    ? normalizedStorageId.slice(prefix.length)
    : normalizedStorageId;
}

function createRunConfigurationUuid(storageId: string): string {
  return globalThis.crypto?.randomUUID?.() ?? `${storageId}:uuid`;
}

function normalizeRunConfigurationGroup(value: unknown): RunConfigurationGroup {
  switch (value) {
    case 'dev':
    case 'build':
    case 'test':
    case 'custom':
      return value;
    default:
      return 'custom';
  }
}

function normalizeRunConfigurationCwdMode(value: unknown): RunConfigurationCwdMode {
  switch (value) {
    case 'project':
    case 'workspace':
    case 'custom':
      return value;
    default:
      return 'project';
  }
}

function normalizeRunConfiguration(
  value: Partial<RunConfigurationRecord> | null | undefined,
  index: number,
): RunConfigurationRecord {
  return {
    id: value?.id?.trim() || `config-${index + 1}`,
    name: value?.name?.trim() || 'Run Task',
    command: value?.command?.trim() || 'echo Configure this run command first.',
    profileId: getTerminalProfile(value?.profileId ?? 'powershell').id,
    group: normalizeRunConfigurationGroup(value?.group),
    cwdMode: normalizeRunConfigurationCwdMode(value?.cwdMode),
    customCwd: value?.customCwd?.trim() || '',
  };
}

function toPublicRunConfiguration(
  value: PersistedRunConfigurationRecord,
): RunConfigurationRecord {
  return {
    id: value.configKey,
    name: value.name,
    command: value.command,
    profileId: value.profileId,
    group: value.group,
    cwdMode: value.cwdMode,
    customCwd: value.customCwd,
  };
}

function matchesRunConfigurationScope(
  value: Pick<PersistedRunConfigurationRecord, 'projectId' | 'scopeId' | 'scopeType'>,
  scope: RunConfigurationScope,
): boolean {
  if (value.scopeType !== scope.scopeType) {
    return false;
  }
  if (value.scopeId !== scope.scopeId) {
    return false;
  }

  const normalizedProjectId = value.projectId?.trim() || null;
  return normalizedProjectId === scope.projectId;
}

function createPersistedRunConfigurationNormalizer(scope: RunConfigurationScope) {
  return (value: unknown): PersistedRunConfigurationRecord | null => {
    if (
      isRecord(value) &&
      typeof value.id === 'string' &&
      ('configKey' in value || 'scopeType' in value || 'profileId' in value)
    ) {
      const scopeType = value.scopeType === 'project' ? 'project' : scope.scopeType;
      const scopeId =
        typeof value.scopeId === 'string' && value.scopeId.trim().length > 0
          ? value.scopeId.trim()
          : scope.scopeId;
      const projectId =
        typeof value.projectId === 'string' && value.projectId.trim().length > 0
          ? value.projectId.trim()
          : scope.projectId ?? undefined;
      const configKey =
        typeof value.configKey === 'string' && value.configKey.trim().length > 0
          ? value.configKey.trim()
          : extractPublicRunConfigurationId(String(value.id), {
              projectId,
              scopeId,
              scopeType,
            }) ?? String(value.id);
      const publicRecord = normalizeRunConfiguration(
        {
          id: configKey,
          name: typeof value.name === 'string' ? value.name : undefined,
          command: typeof value.command === 'string' ? value.command : undefined,
          profileId:
            typeof value.profileId === 'string'
              ? getTerminalProfile(value.profileId).id
              : undefined,
          group: value.group as RunConfigurationGroup | undefined,
          cwdMode: value.cwdMode as RunConfigurationCwdMode | undefined,
          customCwd: typeof value.customCwd === 'string' ? value.customCwd : undefined,
        },
        0,
      );

      return {
        ...publicRecord,
        id:
          typeof value.id === 'string' && value.id.trim().length > 0
            ? value.id
            : buildRunConfigurationStorageId(
                {
                  projectId: projectId ?? null,
                  scopeId,
                  scopeType,
                },
                publicRecord.id,
              ),
        configKey: publicRecord.id,
        scopeType,
        scopeId,
        projectId,
        uuid: typeof value.uuid === 'string' ? value.uuid : createRunConfigurationUuid(String(value.id)),
        tenantId: typeof value.tenantId === 'string' ? value.tenantId : undefined,
        organizationId:
          typeof value.organizationId === 'string' ? value.organizationId : undefined,
        createdAt:
          typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
        updatedAt:
          typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
      };
    }

    const row = coerceBirdCoderSqlEntityRow(RUN_CONFIGURATION_DEFINITION, value);
    if (row && typeof row.id === 'string') {
      const scopeType = row.scope_type === 'project' ? 'project' : 'global';
      const scopeId =
        typeof row.scope_id === 'string' && row.scope_id.trim().length > 0
          ? row.scope_id.trim()
          : scope.scopeId;
      const projectId =
        typeof row.project_id === 'string' && row.project_id.trim().length > 0
          ? row.project_id.trim()
          : scope.projectId ?? undefined;
      const configKey =
        typeof row.config_key === 'string' && row.config_key.trim().length > 0
          ? row.config_key.trim()
          : extractPublicRunConfigurationId(String(row.id), {
              projectId,
              scopeId,
              scopeType,
            }) ?? String(row.id);
      const createdAt =
        typeof row.created_at === 'string' && row.created_at.trim().length > 0
          ? row.created_at
          : new Date(0).toISOString();
      const updatedAt =
        typeof row.updated_at === 'string' && row.updated_at.trim().length > 0
          ? row.updated_at
          : createdAt;

      return {
        id: String(row.id),
        configKey,
        name: typeof row.name === 'string' ? row.name : 'Run Task',
        command:
          typeof row.command === 'string' && row.command.trim().length > 0
            ? row.command
            : 'echo Configure this run command first.',
        profileId: getTerminalProfile(
          typeof row.profile_id === 'string' ? row.profile_id : 'powershell',
        ).id,
        group: normalizeRunConfigurationGroup(row.group_name),
        cwdMode: normalizeRunConfigurationCwdMode(row.cwd_mode),
        customCwd: typeof row.custom_cwd === 'string' ? row.custom_cwd : '',
        scopeType,
        scopeId,
        projectId,
        uuid: typeof row.uuid === 'string' ? row.uuid : undefined,
        tenantId: typeof row.tenant_id === 'string' ? row.tenant_id : undefined,
        organizationId:
          typeof row.organization_id === 'string' ? row.organization_id : undefined,
        createdAt,
        updatedAt,
      };
    }

    if (!isRecord(value) || typeof value.id !== 'string') {
      return null;
    }

    const publicRecord = normalizeRunConfiguration(value as Partial<RunConfigurationRecord>, 0);
    const storageId = buildRunConfigurationStorageId(scope, publicRecord.id);

    return {
      ...publicRecord,
      id: storageId,
      configKey: publicRecord.id,
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      projectId: scope.projectId ?? undefined,
      uuid: typeof value.uuid === 'string' ? value.uuid : createRunConfigurationUuid(storageId),
      tenantId: typeof value.tenantId === 'string' ? value.tenantId : undefined,
      organizationId:
        typeof value.organizationId === 'string' ? value.organizationId : undefined,
      createdAt:
        typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
      updatedAt:
        typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
    };
  };
}

function toRunConfigurationStorageRow(
  value: PersistedRunConfigurationRecord,
): Record<string, unknown> {
  return {
    id: value.id,
    uuid: value.uuid ?? null,
    tenant_id: value.tenantId ?? null,
    organization_id: value.organizationId ?? null,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    version: 0,
    is_deleted: false,
    workspace_id: '',
    project_id: value.projectId ?? '',
    scope_type: value.scopeType,
    scope_id: value.scopeId,
    config_key: value.configKey,
    name: value.name,
    command: value.command,
    profile_id: value.profileId,
    group_name: value.group,
    cwd_mode: value.cwdMode,
    custom_cwd: value.customCwd,
  };
}

function buildPersistedRunConfigurationRecords(
  scope: RunConfigurationScope,
  configurations: ReadonlyArray<RunConfigurationRecord>,
  existingRecords: ReadonlyArray<PersistedRunConfigurationRecord>,
): PersistedRunConfigurationRecord[] {
  const normalizedConfigurations = normalizeRunConfigurations(configurations);
  const existingRecordsByConfigKey = new Map(
    existingRecords.map((record) => [record.configKey, record]),
  );
  const baseTimestamp = Date.now();

  return normalizedConfigurations.map((configuration, index) => {
    const existingRecord = existingRecordsByConfigKey.get(configuration.id);
    const storageId =
      existingRecord?.id ?? buildRunConfigurationStorageId(scope, configuration.id);
    const orderedUpdatedAt = new Date(baseTimestamp - index).toISOString();

    return {
      ...configuration,
      id: storageId,
      configKey: configuration.id,
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      projectId: scope.projectId ?? undefined,
      uuid: existingRecord?.uuid ?? createRunConfigurationUuid(storageId),
      tenantId: existingRecord?.tenantId,
      organizationId: existingRecord?.organizationId,
      createdAt: existingRecord?.createdAt ?? orderedUpdatedAt,
      updatedAt: orderedUpdatedAt,
    };
  });
}

function areRunConfigurationListsEqual(
  left: ReadonlyArray<RunConfigurationRecord>,
  right: ReadonlyArray<RunConfigurationRecord>,
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((entry, index) => {
    const candidate = right[index];
    return (
      candidate?.id === entry.id &&
      candidate.name === entry.name &&
      candidate.command === entry.command &&
      candidate.profileId === entry.profileId &&
      candidate.group === entry.group &&
      candidate.cwdMode === entry.cwdMode &&
      candidate.customCwd === entry.customCwd
    );
  });
}

export function buildRunConfigurationStorageKey(projectId: string | null | undefined): string {
  const normalizedProjectId = projectId?.trim();
  return normalizedProjectId ? `run-configs.${normalizedProjectId}.v1` : 'run-configs.global.v1';
}

function createRunConfigurationRepository(
  projectId: string | null | undefined,
): BirdCoderJsonRecordRepository<RunConfigurationRecord[]> {
  const scope = resolveRunConfigurationScope(projectId);
  const tableRepository: BirdCoderTableRecordRepository<PersistedRunConfigurationRecord> =
    createBirdCoderTableRecordRepository({
      binding: {
        ...BIRDCODER_RUN_CONFIGURATION_STORAGE_BINDING,
        storageKey: buildRunConfigurationStorageKey(projectId),
      },
      definition: RUN_CONFIGURATION_DEFINITION,
      identify(value) {
        return value.id;
      },
      normalize: createPersistedRunConfigurationNormalizer(scope),
      toRow: toRunConfigurationStorageRow,
    });

  return {
    binding: tableRepository.binding,
    definition: tableRepository.definition,
    async clear() {
      const currentScopeRecords = (await tableRepository.list()).filter((record) =>
        matchesRunConfigurationScope(record, scope),
      );
      await Promise.all(
        currentScopeRecords.map((record) => tableRepository.delete(record.id)),
      );
    },
    async read() {
      const records = await tableRepository.list();
      return records
        .filter((record) => matchesRunConfigurationScope(record, scope))
        .map(toPublicRunConfiguration);
    },
    async write(value) {
      const currentScopeRecords = (await tableRepository.list()).filter((record) =>
        matchesRunConfigurationScope(record, scope),
      );
      const nextScopeRecords = buildPersistedRunConfigurationRecords(
        scope,
        value,
        currentScopeRecords,
      );
      const nextConfigKeys = new Set(nextScopeRecords.map((record) => record.configKey));

      for (const record of currentScopeRecords) {
        if (!nextConfigKeys.has(record.configKey)) {
          await tableRepository.delete(record.id);
        }
      }
      await tableRepository.saveMany(nextScopeRecords);

      return nextScopeRecords.map(toPublicRunConfiguration);
    },
  };
}

export function getRunConfigurationRepository(
  projectId: string | null | undefined,
): BirdCoderJsonRecordRepository<RunConfigurationRecord[]> {
  const key = buildRunConfigurationStorageKey(projectId);
  const cachedRepository = runConfigurationRepositoryCache.get(key);
  if (cachedRepository) {
    return cachedRepository;
  }

  const repository = createRunConfigurationRepository(projectId);
  runConfigurationRepositoryCache.set(key, repository);
  return repository;
}

export function getDefaultRunConfigurations(): RunConfigurationRecord[] {
  return DEFAULT_RUN_CONFIGURATIONS.map((config) => ({ ...config }));
}

export function normalizeRunConfigurations(value: unknown): RunConfigurationRecord[] {
  if (!Array.isArray(value)) {
    return getDefaultRunConfigurations();
  }

  const normalized = value
    .map((entry, index) =>
      normalizeRunConfiguration(
        typeof entry === 'object' && entry !== null
          ? (entry as Partial<RunConfigurationRecord>)
          : {},
        index,
      ),
    )
    .slice(0, RUN_CONFIGURATION_LIMIT);

  return normalized.length > 0 ? normalized : getDefaultRunConfigurations();
}

export async function listStoredRunConfigurations(
  projectId: string | null | undefined,
): Promise<RunConfigurationRecord[]> {
  return getRunConfigurationRepository(projectId).read();
}

export async function ensureStoredRunConfigurations(
  projectId: string | null | undefined,
): Promise<RunConfigurationRecord[]> {
  const repository = getRunConfigurationRepository(projectId);
  const currentValue = await repository.read();
  const normalizedValue = normalizeRunConfigurations(currentValue);

  if (!areRunConfigurationListsEqual(currentValue, normalizedValue)) {
    return repository.write(normalizedValue);
  }

  return currentValue;
}

export async function saveStoredRunConfigurations(
  projectId: string | null | undefined,
  configurations: ReadonlyArray<RunConfigurationRecord>,
): Promise<RunConfigurationRecord[]> {
  const normalized = normalizeRunConfigurations(configurations);
  return getRunConfigurationRepository(projectId).write(normalized);
}

export async function upsertStoredRunConfiguration(
  projectId: string | null | undefined,
  configuration: RunConfigurationRecord,
): Promise<RunConfigurationRecord[]> {
  const existing = await listStoredRunConfigurations(projectId);
  const normalizedConfiguration = normalizeRunConfiguration(configuration, existing.length);
  const nextConfigurations = [
    normalizedConfiguration,
    ...existing.filter((item) => item.id !== normalizedConfiguration.id),
  ].slice(0, RUN_CONFIGURATION_LIMIT);

  return saveStoredRunConfigurations(projectId, nextConfigurations);
}
