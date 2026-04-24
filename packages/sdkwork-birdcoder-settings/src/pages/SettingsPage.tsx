import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAuth,
  useBirdcoderAppSettings,
  useWorkbenchPreferences,
} from '@sdkwork/birdcoder-commons';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from '@sdkwork/birdcoder-infrastructure-runtime';
import {
  SettingsTab,
  SettingsSidebar,
  GeneralSettings,
  CodeEngineSettings,
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

interface SettingsPageProps {
  currentProjectId?: string;
  currentProjectName?: string;
  onBack?: () => void;
}

const LazySkillsPage = lazy(async () => {
  const module = await import('@sdkwork/birdcoder-skills');
  return { default: module.SkillsPage };
});

export function SettingsPage({
  currentProjectId,
  currentProjectName,
  onBack,
}: SettingsPageProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { logout } = useAuth();
  const { isHydrated: areSettingsHydrated, settings, updateSettings } = useBirdcoderAppSettings();
  const { preferences, updatePreferences } = useWorkbenchPreferences();
  const currentServerBaseUrl = getDefaultBirdCoderIdeServicesRuntimeConfig().apiBaseUrl ?? '';
  const bootServerBaseUrlOverrideRef = useRef<string | null>(null);

  useEffect(() => {
    if (!areSettingsHydrated || bootServerBaseUrlOverrideRef.current !== null) {
      return;
    }

    bootServerBaseUrlOverrideRef.current = settings.serverBaseUrl ?? '';
  }, [areSettingsHydrated, settings.serverBaseUrl]);

  const updateSetting: UpdateSetting = (key, value) => {
    updateSettings({
      [key]: value,
    } as Partial<AppSettings>);
  };

  const renderContent = () => {
    const props = {
      currentProjectId,
      currentProjectName,
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
      case 'codeEngines':
        return <CodeEngineSettings {...props} />;
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
            <Suspense
              fallback={
                <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
                  {t('common.loading', 'Loading...')}
                </div>
              }
            >
              <LazySkillsPage />
            </Suspense>
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
