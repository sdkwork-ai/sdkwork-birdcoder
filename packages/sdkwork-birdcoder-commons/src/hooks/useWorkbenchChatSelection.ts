import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { BirdCoderCodingSession } from '@sdkwork/birdcoder-types';
import {
  getDefaultWorkbenchServerImplementedCodeEngineId,
  getWorkbenchCodeEngineDefinition,
  isWorkbenchServerImplementedEngineId,
  normalizeWorkbenchCodeEngineId,
  normalizeWorkbenchCodeModelId,
  normalizeWorkbenchServerImplementedCodeEngineId,
  resolveWorkbenchChatSelection,
} from '@sdkwork/birdcoder-codeengine';

import { useToast } from '../contexts/ToastProvider.ts';
import {
  type WorkbenchPreferences,
} from '../workbench/preferences.ts';

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
) => Promise<BirdCoderCodingSession>;

interface UseWorkbenchChatSelectionOptions {
  createCodingSession: CreateCodingSessionFn;
  preferences: WorkbenchPreferences;
  updatePreferences: UpdatePreferencesFn;
}

export function useWorkbenchChatSelection({
  createCodingSession,
  preferences,
  updatePreferences,
}: UseWorkbenchChatSelectionOptions) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const selectedEngineId = normalizeWorkbenchServerImplementedCodeEngineId(
    preferences.codeEngineId,
    preferences,
  );
  const selectedModelId = normalizeWorkbenchCodeModelId(
    selectedEngineId,
    preferences.codeModelId,
    preferences,
  );

  const setSelectedEngineId = useCallback(
    (engineId: string) => {
      const fallbackEngineId = getDefaultWorkbenchServerImplementedCodeEngineId(preferences);
      const normalizedRequestedEngineId = normalizeWorkbenchCodeEngineId(engineId);
      if (!isWorkbenchServerImplementedEngineId(normalizedRequestedEngineId)) {
        addToast(
          t('settings.engines.serverUnavailable', {
            engine: getWorkbenchCodeEngineDefinition(engineId, preferences).label,
          }),
          'error',
        );
        updatePreferences((previousState) =>
          resolveWorkbenchChatSelection(
            {
              codeEngineId: getDefaultWorkbenchServerImplementedCodeEngineId(previousState),
              codeModelId: previousState.codeModelId,
            },
            previousState,
          ),
        );
        return;
      }

      updatePreferences((previousState) =>
        resolveWorkbenchChatSelection(
          {
            codeEngineId: normalizedRequestedEngineId || fallbackEngineId,
            codeModelId: previousState.codeModelId,
          },
          previousState,
        ),
      );
    },
    [addToast, preferences, t, updatePreferences],
  );

  const setSelectedModelId = useCallback(
    (modelId: string) => {
      updatePreferences((previousState) => {
        const resolvedEngineId = normalizeWorkbenchServerImplementedCodeEngineId(
          previousState.codeEngineId,
          previousState,
        );
        return resolveWorkbenchChatSelection(
          {
            codeEngineId: resolvedEngineId,
            codeModelId: modelId,
          },
          previousState,
        );
      });
    },
    [updatePreferences],
  );

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
