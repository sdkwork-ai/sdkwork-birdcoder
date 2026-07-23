import { getTerminalProfile, type TerminalProfileId } from '../terminal/profiles.ts';
import {
  deserializeStoredValue,
  getStoredRawValue,
  removeStoredValue,
  serializeStoredValue,
  setStoredRawValue,
} from '../storage/localStore.ts';
import {
  DEFAULT_WORKBENCH_CHAT_SELECTION,
  findWorkbenchCodeEngineDefinition,
  normalizeWorkbenchCodeEngineSettingsMap,
  normalizeWorkbenchCodeModelId,
  normalizeWorkbenchServerImplementedCodeEngineId,
  resolveWorkbenchChatSelection,
  type WorkbenchChatSelection,
  type WorkbenchCodeEngineId,
  type WorkbenchCodeEngineSettingsMap,
} from './codeEngineCatalog.ts';

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

export interface WorkbenchPreferencesStore {
  clear(): Promise<void>;
  read(): Promise<WorkbenchPreferences>;
  write(value: WorkbenchPreferencesInput): Promise<WorkbenchPreferences>;
}

const DEFAULT_TERMINAL_PROFILE_ID: TerminalProfileId = 'powershell';
const DEFAULT_WORKING_DIRECTORY = getTerminalProfile(DEFAULT_TERMINAL_PROFILE_ID).defaultCwd;
const WORKBENCH_PREFERENCES_SCOPE = 'workbench-settings';
const WORKBENCH_PREFERENCES_KEY = 'preferences.v1';

export const MIN_WORKBENCH_CODE_EDITOR_CHAT_WIDTH = 320;
export const MAX_WORKBENCH_CODE_EDITOR_CHAT_WIDTH = 960;
export const DEFAULT_WORKBENCH_CODE_EDITOR_CHAT_WIDTH = 520;

const TERMINAL_PROFILE_ALIASES: Readonly<Record<string, TerminalProfileId>> = {
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
};

export const DEFAULT_WORKBENCH_PREFERENCES: WorkbenchPreferences = {
  ...DEFAULT_WORKBENCH_CHAT_SELECTION,
  codeEngineSettings: {},
  terminalProfileId: DEFAULT_TERMINAL_PROFILE_ID,
  defaultWorkingDirectory: DEFAULT_WORKING_DIRECTORY,
  codeEditorChatWidth: DEFAULT_WORKBENCH_CODE_EDITOR_CHAT_WIDTH,
};

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

export function normalizeWorkbenchTerminalProfileId(
  value: string | null | undefined,
): TerminalProfileId {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_TERMINAL_PROFILE_ID;
  }
  return TERMINAL_PROFILE_ALIASES[normalized] ?? getTerminalProfile(normalized).id;
}

export function normalizeWorkbenchPreferences(
  value: WorkbenchPreferencesInput | null | undefined,
): WorkbenchPreferences {
  const codeEngineSettings = normalizeWorkbenchCodeEngineSettingsMap(value?.codeEngineSettings);
  const terminalProfileId = normalizeWorkbenchTerminalProfileId(value?.terminalProfileId);
  const defaultWorkingDirectory = value?.defaultWorkingDirectory?.trim();
  return {
    ...resolveWorkbenchChatSelection(value, { codeEngineSettings }),
    codeEngineSettings,
    terminalProfileId,
    defaultWorkingDirectory:
      defaultWorkingDirectory || DEFAULT_WORKBENCH_PREFERENCES.defaultWorkingDirectory,
    codeEditorChatWidth: normalizeWorkbenchCodeEditorChatWidth(value?.codeEditorChatWidth),
  };
}

function parseStoredPreferences(raw: string | null): WorkbenchPreferences {
  return normalizeWorkbenchPreferences(
    deserializeStoredValue<WorkbenchPreferencesInput | null>(raw, null),
  );
}

const workbenchPreferencesStore: WorkbenchPreferencesStore = {
  async clear() {
    await removeStoredValue(WORKBENCH_PREFERENCES_SCOPE, WORKBENCH_PREFERENCES_KEY);
  },
  async read() {
    return parseStoredPreferences(
      await getStoredRawValue(WORKBENCH_PREFERENCES_SCOPE, WORKBENCH_PREFERENCES_KEY),
    );
  },
  async write(value) {
    const normalized = normalizeWorkbenchPreferences(value);
    await setStoredRawValue(
      WORKBENCH_PREFERENCES_SCOPE,
      WORKBENCH_PREFERENCES_KEY,
      serializeStoredValue(normalized),
    );
    return normalized;
  },
};

