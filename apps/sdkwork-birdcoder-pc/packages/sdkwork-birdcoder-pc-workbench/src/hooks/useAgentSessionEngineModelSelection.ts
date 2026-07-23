import { useCallback } from 'react';
import { resolveWorkbenchCodeEngineSelectedModelId } from '../workbench/codeEngineCatalog.ts';

import type { WorkbenchPreferences } from '../workbench/preferences.ts';

interface UseAgentSessionEngineModelSelectionOptions {
  preferences: WorkbenchPreferences;
  selectedModelId: string;
  sessionId?: string | null;
  setSelectedEngineId: (engineId: string) => void;
  setSelectedModelId: (modelId: string, engineId?: string) => void;
}

export function useAgentSessionEngineModelSelection({
  preferences,
  selectedModelId,
  sessionId,
  setSelectedEngineId,
  setSelectedModelId,
}: UseAgentSessionEngineModelSelectionOptions) {
  const handleSelectedEngineChange = useCallback(
    async (engineId: string) => {
      // Session engine/model are fixed once the session exists.
      if (sessionId) {
        return;
      }

      setSelectedEngineId(engineId);

      const nextModelId = resolveWorkbenchCodeEngineSelectedModelId(
        engineId,
        preferences,
      );
      if (nextModelId !== selectedModelId) {
        setSelectedModelId(nextModelId, engineId);
      }
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

