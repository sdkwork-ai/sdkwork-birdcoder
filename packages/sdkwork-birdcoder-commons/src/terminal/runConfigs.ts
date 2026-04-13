import {
  createJsonRecordRepository,
  type BirdCoderJsonRecordRepository,
} from '../storage/dataKernel.ts';
import { getTerminalProfile, type TerminalProfileId } from './profiles.ts';
import {
  listTerminalCliProfileAvailability,
  resolveTerminalProfileBlockedAction,
  resolveTerminalProfileLaunchPresentation,
  type TerminalCliProfileAvailability,
  type TerminalCommandRequest,
  type TerminalProfileBlockedAction,
  type TerminalProfileLaunchPresentation,
} from './runtime.ts';
import {
  BIRDCODER_RUN_CONFIGURATION_STORAGE_BINDING,
  getBirdCoderEntityDefinition,
} from '@sdkwork/birdcoder-types';

const RUN_CONFIGURATION_LIMIT = 20;

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

export interface RunConfigurationTerminalRequest extends TerminalCommandRequest {
  path: string;
  command: string;
  profileId: TerminalProfileId;
}

type RunConfigurationDirectoryInput = Pick<RunConfigurationRecord, 'cwdMode' | 'customCwd'> &
  Partial<RunConfigurationRecord>;

interface BuildRunConfigurationTerminalRequestOptions {
  projectDirectory: string;
  workspaceDirectory: string;
  timestamp?: number;
}

export interface ResolveRunConfigurationTerminalLaunchOptions
  extends BuildRunConfigurationTerminalRequestOptions {
  cliAvailabilityByProfileId?: Partial<Record<TerminalProfileId, TerminalCliProfileAvailability>>;
}

export interface RunConfigurationTerminalLaunchResult {
  request: RunConfigurationTerminalRequest | null;
  launchPresentation: TerminalProfileLaunchPresentation;
  blockedAction: TerminalProfileBlockedAction;
}

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
    command: value?.command?.trim() || 'echo TODO',
    profileId: getTerminalProfile(value?.profileId ?? 'powershell').id,
    group: normalizeRunConfigurationGroup(value?.group),
    cwdMode: normalizeRunConfigurationCwdMode(value?.cwdMode),
    customCwd: value?.customCwd?.trim() || '',
  };
}

export function buildRunConfigurationStorageKey(projectId: string | null | undefined): string {
  const normalizedProjectId = projectId?.trim();
  return normalizedProjectId ? `run-configs.${normalizedProjectId}.v1` : 'run-configs.global.v1';
}

function createRunConfigurationRepository(
  projectId: string | null | undefined,
): BirdCoderJsonRecordRepository<RunConfigurationRecord[]> {
  return createJsonRecordRepository<RunConfigurationRecord[]>({
    binding: {
      ...BIRDCODER_RUN_CONFIGURATION_STORAGE_BINDING,
      storageKey: buildRunConfigurationStorageKey(projectId),
    },
    definition: getBirdCoderEntityDefinition('run_configuration'),
    fallback: getDefaultRunConfigurations(),
    normalize(value) {
      return normalizeRunConfigurations(value);
    },
  });
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
        typeof entry === 'object' && entry !== null ? (entry as Partial<RunConfigurationRecord>) : {},
        index,
      ),
    )
    .slice(0, RUN_CONFIGURATION_LIMIT);

  return normalized.length > 0 ? normalized : getDefaultRunConfigurations();
}

export function resolveRunConfigurationDirectory(
  config: RunConfigurationDirectoryInput,
  projectDirectory: string,
  workspaceDirectory: string,
): string {
  switch (config.cwdMode) {
    case 'custom':
      return config.customCwd.trim() || projectDirectory || workspaceDirectory;
    case 'workspace':
      return workspaceDirectory || projectDirectory;
    default:
      return projectDirectory || workspaceDirectory;
  }
}

export function buildRunConfigurationTerminalRequest(
  configuration: Pick<RunConfigurationRecord, 'command' | 'cwdMode' | 'customCwd' | 'profileId'>,
  options: BuildRunConfigurationTerminalRequestOptions,
): RunConfigurationTerminalRequest {
  return {
    path: resolveRunConfigurationDirectory(
      configuration,
      options.projectDirectory,
      options.workspaceDirectory,
    ),
    command: configuration.command,
    profileId: getTerminalProfile(configuration.profileId).id,
    timestamp: options.timestamp ?? Date.now(),
  };
}

export async function resolveRunConfigurationTerminalLaunch(
  configuration: Pick<RunConfigurationRecord, 'command' | 'cwdMode' | 'customCwd' | 'profileId'>,
  options: ResolveRunConfigurationTerminalLaunchOptions,
): Promise<RunConfigurationTerminalLaunchResult> {
  const profile = getTerminalProfile(configuration.profileId);
  let availability = options.cliAvailabilityByProfileId?.[profile.id];

  if (profile.kind === 'cli' && !availability) {
    availability = (await listTerminalCliProfileAvailability()).find(
      (entry) => entry.profileId === profile.id,
    );
  }

  const launchPresentation = resolveTerminalProfileLaunchPresentation(profile.id, availability);
  const blockedAction = resolveTerminalProfileBlockedAction(profile.id, availability);

  if (!launchPresentation.canLaunch) {
    return {
      request: null,
      launchPresentation,
      blockedAction,
    };
  }

  return {
    request: buildRunConfigurationTerminalRequest(configuration, options),
    launchPresentation,
    blockedAction,
  };
}

export async function listStoredRunConfigurations(
  projectId: string | null | undefined,
): Promise<RunConfigurationRecord[]> {
  return getRunConfigurationRepository(projectId).read();
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
