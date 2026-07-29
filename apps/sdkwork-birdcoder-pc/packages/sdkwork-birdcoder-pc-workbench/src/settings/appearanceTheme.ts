import {
  DEFAULT_APP_SETTINGS,
  parseAppSettingValue,
  type AppSettings,
} from './appSettings.ts';

export type AppearanceThemeVariant = 'dark' | 'light';

export interface AppearanceThemeConfig {
  accent: string;
  background: string;
  codeFont: string;
  contrast: number;
  foreground: string;
  name: string;
  translucent: boolean;
  uiFont: string;
}

export type AppearanceThemeImportErrorCode =
  | 'empty'
  | 'invalid-json'
  | 'invalid-shape'
  | 'invalid-value'
  | 'unsupported-key';

export class AppearanceThemeImportError extends Error {
  readonly code: AppearanceThemeImportErrorCode;

  constructor(code: AppearanceThemeImportErrorCode) {
    super(code);
    this.name = 'AppearanceThemeImportError';
    this.code = code;
  }
}

const APPEARANCE_THEME_FIELDS = [
  'name',
  'accent',
  'background',
  'foreground',
  'uiFont',
  'codeFont',
  'translucent',
  'contrast',
] as const satisfies readonly (keyof AppearanceThemeConfig)[];

const APPEARANCE_THEME_FIELD_SET = new Set<string>(APPEARANCE_THEME_FIELDS);

const APPEARANCE_THEME_SETTING_KEYS = {
  dark: {
    accent: 'darkAccent',
    background: 'darkBackground',
    codeFont: 'darkCodeFont',
    contrast: 'darkContrast',
    foreground: 'darkForeground',
    name: 'darkThemeName',
    translucent: 'darkTranslucent',
    uiFont: 'darkUiFont',
  },
  light: {
    accent: 'lightAccent',
    background: 'lightBackground',
    codeFont: 'lightCodeFont',
    contrast: 'lightContrast',
    foreground: 'lightForeground',
    name: 'lightThemeName',
    translucent: 'lightTranslucent',
    uiFont: 'lightUiFont',
  },
} as const satisfies Record<
  AppearanceThemeVariant,
  Record<keyof AppearanceThemeConfig, keyof AppSettings>
>;

export const APPEARANCE_THEME_PRESETS = {
  dark: {
    'Codex Dark': {
      accent: '#339CFF',
      background: '#181818',
      foreground: '#FFFFFF',
    },
    Dracula: {
      accent: '#FF79C6',
      background: '#282A36',
      foreground: '#F8F8F2',
    },
    'GitHub Dark': {
      accent: '#58A6FF',
      background: '#0D1117',
      foreground: '#C9D1D9',
    },
  },
  light: {
    'Codex Light': {
      accent: '#0285FF',
      background: '#FFFFFF',
      foreground: '#1A1C1F',
    },
    'GitHub Light': {
      accent: '#0969DA',
      background: '#FFFFFF',
      foreground: '#24292F',
    },
    'Solarized Light': {
      accent: '#268BD2',
      background: '#FDF6E3',
      foreground: '#657B83',
    },
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getAppearanceThemeConfig(
  settings: AppSettings,
  variant: AppearanceThemeVariant,
): AppearanceThemeConfig {
  const keys = APPEARANCE_THEME_SETTING_KEYS[variant];
  return {
    accent: settings[keys.accent] as string,
    background: settings[keys.background] as string,
    codeFont: settings[keys.codeFont] as string,
    contrast: settings[keys.contrast] as number,
    foreground: settings[keys.foreground] as string,
    name: settings[keys.name] as string,
    translucent: settings[keys.translucent] as boolean,
    uiFont: settings[keys.uiFont] as string,
  };
}

export function getDefaultAppearanceThemeSettings(
  variant: AppearanceThemeVariant,
): Partial<AppSettings> {
  return appearanceThemeConfigToSettings(
    getAppearanceThemeConfig(DEFAULT_APP_SETTINGS, variant),
    variant,
  );
}

export function getDefaultAppearanceSettings(): Partial<AppSettings> {
  return {
    ...getDefaultAppearanceThemeSettings('light'),
    ...getDefaultAppearanceThemeSettings('dark'),
    codeFontSize: DEFAULT_APP_SETTINGS.codeFontSize,
    minimap: DEFAULT_APP_SETTINGS.minimap,
    showLineNumbers: DEFAULT_APP_SETTINGS.showLineNumbers,
    theme: DEFAULT_APP_SETTINGS.theme,
    uiFontSize: DEFAULT_APP_SETTINGS.uiFontSize,
    usePointerCursor: DEFAULT_APP_SETTINGS.usePointerCursor,
    wordWrap: DEFAULT_APP_SETTINGS.wordWrap,
  };
}

export function getAppearanceThemePresetSettings(
  variant: AppearanceThemeVariant,
  name: string,
): Partial<AppSettings> | null {
  const presets = APPEARANCE_THEME_PRESETS[variant] as Record<
    string,
    Pick<AppearanceThemeConfig, 'accent' | 'background' | 'foreground'>
  >;
  const preset = presets[name];
  if (!preset) {
    return null;
  }

  const keys = APPEARANCE_THEME_SETTING_KEYS[variant];
  return {
    [keys.accent]: preset.accent,
    [keys.background]: preset.background,
    [keys.foreground]: preset.foreground,
    [keys.name]: name,
  };
}

export function appearanceThemeConfigToSettings(
  config: Partial<AppearanceThemeConfig>,
  variant: AppearanceThemeVariant,
): Partial<AppSettings> {
  const keys = APPEARANCE_THEME_SETTING_KEYS[variant];
  const settings: Partial<AppSettings> = {};
  const writableSettings = settings as Record<keyof AppSettings, AppSettings[keyof AppSettings]>;

  for (const field of APPEARANCE_THEME_FIELDS) {
    const rawValue = config[field];
    if (rawValue === undefined) {
      continue;
    }

    const settingKey = keys[field];
    const parsedValue = parseAppSettingValue(settingKey, rawValue);
    if (parsedValue === null || (typeof parsedValue === 'string' && !parsedValue.trim())) {
      throw new AppearanceThemeImportError('invalid-value');
    }
    writableSettings[settingKey] = parsedValue;
  }

  return settings;
}

export function parseAppearanceThemeJson(
  serializedConfig: string,
  variant: AppearanceThemeVariant,
): Partial<AppSettings> {
  if (!serializedConfig.trim()) {
    throw new AppearanceThemeImportError('empty');
  }

  let parsedConfig: unknown;
  try {
    parsedConfig = JSON.parse(serializedConfig) as unknown;
  } catch {
    throw new AppearanceThemeImportError('invalid-json');
  }

  if (!isRecord(parsedConfig)) {
    throw new AppearanceThemeImportError('invalid-shape');
  }

  if (Object.keys(parsedConfig).some((key) => !APPEARANCE_THEME_FIELD_SET.has(key))) {
    throw new AppearanceThemeImportError('unsupported-key');
  }

  const settings = appearanceThemeConfigToSettings(parsedConfig, variant);
  if (Object.keys(settings).length === 0) {
    throw new AppearanceThemeImportError('empty');
  }

  return settings;
}
