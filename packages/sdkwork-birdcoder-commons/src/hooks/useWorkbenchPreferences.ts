import { useCallback, useEffect, useRef, useState } from 'react';
import {
  normalizeWorkbenchCodeModelId,
  normalizeWorkbenchServerImplementedCodeEngineId,
  type WorkbenchCodeEngineId,
} from '@sdkwork/birdcoder-codeengine';

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

    if (leftEntry.customModels.length !== rightEntry.customModels.length) {
      return false;
    }

    for (let index = 0; index < leftEntry.customModels.length; index += 1) {
      const leftModel = leftEntry.customModels[index];
      const rightModel = rightEntry.customModels[index];
      if (!rightModel) {
        return false;
      }

      if (leftModel.id !== rightModel.id || leftModel.label !== rightModel.label) {
        return false;
      }
    }
  }

  return true;
}

function preferencesEqual(left: WorkbenchPreferences, right: WorkbenchPreferences): boolean {
  return (
    left.codeEngineId === right.codeEngineId &&
    left.codeModelId === right.codeModelId &&
    areWorkbenchCodeEngineSettingsEqual(left.codeEngineSettings, right.codeEngineSettings) &&
    left.terminalProfileId === right.terminalProfileId &&
    left.codeEditorChatWidth === right.codeEditorChatWidth &&
    left.defaultWorkingDirectory === right.defaultWorkingDirectory
  );
}

export function useWorkbenchPreferences() {
  const [storedPreferences, setStoredPreferences] = useState<WorkbenchPreferences>(
    DEFAULT_WORKBENCH_PREFERENCES,
  );
  const [persistedPreferences, setPersistedPreferences] = useState<WorkbenchPreferences>(
    DEFAULT_WORKBENCH_PREFERENCES,
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const pendingPersistPreferencesRef = useRef<WorkbenchPreferences | null>(null);

  useEffect(() => {
    let isMounted = true;

    void readWorkbenchPreferences()
      .then((persistedValue) => {
        if (!isMounted) {
          return;
        }

        const normalizedValue = normalizeWorkbenchPreferences(persistedValue);
        pendingPersistPreferencesRef.current = null;
        setStoredPreferences(normalizedValue);
        setPersistedPreferences(normalizedValue);
        setIsHydrated(true);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        pendingPersistPreferencesRef.current = null;
        setStoredPreferences(DEFAULT_WORKBENCH_PREFERENCES);
        setPersistedPreferences(DEFAULT_WORKBENCH_PREFERENCES);
        setIsHydrated(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const normalizedStoredPreferences = normalizeWorkbenchPreferences(storedPreferences);
  const normalizedActiveEngineId = normalizeWorkbenchServerImplementedCodeEngineId(
    normalizedStoredPreferences.codeEngineId,
    normalizedStoredPreferences,
  );
  const preferences = normalizeWorkbenchPreferences({
    ...normalizedStoredPreferences,
    codeEngineId: normalizedActiveEngineId,
    codeModelId: normalizeWorkbenchCodeModelId(
      normalizedActiveEngineId,
      normalizedStoredPreferences.codeModelId,
      normalizedStoredPreferences,
    ),
  });

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
      setStoredPreferences((previousState) => {
        const normalizedPreviousState = normalizeWorkbenchPreferences(previousState);
        const partialValue =
          typeof value === 'function' ? value(normalizedPreviousState) : value;

        return normalizeWorkbenchPreferences({
          ...normalizedPreviousState,
          ...partialValue,
        });
      });
    },
    [setStoredPreferences],
  );

  return {
    preferences,
    updatePreferences,
    isHydrated,
  } as const;
}
