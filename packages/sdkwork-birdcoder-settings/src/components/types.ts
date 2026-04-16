export interface AppSettings extends Record<string, unknown> {
  approvalPolicy: string;
  codeDevelopmentEngine: string;
  integratedTerminalShell: string;
  sandboxSettings: string;
  serverBaseUrl: string;
}

export interface SettingsProps {
  settings: AppSettings;
  updateSetting: (key: string, value: unknown) => void;
  bootServerBaseUrlOverride?: string;
  currentServerBaseUrl?: string;
}
