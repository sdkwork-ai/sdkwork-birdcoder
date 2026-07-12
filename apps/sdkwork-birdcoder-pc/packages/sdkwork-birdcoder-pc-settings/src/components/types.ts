import type { WorkbenchPreferences } from '@sdkwork/birdcoder-pc-commons';
import type { AppSettings } from './appSettings';

export type { AppSettings } from './appSettings';

export type UpdateSetting = <K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
) => void;

export type UpdateSettings = (value: Partial<AppSettings>) => void;

export interface SettingsProps {
  currentProjectId?: string;
  currentProjectName?: string;
  settings: AppSettings;
  updateSetting: UpdateSetting;
  updateSettings: UpdateSettings;
  bootServerBaseUrlOverride?: string;
  currentServerBaseUrl?: string;
  workbenchPreferences?: WorkbenchPreferences;
  updateWorkbenchPreferences?: (
    value:
      | Partial<WorkbenchPreferences>
      | ((previousState: WorkbenchPreferences) => Partial<WorkbenchPreferences>),
  ) => void;
}
