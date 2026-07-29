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
  normalizeWorkbenchCodeEngineAccessModeId,
  normalizeWorkbenchCodeModelId,
  normalizeWorkbenchServerImplementedCodeEngineId,
  resolveWorkbenchChatSelection,
  type WorkbenchChatSelection,
  type WorkbenchCodeEngineId,
  type WorkbenchCodeEngineSettingsMap,
} from './codeEngineCatalog.ts';
import {
  AGENT_SESSION_INBOX_FILTERS,
  AGENT_SESSION_INBOX_GROUP_MODES,
  AGENT_SESSION_INBOX_SORT_MODES,
  type AgentSessionInboxFilter,
  type AgentSessionInboxGroupMode,
  type AgentSessionInboxSortMode,
} from './sessionInbox.ts';
import { normalizeWorkbenchMode, type WorkbenchMode } from './workbenchMode.ts';

export interface WorkbenchPreferences extends WorkbenchChatSelection {
  workbenchMode: WorkbenchMode;
  codeEngineSettings: WorkbenchCodeEngineSettingsMap;
  disabledComposerCapabilityIds: string[];
  terminalProfileId: TerminalProfileId;
  defaultWorkingDirectory: string;
  codeEditorChatWidth: number;
  sessionInboxFilter: AgentSessionInboxFilter;
  sessionInboxGroupMode: AgentSessionInboxGroupMode;
  sessionInboxProviderId: string;
  sessionInboxShowArchived: boolean;
  sessionInboxSortMode: AgentSessionInboxSortMode;
  gitBranchPrefix: string;
  gitCommitInstructions: string;
  gitCreateDraftPullRequest: boolean;
  gitForceWithLease: boolean;
  gitPullRequestInstructions: string;
  gitPullRequestMergeMethod: GitPullRequestMergeMethod;
  gitReviewDeliveryMode: GitReviewDeliveryMode;
  worktreeAutoPrune: boolean;
  worktreeListLimit: number;
}

export const GIT_PULL_REQUEST_MERGE_METHODS = ['merge', 'squash'] as const;
export type GitPullRequestMergeMethod = (typeof GIT_PULL_REQUEST_MERGE_METHODS)[number];

export const GIT_REVIEW_DELIVERY_MODES = ['inline', 'separate'] as const;
export type GitReviewDeliveryMode = (typeof GIT_REVIEW_DELIVERY_MODES)[number];

interface WorkbenchPreferencesInput {
  workbenchMode?: string | null;
  codeEngineId?: string | null;
  codeModelId?: string | null;
  codeEngineSettings?: unknown;
  disabledComposerCapabilityIds?: unknown;
  terminalProfileId?: string | null;
  defaultWorkingDirectory?: string | null;
  codeEditorChatWidth?: number | null;
  sessionInboxFilter?: string | null;
  sessionInboxGroupMode?: string | null;
  sessionInboxProviderId?: string | null;
  sessionInboxShowArchived?: boolean | null;
  sessionInboxSortMode?: string | null;
  gitBranchPrefix?: string | null;
  gitCommitInstructions?: string | null;
  gitCreateDraftPullRequest?: boolean | null;
  gitForceWithLease?: boolean | null;
  gitPullRequestInstructions?: string | null;
  gitPullRequestMergeMethod?: string | null;
  gitReviewDeliveryMode?: string | null;
  worktreeAutoPrune?: boolean | null;
  worktreeListLimit?: number | null;
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
export const MIN_WORKTREE_LIST_LIMIT = 1;
export const MAX_WORKTREE_LIST_LIMIT = 100;
export const DEFAULT_WORKTREE_LIST_LIMIT = 15;
export const DEFAULT_GIT_BRANCH_PREFIX = 'codex/';
export const MAX_GIT_BRANCH_PREFIX_LENGTH = 120;
export const MAX_GIT_INSTRUCTIONS_LENGTH = 12_000;
export const MAX_DISABLED_COMPOSER_CAPABILITY_IDS = 500;
export const MAX_COMPOSER_CAPABILITY_ID_LENGTH = 512;

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
  workbenchMode: 'coding',
  codeEngineSettings: {},
  disabledComposerCapabilityIds: [],
  terminalProfileId: DEFAULT_TERMINAL_PROFILE_ID,
  defaultWorkingDirectory: DEFAULT_WORKING_DIRECTORY,
  codeEditorChatWidth: DEFAULT_WORKBENCH_CODE_EDITOR_CHAT_WIDTH,
  sessionInboxFilter: 'all',
  sessionInboxGroupMode: 'project',
  sessionInboxProviderId: 'all',
  sessionInboxShowArchived: false,
  sessionInboxSortMode: 'smart',
  gitBranchPrefix: DEFAULT_GIT_BRANCH_PREFIX,
  gitCommitInstructions: '',
  gitCreateDraftPullRequest: true,
  gitForceWithLease: false,
  gitPullRequestInstructions: '',
  gitPullRequestMergeMethod: 'merge',
  gitReviewDeliveryMode: 'inline',
  worktreeAutoPrune: true,
  worktreeListLimit: DEFAULT_WORKTREE_LIST_LIMIT,
};

