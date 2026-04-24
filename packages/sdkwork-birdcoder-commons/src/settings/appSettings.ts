export interface AppSettings {
  defaultOpenTarget: string;
  agentEnvironment: string;
  language: string;
  sessionDetails: string;
  requireCtrlEnter: boolean;
  followUpBehavior: string;
  turnCompletionNotification: string;
  enablePermissionNotifications: boolean;
  theme: string;
  usePointerCursor: boolean;
  uiFontSize: string;
  codeFontSize: string;
  approvalPolicy: string;
  sandboxSettings: string;
  serverBaseUrl: string;
  codeSnippetStyle: string;
  showLineNumbers: boolean;
  wordWrap: boolean;
  minimap: boolean;
  envNodeVersion: string;
  envPackageManager: string;
  lightThemeName: string;
  lightAccent: string;
  lightBackground: string;
  lightForeground: string;
  lightUiFont: string;
  lightCodeFont: string;
  lightTranslucent: boolean;
  lightContrast: number;
  darkThemeName: string;
  darkAccent: string;
  darkBackground: string;
  darkForeground: string;
  darkUiFont: string;
  darkCodeFont: string;
  darkTranslucent: boolean;
  darkContrast: number;
  customInstructions: string;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultOpenTarget: "VS Code",
  agentEnvironment: "Windows native",
  language: "Auto-detect",
  sessionDetails: "Steps with code commands",
  requireCtrlEnter: false,
  followUpBehavior: "Queue",
  turnCompletionNotification: "Only when app is unfocused",
  enablePermissionNotifications: true,
  theme: "Dark",
  usePointerCursor: false,
  uiFontSize: "13",
  codeFontSize: "12",
  approvalPolicy: "On request",
  sandboxSettings: "Read only",
  serverBaseUrl: "",
  codeSnippetStyle: "Auto",
  showLineNumbers: true,
  wordWrap: true,
  minimap: false,
  envNodeVersion: "v20.x (LTS)",
  envPackageManager: "pnpm",
  lightThemeName: "Codex Light",
  lightAccent: "#0285FF",
  lightBackground: "#FFFFFF",
  lightForeground: "#0D0D0D",
  lightUiFont: "-apple-system, BlinkMacSystemFont",
  lightCodeFont: "ui-monospace, SFMono-Regular",
  lightTranslucent: true,
  lightContrast: 45,
  darkThemeName: "Codex Dark",
  darkAccent: "#339CFF",
  darkBackground: "#181818",
  darkForeground: "#FFFFFF",
  darkUiFont: "-apple-system, BlinkMacSystemFont",
  darkCodeFont: "ui-monospace, SFMono-Regular",
  darkTranslucent: true,
  darkContrast: 60,
  customInstructions: "",
};

const APP_SETTINGS_KEYS = Object.keys(DEFAULT_APP_SETTINGS) as Array<keyof AppSettings>;

export function normalizeAppSettings(
  value: Partial<AppSettings> | null | undefined,
): AppSettings {
  const rawValue =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const normalizedSettings = { ...DEFAULT_APP_SETTINGS };
  const writableSettings =
    normalizedSettings as Record<keyof AppSettings, AppSettings[keyof AppSettings]>;

  for (const key of APP_SETTINGS_KEYS) {
    const nextValue = rawValue[key];
    if (nextValue !== undefined && nextValue !== null) {
      writableSettings[key] = nextValue as AppSettings[keyof AppSettings];
    }
  }

  return normalizedSettings;
}

export function isCanonicalAppSettingsRecord(
  value: Partial<AppSettings> | null | undefined,
): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const rawValue = value as Record<string, unknown>;
  const normalizedValue = normalizeAppSettings(value);
  if (Object.keys(rawValue).length !== APP_SETTINGS_KEYS.length) {
    return false;
  }

  return APP_SETTINGS_KEYS.every((key) => Object.is(rawValue[key], normalizedValue[key]));
}
