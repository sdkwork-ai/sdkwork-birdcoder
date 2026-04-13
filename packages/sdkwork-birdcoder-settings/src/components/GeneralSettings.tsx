import React, { useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@sdkwork/birdcoder-ui';
import { SettingsProps } from './types';
import { useTranslation } from 'react-i18next';

const Check = ({ size, className }: { size: number, className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

export function GeneralSettings({ settings, updateSetting }: SettingsProps) {
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    updateSetting('language', val);
    if (val === 'English') {
      i18n.changeLanguage('en');
    } else if (val === 'Chinese') {
      i18n.changeLanguage('zh');
    } else {
      // Auto-detect
      i18n.changeLanguage(navigator.language.startsWith('zh') ? 'zh' : 'en');
    }
  };

  useEffect(() => {
    if (settings.language === 'English') {
      i18n.changeLanguage('en');
    } else if (settings.language === 'Chinese') {
      i18n.changeLanguage('zh');
    }
  }, [settings.language, i18n]);

  return (
    <div className="flex-1 overflow-y-auto p-12 bg-[#0e0e11]">
      <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 fill-mode-both" style={{ animationDelay: '0ms' }}>
        <h1 className="text-2xl font-semibold text-white mb-8">{t('settings.general')}</h1>
        
        <div className="bg-[#18181b] rounded-xl border border-white/5 overflow-hidden mb-8">
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <div>
              <div className="text-white font-medium">{t('settings.defaultOpenTarget')}</div>
              <div className="text-sm text-gray-500">{t('settings.defaultOpenTargetDesc')}</div>
            </div>
            <div className="relative">
              <select 
                value={settings.defaultOpenTarget}
                onChange={(e) => updateSetting('defaultOpenTarget', e.target.value)}
                className="appearance-none bg-[#0e0e11] border border-white/10 rounded-lg px-4 py-2 pr-10 text-sm text-white outline-none hover:border-gray-500 cursor-pointer w-64"
              >
                <option>VS Code</option>
                <option>Cursor</option>
                <option>WebStorm</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <div className="text-white font-medium">{t('settings.agentEnvironment')}</div>
              <div className="text-sm text-gray-500">{t('settings.agentEnvironmentDesc')}</div>
            </div>
            <div className="relative">
              <select 
                value={settings.agentEnvironment}
                onChange={(e) => updateSetting('agentEnvironment', e.target.value)}
                className="appearance-none bg-[#0e0e11] border border-white/10 rounded-lg px-4 py-2 pr-10 text-sm text-white outline-none hover:border-gray-500 cursor-pointer w-64"
              >
                <option>Windows native</option>
                <option>WSL</option>
                <option>Docker</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <div className="text-white font-medium">{t('settings.codeDevelopmentEngine')}</div>
              <div className="text-sm text-gray-500">{t('settings.codeDevelopmentEngineDesc')}</div>
            </div>
            <div className="relative">
              <select 
                value={settings.codeDevelopmentEngine || 'codex'}
                onChange={(e) => updateSetting('codeDevelopmentEngine', e.target.value)}
                className="appearance-none bg-[#0e0e11] border border-white/10 rounded-lg px-4 py-2 pr-10 text-sm text-white outline-none hover:border-gray-500 cursor-pointer w-64"
              >
                <option value="codex">codex</option>
                <option value="claude-code">claude code</option>
                <option value="gemini">gemini</option>
                <option value="opencode">opencode</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <div className="text-white font-medium">{t('settings.integratedTerminalShell')}</div>
              <div className="text-sm text-gray-500">{t('settings.integratedTerminalShellDesc')}</div>
            </div>
            <div className="relative">
              <select 
                value={settings.integratedTerminalShell}
                onChange={(e) => updateSetting('integratedTerminalShell', e.target.value)}
                className="appearance-none bg-[#0e0e11] border border-white/10 rounded-lg px-4 py-2 pr-10 text-sm text-white outline-none hover:border-gray-500 cursor-pointer w-64"
              >
                <option>PowerShell</option>
                <option>Command Prompt</option>
                <option>Git Bash</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <div className="text-white font-medium">{t('settings.language')}</div>
              <div className="text-sm text-gray-500">{t('settings.languageDesc')}</div>
            </div>
            <div className="relative">
              <select 
                value={settings.language}
                onChange={handleLanguageChange}
                className="appearance-none bg-[#0e0e11] border border-white/10 rounded-lg px-4 py-2 pr-10 text-sm text-white outline-none hover:border-gray-500 cursor-pointer w-64"
              >
                <option value="Auto-detect">{t('common.autoDetect')}</option>
                <option value="English">{t('common.english')}</option>
                <option value="Chinese">{t('common.chinese')}</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <div className="text-white font-medium">{t('settings.threadDetails')}</div>
              <div className="text-sm text-gray-500">{t('settings.threadDetailsDesc')}</div>
            </div>
            <div className="relative">
              <select 
                value={settings.threadDetails}
                onChange={(e) => updateSetting('threadDetails', e.target.value)}
                className="appearance-none bg-[#0e0e11] border border-white/10 rounded-lg px-4 py-2 pr-10 text-sm text-white outline-none hover:border-gray-500 cursor-pointer w-64"
              >
                <option value="Steps with code commands">{t('common.stepsWithCode')}</option>
                <option value="All steps">{t('common.allSteps')}</option>
                <option value="Minimal">{t('common.minimal')}</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <div className="text-white font-medium">{t('settings.requireCtrlEnter')}</div>
              <div className="text-sm text-gray-500">{t('settings.requireCtrlEnterDesc')}</div>
            </div>
            <div 
              className={`w-10 h-6 rounded-full relative cursor-pointer flex items-center px-1 transition-colors ${settings.requireCtrlEnter ? 'bg-blue-500' : 'bg-white/[0.1]'}`}
              onClick={() => updateSetting('requireCtrlEnter', !settings.requireCtrlEnter)}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute transition-all ${settings.requireCtrlEnter ? 'right-1' : 'left-1'}`}></div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4">
            <div>
              <div className="text-white font-medium">{t('settings.followUpBehavior')}</div>
              <div className="text-sm text-gray-500">{t('settings.followUpBehaviorDesc')}</div>
            </div>
            <div className="flex bg-[#0e0e11] rounded-lg p-1 border border-white/10 gap-1">
              <Button 
                variant={settings.followUpBehavior === 'Queue' ? 'secondary' : 'ghost'} 
                size="sm" 
                className={`h-8 ${settings.followUpBehavior !== 'Queue' ? 'text-gray-400 hover:text-white' : ''}`}
                onClick={() => updateSetting('followUpBehavior', 'Queue')}
              >
                {t('common.queue')}
              </Button>
              <Button 
                variant={settings.followUpBehavior === 'Guide' ? 'secondary' : 'ghost'} 
                size="sm" 
                className={`h-8 ${settings.followUpBehavior !== 'Guide' ? 'text-gray-400 hover:text-white' : ''}`}
                onClick={() => updateSetting('followUpBehavior', 'Guide')}
              >
                {t('common.guide')}
              </Button>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-white mb-4">{t('settings.notifications')}</h2>
        <div className="bg-[#18181b] rounded-xl border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <div className="text-white font-medium">{t('settings.turnCompletionNotification')}</div>
              <div className="text-sm text-gray-500">{t('settings.turnCompletionNotificationDesc')}</div>
            </div>
            <div className="relative">
              <select 
                value={settings.turnCompletionNotification}
                onChange={(e) => updateSetting('turnCompletionNotification', e.target.value)}
                className="appearance-none bg-[#0e0e11] border border-white/10 rounded-lg px-4 py-2 pr-10 text-sm text-white outline-none hover:border-gray-500 cursor-pointer w-64"
              >
                <option value="Only when app is unfocused">{t('common.onlyWhenUnfocused')}</option>
                <option value="Always">{t('common.always')}</option>
                <option value="Never">{t('common.never')}</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center justify-between p-4">
            <div>
              <div className="text-white font-medium">{t('settings.enablePermissionNotifications')}</div>
              <div className="text-sm text-gray-500">{t('settings.enablePermissionNotificationsDesc')}</div>
            </div>
            <div 
              className={`w-5 h-5 border rounded flex items-center justify-center cursor-pointer transition-colors ${settings.enablePermissionNotifications ? 'bg-blue-500 border-blue-500' : 'border-gray-500 bg-white/10'}`}
              onClick={() => updateSetting('enablePermissionNotifications', !settings.enablePermissionNotifications)}
            >
              {settings.enablePermissionNotifications && <Check size={14} className="text-white" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