function normalizeStringEnum<TValue extends string>(
  value: string | null | undefined,
  allowedValues: readonly TValue[],
  fallback: TValue,
): TValue {
  const normalized = value?.trim().toLowerCase();
  return allowedValues.includes(normalized as TValue) ? normalized as TValue : fallback;
}

function normalizeSessionInboxProviderId(value: string | null | undefined): string {
  const normalized = value?.trim();
  return normalized && normalized.length <= 160 ? normalized : 'all';
}

export function normalizeWorkbenchDisabledComposerCapabilityIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedIds: string[] = [];
  const seenIds = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }
    const normalizedId = entry.trim().slice(0, MAX_COMPOSER_CAPABILITY_ID_LENGTH);
    if (!normalizedId || seenIds.has(normalizedId)) {
      continue;
    }
    seenIds.add(normalizedId);
    normalizedIds.push(normalizedId);
    if (normalizedIds.length >= MAX_DISABLED_COMPOSER_CAPABILITY_IDS) {
      break;
    }
  }
  return normalizedIds;
}

export function normalizeWorkbenchGitBranchPrefix(
  value: string | null | undefined,
): string {
  if (value === null || value === undefined) {
    return DEFAULT_GIT_BRANCH_PREFIX;
  }
  return value.trim().slice(0, MAX_GIT_BRANCH_PREFIX_LENGTH);
}

function normalizeGitInstructions(value: string | null | undefined): string {
  return typeof value === 'string' ? value.slice(0, MAX_GIT_INSTRUCTIONS_LENGTH) : '';
}

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

