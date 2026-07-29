import { useCallback, useEffect, useMemo } from 'react';
import {
  DEFAULT_INTEGRATION_PREFERENCES,
  isCanonicalIntegrationPreferences,
  normalizeIntegrationPreferences,
  type IntegrationPreferences,
} from '../settings/integrationPreferences.ts';
import { usePersistedState } from './usePersistedState.ts';

type IntegrationPreferencesUpdate =
  | Partial<IntegrationPreferences>
  | ((previousState: IntegrationPreferences) => Partial<IntegrationPreferences>);

export function useIntegrationPreferences() {
  const [storedPreferences, setStoredPreferences, isHydrated] =
    usePersistedState<IntegrationPreferences>(
      'settings',
      'integrations',
      DEFAULT_INTEGRATION_PREFERENCES,
    );
  const preferences = useMemo(
    () => normalizeIntegrationPreferences(storedPreferences),
    [storedPreferences],
  );

  useEffect(() => {
    if (isHydrated && !isCanonicalIntegrationPreferences(storedPreferences)) {
      setStoredPreferences(preferences);
    }
  }, [isHydrated, preferences, setStoredPreferences, storedPreferences]);

  const updatePreferences = useCallback(
    (value: IntegrationPreferencesUpdate) => {
      setStoredPreferences((previousState) => {
        const normalizedPreviousState = normalizeIntegrationPreferences(previousState);
        const partialValue = typeof value === 'function'
          ? value(normalizedPreviousState)
          : value;
        return normalizeIntegrationPreferences({
          ...normalizedPreviousState,
          ...partialValue,
        });
      });
    },
    [setStoredPreferences],
  );

  return {
    isHydrated,
    preferences,
    updatePreferences,
  } as const;
}
