import { useMemo, useState, type ReactNode } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  MonitorSmartphone,
  Moon,
  RotateCcw,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  SegmentedControl,
  Slider,
  Switch,
} from '@sdkwork/ui-pc-react';
import { copyTextToClipboard } from '@sdkwork/birdcoder-pc-ui';
import {
  APPEARANCE_THEME_PRESETS,
  APP_FONT_SIZE_MAX,
  APP_FONT_SIZE_MIN,
  DEFAULT_APP_SETTINGS,
  getAppearanceThemeConfig,
  getAppearanceThemePresetSettings,
  getDefaultAppearanceSettings,
  getDefaultAppearanceThemeSettings,
  parseAppearanceThemeJson,
  useBirdcoderTheme,
  useToast,
  type AppearanceThemeConfig,
  type AppearanceThemeVariant,
  type AppSettings,
} from '@sdkwork/birdcoder-pc-workbench';

import type { SettingsProps } from './types';

const THEME_SETTING_KEYS = {
  dark: {
    accent: 'darkAccent',
    background: 'darkBackground',
    codeFont: 'darkCodeFont',
    foreground: 'darkForeground',
    uiFont: 'darkUiFont',
  },
  light: {
    accent: 'lightAccent',
    background: 'lightBackground',
    codeFont: 'lightCodeFont',
    foreground: 'lightForeground',
    uiFont: 'lightUiFont',
  },
} as const satisfies Record<
  AppearanceThemeVariant,
  Record<'accent' | 'background' | 'codeFont' | 'foreground' | 'uiFont', keyof AppSettings>
>;

interface AppearanceRowProps {
  children: ReactNode;
  description?: string;
  label: string;
}

function AppearanceRow({ children, description, label }: AppearanceRowProps) {
  return (
    <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)] items-center gap-6 border-t border-[var(--sdk-color-border-subtle)] py-3 first:border-t-0 max-[760px]:grid-cols-1 max-[760px]:gap-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--sdk-color-text-primary)]">{label}</div>
        {description ? (
          <div className="mt-0.5 text-xs leading-5 text-[var(--sdk-color-text-muted)]">
            {description}
          </div>
        ) : null}
      </div>
      <div className="flex min-w-0 justify-end max-[760px]:justify-start">{children}</div>
    </div>
  );
}

interface ThemePreviewProps {
  config: AppearanceThemeConfig;
  variant: AppearanceThemeVariant;
}

function ThemePreview({ config, variant }: ThemePreviewProps) {
  const { t } = useTranslation();
  const isDark = variant === 'dark';

  return (
    <div
      className="min-h-36 overflow-hidden border-b border-[var(--sdk-color-border-subtle)] p-4"
      style={{
        backgroundColor: config.background,
        color: config.foreground,
        fontFamily: config.codeFont,
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: config.accent }}
          />
          <span className="truncate text-xs font-semibold" style={{ fontFamily: config.uiFont }}>
            {config.name}
          </span>
        </div>
        <span className="text-[11px] opacity-60">
          {t(isDark ? 'settings.appearance.darkTheme' : 'settings.appearance.lightTheme')}
        </span>
      </div>
      <div className="space-y-1.5 text-xs leading-5">
        <div className="flex opacity-55">
          <span className="mr-4 w-4 text-right">1</span>
          <span style={{ color: config.accent }}>const</span>&nbsp;theme = {'{'}
        </div>
        <div
          className="flex rounded-sm px-1"
          style={{ backgroundColor: `${config.accent}20` }}
        >
          <span className="mr-4 w-4 text-right" style={{ color: config.accent }}>2</span>
          <span>surface: &quot;sidebar&quot;,</span>
        </div>
        <div className="flex opacity-70">
          <span className="mr-4 w-4 text-right">3</span>
          <span>accent: &quot;{config.accent}&quot;,</span>
        </div>
        <div className="flex opacity-55">
          <span className="mr-4 w-4 text-right">4</span>
          <span>contrast: {config.contrast}</span>
        </div>
        <div className="flex opacity-55">
          <span className="mr-4 w-4 text-right">5</span>
          <span>{'}'};</span>
        </div>
      </div>
    </div>
  );
}