export function normalizeWorkbenchWorktreeListLimit(
  value: number | null | undefined,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_WORKTREE_LIST_LIMIT;
  }
  return Math.max(
    MIN_WORKTREE_LIST_LIMIT,
    Math.min(MAX_WORKTREE_LIST_LIMIT, Math.round(value)),
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
    workbenchMode: normalizeWorkbenchMode(value?.workbenchMode),
    codeEngineSettings,
    disabledComposerCapabilityIds: normalizeWorkbenchDisabledComposerCapabilityIds(
      value?.disabledComposerCapabilityIds,
    ),
    terminalProfileId,
    defaultWorkingDirectory:
      defaultWorkingDirectory || DEFAULT_WORKBENCH_PREFERENCES.defaultWorkingDirectory,
    codeEditorChatWidth: normalizeWorkbenchCodeEditorChatWidth(value?.codeEditorChatWidth),
    sessionInboxFilter: normalizeStringEnum(
      value?.sessionInboxFilter,
      AGENT_SESSION_INBOX_FILTERS,
      DEFAULT_WORKBENCH_PREFERENCES.sessionInboxFilter,
    ),
    sessionInboxGroupMode: normalizeStringEnum(
      value?.sessionInboxGroupMode,
      AGENT_SESSION_INBOX_GROUP_MODES,
      DEFAULT_WORKBENCH_PREFERENCES.sessionInboxGroupMode,
    ),
    sessionInboxProviderId: normalizeSessionInboxProviderId(value?.sessionInboxProviderId),
    sessionInboxShowArchived: value?.sessionInboxShowArchived === true,
    sessionInboxSortMode: normalizeStringEnum(
      value?.sessionInboxSortMode,
      AGENT_SESSION_INBOX_SORT_MODES,
      DEFAULT_WORKBENCH_PREFERENCES.sessionInboxSortMode,
    ),
    gitBranchPrefix: normalizeWorkbenchGitBranchPrefix(value?.gitBranchPrefix),
    gitCommitInstructions: normalizeGitInstructions(value?.gitCommitInstructions),
    gitCreateDraftPullRequest: typeof value?.gitCreateDraftPullRequest === 'boolean'
      ? value.gitCreateDraftPullRequest
      : DEFAULT_WORKBENCH_PREFERENCES.gitCreateDraftPullRequest,
    gitForceWithLease: typeof value?.gitForceWithLease === 'boolean'
      ? value.gitForceWithLease
      : DEFAULT_WORKBENCH_PREFERENCES.gitForceWithLease,
    gitPullRequestInstructions: normalizeGitInstructions(value?.gitPullRequestInstructions),
    gitPullRequestMergeMethod: normalizeStringEnum(
      value?.gitPullRequestMergeMethod,
      GIT_PULL_REQUEST_MERGE_METHODS,
      DEFAULT_WORKBENCH_PREFERENCES.gitPullRequestMergeMethod,
    ),
    gitReviewDeliveryMode: normalizeStringEnum(
      value?.gitReviewDeliveryMode,
      GIT_REVIEW_DELIVERY_MODES,
      DEFAULT_WORKBENCH_PREFERENCES.gitReviewDeliveryMode,
    ),
    worktreeAutoPrune: typeof value?.worktreeAutoPrune === 'boolean'
      ? value.worktreeAutoPrune
      : DEFAULT_WORKBENCH_PREFERENCES.worktreeAutoPrune,
    worktreeListLimit: normalizeWorkbenchWorktreeListLimit(value?.worktreeListLimit),
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
      [normalizedEngineId]: {
        ...normalizedPreferences.codeEngineSettings[normalizedEngineId],
        defaultModelId: resolvedModelId,
      },
    },
    codeModelId:
      normalizedPreferences.codeEngineId === normalizedEngineId
        ? resolvedModelId
        : normalizedPreferences.codeModelId,
  });
}

export function setWorkbenchCodeEngineAccessMode(
  preferences: WorkbenchPreferences,
  engineId: string | null | undefined,
  accessModeId: string | null | undefined,
): WorkbenchPreferences {
  const normalizedPreferences = normalizeWorkbenchPreferences(preferences);
  const normalizedEngineId = resolveKnownWorkbenchCodeEngineId(engineId, normalizedPreferences);
  if (!normalizedEngineId) {
    return normalizedPreferences;
  }
  const resolvedAccessModeId = normalizeWorkbenchCodeEngineAccessModeId(
    normalizedEngineId,
    accessModeId,
    normalizedPreferences,
  );
  if (!resolvedAccessModeId) {
    return normalizedPreferences;
  }
  const currentSettings = normalizedPreferences.codeEngineSettings[normalizedEngineId];
  return normalizeWorkbenchPreferences({
    ...normalizedPreferences,
    codeEngineSettings: {
      ...normalizedPreferences.codeEngineSettings,
      [normalizedEngineId]: {
        ...currentSettings,
        defaultModelId: currentSettings?.defaultModelId
          ?? findWorkbenchCodeEngineDefinition(normalizedEngineId)?.defaultModelId
          ?? '',
        accessModeId: resolvedAccessModeId,
      },
    },
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
      [resolvedEngineId]: {
        ...normalizedPreferences.codeEngineSettings[resolvedEngineId],
        defaultModelId: selection.codeModelId,
      },
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
