import {
  createJsonRecordRepository,
  type BirdCoderJsonRecordRepository,
} from '../storage/dataKernel.ts';
import { getTerminalProfile, type TerminalProfileId } from '../terminal/profiles.ts';
import {
  getWorkbenchCodeEngineKernel,
  normalizeWorkbenchCodeEngineKernelId,
  WORKBENCH_ENGINE_KERNELS,
  type WorkbenchCodeEngineId,
} from './kernel.ts';
import {
  BIRDCODER_WORKBENCH_PREFERENCES_STORAGE_BINDING,
  getBirdCoderEntityDefinition,
} from '@sdkwork/birdcoder-types';

export interface WorkbenchCodeEngineDefinition {
  id: WorkbenchCodeEngineId;
  label: string;
  terminalProfileId: TerminalProfileId;
  description: string;
  aliases: readonly string[];
  defaultModelId: string;
  modelIds: readonly string[];
}

export interface WorkbenchChatSelection {
  codeEngineId: WorkbenchCodeEngineId;
  codeModelId: string;
}

export interface WorkbenchPreferences extends WorkbenchChatSelection {
  terminalProfileId: TerminalProfileId;
  defaultWorkingDirectory: string;
}

interface WorkbenchChatSelectionInput {
  codeEngineId?: string | null;
  codeModelId?: string | null;
}

interface WorkbenchPreferencesInput extends WorkbenchChatSelectionInput {
  terminalProfileId?: string | null;
  defaultWorkingDirectory?: string | null;
}

export const WORKBENCH_CODE_ENGINES: ReadonlyArray<WorkbenchCodeEngineDefinition> =
  WORKBENCH_ENGINE_KERNELS.map((engine) => ({
    id: engine.id,
    label: engine.label,
    terminalProfileId: engine.terminalProfileId,
    description: engine.description,
    aliases: [...engine.aliases],
    defaultModelId: engine.defaultModelId,
    modelIds: [...engine.modelIds],
  }));

const DEFAULT_TERMINAL_PROFILE_ID: TerminalProfileId = 'powershell';
const DEFAULT_WORKING_DIRECTORY = getTerminalProfile(DEFAULT_TERMINAL_PROFILE_ID).defaultCwd;

export const DEFAULT_WORKBENCH_PREFERENCES: WorkbenchPreferences = {
  codeEngineId: 'codex',
  codeModelId: getWorkbenchCodeEngineKernel('codex').defaultModelId,
  terminalProfileId: DEFAULT_TERMINAL_PROFILE_ID,
  defaultWorkingDirectory: DEFAULT_WORKING_DIRECTORY,
};

const ENGINE_TERMINAL_PROFILE_SETTING_ALIASES = Object.fromEntries(
  WORKBENCH_ENGINE_KERNELS.flatMap((engine) =>
    [engine.id, engine.label, ...engine.aliases].map((alias) => [
      alias.toLowerCase(),
      engine.terminalProfileId,
    ]),
  ),
) as Readonly<Record<string, TerminalProfileId>>;

const TERMINAL_PROFILE_SETTING_ALIASES: Readonly<Record<string, TerminalProfileId>> = {
  powershell: 'powershell',
  'windows powershell': 'powershell',
  cmd: 'cmd',
  'command prompt': 'cmd',
  bash: 'bash',
  'git bash': 'bash',
  ubuntu: 'ubuntu',
  'ubuntu-22.04': 'ubuntu',
  node: 'node',
  'node.js': 'node',
  ...ENGINE_TERMINAL_PROFILE_SETTING_ALIASES,
};

export function normalizeWorkbenchCodeEngineId(
  value: string | null | undefined,
): WorkbenchCodeEngineId {
  return normalizeWorkbenchCodeEngineKernelId(value);
}

export function getWorkbenchCodeEngineDefinition(
  value: string | null | undefined,
): WorkbenchCodeEngineDefinition {
  const normalizedEngineId = normalizeWorkbenchCodeEngineId(value);
  return (
    WORKBENCH_CODE_ENGINES.find((engine) => engine.id === normalizedEngineId) ??
    WORKBENCH_CODE_ENGINES[0]
  );
}

