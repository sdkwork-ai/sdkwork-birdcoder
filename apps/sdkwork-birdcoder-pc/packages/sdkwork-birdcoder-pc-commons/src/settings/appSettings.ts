export const TERMINAL_APPROVAL_POLICY_SETTINGS = [
  "AutoAllow",
  "OnRequest",
  "Restricted",
  "ReleaseOnly",
] as const;

export type TerminalApprovalPolicySetting =
  (typeof TERMINAL_APPROVAL_POLICY_SETTINGS)[number];

export const TERMINAL_COMMAND_GUARD_SETTINGS = [
  "ReadOnly",
  "ReadWrite",
  "FullAccess",
] as const;

export type TerminalCommandGuardSetting =
  (typeof TERMINAL_COMMAND_GUARD_SETTINGS)[number];

const TERMINAL_APPROVAL_POLICY_ALIASES: Readonly<
  Record<string, TerminalApprovalPolicySetting>
> = {
  autoallow: "AutoAllow",
  "auto allow": "AutoAllow",
  never: "AutoAllow",
  "never ask": "AutoAllow",
  onrequest: "OnRequest",
  "on request": "OnRequest",
  always: "OnRequest",
  "always ask": "OnRequest",
  restricted: "Restricted",
  releaseonly: "ReleaseOnly",
  "release only": "ReleaseOnly",
};

const TERMINAL_COMMAND_GUARD_ALIASES: Readonly<
  Record<string, TerminalCommandGuardSetting>
> = {
  readonly: "ReadOnly",
  "read only": "ReadOnly",
  readwrite: "ReadWrite",
  "read write": "ReadWrite",
  "read and write": "ReadWrite",
  workspacewrite: "ReadWrite",
  "workspace write": "ReadWrite",
  fullaccess: "FullAccess",
  "full access": "FullAccess",
  unrestricted: "FullAccess",
};

export function normalizeTerminalApprovalPolicySetting(
  value: unknown,
  fallback: TerminalApprovalPolicySetting = "OnRequest",
): TerminalApprovalPolicySetting {
  return parseTerminalApprovalPolicySetting(value) ?? fallback;
}

export function normalizeTerminalCommandGuardSetting(
  value: unknown,
  fallback: TerminalCommandGuardSetting = "ReadOnly",
): TerminalCommandGuardSetting {
  return parseTerminalCommandGuardSetting(value) ?? fallback;
}

export function parseTerminalApprovalPolicySetting(
  value: unknown,
): TerminalApprovalPolicySetting | null {
  if (typeof value !== "string") {
    return null;
  }

  return TERMINAL_APPROVAL_POLICY_ALIASES[value.trim().toLowerCase()] ?? null;
}

export function parseTerminalCommandGuardSetting(
  value: unknown,
): TerminalCommandGuardSetting | null {
  if (typeof value !== "string") {
    return null;
  }

  return TERMINAL_COMMAND_GUARD_ALIASES[value.trim().toLowerCase()] ?? null;
}

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
  approvalPolicy: TerminalApprovalPolicySetting;
  sandboxSettings: TerminalCommandGuardSetting;
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
  approvalPolicy: "OnRequest",
  sandboxSettings: "ReadOnly",
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

const APP_SETTING_ENUMS: Partial<Record<keyof AppSettings, readonly string[]>> = {
  defaultOpenTarget: ['VS Code', 'Cursor', 'WebStorm'],
  agentEnvironment: ['Windows native', 'WSL', 'Docker'],
  language: ['Auto-detect', 'English', 'Chinese'],
  sessionDetails: ['Steps with code commands', 'All steps', 'Minimal'],
  followUpBehavior: ['Queue', 'Guide'],
  turnCompletionNotification: ['Only when app is unfocused', 'Always', 'Never'],
  theme: ['Light', 'Dark', 'System'],
  codeSnippetStyle: ['Auto', 'Concise', 'Detailed comments', 'Code only'],
  envNodeVersion: ['v20.x (LTS)', 'v22.x (Latest)', 'v18.x'],
  envPackageManager: ['pnpm', 'npm', 'yarn', 'bun'],
};