function resolveKnownWorkbenchCodeEngineId(
  engineId: string | null | undefined,
  preferences?: WorkbenchPreferences | null,
): WorkbenchCodeEngineId | null {
  return findWorkbenchCodeEngineDefinition(engineId, preferences)?.id ?? null;
}

export function setWorkbenchCodeEngineDefaultModel(
  preferences: WorkbenchPreferences,
  engineId: string | null | undefined,
  modelId: string | null | undefined,
): WorkbenchPreferences {
  const normalizedPreferences = normalizeWorkbenchPreferences(preferences);
  const normalizedEngineId = resolveKnownWorkbenchCodeEngineId(engineId, normalizedPreferences);
  if (!normalizedEngineId) {
    return normalizedPreferences;
  }
  const resolvedModelId = normalizeWorkbenchCodeModelId(
    normalizedEngineId,
    modelId,
    normalizedPreferences,
  );
  return normalizeWorkbenchPreferences({
    ...normalizedPreferences,
    codeEngineSettings: {
      ...normalizedPreferences.codeEngineSettings,
      [normalizedEngineId]: { defaultModelId: resolvedModelId },
    },
    codeModelId:
      normalizedPreferences.codeEngineId === normalizedEngineId
        ? resolvedModelId
        : normalizedPreferences.codeModelId,
  });
}

export function setWorkbenchActiveCodeEngine(
  preferences: WorkbenchPreferences,
  engineId: string | null | undefined,
): WorkbenchPreferences {
  const normalizedPreferences = normalizeWorkbenchPreferences(preferences);
  const resolvedEngineId = normalizeWorkbenchServerImplementedCodeEngineId(
    engineId,
    normalizedPreferences,
  );
  return normalizeWorkbenchPreferences({
    ...normalizedPreferences,
    ...resolveWorkbenchChatSelection(
      {
        codeEngineId: resolvedEngineId,
        codeModelId: normalizedPreferences.codeModelId,
      },
      normalizedPreferences,
    ),
  });
}

export function setWorkbenchActiveChatSelection(
  preferences: WorkbenchPreferences,
  engineId: string | null | undefined,
  modelId: string | null | undefined,
): WorkbenchPreferences {
  const normalizedPreferences = normalizeWorkbenchPreferences(preferences);
  const resolvedEngineId = normalizeWorkbenchServerImplementedCodeEngineId(
    resolveKnownWorkbenchCodeEngineId(engineId, normalizedPreferences)
      ?? engineId
      ?? normalizedPreferences.codeEngineId,
    normalizedPreferences,
  );
  const selection = resolveWorkbenchChatSelection(
    { codeEngineId: resolvedEngineId, codeModelId: modelId },
    normalizedPreferences,
  );
  return normalizeWorkbenchPreferences({
    ...normalizedPreferences,
    ...selection,
    codeEngineSettings: {
      ...normalizedPreferences.codeEngineSettings,
      [resolvedEngineId]: { defaultModelId: selection.codeModelId },
    },
  });
}

export function setWorkbenchActiveCodeModel(
  preferences: WorkbenchPreferences,
  modelId: string | null | undefined,
  engineId?: string | null,
): WorkbenchPreferences {
  return setWorkbenchActiveChatSelection(preferences, engineId, modelId);
}

export function getWorkbenchPreferencesStore(): WorkbenchPreferencesStore {
  return workbenchPreferencesStore;
}

export async function readWorkbenchPreferences(): Promise<WorkbenchPreferences> {
  return workbenchPreferencesStore.read();
}

export async function writeWorkbenchPreferences(
  value: WorkbenchPreferencesInput,
): Promise<WorkbenchPreferences> {
  return workbenchPreferencesStore.write(value);
}

export async function ensureWorkbenchPreferences(): Promise<WorkbenchPreferences> {
  const raw = await getStoredRawValue(WORKBENCH_PREFERENCES_SCOPE, WORKBENCH_PREFERENCES_KEY);
  const normalized = parseStoredPreferences(raw);
  const normalizedRaw = serializeStoredValue(normalized);
  if (raw !== normalizedRaw) {
    await setStoredRawValue(WORKBENCH_PREFERENCES_SCOPE, WORKBENCH_PREFERENCES_KEY, normalizedRaw);
  }
  return normalized;
}