interface ThemeEditorProps extends Pick<SettingsProps, 'settings' | 'updateSetting' | 'updateSettings'> {
  isActive: boolean;
  onCopy: (variant: AppearanceThemeVariant) => void;
  onImport: (variant: AppearanceThemeVariant) => void;
  variant: AppearanceThemeVariant;
}

function ThemeEditor({
  isActive,
  onCopy,
  onImport,
  settings,
  updateSetting,
  updateSettings,
  variant,
}: ThemeEditorProps) {
  const { t } = useTranslation();
  const config = getAppearanceThemeConfig(settings, variant);
  const settingKeys = THEME_SETTING_KEYS[variant];
  const presetNames = Object.keys(APPEARANCE_THEME_PRESETS[variant]);
  const isCustomTheme = !presetNames.includes(config.name);

  const selectPreset = (name: string) => {
    const presetSettings = getAppearanceThemePresetSettings(variant, name);
    if (presetSettings) {
      updateSettings(presetSettings);
    }
  };

  const resetTheme = () => {
    updateSettings(getDefaultAppearanceThemeSettings(variant));
  };

  return (
    <section
      className={`overflow-hidden rounded-lg border bg-[var(--sdk-color-surface-panel)] shadow-[var(--sdk-shadow-soft)] transition-colors ${
        isActive
          ? 'border-[var(--sdk-color-brand-primary)]'
          : 'border-[var(--sdk-color-border-default)]'
      }`}
      aria-label={t(
        variant === 'dark'
          ? 'settings.appearance.darkThemeSettings'
          : 'settings.appearance.lightThemeSettings',
      )}
    >
      <ThemePreview config={config} variant={variant} />
      <div className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {variant === 'dark' ? (
              <Moon aria-hidden="true" className="h-4 w-4 text-[var(--sdk-color-text-secondary)]" />
            ) : (
              <Sun aria-hidden="true" className="h-4 w-4 text-[var(--sdk-color-text-secondary)]" />
            )}
            <h2 className="truncate text-sm font-semibold text-[var(--sdk-color-text-primary)]">
              {t(variant === 'dark' ? 'settings.appearance.darkTheme' : 'settings.appearance.lightTheme')}
            </h2>
            {isActive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--sdk-color-brand-primary-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--sdk-color-brand-primary)]">
                <Check aria-hidden="true" className="h-3 w-3" />
                {t('settings.appearance.active')}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <Button
              aria-label={t('settings.appearance.importThemeFor', {
                type: t(variant === 'dark' ? 'common.dark' : 'common.light'),
              })}
              onClick={() => onImport(variant)}
              size="sm"
              title={t('common.import')}
              variant="ghost"
            >
              <Upload aria-hidden="true" className="h-3.5 w-3.5" />
              {t('common.import')}
            </Button>
            <Button
              aria-label={t('settings.appearance.copyThemeFor', {
                type: t(variant === 'dark' ? 'common.dark' : 'common.light'),
              })}
              onClick={() => onCopy(variant)}
              size="sm"
              title={t('settings.appearance.copyTheme')}
              variant="ghost"
            >
              <Copy aria-hidden="true" className="h-3.5 w-3.5" />
              {t('settings.appearance.copyTheme')}
            </Button>
            <Button
              aria-label={t('settings.appearance.resetThemeFor', {
                type: t(variant === 'dark' ? 'common.dark' : 'common.light'),
              })}
              onClick={resetTheme}
              size="icon"
              title={t('settings.appearance.resetTheme')}
              variant="ghost"
              className="h-8 w-8"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <AppearanceRow label={t('settings.appearance.preset')}>
          <div className="relative w-full max-w-72">
            <select
              aria-label={t('settings.appearance.presetFor', {
                type: t(variant === 'dark' ? 'common.dark' : 'common.light'),
              })}
              className="h-9 w-full appearance-none rounded-md border border-[var(--sdk-color-border-default)] px-3 pr-9 text-sm text-[var(--sdk-color-text-primary)] outline-none transition-colors hover:border-[var(--sdk-color-border-strong)] focus:border-[var(--sdk-color-border-focus)] focus:ring-2 focus:ring-[var(--sdk-color-brand-primary-soft)]"
              data-birdcoder-field="true"
              onChange={(event) => selectPreset(event.target.value)}
              value={config.name}
            >
              {isCustomTheme ? <option value={config.name}>{config.name}</option> : null}
              {presetNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sdk-color-text-muted)]"
            />
          </div>
        </AppearanceRow>

        {(['accent', 'background', 'foreground'] as const).map((field) => {
          const color = config[field];
          const label = t(`settings.appearance.${field}`);
          return (
            <AppearanceRow key={field} label={label}>
              <div className="flex w-full max-w-72 items-center justify-end gap-3 max-[760px]:justify-start">
                <input
                  aria-label={label}
                  className="h-8 w-10 shrink-0 overflow-hidden rounded-md border border-[var(--sdk-color-border-default)] bg-transparent p-0.5"
                  onChange={(event) => updateSetting(settingKeys[field], event.target.value.toUpperCase())}
                  type="color"
                  value={color}
                />
                <output className="min-w-24 rounded-md border border-[var(--sdk-color-border-subtle)] bg-[var(--sdk-color-surface-panel-muted)] px-3 py-1.5 text-center font-mono text-xs tabular-nums text-[var(--sdk-color-text-secondary)]">
                  {color}
                </output>
              </div>
            </AppearanceRow>
          );
        })}

        <AppearanceRow label={t('settings.appearance.uiFont')}>
          <Input
            aria-label={t('settings.appearance.uiFontFor', {
              type: t(variant === 'dark' ? 'common.dark' : 'common.light'),
            })}
            className="w-full max-w-72"
            onBlur={(event) => {
              if (!event.target.value.trim()) {
                updateSetting(settingKeys.uiFont, DEFAULT_APP_SETTINGS[settingKeys.uiFont] as string);
              }
            }}
            onChange={(event) => updateSetting(settingKeys.uiFont, event.target.value)}
            value={config.uiFont}
          />
        </AppearanceRow>

        <AppearanceRow label={t('settings.appearance.codeFont')}>
          <Input
            aria-label={t('settings.appearance.codeFontFor', {
              type: t(variant === 'dark' ? 'common.dark' : 'common.light'),
            })}
            className="w-full max-w-72 font-mono"
            onBlur={(event) => {
              if (!event.target.value.trim()) {
                updateSetting(settingKeys.codeFont, DEFAULT_APP_SETTINGS[settingKeys.codeFont] as string);
              }
            }}
            onChange={(event) => updateSetting(settingKeys.codeFont, event.target.value)}
            value={config.codeFont}
          />
        </AppearanceRow>

        <AppearanceRow
          description={t('settings.appearance.translucentSidebarDesc')}
          label={t('settings.appearance.translucentSidebar')}
        >
          <Switch
            aria-label={t('settings.appearance.translucentSidebarFor', {
              type: t(variant === 'dark' ? 'common.dark' : 'common.light'),
            })}
            checked={config.translucent}
            onCheckedChange={(checked) => updateSetting(
              variant === 'dark' ? 'darkTranslucent' : 'lightTranslucent',
              checked,
            )}
          />
        </AppearanceRow>

        <AppearanceRow
          description={t('settings.appearance.contrastDesc')}
          label={t('settings.appearance.contrast')}
        >
          <div className="flex w-full max-w-72 items-center gap-3">
            <Slider
              aria-label={t('settings.appearance.contrastFor', {
                type: t(variant === 'dark' ? 'common.dark' : 'common.light'),
              })}
              max={100}
              min={0}
              onValueChange={([value]) => updateSetting(
                variant === 'dark' ? 'darkContrast' : 'lightContrast',
                value ?? config.contrast,
              )}
              step={1}
              value={[config.contrast]}
            />
            <output className="w-9 text-right text-xs tabular-nums text-[var(--sdk-color-text-secondary)]">
              {config.contrast}
            </output>
          </div>
        </AppearanceRow>
      </div>
    </section>
  );
}

