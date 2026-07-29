import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isBrowserSpeechRecognitionSupported } from '@sdkwork/birdcoder-pc-workbench';

import type { SettingsProps } from '../types';
import {
  VoiceSettingsCard,
  VoiceSettingsRow,
  VoiceSettingsSwitch,
  VoiceStatusBadge,
} from './VoiceSettingsPrimitives';

export function VoiceDictationSettings({ settings, updateSetting }: SettingsProps) {
  const { t } = useTranslation();
  const isSupported = isBrowserSpeechRecognitionSupported();

  return (
    <VoiceSettingsCard>
      <VoiceSettingsRow
        title={t('settings.voice.browserDictation')}
        description={t('settings.voice.browserDictationDesc')}
      >
        <VoiceStatusBadge
          label={t(
            isSupported
              ? 'settings.voice.dictationAvailable'
              : 'settings.voice.dictationUnavailable',
          )}
          tone={isSupported ? 'positive' : 'warning'}
        />
      </VoiceSettingsRow>
      <VoiceSettingsRow
        title={t('settings.voice.recognitionLanguage')}
        description={t('settings.voice.recognitionLanguageDesc')}
      >
        <div className="relative">
          <select
            value={settings.voiceRecognitionLanguage}
            onChange={(event) =>
              updateSetting(
                'voiceRecognitionLanguage',
                event.target.value as typeof settings.voiceRecognitionLanguage,
              )
            }
            aria-label={t('settings.voice.recognitionLanguage')}
            className="h-8 w-44 appearance-none rounded-md border border-white/[0.075] bg-[#242426] px-3 pr-8 text-xs text-white outline-none transition-colors hover:border-white/15 focus:border-blue-400/60 focus:ring-1 focus:ring-blue-400/30"
          >
            <option value="Auto">{t('settings.voice.languageAuto')}</option>
            <option value="Chinese">{t('settings.voice.languageChinese')}</option>
            <option value="English">{t('settings.voice.languageEnglish')}</option>
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#92949a]"
          />
        </div>
      </VoiceSettingsRow>
      <VoiceSettingsRow
        title={t('settings.voice.continuousListening')}
        description={t('settings.voice.continuousListeningDesc')}
      >
        <VoiceSettingsSwitch
          checked={settings.voiceContinuousListening}
          label={t('settings.voice.continuousListening')}
          onCheckedChange={(checked) => updateSetting('voiceContinuousListening', checked)}
        />
      </VoiceSettingsRow>
      <VoiceSettingsRow
        title={t('settings.voice.inAppShortcut')}
        description={t('settings.voice.inAppShortcutDesc')}
      >
        <div className="flex items-center gap-3">
          <kbd className="inline-flex h-6 items-center rounded-md border border-white/10 bg-white/[0.055] px-2 font-mono text-[11px] text-[#c7c8cc] shadow-sm">
            Ctrl + Shift + Space
          </kbd>
          <VoiceSettingsSwitch
            checked={settings.voiceShortcutEnabled}
            label={t('settings.voice.inAppShortcut')}
            onCheckedChange={(checked) => updateSetting('voiceShortcutEnabled', checked)}
          />
        </div>
      </VoiceSettingsRow>
    </VoiceSettingsCard>
  );
}