export function normalizeWorkbenchCodeModelId(
  engineId: string | null | undefined,
  modelId: string | null | undefined,
): string {
  const engine = getWorkbenchCodeEngineDefinition(engineId);
  const normalizedValue = modelId?.trim().toLowerCase();
  if (!normalizedValue) {
    return engine.defaultModelId;
  }

  const matchedModelId = engine.modelIds.find(
    (candidate) => candidate.toLowerCase() === normalizedValue,
  );
  return matchedModelId ?? engine.defaultModelId;
}

export function resolveWorkbenchChatSelection(
  value: WorkbenchChatSelectionInput | null | undefined,
): WorkbenchChatSelection {
  const codeEngineId = normalizeWorkbenchCodeEngineId(value?.codeEngineId);
  return {
    codeEngineId,
    codeModelId: normalizeWorkbenchCodeModelId(codeEngineId, value?.codeModelId),
  };
}

export function normalizeWorkbenchTerminalProfileId(
  value: string | null | undefined,
): TerminalProfileId {
  const normalizedValue = value?.trim().toLowerCase();
  if (!normalizedValue) {
    return DEFAULT_WORKBENCH_PREFERENCES.terminalProfileId;
  }

  const aliasedProfileId = TERMINAL_PROFILE_SETTING_ALIASES[normalizedValue];
  if (aliasedProfileId) {
    return aliasedProfileId;
  }

  return getTerminalProfile(value).id;
}

export function getTerminalShellSettingValue(profileId: TerminalProfileId): string {
  switch (profileId) {
    case 'powershell':
      return 'PowerShell';
    case 'cmd':
      return 'Command Prompt';
    case 'bash':
      return 'Git Bash';
    default:
      return getTerminalProfile(profileId).title;
  }
}

export function normalizeWorkbenchPreferences(
  value: WorkbenchPreferencesInput | null | undefined,
): WorkbenchPreferences {
  const chatSelection = resolveWorkbenchChatSelection(value);
  const terminalProfileId = normalizeWorkbenchTerminalProfileId(value?.terminalProfileId);
  const defaultWorkingDirectory = value?.defaultWorkingDirectory?.trim();

  return {
    ...chatSelection,
    terminalProfileId,
    defaultWorkingDirectory:
      defaultWorkingDirectory && defaultWorkingDirectory.length > 0
        ? defaultWorkingDirectory
        : DEFAULT_WORKBENCH_PREFERENCES.defaultWorkingDirectory,
  };
}

const workbenchPreferencesRepository: BirdCoderJsonRecordRepository<WorkbenchPreferences> =
  createJsonRecordRepository<WorkbenchPreferences>({
    binding: BIRDCODER_WORKBENCH_PREFERENCES_STORAGE_BINDING,
    definition: getBirdCoderEntityDefinition('workbench_preference'),
    fallback: DEFAULT_WORKBENCH_PREFERENCES,
    normalize(value, fallback) {
      const normalizedValue =
        value && typeof value === 'object'
          ? normalizeWorkbenchPreferences(value as WorkbenchPreferencesInput)
          : fallback;

      return normalizeWorkbenchPreferences(normalizedValue);
    },
  });

export function getWorkbenchPreferencesRepository(): BirdCoderJsonRecordRepository<WorkbenchPreferences> {
  return workbenchPreferencesRepository;
}

export async function readWorkbenchPreferences(): Promise<WorkbenchPreferences> {
  return workbenchPreferencesRepository.read();
}

export async function writeWorkbenchPreferences(
  value: Partial<WorkbenchPreferences> | null | undefined,
): Promise<WorkbenchPreferences> {
  return workbenchPreferencesRepository.write(
    normalizeWorkbenchPreferences(value as WorkbenchPreferencesInput | null | undefined),
  );
}

export type { WorkbenchCodeEngineId } from './kernel.ts';
