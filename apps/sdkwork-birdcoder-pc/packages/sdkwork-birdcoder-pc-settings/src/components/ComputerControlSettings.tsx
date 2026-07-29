import { Globe2, MonitorUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIntegrationPreferences, useToast } from '@sdkwork/birdcoder-pc-workbench';
import { ComputerAllowedApps } from './integration-settings/ComputerAllowedApps';
import {
  IntegrationSettingsButton,
  IntegrationSettingsCard,
  IntegrationSettingsPage,
  IntegrationSettingsRow,
  IntegrationSettingsSection,
  IntegrationStatus,
} from './integration-settings/IntegrationSettingsPrimitives';

interface ComputerControlBridgeWindow extends Window {
  __BIRDCODER_CHROME_CONTROL__?: { connected?: boolean };
  __TAURI_INTERNALS__?: unknown;
}

export function ComputerControlSettings() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { preferences, updatePreferences } = useIntegrationPreferences();
  const runtimeWindow = window as ComputerControlBridgeWindow;
  const isDesktopHost = Boolean(runtimeWindow.__TAURI_INTERNALS__);
  const isChromeConnected = runtimeWindow.__BIRDCODER_CHROME_CONTROL__?.connected === true;

  const toggleAnyApp = () => {
    const computerAnyAppEnabled = !preferences.computerAnyAppEnabled;
    updatePreferences({ computerAnyAppEnabled });
    addToast(
      t(computerAnyAppEnabled
        ? 'settings.computerControl.feedback.anyAppConfigured'
        : 'settings.computerControl.feedback.anyAppRemoved'),
      'success',
    );
  };

  const toggleChrome = () => {
    const computerChromeEnabled = !preferences.computerChromeEnabled;
    updatePreferences({ computerChromeEnabled });
    addToast(
      t(computerChromeEnabled
        ? 'settings.computerControl.feedback.chromeConfigured'
        : 'settings.computerControl.feedback.chromeRemoved'),
      'success',
    );
  };

  const anyAppStatus = preferences.computerAnyAppEnabled
    ? isDesktopHost
      ? t('settings.computerControl.status.ready')
      : t('settings.computerControl.status.desktopRequired')
    : t('settings.computerControl.status.notConfigured');
  const chromeStatus = isChromeConnected
    ? t('settings.computerControl.status.connected')
    : preferences.computerChromeEnabled
      ? t('settings.computerControl.status.extensionNotConnected')
      : t('settings.computerControl.status.notConfigured');

  return (
    <IntegrationSettingsPage
      description={t('settings.computerControl.description')}
      title={t('settings.computerControl.title')}
    >
      <IntegrationSettingsSection title={t('settings.computerControl.control')}>
        <IntegrationSettingsCard ariaLabel={t('settings.computerControl.control')}>
          <IntegrationSettingsRow
            description={(
              <>
                <span className="block">{t('settings.computerControl.anyAppDesc')}</span>
                <IntegrationStatus
                  label={anyAppStatus}
                  tone={preferences.computerAnyAppEnabled && isDesktopHost ? 'positive' : 'neutral'}
                />
              </>
            )}
            icon={(
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-300/20 bg-sky-500/85 text-white">
                <MonitorUp aria-hidden="true" className="h-[18px] w-[18px]" />
              </span>
            )}
            title={t('settings.computerControl.anyApp')}
          >
            <IntegrationSettingsButton
              ariaLabel={`${t(preferences.computerAnyAppEnabled
                ? 'settings.computerControl.remove'
                : 'settings.computerControl.install')} ${t('settings.computerControl.anyApp')}`}
              onClick={toggleAnyApp}
            >
              {t(preferences.computerAnyAppEnabled
                ? 'settings.computerControl.remove'
                : 'settings.computerControl.install')}
            </IntegrationSettingsButton>
          </IntegrationSettingsRow>
          <IntegrationSettingsRow
            description={(
              <>
                <span className="block">{t('settings.computerControl.chromeDesc')}</span>
                <IntegrationStatus
                  label={chromeStatus}
                  tone={isChromeConnected ? 'positive' : preferences.computerChromeEnabled ? 'warning' : 'neutral'}
                />
              </>
            )}
            icon={(
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.1] bg-white text-[#4285f4]">
                <Globe2 aria-hidden="true" className="h-5 w-5" />
              </span>
            )}
            title="Google Chrome"
          >
            <IntegrationSettingsButton
              ariaLabel={`${t(preferences.computerChromeEnabled
                ? 'settings.computerControl.remove'
                : 'settings.computerControl.install')} Google Chrome`}
              onClick={toggleChrome}
            >
              {t(preferences.computerChromeEnabled
                ? 'settings.computerControl.remove'
                : 'settings.computerControl.install')}
            </IntegrationSettingsButton>
          </IntegrationSettingsRow>
        </IntegrationSettingsCard>
      </IntegrationSettingsSection>

      <ComputerAllowedApps
        apps={preferences.computerAlwaysAllowedApps}
        enabled={preferences.computerAnyAppEnabled}
        onAppsChange={(computerAlwaysAllowedApps) => (
          updatePreferences({ computerAlwaysAllowedApps })
        )}
      />
    </IntegrationSettingsPage>
  );
}
