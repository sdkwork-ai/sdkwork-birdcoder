import { useEffect } from "react";
import { usePersistedState } from "./usePersistedState.ts";
import {
  DEFAULT_APP_SETTINGS,
  isCanonicalAppSettingsRecord,
  normalizeAppSettings,
  type AppSettings,
} from "../settings/appSettings.ts";

type AppSettingsUpdate =
  | Partial<AppSettings>
  | ((previousState: AppSettings) => Partial<AppSettings>);

export function useBirdcoderAppSettings() {
  const [storedSettings, setStoredSettings, isHydrated] = usePersistedState<AppSettings>(
    "settings",
    "app",
    DEFAULT_APP_SETTINGS,
  );
  const settings = normalizeAppSettings(storedSettings);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (isCanonicalAppSettingsRecord(storedSettings)) {
      return;
    }

    setStoredSettings(settings);
  }, [isHydrated, setStoredSettings, settings, storedSettings]);

  const updateSettings = (value: AppSettingsUpdate) => {
    setStoredSettings((previousState) => {
      const normalizedPreviousState = normalizeAppSettings(previousState);
      const partialValue =
        typeof value === "function" ? value(normalizedPreviousState) : value;

      return normalizeAppSettings({
        ...normalizedPreviousState,
        ...partialValue,
      });
    });
  };

  return {
    isHydrated,
    setSettings: setStoredSettings,
    settings,
    storedSettings,
    updateSettings,
  } as const;
}
