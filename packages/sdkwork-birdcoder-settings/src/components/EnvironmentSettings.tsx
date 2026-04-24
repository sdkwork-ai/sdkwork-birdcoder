import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@sdkwork/birdcoder-ui-shell';
import { useToast } from '@sdkwork/birdcoder-commons';
import { useTranslation } from 'react-i18next';
import { SettingsProps } from './types';

export function EnvironmentSettings({ settings, updateSetting }: SettingsProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [envContent, setEnvContent] = useState('API_KEY=your_api_key_here\nDEBUG=true\nPORT=3000');
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    setIsEditing(false);
    // In a real app, this would save to a .env file
    addToast(t('settings.environment.variablesSaved'), 'success');
  };

  return (
    <div className="flex-1 overflow-y-auto p-12 bg-[#0e0e11]">
      <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 fill-mode-both" style={{ animationDelay: '0ms' }}>
        <h1 className="text-2xl font-semibold text-white mb-8">{t('settings.environment.title')}</h1>
        
        <div className="bg-[#18181b] rounded-xl border border-white/10 overflow-hidden mb-8">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <div className="text-white font-medium">{t('settings.environment.nodeVersion')}</div>
              <div className="text-sm text-gray-500">{t('settings.environment.nodeVersionDesc')}</div>
            </div>
            <div className="relative">
              <select 
                value={settings.envNodeVersion}
                onChange={(e) => updateSetting('envNodeVersion', e.target.value)}
                className="appearance-none bg-[#0e0e11] border border-white/10 rounded-lg px-4 py-2 pr-10 text-sm text-white outline-none hover:border-gray-500 cursor-pointer w-48"
              >
                <option>v20.x (LTS)</option>
                <option>v22.x (Latest)</option>
                <option>v18.x</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <div className="text-white font-medium">{t('settings.environment.packageManager')}</div>
              <div className="text-sm text-gray-500">{t('settings.environment.packageManagerDesc')}</div>
            </div>
            <div className="relative">
              <select 
                value={settings.envPackageManager}
                onChange={(e) => updateSetting('envPackageManager', e.target.value)}
                className="appearance-none bg-[#0e0e11] border border-white/10 rounded-lg px-4 py-2 pr-10 text-sm text-white outline-none hover:border-gray-500 cursor-pointer w-48"
              >
                <option>pnpm</option>
                <option>npm</option>
                <option>yarn</option>
                <option>bun</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-white font-medium">{t('settings.environment.environmentVariables')}</div>
                <div className="text-sm text-gray-500">{t('settings.environment.environmentVariablesDesc')}</div>
              </div>
              {isEditing ? (
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setIsEditing(false)}>{t('common.cancel')}</Button>
                  <Button variant="default" onClick={handleSave}>{t('common.save')}</Button>
                </div>
              ) : (
                <Button variant="secondary" onClick={() => setIsEditing(true)}>
                  {t('settings.environment.editVariables')}
                </Button>
              )}
            </div>
            {isEditing ? (
              <textarea 
                value={envContent}
                onChange={(e) => setEnvContent(e.target.value)}
                className="w-full h-48 bg-black/50 border border-white/10 rounded-lg p-3 text-sm text-gray-300 font-mono outline-none focus:border-blue-500/50 resize-none"
                placeholder="KEY=value"
              />
            ) : (
              <div className="w-full bg-black/30 border border-white/5 rounded-lg p-3 text-sm text-gray-400 font-mono whitespace-pre-wrap">
                {envContent || <span className="text-gray-600 italic">{t('settings.environment.noneDefined')}</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
