import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { normalizeBrowserSiteOrigin } from '@sdkwork/birdcoder-pc-workbench';
import {
  IntegrationSettingsButton,
  IntegrationSettingsCard,
  IntegrationSettingsRow,
  IntegrationSettingsSection,
} from './IntegrationSettingsPrimitives';

interface BrowserWebsitePermissionsProps {
  allowedSites: readonly string[];
  onAllowedSitesChange: (sites: string[]) => void;
}

export function BrowserWebsitePermissions({
  allowedSites,
  onAllowedSitesChange,
}: BrowserWebsitePermissionsProps) {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const [siteDraft, setSiteDraft] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const origin = normalizeBrowserSiteOrigin(siteDraft);
    if (!origin) {
      setError(t('settings.browser.permissions.invalidSite'));
      return;
    }
    onAllowedSitesChange([...allowedSites, origin]);
    setSiteDraft('');
    setError('');
    setIsAdding(false);
  };

  return (
    <IntegrationSettingsSection
      action={(
        <IntegrationSettingsButton
          icon={Plus}
          onClick={() => setIsAdding((value) => !value)}
          variant="quiet"
        >
          {t('settings.browser.permissions.add')}
        </IntegrationSettingsButton>
      )}
      title={t('settings.browser.permissions.websitePermissions')}
    >
      <IntegrationSettingsCard>
        {isAdding ? (
          <form className="border-b border-white/[0.055] p-3" onSubmit={handleSubmit}>
            <div className="flex gap-2">
              <input
                aria-label={t('settings.browser.permissions.siteAddress')}
                className="h-8 min-w-0 flex-1 rounded-md border border-white/[0.1] bg-[#171719] px-2.5 text-[11px] text-[#ededee] outline-none placeholder:text-[#66676c] focus:border-blue-400/60"
                onChange={(event) => {
                  setSiteDraft(event.target.value);
                  setError('');
                }}
                placeholder="https://example.com"
                value={siteDraft}
              />
              <IntegrationSettingsButton type="submit">
                {t('settings.browser.permissions.save')}
              </IntegrationSettingsButton>
            </div>
            {error ? <p className="mt-1.5 text-[10px] text-red-300">{error}</p> : null}
          </form>
        ) : null}
        {allowedSites.length === 0 ? (
          <div className="px-3.5 py-3 text-[11px] text-[#85868b]">
            {t('settings.browser.permissions.noSites')}
          </div>
        ) : allowedSites.map((site) => (
          <IntegrationSettingsRow key={site} title={site}>
            <button
              aria-label={t('settings.browser.permissions.removeSite', { site })}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#85868b] outline-none hover:bg-white/[0.06] hover:text-red-300 focus-visible:ring-2 focus-visible:ring-blue-400/70"
              onClick={() => onAllowedSitesChange(allowedSites.filter((entry) => entry !== site))}
              type="button"
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </IntegrationSettingsRow>
        ))}
      </IntegrationSettingsCard>
    </IntegrationSettingsSection>
  );
}
