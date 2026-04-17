import { useCallback } from 'react';

import {
  normalizeWorkbenchCodeEngineId,
  normalizeWorkbenchCodeModelId,
  resolveWorkbenchChatSelection,
  type WorkbenchPreferences,
} from '@sdkwork/birdcoder-commons/workbench';

type ToastFn = (message: string, type?: 'success' | 'error' | 'info') => void;

type WorkbenchPreferencesUpdate =
  | Partial<WorkbenchPreferences>
  | ((previousState: WorkbenchPreferences) => Partial<WorkbenchPreferences>);

type UpdatePreferencesFn = (value: WorkbenchPreferencesUpdate) => void;

type CreateCodingSessionFn = (
  projectId: string,
  title: string,
  options?: {
    engineId?: string;
    modelId?: string;
  },
) => Promise<unknown>;

interface UseStudioChatSelectionOptions {
  addToast: ToastFn;
  createCodingSession: CreateCodingSessionFn;
  preferences: WorkbenchPreferences;
  updatePreferences: UpdatePreferencesFn;
}

export function useStudioChatSelection({
  addToast,
  createCodingSession,
  preferences,
  updatePreferences,
}: UseStudioChatSelectionOptions) {
  const selectedEngineId = preferences.codeEngineId === 'opencode' ? 'opencode' : 'codex';
  const selectedModelId = normalizeWorkbenchCodeModelId(
    selectedEngineId,
    preferences.codeModelId,
  );

  const setSelectedEngineId = useCallback((engineId: string) => {
    const normalizedEngineId = normalizeWorkbenchCodeEngineId(engineId);
    if (normalizedEngineId !== 'codex' && normalizedEngineId !== 'opencode') {
      addToast(
        'Only Codex and OpenCode are currently available through the Rust server. Other code engines remain server TODO items.',
        'error',
      );
      updatePreferences((previousState) =>
        resolveWorkbenchChatSelection({
          codeEngineId: 'codex',
          codeModelId: previousState.codeModelId,
        }),
      );
      return;
    }

    updatePreferences((previousState) =>
      resolveWorkbenchChatSelection({
        codeEngineId: normalizedEngineId,
        codeModelId: previousState.codeModelId,
      }),
    );
  }, [addToast, updatePreferences]);

  const setSelectedModelId = useCallback((modelId: string) => {
    updatePreferences((previousState) => ({
      codeModelId: normalizeWorkbenchCodeModelId(previousState.codeEngineId, modelId),
    }));
  }, [updatePreferences]);

  const createCodingSessionWithSelection = useCallback(
    (projectId: string, title: string) =>
      createCodingSession(projectId, title, {
        engineId: selectedEngineId,
        modelId: selectedModelId,
      }),
    [createCodingSession, selectedEngineId, selectedModelId],
  );

  return {
    createCodingSessionWithSelection,
    selectedEngineId,
    selectedModelId,
    setSelectedEngineId,
    setSelectedModelId,
  } as const;
}
