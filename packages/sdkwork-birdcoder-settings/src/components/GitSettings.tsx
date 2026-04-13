import React from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsProps } from './types';

export function GitSettings({ settings, updateSetting }: SettingsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 overflow-y-auto p-12 bg-[#0e0e11]">
      <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 fill-mode-both" style={{ animationDelay: '0ms' }}>
        <h1 className="text-2xl font-semibold text-white mb-8">{t('settings.git.title')}</h1>
        
        <div className="bg-[#18181b] rounded-xl border border-white/10 overflow-hidden mb-8">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <div className="text-white font-medium">{t('settings.git.autoFetch')}</div>
              <div className="text-sm text-gray-500">{t('settings.git.autoFetchDesc')}</div>
            </div>
            <div 
              className={`w-10 h-6 rounded-full relative cursor-pointer flex items-center px-1 transition-colors ${settings.gitAutoFetch ? 'bg-blue-500' : 'bg-white/[0.1]'}`}
              onClick={() => updateSetting('gitAutoFetch', !settings.gitAutoFetch)}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute transition-all ${settings.gitAutoFetch ? 'right-1' : 'left-1'}`}></div>
            </div>
          </div>
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <div className="text-white font-medium">{t('settings.git.commitMessageGeneration')}</div>
              <div className="text-sm text-gray-500">{t('settings.git.commitMessageGenerationDesc')}</div>
            </div>
            <div 
              className={`w-10 h-6 rounded-full relative cursor-pointer flex items-center px-1 transition-colors ${settings.gitCommitMessageGeneration ? 'bg-blue-500' : 'bg-white/[0.1]'}`}
              onClick={() => updateSetting('gitCommitMessageGeneration', !settings.gitCommitMessageGeneration)}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute transition-all ${settings.gitCommitMessageGeneration ? 'right-1' : 'left-1'}`}></div>
            </div>
          </div>
          <div className="flex items-center justify-between p-4">
            <div>
              <div className="text-white font-medium">{t('settings.git.defaultBranchName')}</div>
              <div className="text-sm text-gray-500">{t('settings.git.defaultBranchNameDesc')}</div>
            </div>
            <input 
              type="text" 
              value={settings.gitDefaultBranch} 
              onChange={(e) => updateSetting('gitDefaultBranch', e.target.value)}
              className="bg-[#0e0e11] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none hover:border-gray-500 w-32 focus:border-blue-500/50" 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
