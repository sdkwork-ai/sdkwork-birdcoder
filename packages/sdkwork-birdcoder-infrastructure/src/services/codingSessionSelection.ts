import { findWorkbenchCodeEngineDefinition } from '@sdkwork/birdcoder-codeengine';

interface RequiredCodingSessionSelectionInput {
  engineId?: string | null;
  modelId?: string | null;
}

export interface ResolvedRequiredCodingSessionSelection {
  engineId: string;
  modelId: string;
}

export function resolveRequiredCodingSessionSelection(
  value: RequiredCodingSessionSelectionInput | null | undefined,
): ResolvedRequiredCodingSessionSelection {
  const requestedEngineId = value?.engineId?.trim() ?? '';
  if (!requestedEngineId) {
    throw new Error(
      'Coding session creation requires an explicit code engine id. Resolve the preferred engine before creating the session.',
    );
  }

  const engine = findWorkbenchCodeEngineDefinition(requestedEngineId);
  if (!engine) {
    throw new Error(
      `Coding session creation requires a known code engine id. Received "${requestedEngineId}".`,
    );
  }

  const requestedModelId = value?.modelId?.trim() ?? '';
  if (!requestedModelId) {
    throw new Error(
      `Coding session creation requires an explicit model id for engine "${engine.id}". Resolve the preferred model before creating the session.`,
    );
  }

  const resolvedModelId =
    engine.modelCatalog.find(
      (candidate) => candidate.id.toLowerCase() === requestedModelId.toLowerCase(),
    )?.id ?? requestedModelId;

  return {
    engineId: engine.id,
    modelId: resolvedModelId,
  };
}
