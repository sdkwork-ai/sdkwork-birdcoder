import {
  createJsonRecordRepository,
  type BirdCoderJsonRecordRepository,
} from '../storage/dataKernel.ts';
import { getTerminalProfile, type TerminalProfileId } from '../terminal/profiles.ts';
import {
  DEFAULT_WORKBENCH_CHAT_SELECTION,
  WORKBENCH_ENGINE_KERNELS,
  normalizeWorkbenchCodeEngineId,
  normalizeWorkbenchCodeEngineSettingsMap,
  normalizeWorkbenchCodeModelId,
  resolveWorkbenchChatSelection,
  type WorkbenchChatSelection,
  type WorkbenchCodeEngineSettingsMap,
  type WorkbenchCustomCodeEngineModelInput,
} from '@sdkwork/birdcoder-codeengine';
import {
  BIRDCODER_WORKBENCH_PREFERENCES_STORAGE_BINDING,
} from '@sdkwork/birdcoder-types/storageBindings';

export interface WorkbenchPreferences extends WorkbenchChatSelection {
  codeEngineSettings: WorkbenchCodeEngineSettingsMap;
  terminalProfileId: TerminalProfileId;
  defaultWorkingDirectory: string;
  codeEditorChatWidth: number;
}

interface WorkbenchPreferencesInput {
  codeEngineId?: string | null;
  codeModelId?: string | null;
  codeEngineSettings?: unknown;
  terminalProfileId?: string | null;
  defaultWorkingDirectory?: string | null;
  codeEditorChatWidth?: number | null;
}

const DEFAULT_TERMINAL_PROFILE_ID: TerminalProfileId = 'powershell';
const DEFAULT_WORKING_DIRECTORY = getTerminalProfile(DEFAULT_TERMINAL_PROFILE_ID).defaultCwd;
export const MIN_WORKBENCH_CODE_EDITOR_CHAT_WIDTH = 320;
export const MAX_WORKBENCH_CODE_EDITOR_CHAT_WIDTH = 960;
export const DEFAULT_WORKBENCH_CODE_EDITOR_CHAT_WIDTH = 520;

export function normalizeWorkbenchCodeEditorChatWidth(
  value: number | null | undefined,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_WORKBENCH_CODE_EDITOR_CHAT_WIDTH;
  }

  return Math.max(
    MIN_WORKBENCH_CODE_EDITOR_CHAT_WIDTH,
    Math.min(MAX_WORKBENCH_CODE_EDITOR_CHAT_WIDTH, Math.round(value)),
  );
}

