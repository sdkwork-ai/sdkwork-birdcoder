import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { BirdCoderCodingSession } from '@sdkwork/birdcoder-types';
import {
  findWorkbenchCodeEngineDefinition,
  getDefaultWorkbenchServerImplementedCodeEngineId,
  getWorkbenchCodeEngineLabel,
  isWorkbenchServerImplementedEngineId,
  normalizeWorkbenchCodeModelId,
  normalizeWorkbenchServerImplementedCodeEngineId,
  resolveWorkbenchPreferredNewSessionSelection,
} from '@sdkwork/birdcoder-codeengine';

import { useToast } from '../contexts/ToastProvider.ts';
import {
  setWorkbenchActiveChatSelection,
  setWorkbenchActiveCodeEngine,
  setWorkbenchActiveCodeModel,
  type WorkbenchPreferences,
} from '../workbench/preferences.ts';

type WorkbenchPreferencesUpdate =
  | Partial<WorkbenchPreferences>
  | ((previousState: WorkbenchPreferences) => Partial<WorkbenchPreferences>);

type UpdatePreferencesFn = (value: WorkbenchPreferencesUpdate) => void;

type CreateCodingSessionFn = (
  projectId: string,
  title: string,
  options: {
    engineId: string;
    modelId: string;
  },
) => Promise<BirdCoderCodingSession>;

interface UseWorkbenchChatSelectionOptions {
  createCodingSession: CreateCodingSessionFn;
  currentSessionEngineId?: string | null;
  currentSessionModelId?: string | null;
  preferences: WorkbenchPreferences;
  updatePreferences: UpdatePreferencesFn;
}

interface CreateCodingSessionWithSelectionOptions {
  engineId?: string;
  modelId?: string;
}

export function useWorkbenchChatSelection({
  createCodingSession,
  currentSessionEngineId,
  currentSessionModelId,
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
      const resolvedRequestedEngineId =
        findWorkbenchCodeEngineDefinition(engineId, preferences)?.id ?? null;
      if (!resolvedRequestedEngineId || !isWorkbenchServerImplementedEngineId(engineId)) {
        addToast(
          t('settings.engines.serverUnavailable', {
            engine: getWorkbenchCodeEngineLabel(engineId, preferences),
          }),
          'error',
        );
        updatePreferences((previousState) =>
          setWorkbenchActiveCodeEngine(
            previousState,
            getDefaultWorkbenchServerImplementedCodeEngineId(previousState),
          ),
        );
        return;
      }

      updatePreferences((previousState) =>
        setWorkbenchActiveCodeEngine(
          previousState,
          resolvedRequestedEngineId || fallbackEngineId,
        ),
      );
    },
    [addToast, preferences, t, updatePreferences],
  );

  const setSelectedModelId = useCallback(
    (modelId: string, engineId?: string) => {
      updatePreferences((previousState) =>
        engineId
          ? setWorkbenchActiveChatSelection(previousState, engineId, modelId)
          : setWorkbenchActiveCodeModel(previousState, modelId),
      );
    },
    [updatePreferences],
  );

  const setSelectedChatSelection = useCallback(
    (engineId: string, modelId: string) => {
      updatePreferences((previousState) =>
        setWorkbenchActiveChatSelection(previousState, engineId, modelId),
      );
    },
    [updatePreferences],
  );

  const createCodingSessionWithSelection = useCallback(
    (
      projectId: string,
      title?: string,
      options?: CreateCodingSessionWithSelectionOptions,
    ) => {
      const requestedEngineId = options?.engineId?.trim() || undefined;
      const requestedModelId = options?.modelId?.trim() || undefined;
      const normalizedCurrentSessionEngineId = currentSessionEngineId?.trim() || undefined;
      const normalizedCurrentSessionModelId = currentSessionModelId?.trim() || undefined;
      const preferredSelection = resolveWorkbenchPreferredNewSessionSelection(
        {
          requestedEngineId,
          currentSessionEngineId: normalizedCurrentSessionEngineId,
          currentSessionModelId: requestedModelId ?? normalizedCurrentSessionModelId,
          preferredEngineId:
            requestedModelId && requestedEngineId
              ? requestedEngineId
              : selectedEngineId,
          preferredModelId: requestedModelId ?? selectedModelId,
        },
        preferences,
      );
      const resolvedEngineId = preferredSelection.engineId;
      const resolvedModelId = requestedModelId
        ? normalizeWorkbenchCodeModelId(
            resolvedEngineId,
            requestedModelId,
            preferences,
          )
        : preferredSelection.modelId;
      const resolvedTitle =
        title?.trim() || `${preferredSelection.engine.label} Session`;

      updatePreferences((previousState) =>
        setWorkbenchActiveChatSelection(previousState, resolvedEngineId, resolvedModelId),
      );

      return createCodingSession(projectId, resolvedTitle, {
        engineId: resolvedEngineId,
        modelId: resolvedModelId,
      });
    },
    [
      createCodingSession,
      currentSessionEngineId,
      currentSessionModelId,
      preferences,
      selectedEngineId,
      selectedModelId,
      updatePreferences,
    ],
  );

  return {
    createCodingSessionWithSelection,
    selectedEngineId,
    selectedModelId,
    setSelectedChatSelection,
    setSelectedEngineId,
    setSelectedModelId,
  } as const;
}
