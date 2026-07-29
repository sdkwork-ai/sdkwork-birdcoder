import { describe, expect, it } from 'vitest';

import {
  AppearanceThemeImportError,
  appearanceThemeConfigToSettings,
  getAppearanceThemeConfig,
  getAppearanceThemePresetSettings,
  parseAppearanceThemeJson,
} from '../src/settings/appearanceTheme.ts';
import { DEFAULT_APP_SETTINGS } from '../src/settings/appSettings.ts';
import { resolveBirdcoderThemeState } from '../src/theme/birdcoderTheme.ts';

describe('PC appearance themes', () => {
  it('round-trips an exported light theme through validated settings', () => {
    const config = getAppearanceThemeConfig(DEFAULT_APP_SETTINGS, 'light');

    expect(parseAppearanceThemeJson(JSON.stringify(config), 'light')).toEqual(
      appearanceThemeConfigToSettings(config, 'light'),
    );
  });

  it('rejects invalid theme input without returning partial settings', () => {
    expect(() => parseAppearanceThemeJson(JSON.stringify({
      accent: '#123456',
      contrast: 101,
    }), 'dark')).toThrow(AppearanceThemeImportError);
    expect(() => parseAppearanceThemeJson('{"accent":', 'dark')).toThrow(
      AppearanceThemeImportError,
    );
    expect(() => parseAppearanceThemeJson(JSON.stringify({
      accent: '#123456',
      script: 'unsupported',
    }), 'dark')).toThrow(
      expect.objectContaining({ code: 'unsupported-key' }),
    );
  });

  it('applies presets as one partial settings object', () => {
    expect(getAppearanceThemePresetSettings('dark', 'Dracula')).toEqual({
      darkAccent: '#FF79C6',
      darkBackground: '#282A36',
      darkForeground: '#F8F8F2',
      darkThemeName: 'Dracula',
    });
    expect(getAppearanceThemePresetSettings('light', 'Unknown')).toBeNull();
  });

  it('resolves explicit and system modes with active appearance values', () => {
    const systemLight = resolveBirdcoderThemeState({
      ...DEFAULT_APP_SETTINGS,
      theme: 'System',
      lightAccent: '#123456',
      lightBackground: '#FAFAFA',
      lightForeground: '#101010',
      lightTranslucent: false,
      usePointerCursor: true,
    }, 'light');

    expect(systemLight).toMatchObject({
      accentColor: '#123456',
      backgroundColor: '#FAFAFA',
      colorMode: 'light',
      foregroundColor: '#101010',
      sidebarTranslucent: false,
      themeSelection: 'system',
      usePointerCursor: true,
    });

    expect(resolveBirdcoderThemeState({
      ...DEFAULT_APP_SETTINGS,
      theme: 'Dark',
    }, 'light').colorMode).toBe('dark');
  });

  it('uses the reference Codex surface palette in dark and light modes', () => {
    const darkTheme = resolveBirdcoderThemeState({
      ...DEFAULT_APP_SETTINGS,
      theme: 'Dark',
    });
    const lightTheme = resolveBirdcoderThemeState({
      ...DEFAULT_APP_SETTINGS,
      theme: 'Light',
    });

    expect(darkTheme.hostStyle).toMatchObject({
      '--birdcoder-chrome-border': '#343A44',
      '--birdcoder-chrome-selection': '#303135',
      '--birdcoder-chrome-surface': '#1E2024',
      '--sdk-color-surface-elevated': '#2D2D2D',
      '--sdk-color-surface-field': '#2D2D2D',
      '--sdk-color-surface-field-disabled': '#262626',
      '--sdk-color-surface-field-hover': '#333333',
      '--sdk-color-surface-panel': '#222222',
      '--sdk-color-surface-panel-muted': '#262626',
    });
    expect(lightTheme.hostStyle).toMatchObject({
      '--birdcoder-chrome-border': '#D4D7DD',
      '--birdcoder-chrome-selection': '#E4E8ED',
      '--birdcoder-chrome-surface': '#F0F3F9',
      '--sdk-color-surface-elevated': '#FFFFFF',
      '--sdk-color-surface-field': '#FFFFFF',
      '--sdk-color-surface-field-disabled': '#F5F5F5',
      '--sdk-color-surface-field-hover': '#FAFAFA',
      '--sdk-color-surface-panel': '#FFFFFF',
      '--sdk-color-surface-panel-muted': '#F7F7F8',
      '--sdk-color-text-primary': '#1A1C1F',
    });
  });

  it('keeps contrast and custom backgrounds effective for Codex themes', () => {
    const highContrastDark = resolveBirdcoderThemeState({
      ...DEFAULT_APP_SETTINGS,
      darkContrast: 100,
      theme: 'Dark',
    });
    const customCanvasDark = resolveBirdcoderThemeState({
      ...DEFAULT_APP_SETTINGS,
      darkBackground: '#101010',
      theme: 'Dark',
    });

    expect(highContrastDark.hostStyle['--sdk-color-surface-field']).not.toBe('#2D2D2D');
    expect(customCanvasDark.hostStyle['--sdk-color-surface-canvas']).toBe('#101010');
    expect(customCanvasDark.hostStyle['--birdcoder-chrome-surface']).not.toBe('#1E2024');
  });
});