export const DEFAULT_WORKBENCH_PREFERENCES: WorkbenchPreferences = {
  ...DEFAULT_WORKBENCH_CHAT_SELECTION,
  codeEngineSettings: {},
  terminalProfileId: DEFAULT_TERMINAL_PROFILE_ID,
  defaultWorkingDirectory: DEFAULT_WORKING_DIRECTORY,
  codeEditorChatWidth: DEFAULT_WORKBENCH_CODE_EDITOR_CHAT_WIDTH,
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

function createCustomModelRecord(
  input: WorkbenchCustomCodeEngineModelInput | null | undefined,
) {
  const id = input?.id?.trim() || input?.modelId?.trim() || '';
  if (!id) {
    return null;
  }

  const label = input?.label?.trim() || id;
  return {
    id,
    label,
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

  return getTerminalProfile(normalizedValue).id;
}

export function normalizeWorkbenchPreferences(
  value: WorkbenchPreferencesInput | null | undefined,
): WorkbenchPreferences {
  const codeEngineSettings = normalizeWorkbenchCodeEngineSettingsMap(value?.codeEngineSettings);
  const chatSelection = resolveWorkbenchChatSelection(value, { codeEngineSettings });
  const terminalProfileId = normalizeWorkbenchTerminalProfileId(value?.terminalProfileId);
  const defaultWorkingDirectory = value?.defaultWorkingDirectory?.trim();

  return {
    ...chatSelection,
    codeEngineSettings,
    terminalProfileId,
    codeEditorChatWidth: normalizeWorkbenchCodeEditorChatWidth(value?.codeEditorChatWidth),
    defaultWorkingDirectory:
      defaultWorkingDirectory && defaultWorkingDirectory.length > 0
        ? defaultWorkingDirectory
        : DEFAULT_WORKBENCH_PREFERENCES.defaultWorkingDirectory,
  };
}

export function setWorkbenchCodeEngineDefaultModel(
  preferences: WorkbenchPreferences,
  engineId: string | null | undefined,
  modelId: string | null | undefined,
): WorkbenchPreferences {
  const normalizedPreferences = normalizeWorkbenchPreferences(preferences);
  const normalizedEngineId = normalizeWorkbenchCodeEngineId(engineId);
  const existingEntry = normalizedPreferences.codeEngineSettings[normalizedEngineId];
  const resolvedModelId = normalizeWorkbenchCodeModelId(
    normalizedEngineId,
    modelId,
    normalizedPreferences,
  );
  const nextSettings = normalizeWorkbenchCodeEngineSettingsMap({
    ...normalizedPreferences.codeEngineSettings,
    [normalizedEngineId]: {
      defaultModelId: resolvedModelId,
      customModels: existingEntry?.customModels ?? [],
    },
  });

  return normalizeWorkbenchPreferences({
    ...normalizedPreferences,
    codeEngineSettings: nextSettings,
    codeModelId:
      normalizedPreferences.codeEngineId === normalizedEngineId
        ? resolvedModelId
        : normalizedPreferences.codeModelId,
  });
}

export function upsertWorkbenchCodeEngineCustomModel(
  preferences: WorkbenchPreferences,
  engineId: string | null | undefined,
  model: WorkbenchCustomCodeEngineModelInput | null | undefined,
): WorkbenchPreferences {
  const normalizedPreferences = normalizeWorkbenchPreferences(preferences);
  const normalizedEngineId = normalizeWorkbenchCodeEngineId(engineId);
  const existingEntry = normalizedPreferences.codeEngineSettings[normalizedEngineId];
  const nextCustomModel = createCustomModelRecord(model);
  if (!nextCustomModel) {
    return normalizedPreferences;
  }

  const nextSettings = normalizeWorkbenchCodeEngineSettingsMap({
    ...normalizedPreferences.codeEngineSettings,
    [normalizedEngineId]: {
      defaultModelId: existingEntry?.defaultModelId,
      customModels: [...(existingEntry?.customModels ?? []), nextCustomModel],
    },
  });

  return normalizeWorkbenchPreferences({
    ...normalizedPreferences,
    codeEngineSettings: nextSettings,
  });
}

export function removeWorkbenchCodeEngineCustomModel(
  preferences: WorkbenchPreferences,
  engineId: string | null | undefined,
  modelId: string | null | undefined,
): WorkbenchPreferences {
  const normalizedPreferences = normalizeWorkbenchPreferences(preferences);
  const normalizedEngineId = normalizeWorkbenchCodeEngineId(engineId);
  const existingEntry = normalizedPreferences.codeEngineSettings[normalizedEngineId];
  if (!existingEntry) {
    return normalizedPreferences;
  }

  const normalizedModelId = modelId?.trim().toLowerCase() || '';
  if (!normalizedModelId) {
    return normalizedPreferences;
  }

  const nextSettings = normalizeWorkbenchCodeEngineSettingsMap({
    ...normalizedPreferences.codeEngineSettings,
    [normalizedEngineId]: {
      defaultModelId: existingEntry.defaultModelId,
      customModels: existingEntry.customModels.filter(
        (candidate) => candidate.id.toLowerCase() !== normalizedModelId,
      ),
    },
  });

  return normalizeWorkbenchPreferences({
    ...normalizedPreferences,
    codeEngineSettings: nextSettings,
    codeModelId:
      normalizedPreferences.codeEngineId === normalizedEngineId &&
      normalizedPreferences.codeModelId.toLowerCase() === normalizedModelId
        ? normalizeWorkbenchCodeModelId(normalizedEngineId, null, {
            codeEngineSettings: nextSettings,
          })
        : normalizedPreferences.codeModelId,
  });
}

const workbenchPreferencesRepository: BirdCoderJsonRecordRepository<WorkbenchPreferences> =
  createJsonRecordRepository<WorkbenchPreferences>({
    binding: BIRDCODER_WORKBENCH_PREFERENCES_STORAGE_BINDING,
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

export type {
  WorkbenchCodeEngineDefinition,
  WorkbenchCodeEngineId,
  WorkbenchCodeEngineSettingsMap,
} from '@sdkwork/birdcoder-codeengine';
