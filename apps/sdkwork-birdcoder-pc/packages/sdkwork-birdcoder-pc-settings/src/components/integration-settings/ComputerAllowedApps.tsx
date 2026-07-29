import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  IntegrationSettingsButton,
  IntegrationSettingsCard,
  IntegrationSettingsRow,
  IntegrationSettingsSection,
} from './IntegrationSettingsPrimitives';

interface ComputerAllowedAppsProps {
  apps: readonly string[];
  enabled: boolean;
  onAppsChange: (apps: string[]) => void;
}

export function ComputerAllowedApps({
  apps,
  enabled,
  onAppsChange,
}: ComputerAllowedAppsProps) {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const [appDraft, setAppDraft] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const appName = appDraft.trim();
    if (!appName) {
      return;
    }
    onAppsChange([...apps, appName]);
    setAppDraft('');
    setIsAdding(false);
  };

  return (
    <IntegrationSettingsSection
      action={(
        <IntegrationSettingsButton
          disabled={!enabled}
          icon={Plus}
          onClick={() => setIsAdding((value) => !value)}
          variant="quiet"
        >
          {t('settings.computerControl.allowedApps.add')}
        </IntegrationSettingsButton>
      )}
      title={t('settings.computerControl.allowedApps.title')}
    >
      <IntegrationSettingsCard>
        {isAdding ? (
          <form className="flex gap-2 border-b border-white/[0.055] p-3" onSubmit={handleSubmit}>
            <input
              aria-label={t('settings.computerControl.allowedApps.appName')}
              className="h-8 min-w-0 flex-1 rounded-md border border-white/[0.1] bg-[#171719] px-2.5 text-[11px] text-[#ededee] outline-none placeholder:text-[#66676c] focus:border-blue-400/60"
              maxLength={160}
              onChange={(event) => setAppDraft(event.target.value)}
              placeholder={t('settings.computerControl.allowedApps.placeholder')}
              value={appDraft}
            />
            <IntegrationSettingsButton type="submit">
              {t('settings.computerControl.allowedApps.save')}
            </IntegrationSettingsButton>
          </form>
        ) : null}
        {apps.length === 0 ? (
          <div className="px-3.5 py-3 text-[11px] text-[#85868b]">
            {enabled
              ? t('settings.computerControl.allowedApps.none')
              : t('settings.computerControl.allowedApps.enableFirst')}
          </div>
        ) : apps.map((app) => (
          <IntegrationSettingsRow key={app} title={app}>
            <button
              aria-label={t('settings.computerControl.allowedApps.remove', { app })}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#85868b] outline-none hover:bg-white/[0.06] hover:text-red-300 focus-visible:ring-2 focus-visible:ring-blue-400/70"
              onClick={() => onAppsChange(apps.filter((entry) => entry !== app))}
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
