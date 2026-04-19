import { useCallback, useEffect } from 'react';
import {
  normalizeWorkbenchCodeModelId,
  normalizeWorkbenchServerImplementedCodeEngineId,
} from '@sdkwork/birdcoder-codeengine';

import {
  DEFAULT_WORKBENCH_PREFERENCES,
  normalizeWorkbenchPreferences,
  type WorkbenchPreferences,
} from '../workbench/preferences.ts';
import { usePersistedState } from './usePersistedState.ts';

type WorkbenchPreferencesUpdate =
  | Partial<WorkbenchPreferences>
  | ((previousState: WorkbenchPreferences) => Partial<WorkbenchPreferences>);

function preferencesEqual(left: WorkbenchPreferences, right: WorkbenchPreferences): boolean {
  return (
    left.codeEngineId === right.codeEngineId &&
    left.codeModelId === right.codeModelId &&
    JSON.stringify(left.codeEngineSettings ?? {}) === JSON.stringify(right.codeEngineSettings ?? {}) &&
    left.terminalProfileId === right.terminalProfileId &&
    left.codeEditorChatWidth === right.codeEditorChatWidth &&
    left.defaultWorkingDirectory === right.defaultWorkingDirectory
  );
}

export function useWorkbenchPreferences() {
  const [storedPreferences, setStoredPreferences, isHydrated] = usePersistedState(
    'workbench',
    'preferences',
    DEFAULT_WORKBENCH_PREFERENCES,
  );
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
    if (!isHydrated || preferencesEqual(storedPreferences, preferences)) {
      return;
    }

    setStoredPreferences(preferences);
  }, [isHydrated, preferences, setStoredPreferences, storedPreferences]);

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
