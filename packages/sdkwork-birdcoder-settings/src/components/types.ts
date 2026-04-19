import type { WorkbenchPreferences } from '@sdkwork/birdcoder-commons';
import type { AppSettings } from './appSettings';

export type { AppSettings } from './appSettings';

export type UpdateSetting = <K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
) => void;

export interface SettingsProps {
  settings: AppSettings;
  updateSetting: UpdateSetting;
  bootServerBaseUrlOverride?: string;
  currentServerBaseUrl?: string;
  workbenchPreferences?: WorkbenchPreferences;
  updateWorkbenchPreferences?: (
    value:
      | Partial<WorkbenchPreferences>
      | ((previousState: WorkbenchPreferences) => Partial<WorkbenchPreferences>),
  ) => void;
}
