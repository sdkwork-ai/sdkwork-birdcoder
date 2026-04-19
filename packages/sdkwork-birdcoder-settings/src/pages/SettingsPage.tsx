import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getDefaultBirdCoderIdeServicesRuntimeConfig,
  useAuth,
  usePersistedState,
  useWorkbenchPreferences,
} from '@sdkwork/birdcoder-commons';
import { SkillsPage } from '@sdkwork/birdcoder-skills';
import {
  SettingsTab,
  SettingsSidebar,
  GeneralSettings,
  AppearanceSettings,
  ConfigSettings,
  PersonalizationSettings,
  MCPSettings,
  GitSettings,
  EnvironmentSettings,
  WorktreeSettings,
  ArchivedSettings,
  type AppSettings,
  type UpdateSetting,
} from '../components';
import { DEFAULT_APP_SETTINGS } from '../components/appSettings';

interface SettingsPageProps {
  onBack?: () => void;
}

function normalizeAppSettings(value: Partial<AppSettings> | null | undefined): AppSettings {
  const rawValue =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const normalizedSettings = { ...DEFAULT_APP_SETTINGS };
  const writableSettings =
    normalizedSettings as Record<keyof AppSettings, AppSettings[keyof AppSettings]>;

  for (const key of Object.keys(DEFAULT_APP_SETTINGS) as Array<keyof AppSettings>) {
    const nextValue = rawValue[key];
    if (nextValue !== undefined && nextValue !== null) {
      writableSettings[key] = nextValue as AppSettings[keyof AppSettings];
    }
  }

  return normalizedSettings;
}

function appSettingsEqual(left: AppSettings, right: AppSettings): boolean {
  return (
    JSON.stringify(normalizeAppSettings(left)) === JSON.stringify(normalizeAppSettings(right))
  );
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { logout } = useAuth();
  const [storedSettings, setSettings, areSettingsHydrated] = usePersistedState<AppSettings>(
    'settings',
    'app',
    DEFAULT_APP_SETTINGS,
  );
  const settings = normalizeAppSettings(storedSettings);
  const { preferences, updatePreferences, isHydrated: isWorkbenchHydrated } = useWorkbenchPreferences();
  const currentServerBaseUrl = getDefaultBirdCoderIdeServicesRuntimeConfig().apiBaseUrl ?? '';
  const bootServerBaseUrlOverrideRef = useRef<string | null>(null);

  useEffect(() => {
    if (!areSettingsHydrated || bootServerBaseUrlOverrideRef.current !== null) {
      return;
    }

    bootServerBaseUrlOverrideRef.current = settings.serverBaseUrl ?? '';
  }, [areSettingsHydrated, settings.serverBaseUrl]);

  useEffect(() => {
    if (!areSettingsHydrated) {
      return;
    }

    if (appSettingsEqual(storedSettings, settings)) {
      return;
    }

    setSettings(settings);
  }, [areSettingsHydrated, setSettings, settings, storedSettings]);

  const updateSetting: UpdateSetting = (key, value) => {
    setSettings({
      ...settings,
      [key]: value,
    } as AppSettings);
  };

  const renderContent = () => {
    const props = {
      settings,
      updateSetting,
      currentServerBaseUrl,
      bootServerBaseUrlOverride:
        bootServerBaseUrlOverrideRef.current ?? (areSettingsHydrated ? settings.serverBaseUrl : undefined),
      workbenchPreferences: preferences,
      updateWorkbenchPreferences: updatePreferences,
    };
    switch (activeTab) {
      case 'general':
        return <GeneralSettings {...props} />;
      case 'appearance':
        return <AppearanceSettings {...props} />;
      case 'config':
        return <ConfigSettings {...props} />;
      case 'personalization':
        return <PersonalizationSettings {...props} />;
      case 'mcp':
        return <MCPSettings {...props} />;
      case 'git':
        return <GitSettings {...props} />;
      case 'environment':
        return <EnvironmentSettings {...props} />;
      case 'worktree':
        return <WorktreeSettings {...props} />;
      case 'archived':
        return <ArchivedSettings />;
      case 'skills':
        return (
          <div className="flex-1 bg-[#0e0e11] overflow-hidden relative">
            <SkillsPage />
          </div>
        );
      default:
        return (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            {t('settings.sidebar.unavailable', { tab: activeTab })}
          </div>
        );
    }
  };

  return (
    <div className="flex h-full w-full bg-[#0e0e11]">
      <SettingsSidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onBack={onBack} 
        onLogout={logout} 
      />
      {renderContent()}
    </div>
  );
}