const APP_SETTING_COLOR_KEYS = new Set<keyof AppSettings>([
  'lightAccent',
  'lightBackground',
  'lightForeground',
  'darkAccent',
  'darkBackground',
  'darkForeground',
]);

const APP_SETTING_FONT_SIZE_KEYS = new Set<keyof AppSettings>([
  'uiFontSize',
  'codeFontSize',
]);

const APP_SETTING_STRING_MAX_LENGTHS: Partial<Record<keyof AppSettings, number>> = {
  serverBaseUrl: 2_048,
  lightThemeName: 128,
  darkThemeName: 128,
  lightUiFont: 256,
  lightCodeFont: 256,
  darkUiFont: 256,
  darkCodeFont: 256,
  customInstructions: 64 * 1024,
};

function normalizeHexSettingColor(value: string): string | null {
  const normalizedValue = value.trim();
  if (/^#[0-9a-fA-F]{6}$/u.test(normalizedValue)) {
    return normalizedValue.toUpperCase();
  }

  if (/^#[0-9a-fA-F]{3}$/u.test(normalizedValue)) {
    return `#${normalizedValue[1]}${normalizedValue[1]}${normalizedValue[2]}${normalizedValue[2]}${normalizedValue[3]}${normalizedValue[3]}`.toUpperCase();
  }

  return null;
}

function normalizeServerBaseUrlSetting(value: string): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return '';
  }

  try {
    const parsedUrl = new URL(trimmedValue);
    if (
      (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      return null;
    }

    const normalizedPathname = parsedUrl.pathname.replace(/\/+$/u, '');
    const pathname = normalizedPathname === '/' ? '' : normalizedPathname;
    return `${parsedUrl.origin}${pathname}`;
  } catch {
    return null;
  }
}

/**
 * Parse one setting using the same semantic rules for persisted state and
 * imported configuration. `null` means the value is not safe/canonical.
 */
export function parseAppSettingValue<K extends keyof AppSettings>(
  key: K,
  value: unknown,
): AppSettings[K] | null {
  const expectedValue = DEFAULT_APP_SETTINGS[key];
  if (typeof value !== typeof expectedValue) {
    return null;
  }

  if (key === 'approvalPolicy') {
    return parseTerminalApprovalPolicySetting(value) as AppSettings[K] | null;
  }

  if (key === 'sandboxSettings') {
    return parseTerminalCommandGuardSetting(value) as AppSettings[K] | null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && (key === 'lightContrast' || key === 'darkContrast') && value >= 0 && value <= 100
      ? value as AppSettings[K]
      : null;
  }

  if (typeof value !== 'string') {
    return value as AppSettings[K];
  }

  const maximumLength = APP_SETTING_STRING_MAX_LENGTHS[key] ?? 256;
  if (value.length > maximumLength) {
    return null;
  }

  const enumValues = APP_SETTING_ENUMS[key];
  if (enumValues && !enumValues.includes(value)) {
    return null;
  }

  if (APP_SETTING_COLOR_KEYS.has(key)) {
    return normalizeHexSettingColor(value) as AppSettings[K] | null;
  }

  if (APP_SETTING_FONT_SIZE_KEYS.has(key)) {
    if (!/^\d{1,2}$/u.test(value.trim())) {
      return null;
    }

    const numericValue = Number(value);
    return numericValue >= 8 && numericValue <= 32
      ? value.trim() as AppSettings[K]
      : null;
  }

  if (key === 'serverBaseUrl') {
    return normalizeServerBaseUrlSetting(value) as AppSettings[K] | null;
  }

  return value as AppSettings[K];
}

function normalizeAppSettingValue<K extends keyof AppSettings>(
  key: K,
  value: unknown,
): AppSettings[K] {
  return parseAppSettingValue(key, value) ?? DEFAULT_APP_SETTINGS[key];
}

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
      writableSettings[key] = normalizeAppSettingValue(key, nextValue);
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
