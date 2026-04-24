import {
  findWorkbenchCodeEngineDefinition,
  getWorkbenchCodeEngineDefinition,
  listWorkbenchCodeEngines,
  normalizeWorkbenchCodeEngineId,
  normalizeWorkbenchCodeModelId,
  type WorkbenchCodeEngineSettingsCarrier,
  type WorkbenchCodeEngineDefinition,
} from './preferences.ts';
import {
  getWorkbenchCodeEngineKernel,
  listWorkbenchCliEngines,
  type WorkbenchCodeEngineId,
} from './kernel.ts';

export type WorkbenchServerEngineSupportStatus = 'ready' | 'planned';

export interface WorkbenchServerEngineSupportState {
  engine: WorkbenchCodeEngineDefinition;
  implemented: boolean;
  status: WorkbenchServerEngineSupportStatus;
}

export interface WorkbenchPreferredNewSessionSelectionInput {
  requestedEngineId?: string | null;
  currentSessionEngineId?: string | null;
  currentSessionModelId?: string | null;
  preferredEngineId?: string | null;
  preferredModelId?: string | null;
}

export interface WorkbenchPreferredNewSessionSelection {
  engine: WorkbenchCodeEngineDefinition;
  engineId: WorkbenchCodeEngineId;
  modelId: string;
}

export interface WorkbenchNewSessionEngineCatalog {
  availableEngines: ReadonlyArray<WorkbenchCodeEngineDefinition>;
  preferredSelection: WorkbenchPreferredNewSessionSelection;
}

function resolveExplicitWorkbenchModelId(
  engineId: string,
  modelId: string | null | undefined,
  preferences?: WorkbenchCodeEngineSettingsCarrier | null,
): string | null {
  const requestedModelId = modelId?.trim() ?? '';
  if (!requestedModelId) {
    return null;
  }

  const engine = findWorkbenchCodeEngineDefinition(engineId, preferences);
  if (!engine) {
    return requestedModelId;
  }

  return (
    engine.modelCatalog.find(
      (candidate) => candidate.id.toLowerCase() === requestedModelId.toLowerCase(),
    )?.id ?? requestedModelId
  );
}

