import { resolveBirdCoderLegalLinks } from '@sdkwork/birdcoder-pc-workbench';
import { useTranslation } from 'react-i18next';

export function LegalComplianceSettings() {
  const { t } = useTranslation();
  const legal = resolveBirdCoderLegalLinks();

  return (
    <div className="flex-1 overflow-y-auto bg-[#0e0e11] p-12">
      <div className="mx-auto max-w-3xl animate-in fade-in slide-in-from-bottom-4 fill-mode-both">
        <h1 className="mb-8 text-2xl font-semibold text-white">{t('settings.legalCompliance')}</h1>
        <div className="overflow-hidden rounded-xl border border-white/5 bg-[#18181b]">
          <div className="space-y-1 p-4 text-sm text-gray-300">
            <p>{t('settings.legalComplianceDesc')}</p>
            <div className="flex flex-wrap gap-4 pt-2">
              <a
                className="text-blue-400 underline-offset-2 hover:underline"
                href={legal.privacyPolicyUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {t('settings.privacyPolicy')}
              </a>
              <a
                className="text-blue-400 underline-offset-2 hover:underline"
                href={legal.termsOfServiceUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {t('settings.termsOfService')}
              </a>
              <a
                className="text-blue-400 underline-offset-2 hover:underline"
                href={legal.supportUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {t('settings.support')}
              </a>
              <a
                className="text-blue-400 underline-offset-2 hover:underline"
                href={legal.officialWebsiteUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {t('settings.officialWebsite')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
