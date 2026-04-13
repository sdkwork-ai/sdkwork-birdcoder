import React from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsProps } from './types';

export function WorktreeSettings({ settings, updateSetting }: SettingsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 overflow-y-auto p-12 bg-[#0e0e11]">
      <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 fill-mode-both" style={{ animationDelay: '0ms' }}>
        <h1 className="text-2xl font-semibold text-white mb-8">{t('settings.worktree.title')}</h1>
        
        <div className="bg-[#18181b] rounded-xl border border-white/10 overflow-hidden mb-8">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <div className="text-white font-medium">{t('settings.worktree.defaultLocation')}</div>
              <div className="text-sm text-gray-500">{t('settings.worktree.defaultLocationDesc')}</div>
            </div>
            <input 
              type="text" 
              value={settings.worktreeLocation} 
              onChange={(e) => updateSetting('worktreeLocation', e.target.value)}
              className="bg-[#0e0e11] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none hover:border-gray-500 w-48 focus:border-blue-500/50" 
            />
          </div>
          <div className="flex items-center justify-between p-4">
            <div>
              <div className="text-white font-medium">{t('settings.worktree.autoCleanup')}</div>
              <div className="text-sm text-gray-500">{t('settings.worktree.autoCleanupDesc')}</div>
            </div>
            <div 
              className={`w-10 h-6 rounded-full relative cursor-pointer flex items-center px-1 transition-colors ${settings.worktreeAutoCleanup ? 'bg-blue-500' : 'bg-white/[0.1]'}`}
              onClick={() => updateSetting('worktreeAutoCleanup', !settings.worktreeAutoCleanup)}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute transition-all ${settings.worktreeAutoCleanup ? 'right-1' : 'left-1'}`}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