function resolveKnownWorkbenchCodeEngineDefinition(
  engineId: string | null | undefined,
  preferences?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchCodeEngineDefinition | null {
  return findWorkbenchCodeEngineDefinition(engineId, preferences);
}

function resolveWorkbenchServerEngineSupportStatus(
  engine: WorkbenchCodeEngineDefinition,
): WorkbenchServerEngineSupportStatus {
  return engine.executionTopology.serverReady
    ? 'ready'
    : getWorkbenchCodeEngineKernel(engine.id).serverSupportStatus;
}

export function isWorkbenchServerImplementedEngineId(
  engineId: string | null | undefined,
): engineId is WorkbenchCodeEngineId {
  const engine = resolveKnownWorkbenchCodeEngineDefinition(engineId);
  return !!engine && resolveWorkbenchServerEngineSupportStatus(engine) === 'ready';
}

export function listWorkbenchServerImplementedCodeEngines(
  preferences?: WorkbenchCodeEngineSettingsCarrier | null,
): ReadonlyArray<WorkbenchCodeEngineDefinition> {
  return listWorkbenchCodeEngines(preferences).filter((engine) =>
    isWorkbenchServerImplementedEngineId(engine.id),
  );
}

export function getDefaultWorkbenchServerImplementedCodeEngineId(
  preferences?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchCodeEngineId {
  return (
    listWorkbenchServerImplementedCodeEngines(preferences)[0]?.id ??
    listWorkbenchCliEngines().find((engine) => engine.serverSupportStatus === 'ready')?.id ??
    listWorkbenchCliEngines()[0]?.id ??
    getWorkbenchCodeEngineKernel(null).id
  );
}

export function resolveWorkbenchServerEngineSupportState(
  engineId: string | null | undefined,
  preferences?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchServerEngineSupportState {
  const engine =
    resolveKnownWorkbenchCodeEngineDefinition(engineId, preferences) ??
    getWorkbenchCodeEngineDefinition(
      getDefaultWorkbenchServerImplementedCodeEngineId(preferences),
      preferences,
    );
  const status = resolveKnownWorkbenchCodeEngineDefinition(engineId, preferences)
    ? resolveWorkbenchServerEngineSupportStatus(engine)
    : 'planned';
  return {
    engine,
    implemented: status === 'ready',
    status,
  };
}

export function buildWorkbenchServerEngineNotImplementedError(
  engineId: string | null | undefined,
  preferences?: WorkbenchCodeEngineSettingsCarrier | null,
): Error {
  const normalizedEngineId = engineId?.trim();
  const engine = resolveKnownWorkbenchCodeEngineDefinition(engineId, preferences);
  if (!engine) {
    return new Error(
      `BirdCoder server authority cannot execute unknown code engine "${normalizedEngineId || 'unknown'}". Only server-implemented engines may create or run coding sessions.`,
    );
  }

  const supportStatus = resolveWorkbenchServerEngineSupportStatus(engine);
  return new Error(
    `BirdCoder server authority cannot execute code engine "${engine.id}" because server support is ${supportStatus}. Only server-ready engines may create or run coding sessions.`,
  );
}

export function assertWorkbenchServerImplementedEngineId(
  engineId: string | null | undefined,
  preferences?: WorkbenchCodeEngineSettingsCarrier | null,
): asserts engineId is WorkbenchCodeEngineId {
  if (!isWorkbenchServerImplementedEngineId(engineId)) {
    throw buildWorkbenchServerEngineNotImplementedError(engineId, preferences);
  }
}

export function normalizeWorkbenchServerImplementedCodeEngineId(
  engineId: string | null | undefined,
  preferences?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchCodeEngineId {
  const normalizedEngineId = normalizeWorkbenchCodeEngineId(engineId);
  return isWorkbenchServerImplementedEngineId(normalizedEngineId)
    ? normalizedEngineId
    : getDefaultWorkbenchServerImplementedCodeEngineId(preferences);
}

function matchesServerImplementedEngineId(
  candidateEngineId: string | null | undefined,
  targetEngineId: WorkbenchCodeEngineId,
  preferences?: WorkbenchCodeEngineSettingsCarrier | null,
): boolean {
  const candidateEngine = resolveKnownWorkbenchCodeEngineDefinition(
    candidateEngineId,
    preferences,
  );
  if (!candidateEngine) {
    return false;
  }

  return (
    candidateEngine.id === targetEngineId &&
    resolveWorkbenchServerEngineSupportStatus(candidateEngine) === 'ready'
  );
}

export function resolveWorkbenchPreferredNewSessionSelection(
  value: WorkbenchPreferredNewSessionSelectionInput | null | undefined,
  preferences?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchPreferredNewSessionSelection {
  const engineId = normalizeWorkbenchServerImplementedCodeEngineId(
    value?.requestedEngineId?.trim() ||
      value?.currentSessionEngineId?.trim() ||
      value?.preferredEngineId?.trim() ||
      getDefaultWorkbenchServerImplementedCodeEngineId(preferences),
    preferences,
  );
  const preferredModelId =
    value?.currentSessionModelId?.trim() &&
    matchesServerImplementedEngineId(value.currentSessionEngineId, engineId, preferences)
      ? value.currentSessionModelId
      : value?.preferredModelId?.trim() &&
          matchesServerImplementedEngineId(value.preferredEngineId, engineId, preferences)
        ? value.preferredModelId
        : undefined;
  const resolvedExplicitModelId = resolveExplicitWorkbenchModelId(
    engineId,
    preferredModelId,
    preferences,
  );

  return {
    engineId,
    engine: getWorkbenchCodeEngineDefinition(engineId, preferences),
    modelId:
      resolvedExplicitModelId ??
      normalizeWorkbenchCodeModelId(engineId, preferredModelId, preferences),
  };
}

export function resolveWorkbenchNewSessionEngineCatalog(
  value: WorkbenchPreferredNewSessionSelectionInput | null | undefined,
  preferences?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchNewSessionEngineCatalog {
  const preferredSelection = resolveWorkbenchPreferredNewSessionSelection(value, preferences);
  const availableEngines: WorkbenchCodeEngineDefinition[] = [];
  const seenEngineIds = new Set<string>();

  const appendEngine = (engine: WorkbenchCodeEngineDefinition | null | undefined) => {
    if (!engine || seenEngineIds.has(engine.id)) {
      return;
    }

    seenEngineIds.add(engine.id);
    availableEngines.push(engine);
  };

  appendEngine(preferredSelection.engine);
  for (const engine of listWorkbenchServerImplementedCodeEngines(preferences)) {
    appendEngine(engine);
  }

  return {
    availableEngines,
    preferredSelection,
  };
}
