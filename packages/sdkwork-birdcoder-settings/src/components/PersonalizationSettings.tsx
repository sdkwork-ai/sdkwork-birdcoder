import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@sdkwork/birdcoder-ui';
import { useToast } from '@sdkwork/birdcoder-commons';
import { useTranslation } from 'react-i18next';
import { SettingsProps } from './types';

export function PersonalizationSettings({ settings, updateSetting }: SettingsProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);
  const [instructions, setInstructions] = useState(settings.customInstructions || '');

  const handleSaveInstructions = () => {
    updateSetting('customInstructions', instructions);
    setIsEditingInstructions(false);
    addToast(t('settings.personalization.instructionsSaved'), 'success');
  };

  return (
    <div className="flex-1 overflow-y-auto p-12 bg-[#0e0e11]">
      <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 fill-mode-both" style={{ animationDelay: '0ms' }}>
        <h1 className="text-2xl font-semibold text-white mb-8">{t('settings.personalization.title')}</h1>
        
        <div className="bg-[#18181b] rounded-xl border border-white/10 overflow-hidden mb-8">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-white font-medium">{t('settings.personalization.customInstructions')}</div>
                <div className="text-sm text-gray-500">{t('settings.personalization.customInstructionsDesc')}</div>
              </div>
              {isEditingInstructions ? (
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setIsEditingInstructions(false)}>{t('common.cancel')}</Button>
                  <Button variant="default" onClick={handleSaveInstructions}>{t('common.save')}</Button>
                </div>
              ) : (
                <Button variant="secondary" onClick={() => setIsEditingInstructions(true)}>
                  {t('settings.personalization.editInstructions')}
                </Button>
              )}
            </div>
            {isEditingInstructions ? (
              <textarea 
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full h-32 bg-black/50 border border-white/10 rounded-lg p-3 text-sm text-gray-300 outline-none focus:border-blue-500/50 resize-none"
                placeholder="E.g., Always use TypeScript, prefer functional components..."
              />
            ) : (
              <div className="w-full bg-black/30 border border-white/5 rounded-lg p-3 text-sm text-gray-400 whitespace-pre-wrap min-h-[80px]">
                {settings.customInstructions || <span className="text-gray-600 italic">{t('settings.personalization.noCustomInstructions')}</span>}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between p-4">
            <div>
              <div className="text-white font-medium">{t('settings.personalization.codeSnippetStyle')}</div>
              <div className="text-sm text-gray-500">{t('settings.personalization.codeSnippetStyleDesc')}</div>
            </div>
            <div className="relative">
              <select 
                value={settings.codeSnippetStyle}
                onChange={(e) => updateSetting('codeSnippetStyle', e.target.value)}
                className="appearance-none bg-[#0e0e11] border border-white/10 rounded-lg px-4 py-2 pr-10 text-sm text-white outline-none hover:border-gray-500 cursor-pointer w-48"
              >
                <option>Auto</option>
                <option>Concise</option>
                <option>Detailed comments</option>
                <option>Code only</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
