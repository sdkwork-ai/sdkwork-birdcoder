import {
  coerceBirdCoderSqlEntityRow,
  createBirdCoderTableRecordRepository,
  type BirdCoderJsonRecordRepository,
  type BirdCoderTableRecordRepository,
} from '../storage/dataKernel.ts';
import { getTerminalProfile, type TerminalProfileId } from '../terminal/profiles.ts';
import {
  DEFAULT_WORKBENCH_CHAT_SELECTION,
  WORKBENCH_ENGINE_KERNELS,
  findWorkbenchCodeEngineDefinition,
  normalizeWorkbenchCodeEngineSettingsMap,
  normalizeWorkbenchCodeModelId,
  normalizeWorkbenchServerImplementedCodeEngineId,
  resolveWorkbenchChatSelection,
  type WorkbenchChatSelection,
  type WorkbenchCodeEngineSettingsMap,
  type WorkbenchCodeEngineId,
  type WorkbenchCustomCodeEngineModelInput,
} from '@sdkwork/birdcoder-codeengine';
import {
  BIRDCODER_WORKBENCH_PREFERENCES_STORAGE_BINDING,
  getBirdCoderEntityDefinition,
} from '@sdkwork/birdcoder-types';

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

interface PersistedWorkbenchPreferencesRecord {
  id: string;
  uuid?: string;
  tenantId?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  scopeType: 'global' | 'workspace' | 'project';
  scopeId: string;
  codeEngineId: string;
  codeModelId: string;
  terminalProfileId: TerminalProfileId;
  payload: {
    codeEngineSettings?: unknown;
    defaultWorkingDirectory?: string | null;
    codeEditorChatWidth?: number | null;
  };
}

const DEFAULT_TERMINAL_PROFILE_ID: TerminalProfileId = 'powershell';
const DEFAULT_WORKING_DIRECTORY = getTerminalProfile(DEFAULT_TERMINAL_PROFILE_ID).defaultCwd;
export const MIN_WORKBENCH_CODE_EDITOR_CHAT_WIDTH = 320;
export const MAX_WORKBENCH_CODE_EDITOR_CHAT_WIDTH = 960;
export const DEFAULT_WORKBENCH_CODE_EDITOR_CHAT_WIDTH = 520;
const WORKBENCH_PREFERENCES_SCOPE_TYPE: PersistedWorkbenchPreferencesRecord['scopeType'] = 'global';
const WORKBENCH_PREFERENCES_SCOPE_ID = 'global';
const WORKBENCH_PREFERENCES_STORAGE_ID = 'workbench-preference:global:global';
const WORKBENCH_PREFERENCES_DEFINITION = getBirdCoderEntityDefinition('workbench_preference');

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

function createWorkbenchPreferencesUuid(storageId: string): string {
  return globalThis.crypto?.randomUUID?.() ?? `${storageId}:uuid`;
}

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

function createPersistedWorkbenchPreferencesRecord(
  value: WorkbenchPreferences,
  existingRecord?: PersistedWorkbenchPreferencesRecord | null,
): PersistedWorkbenchPreferencesRecord {
  const timestamp = new Date().toISOString();
  return {
    id: WORKBENCH_PREFERENCES_STORAGE_ID,
    uuid:
      existingRecord?.uuid ?? createWorkbenchPreferencesUuid(WORKBENCH_PREFERENCES_STORAGE_ID),
    tenantId: existingRecord?.tenantId,
    organizationId: existingRecord?.organizationId,
    createdAt: existingRecord?.createdAt ?? timestamp,
    updatedAt: timestamp,
    scopeType: WORKBENCH_PREFERENCES_SCOPE_TYPE,
    scopeId: WORKBENCH_PREFERENCES_SCOPE_ID,
    codeEngineId: value.codeEngineId,
    codeModelId: value.codeModelId,
    terminalProfileId: value.terminalProfileId,
    payload: {
      codeEngineSettings: value.codeEngineSettings,
      defaultWorkingDirectory: value.defaultWorkingDirectory,
      codeEditorChatWidth: value.codeEditorChatWidth,
    },
  };
}

