import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  normalizeWorkbenchCodeModelId,
  normalizeWorkbenchServerImplementedCodeEngineId,
  useWorkbenchCodeEngineCatalog,
  type WorkbenchCodeEngineId,
} from '../workbench/codeEngineCatalog.ts';

import {
  DEFAULT_WORKBENCH_PREFERENCES,
  normalizeWorkbenchPreferences,
  readWorkbenchPreferences,
  type WorkbenchPreferences,
  writeWorkbenchPreferences,
} from '../workbench/preferences.ts';

type WorkbenchPreferencesUpdate =
  | Partial<WorkbenchPreferences>
  | ((previousState: WorkbenchPreferences) => Partial<WorkbenchPreferences>);

type WorkbenchPreferencesListener = (preferences: WorkbenchPreferences) => void;

let liveWorkbenchPreferences: WorkbenchPreferences | null = null;
const workbenchPreferencesListeners = new Set<WorkbenchPreferencesListener>();

function areWorkbenchCodeEngineSettingsEqual(
  left: WorkbenchPreferences['codeEngineSettings'],
  right: WorkbenchPreferences['codeEngineSettings'],
): boolean {
  if (left === right) {
    return true;
  }

  const leftEngineIds = Object.keys(left ?? {}) as WorkbenchCodeEngineId[];
  const rightEngineIds = Object.keys(right ?? {}) as WorkbenchCodeEngineId[];
  if (leftEngineIds.length !== rightEngineIds.length) {
    return false;
  }

  for (const engineId of leftEngineIds) {
    const leftEntry = left?.[engineId];
    const rightEntry = right?.[engineId];
    if (!leftEntry || !rightEntry) {
      return false;
    }

    if (leftEntry.defaultModelId !== rightEntry.defaultModelId) {
      return false;
    }

    if ((leftEntry.accessModeId ?? '') !== (rightEntry.accessModeId ?? '')) {
      return false;
    }

    if ((leftEntry.modelAccessChannelId ?? '') !== (rightEntry.modelAccessChannelId ?? '')) {
      return false;
    }

  }

  return true;
}

function preferencesEqual(left: WorkbenchPreferences, right: WorkbenchPreferences): boolean {
  return (
    left.workbenchMode === right.workbenchMode &&
    left.codeEngineId === right.codeEngineId &&
    left.codeModelId === right.codeModelId &&
    areWorkbenchCodeEngineSettingsEqual(left.codeEngineSettings, right.codeEngineSettings) &&
    left.unifiedCustomAgentModels.length === right.unifiedCustomAgentModels.length &&
    left.unifiedCustomAgentModels.every((model, index) => {
      const other = right.unifiedCustomAgentModels[index];
      return Boolean(
        other
        && model.configurationId === other.configurationId
        && model.modelId === other.modelId
        && model.label === other.label
        && model.description === other.description
        && model.vendorCode === other.vendorCode
        && model.baseUrl === other.baseUrl
        && model.supportedModelIds.join('\u0000') === other.supportedModelIds.join('\u0000')
        && model.supportedProviderIds.join('\u0000') === other.supportedProviderIds.join('\u0000')
        && model.inputContextTokens === other.inputContextTokens
        && model.outputContextTokens === other.outputContextTokens
        && model.toolCallRounds === other.toolCallRounds
        && model.supportsMultimodal === other.supportsMultimodal
        && model.apiKeyConfigured === other.apiKeyConfigured
        && model.accessChannelKind === other.accessChannelKind
        && model.accessChannelName === other.accessChannelName
        && model.defaultVendorCode === other.defaultVendorCode
        && model.vendorOfferings.length === other.vendorOfferings.length
        && model.vendorOfferings.every((offering, offeringIndex) => {
          const otherOffering = other.vendorOfferings[offeringIndex];
          return Boolean(
            otherOffering
            && offering.vendorCode === otherOffering.vendorCode
            && offering.vendorName === otherOffering.vendorName
            && offering.modelIds.join('\u0000') === otherOffering.modelIds.join('\u0000')
          );
        })
      );
    }) &&
    left.disabledComposerCapabilityIds.length === right.disabledComposerCapabilityIds.length &&
    left.disabledComposerCapabilityIds.every(
      (capabilityId, index) => capabilityId === right.disabledComposerCapabilityIds[index],
    ) &&
    left.terminalProfileId === right.terminalProfileId &&
    left.codeEditorChatWidth === right.codeEditorChatWidth &&
    left.defaultWorkingDirectory === right.defaultWorkingDirectory &&
    left.sessionInboxFilter === right.sessionInboxFilter &&
    left.sessionInboxGroupMode === right.sessionInboxGroupMode &&
    left.sessionInboxProviderId === right.sessionInboxProviderId &&
    left.sessionInboxShowArchived === right.sessionInboxShowArchived &&
    left.sessionInboxSortMode === right.sessionInboxSortMode &&
    left.gitBranchPrefix === right.gitBranchPrefix &&
    left.gitCommitInstructions === right.gitCommitInstructions &&
    left.gitCreateDraftPullRequest === right.gitCreateDraftPullRequest &&
    left.gitForceWithLease === right.gitForceWithLease &&
    left.gitPullRequestInstructions === right.gitPullRequestInstructions &&
    left.gitPullRequestMergeMethod === right.gitPullRequestMergeMethod &&
    left.gitReviewDeliveryMode === right.gitReviewDeliveryMode &&
    left.worktreeAutoPrune === right.worktreeAutoPrune &&
    left.worktreeListLimit === right.worktreeListLimit
  );
}

