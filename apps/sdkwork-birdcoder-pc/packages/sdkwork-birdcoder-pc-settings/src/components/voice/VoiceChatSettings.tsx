import { useTranslation } from 'react-i18next';

import { VoiceSettingsCard, VoiceSettingsRow, VoiceStatusBadge } from './VoiceSettingsPrimitives';

export function VoiceChatSettings() {
  const { t } = useTranslation();

  return (
    <VoiceSettingsCard>
      <VoiceSettingsRow
        title={t('settings.voice.voiceInput')}
        description={t('settings.voice.voiceInputDesc')}
      >
        <VoiceStatusBadge label={t('settings.voice.composerMicrophone')} tone="positive" />
      </VoiceSettingsRow>
      <VoiceSettingsRow
        title={t('settings.voice.spokenResponses')}
        description={t('settings.voice.spokenResponsesDesc')}
      >
        <VoiceStatusBadge label={t('settings.voice.runtimeUnavailable')} />
      </VoiceSettingsRow>
    </VoiceSettingsCard>
  );
}
