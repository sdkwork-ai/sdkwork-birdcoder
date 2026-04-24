import { useCallback } from 'react';
import { normalizeWorkbenchCodeModelId } from '@sdkwork/birdcoder-codeengine';

import type { WorkbenchPreferences } from '../workbench/preferences.ts';

interface UseCodingSessionEngineModelSelectionOptions {
  preferences: WorkbenchPreferences;
  selectedModelId: string;
  sessionId?: string | null;
  setSelectedEngineId: (engineId: string) => void;
  setSelectedModelId: (modelId: string, engineId?: string) => void;
}

export function useCodingSessionEngineModelSelection({
  preferences,
  selectedModelId,
  sessionId,
  setSelectedEngineId,
  setSelectedModelId,
}: UseCodingSessionEngineModelSelectionOptions) {
  const handleSelectedEngineChange = useCallback(
    async (engineId: string) => {
      // Session engine/model are fixed once the session exists.
      if (sessionId) {
        return;
      }

      setSelectedEngineId(engineId);

      const nextModelId = normalizeWorkbenchCodeModelId(
        engineId,
        selectedModelId,
        preferences,
      );
      if (nextModelId !== selectedModelId) {
        setSelectedModelId(nextModelId, engineId);
        return;
      }

      setSelectedEngineId(engineId);
    },
    [
      preferences,
      selectedModelId,
      sessionId,
      setSelectedEngineId,
      setSelectedModelId,
    ],
  );

  const handleSelectedModelChange = useCallback(
    async (modelId: string, engineId?: string) => {
      if (sessionId) {
        return;
      }

      setSelectedModelId(modelId, engineId);
    },
    [
      sessionId,
      setSelectedModelId,
    ],
  );

  return {
    handleSelectedEngineChange,
    handleSelectedModelChange,
  } as const;
}
