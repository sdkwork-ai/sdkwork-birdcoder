import {
  getWorkbenchCodeEngineDefinition,
  listWorkbenchCodeEngines,
  normalizeWorkbenchCodeEngineId,
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

export function isWorkbenchServerImplementedEngineId(
  engineId: string | null | undefined,
): engineId is WorkbenchCodeEngineId {
  return getWorkbenchCodeEngineKernel(engineId).serverSupportStatus === 'ready';
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
  const engine = getWorkbenchCodeEngineDefinition(engineId, preferences);
  const status =
    engine.primaryAccessLane?.status === 'ready'
      ? 'ready'
      : engine.primaryAccessLane?.status === 'planned'
        ? 'planned'
        : getWorkbenchCodeEngineKernel(engine.id).serverSupportStatus;
  return {
    engine,
    implemented: status === 'ready',
    status,
  };
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
