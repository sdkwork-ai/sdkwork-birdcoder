import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAuth,
  useBirdcoderAppSettings,
  useWorkbenchPreferences,
} from '@sdkwork/birdcoder-pc-workbench';
import { getDefaultBirdCoderIdeServicesRuntimeConfig } from '@sdkwork/birdcoder-pc-infrastructure-runtime/defaultIdeServices';
import {
  SettingsSidebar,
  GeneralSettings,
  AgentEngineSettings,
  ModelManagementSettings,
  AppearanceSettings,
  VoiceSettings,
  KeyboardShortcutsSettings,
  ConfigSettings,
  PersonalizationSettings,
  PluginSettings,
  BrowserSettings,
  ComputerControlSettings,
  MCPSettings,
  GitSettings,
  EnvironmentSettings,
  WorktreeSettings,
  ArchivedSettings,
  LegalComplianceSettings,
  type AppSettings,
  type SettingsTab,
  type UpdateSetting,
} from '../components';

interface SettingsPageProps {
  activeTab?: SettingsTab;
  currentProjectId?: string;
  currentProjectName?: string;
  onActiveTabChange?: (tab: SettingsTab) => void;
  onBack?: () => void;
  workspaceId: string;
}

export function SettingsPage({
  activeTab: controlledActiveTab,
  currentProjectId,
  currentProjectName,
  onActiveTabChange,
  onBack,
  workspaceId,
}: SettingsPageProps) {
  const { t } = useTranslation();
  const [internalActiveTab, setInternalActiveTab] = useState<SettingsTab>('general');
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const { logout } = useAuth();
  const { isHydrated: areSettingsHydrated, settings, updateSettings } = useBirdcoderAppSettings();
  const { preferences, updatePreferences } = useWorkbenchPreferences();
  const currentServerBaseUrl = getDefaultBirdCoderIdeServicesRuntimeConfig()
    .applicationApiBaseUrl ?? '';
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

  const handleActiveTabChange = (tab: SettingsTab) => {
    setInternalActiveTab(tab);
    onActiveTabChange?.(tab);
  };

  const renderContent = () => {
    const props = {
      currentProjectId,
      currentProjectName,
      settings,
      updateSetting,
      updateSettings,
      currentServerBaseUrl,
      bootServerBaseUrlOverride:
        bootServerBaseUrlOverrideRef.current ?? (areSettingsHydrated ? settings.serverBaseUrl : undefined),
      workbenchPreferences: preferences,
      updateWorkbenchPreferences: updatePreferences,
    };
    switch (activeTab) {
      case 'general':
        return <GeneralSettings {...props} />;
      case 'agentEngines':
        return <AgentEngineSettings {...props} />;
      case 'modelManagement':
        return <ModelManagementSettings />;
      case 'appearance':
        return <AppearanceSettings {...props} />;
      case 'voice':
        return <VoiceSettings {...props} />;
      case 'shortcuts':
        return <KeyboardShortcutsSettings />;
      case 'config':
        return <ConfigSettings {...props} />;
      case 'personalization':
        return <PersonalizationSettings {...props} />;
      case 'plugins':
        return <PluginSettings {...props} />;
      case 'browser':
        return (
          <BrowserSettings onOpenComputerControl={() => handleActiveTabChange('computerControl')} />
        );
      case 'computerControl':
        return <ComputerControlSettings />;
      case 'mcp':
        return <MCPSettings {...props} />;
      case 'git':
        return <GitSettings {...props} />;
      case 'environment':
        return <EnvironmentSettings {...props} />;
      case 'worktree':
        return <WorktreeSettings {...props} />;
      case 'archived':
        return <ArchivedSettings workspaceId={workspaceId} />;
      case 'legal':
        return <LegalComplianceSettings />;
      default:
        return (
          <div className="flex flex-1 items-center justify-center text-[var(--sdk-color-text-muted)]">
            {t('settings.sidebar.unavailable', { tab: activeTab })}
          </div>
        );
    }
  };

  return (
    <div className="flex h-full w-full bg-[var(--sdk-color-surface-canvas)] text-[var(--sdk-color-text-primary)]">
      <SettingsSidebar
        activeTab={activeTab}
        setActiveTab={handleActiveTabChange}
        onBack={onBack}
        onLogout={logout}
      />
      {renderContent()}
    </div>
  );
}