export function AppearanceSettings({ settings, updateSetting, updateSettings }: SettingsProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { colorMode } = useBirdcoderTheme();
  const [importThemeType, setImportThemeType] = useState<AppearanceThemeVariant>('light');
  const [importThemeData, setImportThemeData] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const modeOptions = useMemo(() => [
    {
      icon: <Sun aria-hidden="true" className="h-4 w-4" />,
      label: t('common.light'),
      value: 'Light',
    },
    {
      icon: <Moon aria-hidden="true" className="h-4 w-4" />,
      label: t('common.dark'),
      value: 'Dark',
    },
    {
      icon: <MonitorSmartphone aria-hidden="true" className="h-4 w-4" />,
      label: t('common.system'),
      value: 'System',
    },
  ], [t]);

  const openImportDialog = (variant: AppearanceThemeVariant) => {
    setImportThemeType(variant);
    setImportThemeData('');
    setIsImportModalOpen(true);
  };

  const copyTheme = async (variant: AppearanceThemeVariant) => {
    const didCopy = await copyTextToClipboard(JSON.stringify(
      getAppearanceThemeConfig(settings, variant),
      null,
      2,
    ));
    const type = t(variant === 'dark' ? 'common.dark' : 'common.light');
    addToast(
      t(
        didCopy
          ? 'settings.appearance.themeCopied'
          : 'settings.appearance.themeCopyFailed',
        { type },
      ),
      didCopy ? 'success' : 'error',
    );
  };

  const importTheme = () => {
    try {
      const importedSettings = parseAppearanceThemeJson(importThemeData, importThemeType);
      updateSettings(importedSettings);
      addToast(t('settings.appearance.themeImported', {
        type: t(importThemeType === 'dark' ? 'common.dark' : 'common.light'),
      }), 'success');
      setIsImportModalOpen(false);
      setImportThemeData('');
    } catch {
      addToast(t('settings.appearance.invalidThemeJson'), 'error');
    }
  };

  const resetAppearance = () => {
    updateSettings(getDefaultAppearanceSettings());
    addToast(t('settings.appearance.appearanceReset'), 'success');
  };

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-[var(--sdk-color-surface-canvas)] text-[var(--sdk-color-text-primary)]">
      <div className="mx-auto w-full max-w-6xl px-8 py-9 max-[960px]:px-5 max-[760px]:px-4">
        <header className="mb-8 flex items-start justify-between gap-8 max-[1100px]:flex-col max-[1100px]:gap-5">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-[var(--sdk-color-text-primary)]">
              {t('settings.appearance.title')}
            </h1>
            <p className="mt-1 text-sm text-[var(--sdk-color-text-muted)]">
              {t('settings.appearance.description')}
            </p>
          </div>
          <div className="w-full max-w-md">
            <SegmentedControl
              aria-label={t('settings.appearance.themeMode')}
              onValueChange={(value) => updateSetting('theme', value)}
              options={modeOptions}
              size="sm"
              value={settings.theme}
            />
            {settings.theme === 'System' ? (
              <div className="mt-2 flex items-center justify-end gap-1.5 text-xs text-[var(--sdk-color-text-muted)]">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-[var(--sdk-color-brand-primary)]"
                />
                {t('settings.appearance.systemResolved', {
                  mode: t(colorMode === 'dark' ? 'common.dark' : 'common.light'),
                })}
              </div>
            ) : null}
          </div>
        </header>

        <div className="grid grid-cols-2 gap-5 max-[1180px]:grid-cols-1">
          <ThemeEditor
            isActive={colorMode === 'light'}
            onCopy={copyTheme}
            onImport={openImportDialog}
            settings={settings}
            updateSetting={updateSetting}
            updateSettings={updateSettings}
            variant="light"
          />
          <ThemeEditor
            isActive={colorMode === 'dark'}
            onCopy={copyTheme}
            onImport={openImportDialog}
            settings={settings}
            updateSetting={updateSetting}
            updateSettings={updateSettings}
            variant="dark"
          />
        </div>

        <section className="mt-10" aria-labelledby="appearance-behavior-title">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <h2
                className="text-base font-semibold text-[var(--sdk-color-text-primary)]"
                id="appearance-behavior-title"
              >
                {t('settings.appearance.interfaceAndEditor')}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--sdk-color-text-muted)]">
                {t('settings.appearance.interfaceAndEditorDesc')}
              </p>
            </div>
            <Button onClick={resetAppearance} size="sm" variant="outline">
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
              {t('settings.appearance.resetAll')}
            </Button>
          </div>

          <div className="border-y border-[var(--sdk-color-border-default)]">
            <AppearanceRow
              description={t('settings.appearance.usePointerCursorDesc')}
              label={t('settings.appearance.usePointerCursor')}
            >
              <Switch
                aria-label={t('settings.appearance.usePointerCursor')}
                checked={settings.usePointerCursor}
                onCheckedChange={(checked) => updateSetting('usePointerCursor', checked)}
              />
            </AppearanceRow>

            <AppearanceRow
              description={t('settings.appearance.uiFontSizeDesc')}
              label={t('settings.appearance.uiFontSize')}
            >
              <div className="flex w-full max-w-72 items-center gap-3">
                <Slider
                  aria-label={t('settings.appearance.uiFontSize')}
                  max={APP_FONT_SIZE_MAX}
                  min={APP_FONT_SIZE_MIN}
                  onValueChange={([value]) => updateSetting(
                    'uiFontSize',
                    String(value ?? Number(settings.uiFontSize)),
                  )}
                  step={1}
                  value={[Number(settings.uiFontSize)]}
                />
                <output className="w-12 text-right text-xs tabular-nums text-[var(--sdk-color-text-secondary)]">
                  {settings.uiFontSize}px
                </output>
              </div>
            </AppearanceRow>

            <AppearanceRow
              description={t('settings.appearance.codeFontSizeDesc')}
              label={t('settings.appearance.codeFontSize')}
            >
              <div className="flex w-full max-w-72 items-center gap-3">
                <Slider
                  aria-label={t('settings.appearance.codeFontSize')}
                  max={APP_FONT_SIZE_MAX}
                  min={APP_FONT_SIZE_MIN}
                  onValueChange={([value]) => updateSetting(
                    'codeFontSize',
                    String(value ?? Number(settings.codeFontSize)),
                  )}
                  step={1}
                  value={[Number(settings.codeFontSize)]}
                />
                <output className="w-12 text-right text-xs tabular-nums text-[var(--sdk-color-text-secondary)]">
                  {settings.codeFontSize}px
                </output>
              </div>
            </AppearanceRow>

            {([
              ['showLineNumbers', 'showLineNumbers', 'showLineNumbersDesc'],
              ['wordWrap', 'wordWrap', 'wordWrapDesc'],
              ['minimap', 'minimap', 'minimapDesc'],
            ] as const).map(([settingKey, labelKey, descriptionKey]) => (
              <AppearanceRow
                description={t(`settings.appearance.${descriptionKey}`)}
                key={settingKey}
                label={t(`settings.appearance.${labelKey}`)}
              >
                <Switch
                  aria-label={t(`settings.appearance.${labelKey}`)}
                  checked={settings[settingKey]}
                  onCheckedChange={(checked) => updateSetting(settingKey, checked)}
                />
              </AppearanceRow>
            ))}
          </div>
        </section>
      </div>

      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="[&>button:last-child]:hidden">
          <DialogHeader>
            <DialogTitle>
              {t('settings.appearance.importThemeTitle', {
                type: t(importThemeType === 'dark' ? 'common.dark' : 'common.light'),
              })}
            </DialogTitle>
            <DialogDescription>{t('settings.appearance.importThemeDesc')}</DialogDescription>
          </DialogHeader>
          <DialogClose asChild>
            <Button
              aria-label={t('common.close')}
              className="absolute right-4 top-4 h-8 w-8"
              size="icon"
              title={t('common.close')}
              variant="ghost"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </Button>
          </DialogClose>
          <div>
            <label
              className="mb-2 block text-xs font-medium text-[var(--sdk-color-text-secondary)]"
              htmlFor="appearance-theme-json"
            >
              {t('settings.appearance.themeJsonData')}
            </label>
            <textarea
              autoFocus
              className="h-56 w-full resize-none rounded-md border border-[var(--sdk-color-border-default)] px-3 py-2 font-mono text-sm text-[var(--sdk-color-text-primary)] outline-none placeholder:text-[var(--sdk-color-text-muted)] focus:border-[var(--sdk-color-border-focus)] focus:ring-2 focus:ring-[var(--sdk-color-brand-primary-soft)]"
              data-birdcoder-field="true"
              id="appearance-theme-json"
              onChange={(event) => setImportThemeData(event.target.value)}
              placeholder={t('settings.appearance.themeJsonPlaceholder')}
              value={importThemeData}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t('common.cancel')}</Button>
            </DialogClose>
            <Button disabled={!importThemeData.trim()} onClick={importTheme}>
              <Upload aria-hidden="true" className="h-4 w-4" />
              {t('settings.appearance.importTheme')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
