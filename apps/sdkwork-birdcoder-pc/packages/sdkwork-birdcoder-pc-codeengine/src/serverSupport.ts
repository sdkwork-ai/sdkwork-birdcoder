import type { BirdCoderEngineDescriptor } from '@sdkwork/birdcoder-pc-contracts-commons';

import {
  type WorkbenchCodeEngineId,
  WORKBENCH_CODE_ENGINE_IDS,
} from './catalog.ts';
import {
  BIRDCODER_STANDARD_DEFAULT_ENGINE_ID,
  getWorkbenchCodeEngineDefinition,
  hasWorkbenchCodeModel,
  listWorkbenchCodeEngines,
  normalizeWorkbenchCodeEngineId,
  resolveWorkbenchCodeEngineSelectedModelId,
  type WorkbenchCodeEngineDefinition,
  type WorkbenchCodeEngineSettingsCarrier,
} from './preferences.ts';
import { WORKBENCH_ENGINE_KERNELS } from './kernel.ts';

export interface WorkbenchServerEngineSupportState {
  engineId: WorkbenchCodeEngineId;
  label: string;
  supported: boolean;
  serverImplemented: boolean;
  isServerImplemented: boolean;
  status: 'implemented' | 'unsupported';
  descriptor: BirdCoderEngineDescriptor | null;
}

export interface WorkbenchPreferredNewSessionInput extends WorkbenchCodeEngineSettingsCarrier {
  requestedEngineId?: unknown;
  currentSessionEngineId?: unknown;
  currentSessionModelId?: unknown;
  preferredEngineId?: unknown;
  preferredModelId?: unknown;
}

export interface WorkbenchNewSessionSelection {
  engineId: WorkbenchCodeEngineId;
  modelId: string;
  engine: WorkbenchCodeEngineDefinition;
  supported: boolean;
}

export function listWorkbenchServerImplementedCodeEngines(
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
):
  readonly WorkbenchCodeEngineDefinition[] {
  return listWorkbenchCodeEngines(carrier);
}

export function isWorkbenchServerImplementedEngineId(value: unknown): value is WorkbenchCodeEngineId {
  const engineId = normalizeWorkbenchCodeEngineId(value);

  return Boolean(engineId && WORKBENCH_CODE_ENGINE_IDS.includes(engineId));
}

export function normalizeWorkbenchServerImplementedCodeEngineId(
  value: unknown,
  _carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchCodeEngineId {
  const engineId = normalizeWorkbenchCodeEngineId(value);

  return engineId && isWorkbenchServerImplementedEngineId(engineId)
    ? engineId
    : BIRDCODER_STANDARD_DEFAULT_ENGINE_ID;
}

export function assertWorkbenchServerImplementedEngineId(
  value: unknown,
): asserts value is WorkbenchCodeEngineId {
  if (!isWorkbenchServerImplementedEngineId(value)) {
    throw new Error(`Unknown server implemented code engine: ${String(value)}`);
  }
}

export function getDefaultWorkbenchServerImplementedCodeEngineId(
  _carrier?: WorkbenchCodeEngineSettingsCarrier | null,
):
  WorkbenchCodeEngineId {
  return BIRDCODER_STANDARD_DEFAULT_ENGINE_ID;
}

export function resolveWorkbenchServerEngineSupportState(
  value: unknown,
): WorkbenchServerEngineSupportState {
  const engineId = normalizeWorkbenchCodeEngineId(value);
  const supported = Boolean(engineId && isWorkbenchServerImplementedEngineId(engineId));
  const resolvedEngineId = engineId ?? BIRDCODER_STANDARD_DEFAULT_ENGINE_ID;
  const definition = getWorkbenchCodeEngineDefinition(resolvedEngineId);
  const kernel = WORKBENCH_ENGINE_KERNELS.find((engine) => engine.id === resolvedEngineId);

  return {
    engineId: resolvedEngineId,
    label: definition.label,
    supported,
    serverImplemented: supported,
    isServerImplemented: supported,
    status: supported ? 'implemented' : 'unsupported',
    descriptor: kernel?.descriptor ?? null,
  };
}

export function resolveWorkbenchPreferredNewSessionSelection(
  input: WorkbenchPreferredNewSessionInput = {},
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchNewSessionSelection {
  const requestedEngineId = normalizeWorkbenchCodeEngineId(input.requestedEngineId);
  const requestedModelCandidate = String(input.preferredModelId ?? '').trim();
  const requestedModelId =
    requestedEngineId &&
    requestedModelCandidate &&
    hasWorkbenchCodeModel(requestedEngineId, requestedModelCandidate, carrier ?? input)
      ? requestedModelCandidate
      : '';

  // An explicit new-session provider selection must not be replaced by the
  // provider of the currently open session. The latter is only a default.
  if (requestedEngineId) {
    return {
      engineId: requestedEngineId,
      modelId:
        requestedModelId ||
        resolveWorkbenchCodeEngineSelectedModelId(requestedEngineId, carrier ?? input),
      engine: getWorkbenchCodeEngineDefinition(requestedEngineId, carrier ?? input),
      supported: isWorkbenchServerImplementedEngineId(requestedEngineId),
    };
  }

  const currentEngineId = normalizeWorkbenchCodeEngineId(input.currentSessionEngineId);
  const currentModelId = String(input.currentSessionModelId ?? '').trim();

  if (
    currentEngineId &&
    isWorkbenchServerImplementedEngineId(currentEngineId) &&
    currentModelId &&
    hasWorkbenchCodeModel(currentEngineId, currentModelId, carrier ?? input)
  ) {
    return {
      engineId: currentEngineId,
      modelId: currentModelId,
      engine: getWorkbenchCodeEngineDefinition(currentEngineId, carrier ?? input),
      supported: true,
    };
  }

  const preferredEngineId =
    normalizeWorkbenchCodeEngineId(input.preferredEngineId) ??
    BIRDCODER_STANDARD_DEFAULT_ENGINE_ID;
  const preferredModelId = requestedModelId;

  return {
    engineId: preferredEngineId,
    modelId:
      preferredModelId ||
      resolveWorkbenchCodeEngineSelectedModelId(preferredEngineId, carrier ?? input),
    engine: getWorkbenchCodeEngineDefinition(preferredEngineId, carrier ?? input),
    supported: isWorkbenchServerImplementedEngineId(preferredEngineId),
  };
}

export interface WorkbenchNewSessionEngineCatalog {
  availableEngines: readonly WorkbenchCodeEngineDefinition[];
  preferredSelection: WorkbenchNewSessionSelection;
}

export function resolveWorkbenchNewSessionEngineCatalog(
  input: WorkbenchPreferredNewSessionInput | null = {},
  carrier?: WorkbenchCodeEngineSettingsCarrier | null,
): WorkbenchNewSessionEngineCatalog {
  const resolvedInput = input ?? {};
  const resolvedCarrier = carrier ?? resolvedInput;

  return {
    availableEngines: listWorkbenchServerImplementedCodeEngines(resolvedCarrier),
    preferredSelection: resolveWorkbenchPreferredNewSessionSelection(
      resolvedInput,
      resolvedCarrier,
    ),
  };
}
