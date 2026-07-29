import { useTranslation } from 'react-i18next';

import type { SettingsProps } from './types';
import { VoiceChatSettings } from './voice/VoiceChatSettings';
import { VoiceDictationSettings } from './voice/VoiceDictationSettings';
import { VoiceMicrophoneSettings } from './voice/VoiceMicrophoneSettings';
import { VoicePrivacySettings } from './voice/VoicePrivacySettings';
import { VoiceSettingsSection } from './voice/VoiceSettingsPrimitives';

export function VoiceSettings(props: SettingsProps) {
  const { t } = useTranslation();

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-[#0e0e11] px-6 py-10 lg:px-12">
      <div className="mx-auto w-full max-w-2xl animate-in fade-in slide-in-from-bottom-2 fill-mode-both">
        <h1 className="text-2xl font-semibold text-white">{t('settings.voice.title')}</h1>
        <p className="mt-2 text-sm leading-6 text-[#8b8d92]">{t('settings.voice.description')}</p>

        <VoiceSettingsSection title={t('settings.voice.generalSection')}>
          <VoiceMicrophoneSettings />
        </VoiceSettingsSection>

        <VoiceSettingsSection title={t('settings.voice.dictationSection')}>
          <VoiceDictationSettings {...props} />
        </VoiceSettingsSection>

        <VoiceSettingsSection title={t('settings.voice.voiceChatSection')}>
          <VoiceChatSettings />
        </VoiceSettingsSection>

        <VoiceSettingsSection title={t('settings.voice.privacySection')}>
          <VoicePrivacySettings />
        </VoiceSettingsSection>
      </div>
    </main>
  );
}
