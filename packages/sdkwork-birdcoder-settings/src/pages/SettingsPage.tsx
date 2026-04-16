import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getDefaultBirdCoderIdeServicesRuntimeConfig,
  getTerminalShellSettingValue,
  normalizeWorkbenchCodeEngineId,
  normalizeWorkbenchTerminalProfileId,
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
} from '../components';

interface SettingsPageProps {
  onBack?: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultOpenTarget: 'VS Code',
  agentEnvironment: 'Windows native',
  integratedTerminalShell: 'PowerShell',
  language: 'Auto-detect',
  threadDetails: 'Steps with code commands',
  requireCtrlEnter: false,
  followUpBehavior: 'Queue',
  turnCompletionNotification: 'Only when app is unfocused',
  enablePermissionNotifications: true,
  theme: 'Dark',
  usePointerCursor: false,
  uiFontSize: '13',
  codeFontSize: '12',
  approvalPolicy: 'On request',
  sandboxSettings: 'Read only',
  serverBaseUrl: '',
  codeSnippetStyle: 'Auto',
  showLineNumbers: true,
  wordWrap: true,
  minimap: false,
  gitAutoFetch: true,
  gitCommitMessageGeneration: true,
  gitDefaultBranch: 'main',
  envNodeVersion: 'v20.x (LTS)',
  envPackageManager: 'pnpm',
  worktreeLocation: '../.worktrees',
  worktreeAutoCleanup: false,
  codeDevelopmentEngine: 'codex',
  lightThemeName: 'Codex Light',
  lightAccent: '#0285FF',
  lightBackground: '#FFFFFF',
  lightForeground: '#0D0D0D',
  lightUiFont: '-apple-system, BlinkMacSystemFont',
  lightCodeFont: 'ui-monospace, SFMono-Regular',
  lightTranslucent: true,
  lightContrast: 45,
  darkThemeName: 'Codex Dark',
  darkAccent: '#339CFF',
  darkBackground: '#181818',
  darkForeground: '#FFFFFF',
  darkUiFont: '-apple-system, BlinkMacSystemFont',
  darkCodeFont: 'ui-monospace, SFMono-Regular',
  darkTranslucent: true,
  darkContrast: 60,
};

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { logout } = useAuth();
  const [settings, setSettings, areSettingsHydrated] = usePersistedState<AppSettings>(
    'settings',
    'app',
    DEFAULT_SETTINGS,
  );
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
    if (!isWorkbenchHydrated) {
      return;
    }

    const nextEngine = preferences.codeEngineId;
    const nextShell = getTerminalShellSettingValue(preferences.terminalProfileId);

    if (
      settings.codeDevelopmentEngine === nextEngine &&
      settings.integratedTerminalShell === nextShell
    ) {
      return;
    }

    setSettings({
      ...settings,
      codeDevelopmentEngine: nextEngine,
      integratedTerminalShell: nextShell,
    });
  }, [isWorkbenchHydrated, preferences.codeEngineId, preferences.terminalProfileId, setSettings, settings]);

  const updateSetting = (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    if (key === 'codeDevelopmentEngine') {
      updatePreferences({
        codeEngineId: normalizeWorkbenchCodeEngineId(String(value)),
      });
    }

    if (key === 'integratedTerminalShell') {
      updatePreferences({
        terminalProfileId: normalizeWorkbenchTerminalProfileId(String(value)),
      });
    }
  };

  const renderContent = () => {
    const props = {
      settings,
      updateSetting,
      currentServerBaseUrl,
      bootServerBaseUrlOverride:
        bootServerBaseUrlOverrideRef.current ?? (areSettingsHydrated ? settings.serverBaseUrl : undefined),
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
