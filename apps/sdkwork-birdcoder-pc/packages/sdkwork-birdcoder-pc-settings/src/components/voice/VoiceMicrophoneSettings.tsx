import { Mic, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { VoiceSettingsCard, VoiceSettingsRow, VoiceStatusBadge } from './VoiceSettingsPrimitives';
import { useVoiceMicrophoneState } from './useVoiceMicrophoneState';

export function VoiceMicrophoneSettings() {
  const { t } = useTranslation();
  const { deviceCount, isChecking, permission, requestAccess } = useVoiceMicrophoneState();
  const permissionLabel = t(`settings.voice.microphoneStatus.${permission}`);
  const permissionTone = permission === 'granted'
    ? 'positive'
    : permission === 'prompt'
      ? 'neutral'
      : 'warning';

  return (
    <VoiceSettingsCard>
      <VoiceSettingsRow
        title={t('settings.voice.microphone')}
        description={
          deviceCount > 0
            ? t('settings.voice.microphoneDevices', { count: deviceCount })
            : t('settings.voice.microphoneDesc')
        }
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          <VoiceStatusBadge label={permissionLabel} tone={permissionTone} />
          {permission !== 'unsupported' ? (
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-white/[0.065] px-2.5 text-xs font-medium text-[#d8d9dc] outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:opacity-50"
              disabled={isChecking}
              onClick={() => void requestAccess()}
            >
              {isChecking ? (
                <RefreshCw aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mic aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              {permission === 'granted'
                ? t('settings.voice.checkMicrophone')
                : t('settings.voice.enableMicrophone')}
            </button>
          ) : null}
        </div>
      </VoiceSettingsRow>
      <VoiceSettingsRow
        title={t('settings.voice.inputDevice')}
        description={t('settings.voice.inputDeviceDesc')}
      >
        <VoiceStatusBadge label={t('settings.voice.systemDefault')} />
      </VoiceSettingsRow>
    </VoiceSettingsCard>
  );
}