function normalizePersistedWorkbenchPreferencesRecord(
  value: unknown,
): PersistedWorkbenchPreferencesRecord | null {
  if (value && typeof value === 'object' && 'codeEngineId' in value) {
    const record = value as Partial<PersistedWorkbenchPreferencesRecord>;
    const normalizedPreferences = normalizeWorkbenchPreferences({
      codeEngineId: typeof record.codeEngineId === 'string' ? record.codeEngineId : undefined,
      codeModelId: typeof record.codeModelId === 'string' ? record.codeModelId : undefined,
      terminalProfileId:
        typeof record.terminalProfileId === 'string' ? record.terminalProfileId : undefined,
      codeEngineSettings: record.payload?.codeEngineSettings,
      defaultWorkingDirectory: record.payload?.defaultWorkingDirectory,
      codeEditorChatWidth: record.payload?.codeEditorChatWidth,
    });

    return {
      id:
        typeof record.id === 'string' && record.id.trim().length > 0
          ? record.id
          : WORKBENCH_PREFERENCES_STORAGE_ID,
      uuid:
        typeof record.uuid === 'string' && record.uuid.trim().length > 0
          ? record.uuid
          : createWorkbenchPreferencesUuid(WORKBENCH_PREFERENCES_STORAGE_ID),
      tenantId:
        typeof record.tenantId === 'string' && record.tenantId.trim().length > 0
          ? record.tenantId
          : undefined,
      organizationId:
        typeof record.organizationId === 'string' && record.organizationId.trim().length > 0
          ? record.organizationId
          : undefined,
      createdAt:
        typeof record.createdAt === 'string' && record.createdAt.trim().length > 0
          ? record.createdAt
          : new Date(0).toISOString(),
      updatedAt:
        typeof record.updatedAt === 'string' && record.updatedAt.trim().length > 0
          ? record.updatedAt
          : new Date(0).toISOString(),
      scopeType:
        record.scopeType === 'workspace' || record.scopeType === 'project'
          ? record.scopeType
          : WORKBENCH_PREFERENCES_SCOPE_TYPE,
      scopeId:
        typeof record.scopeId === 'string' && record.scopeId.trim().length > 0
          ? record.scopeId
          : WORKBENCH_PREFERENCES_SCOPE_ID,
      codeEngineId: normalizedPreferences.codeEngineId,
      codeModelId: normalizedPreferences.codeModelId,
      terminalProfileId: normalizedPreferences.terminalProfileId,
      payload: {
        codeEngineSettings: normalizedPreferences.codeEngineSettings,
        defaultWorkingDirectory: normalizedPreferences.defaultWorkingDirectory,
        codeEditorChatWidth: normalizedPreferences.codeEditorChatWidth,
      },
    };
  }

  const row = coerceBirdCoderSqlEntityRow(WORKBENCH_PREFERENCES_DEFINITION, value);
  if (row && typeof row.id === 'string') {
    const payload = row.payload_json && typeof row.payload_json === 'object'
      ? (row.payload_json as PersistedWorkbenchPreferencesRecord['payload'])
      : {};
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
      uuid: typeof row.uuid === 'string' ? row.uuid : undefined,
      tenantId: typeof row.tenant_id === 'string' ? row.tenant_id : undefined,
      organizationId:
        typeof row.organization_id === 'string' ? row.organization_id : undefined,
      createdAt,
      updatedAt,
      scopeType:
        row.scope_type === 'workspace' || row.scope_type === 'project'
          ? row.scope_type
          : 'global',
      scopeId:
        typeof row.scope_id === 'string' && row.scope_id.trim().length > 0
          ? row.scope_id.trim()
          : WORKBENCH_PREFERENCES_SCOPE_ID,
      codeEngineId:
        typeof row.code_engine_id === 'string'
          ? row.code_engine_id
          : DEFAULT_WORKBENCH_PREFERENCES.codeEngineId,
      codeModelId:
        typeof row.code_model_id === 'string'
          ? row.code_model_id
          : DEFAULT_WORKBENCH_PREFERENCES.codeModelId,
      terminalProfileId: getTerminalProfile(
        typeof row.terminal_profile_id === 'string'
          ? row.terminal_profile_id
          : DEFAULT_WORKBENCH_PREFERENCES.terminalProfileId,
      ).id,
      payload,
    };
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  return createPersistedWorkbenchPreferencesRecord(
    normalizeWorkbenchPreferences(value as WorkbenchPreferencesInput),
    {
      id: WORKBENCH_PREFERENCES_STORAGE_ID,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      scopeType: WORKBENCH_PREFERENCES_SCOPE_TYPE,
      scopeId: WORKBENCH_PREFERENCES_SCOPE_ID,
      codeEngineId: DEFAULT_WORKBENCH_PREFERENCES.codeEngineId,
      codeModelId: DEFAULT_WORKBENCH_PREFERENCES.codeModelId,
      terminalProfileId: DEFAULT_WORKBENCH_PREFERENCES.terminalProfileId,
      payload: {},
    },
  );
}