function publishWorkbenchPreferences(preferences: WorkbenchPreferences): void {
  const normalizedPreferences = normalizeWorkbenchPreferences(preferences);
  if (
    liveWorkbenchPreferences
    && preferencesEqual(liveWorkbenchPreferences, normalizedPreferences)
  ) {
    return;
  }

  liveWorkbenchPreferences = normalizedPreferences;
  for (const listener of workbenchPreferencesListeners) {
    listener(normalizedPreferences);
  }
}

export function useWorkbenchPreferences() {
  const codeEngineCatalog = useWorkbenchCodeEngineCatalog();
  const [storedPreferences, setStoredPreferences] = useState<WorkbenchPreferences>(
    () => liveWorkbenchPreferences ?? DEFAULT_WORKBENCH_PREFERENCES,
  );
  const [persistedPreferences, setPersistedPreferences] = useState<WorkbenchPreferences>(
    DEFAULT_WORKBENCH_PREFERENCES,
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const pendingPersistPreferencesRef = useRef<WorkbenchPreferences | null>(null);

  useEffect(() => {
    const handlePreferencesChange: WorkbenchPreferencesListener = (nextPreferences) => {
      setStoredPreferences((previousPreferences) => (
        preferencesEqual(previousPreferences, nextPreferences)
          ? previousPreferences
          : nextPreferences
      ));
    };
    workbenchPreferencesListeners.add(handlePreferencesChange);
    return () => {
      workbenchPreferencesListeners.delete(handlePreferencesChange);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    void readWorkbenchPreferences()
      .then((persistedValue) => {
        if (!isMounted) {
          return;
        }

        const normalizedValue = normalizeWorkbenchPreferences(persistedValue);
        pendingPersistPreferencesRef.current = null;
        setPersistedPreferences(normalizedValue);
        if (liveWorkbenchPreferences) {
          setStoredPreferences(liveWorkbenchPreferences);
        } else {
          publishWorkbenchPreferences(normalizedValue);
          setStoredPreferences(normalizedValue);
        }
        setIsHydrated(true);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        pendingPersistPreferencesRef.current = null;
        setPersistedPreferences(DEFAULT_WORKBENCH_PREFERENCES);
        const fallbackPreferences = liveWorkbenchPreferences ?? DEFAULT_WORKBENCH_PREFERENCES;
        publishWorkbenchPreferences(fallbackPreferences);
        setStoredPreferences(fallbackPreferences);
        setIsHydrated(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const preferences = useMemo(() => {
    const normalizedStoredPreferences = normalizeWorkbenchPreferences(storedPreferences);
    const normalizedActiveEngineId = normalizeWorkbenchServerImplementedCodeEngineId(
      normalizedStoredPreferences.codeEngineId,
      normalizedStoredPreferences,
    );
    return normalizeWorkbenchPreferences({
      ...normalizedStoredPreferences,
      codeEngineId: normalizedActiveEngineId,
      codeModelId: normalizeWorkbenchCodeModelId(
        normalizedActiveEngineId,
        normalizedStoredPreferences.codeModelId,
        normalizedStoredPreferences,
      ),
    });
  }, [codeEngineCatalog, storedPreferences]);
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

  useEffect(() => {
    if (!isHydrated || preferencesEqual(persistedPreferences, preferences)) {
      pendingPersistPreferencesRef.current = null;
      return;
    }

    const pendingPreferences = pendingPersistPreferencesRef.current;
    if (pendingPreferences && preferencesEqual(pendingPreferences, preferences)) {
      return;
    }

    let isActive = true;
    pendingPersistPreferencesRef.current = preferences;

    void writeWorkbenchPreferences(preferences)
      .then((nextPersistedPreferences) => {
        if (!isActive) {
          return;
        }

        const normalizedNextPersistedPreferences = normalizeWorkbenchPreferences(
          nextPersistedPreferences,
        );
        pendingPersistPreferencesRef.current = null;
        setPersistedPreferences(normalizedNextPersistedPreferences);
        setStoredPreferences((previousState) =>
          preferencesEqual(previousState, normalizedNextPersistedPreferences)
            ? previousState
            : normalizedNextPersistedPreferences,
        );
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        pendingPersistPreferencesRef.current = null;
      });

    return () => {
      isActive = false;
    };
  }, [isHydrated, persistedPreferences, preferences]);

  const updatePreferences = useCallback(
    (value: WorkbenchPreferencesUpdate) => {
      const normalizedPreviousState = normalizeWorkbenchPreferences(preferencesRef.current);
      const partialValue =
        typeof value === 'function' ? value(normalizedPreviousState) : value;
      const nextPreferences = normalizeWorkbenchPreferences({
        ...normalizedPreviousState,
        ...partialValue,
      });
      // Preserve the previous identity when nothing actually changed. An
      // unconditional write would re-create `preferences` on every call and
      // re-trigger every effect that derives state from it — the UniversalChat
      // channel-migration effect re-issues user_model_config_list_channels per
      // cycle (the observed IPC loop).
      if (preferencesEqual(preferencesRef.current, nextPreferences)) {
        return;
      }
      preferencesRef.current = nextPreferences;
      publishWorkbenchPreferences(nextPreferences);
      setStoredPreferences(nextPreferences);
    },
    [],
  );

  return {
    preferences,
    updatePreferences,
    isHydrated,
  } as const;
}

