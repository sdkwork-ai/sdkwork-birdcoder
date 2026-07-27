import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentSessionView } from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  findWorkbenchCodeEngineDefinition,
  getDefaultWorkbenchServerImplementedCodeEngineId,
  getWorkbenchCodeEngineLabel,
  isWorkbenchServerImplementedEngineId,
  loadWorkbenchCodeEngineCatalog,
  normalizeWorkbenchCodeModelId,
  normalizeWorkbenchServerImplementedCodeEngineId,
  resolveWorkbenchPreferredNewSessionSelection,
  resolveWorkbenchRuntimeBindingIdentity,
  useWorkbenchCodeEngineCatalog,
} from '../workbench/codeEngineCatalog.ts';
import { resolveBirdcoderWorkbenchHostMode } from '../terminal/runtimeTarget.ts';

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

type CreateAgentSessionFn = (
  projectId: string,
  title: string,
  options: {
    agentId: string;
    engineId: string;
    hostMode: AgentSessionView['hostMode'];
    modelId: string;
    providerBindingId: string;
    providerId: string;
  },
) => Promise<AgentSessionView>;

interface UseWorkbenchChatSelectionOptions {
  createAgentSession: CreateAgentSessionFn;
  currentSessionEngineId?: string | null;
  currentSessionModelId?: string | null;
  preferences: WorkbenchPreferences;
  updatePreferences: UpdatePreferencesFn;
}

interface CreateAgentSessionWithSelectionOptions {
  engineId?: string;
  modelId?: string;
}

export function useWorkbenchChatSelection({
  createAgentSession,
  currentSessionEngineId,
  currentSessionModelId,
  preferences,
  updatePreferences,
}: UseWorkbenchChatSelectionOptions) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const codeEngineCatalog = useWorkbenchCodeEngineCatalog();
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
      const fallbackEngineId = getDefaultWorkbenchServerImplementedCodeEngineId();
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
            getDefaultWorkbenchServerImplementedCodeEngineId(),
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

  const createAgentSessionWithSelection = useCallback(
    async (
      projectId: string,
      title?: string,
      options?: CreateAgentSessionWithSelectionOptions,
    ) => {
      if (!codeEngineCatalog.loaded) {
        await loadWorkbenchCodeEngineCatalog();
      }
      const requestedEngineId = options?.engineId?.trim() || undefined;
      const requestedModelId = options?.modelId?.trim() || undefined;
      const hasExplicitEngineSelection = Boolean(requestedEngineId);
      const normalizedCurrentSessionEngineId = currentSessionEngineId?.trim() || undefined;
      const normalizedCurrentSessionModelId = currentSessionModelId?.trim() || undefined;
      const preferredSelection = resolveWorkbenchPreferredNewSessionSelection(
        {
          requestedEngineId,
          currentSessionEngineId: normalizedCurrentSessionEngineId,
          currentSessionModelId: hasExplicitEngineSelection
            ? undefined
            : (requestedModelId ?? normalizedCurrentSessionModelId),
          preferredEngineId: requestedEngineId ?? selectedEngineId,
          preferredModelId: requestedModelId ?? (hasExplicitEngineSelection ? undefined : selectedModelId),
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

      const runtimeIdentity = resolveWorkbenchRuntimeBindingIdentity(
        resolvedEngineId,
        resolvedModelId,
      );

      return createAgentSession(projectId, resolvedTitle, {
        ...runtimeIdentity,
        hostMode: resolveBirdcoderWorkbenchHostMode(),
      });
    },
    [
      createAgentSession,
      codeEngineCatalog.loaded,
      currentSessionEngineId,
      currentSessionModelId,
      preferences,
      selectedEngineId,
      selectedModelId,
      updatePreferences,
    ],
  );

  return {
    createAgentSessionWithSelection,
    selectedEngineId,
    selectedModelId,
    setSelectedChatSelection,
    setSelectedEngineId,
    setSelectedModelId,
  } as const;
}

