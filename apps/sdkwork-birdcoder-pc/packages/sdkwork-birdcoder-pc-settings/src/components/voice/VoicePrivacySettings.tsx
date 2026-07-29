import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function VoicePrivacySettings() {
  const { t } = useTranslation();

  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/[0.07] bg-[#1b1b1d] px-4 py-3">
      <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
      <div>
        <div className="text-sm font-medium text-white">{t('settings.voice.privacyTitle')}</div>
        <div className="mt-0.5 text-xs leading-5 text-[#8b8d92]">
          {t('settings.voice.privacyDesc')}
        </div>
      </div>
    </div>
  );
}