function toWorkbenchPreferences(
  value: PersistedWorkbenchPreferencesRecord | null | undefined,
): WorkbenchPreferences {
  if (!value) {
    return DEFAULT_WORKBENCH_PREFERENCES;
  }

  return normalizeWorkbenchPreferences({
    codeEngineId: value.codeEngineId,
    codeModelId: value.codeModelId,
    terminalProfileId: value.terminalProfileId,
    codeEngineSettings: value.payload.codeEngineSettings,
    defaultWorkingDirectory: value.payload.defaultWorkingDirectory,
    codeEditorChatWidth: value.payload.codeEditorChatWidth,
  });
}

function toWorkbenchPreferencesStorageRow(
  value: PersistedWorkbenchPreferencesRecord,
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
    scope_type: value.scopeType,
    scope_id: value.scopeId,
    code_engine_id: value.codeEngineId,
    code_model_id: value.codeModelId,
    terminal_profile_id: value.terminalProfileId,
    payload_json: value.payload,
  };
}

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
  const normalizedEngineId = resolveKnownWorkbenchCodeEngineId(
    engineId,
    normalizedPreferences,
  );
  if (!normalizedEngineId) {
    return normalizedPreferences;
  }
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
    resolveKnownWorkbenchCodeEngineId(engineId, normalizedPreferences) ??
      engineId ??
      normalizedPreferences.codeEngineId,
    normalizedPreferences,
  );

  return normalizeWorkbenchPreferences({
    ...normalizedPreferences,
    ...resolveWorkbenchChatSelection(
      {
        codeEngineId: resolvedEngineId,
        codeModelId: modelId,
      },
      normalizedPreferences,
    ),
  });
}

export function setWorkbenchActiveCodeModel(
  preferences: WorkbenchPreferences,
  modelId: string | null | undefined,
  engineId?: string | null,
): WorkbenchPreferences {
  return setWorkbenchActiveChatSelection(preferences, engineId, modelId);
}

export function upsertWorkbenchCodeEngineCustomModel(
  preferences: WorkbenchPreferences,
  engineId: string | null | undefined,
  model: WorkbenchCustomCodeEngineModelInput | null | undefined,
): WorkbenchPreferences {
  const normalizedPreferences = normalizeWorkbenchPreferences(preferences);
  const normalizedEngineId = resolveKnownWorkbenchCodeEngineId(
    engineId,
    normalizedPreferences,
  );
  if (!normalizedEngineId) {
    return normalizedPreferences;
  }
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
  const normalizedEngineId = resolveKnownWorkbenchCodeEngineId(
    engineId,
    normalizedPreferences,
  );
  if (!normalizedEngineId) {
    return normalizedPreferences;
  }
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

const workbenchPreferencesTableRepository: BirdCoderTableRecordRepository<PersistedWorkbenchPreferencesRecord> =
  createBirdCoderTableRecordRepository<PersistedWorkbenchPreferencesRecord>({
    binding: BIRDCODER_WORKBENCH_PREFERENCES_STORAGE_BINDING,
    definition: WORKBENCH_PREFERENCES_DEFINITION,
    identify(value) {
      return value.id;
    },
    normalize: normalizePersistedWorkbenchPreferencesRecord,
    toRow: toWorkbenchPreferencesStorageRow,
  });

const workbenchPreferencesRepository: BirdCoderJsonRecordRepository<WorkbenchPreferences> = {
  binding: workbenchPreferencesTableRepository.binding,
  definition: workbenchPreferencesTableRepository.definition,
  async clear() {
    await workbenchPreferencesTableRepository.delete(WORKBENCH_PREFERENCES_STORAGE_ID);
  },
  async read() {
    const record = await workbenchPreferencesTableRepository.findById(
      WORKBENCH_PREFERENCES_STORAGE_ID,
    );
    return toWorkbenchPreferences(record);
  },
  async write(value) {
    const normalizedValue = normalizeWorkbenchPreferences(
      value as WorkbenchPreferencesInput | null | undefined,
    );
    const existingRecord = await workbenchPreferencesTableRepository.findById(
      WORKBENCH_PREFERENCES_STORAGE_ID,
    );
    const persistedRecord = createPersistedWorkbenchPreferencesRecord(
      normalizedValue,
      existingRecord,
    );
    await workbenchPreferencesTableRepository.save(persistedRecord);
    return normalizedValue;
  },
};

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
