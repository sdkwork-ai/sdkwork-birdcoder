import { useRef, type ChangeEvent } from 'react';
import { AppWindow, Download, Import, KeyRound, MapPin, ShieldCheck, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useIntegrationPreferences,
  useToast,
  type BrowserApprovalPolicy,
  type BrowserLinkOpenTarget,
  type BrowserScreenshotPolicy,
} from '@sdkwork/birdcoder-pc-workbench';
import { BrowserWebsitePermissions } from './integration-settings/BrowserWebsitePermissions';
import {
  IntegrationSettingsButton,
  IntegrationSettingsCard,
  IntegrationSettingsPage,
  IntegrationSettingsRow,
  IntegrationSettingsSection,
  IntegrationSettingsSelect,
  IntegrationSettingsSwitch,
} from './integration-settings/IntegrationSettingsPrimitives';
import {
  clearBirdCoderBrowserData,
  parseBrowserSettingsImport,
} from './integration-settings/browserSettingsUtils';

interface BrowserSettingsProps {
  onOpenComputerControl?: () => void;
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<{ name: string }>;
}

export function BrowserSettings({ onOpenComputerControl }: BrowserSettingsProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { preferences, updatePreferences } = useIntegrationPreferences();
  const importInputRef = useRef<HTMLInputElement>(null);

  const linkTargetOptions: readonly { label: string; value: BrowserLinkOpenTarget }[] = [
    { label: t('settings.browser.options.systemBrowser'), value: 'system' },
    { label: t('settings.browser.options.birdcoder'), value: 'birdcoder' },
  ];
  const screenshotOptions: readonly { label: string; value: BrowserScreenshotPolicy }[] = [
    { label: t('settings.browser.options.always'), value: 'always' },
    { label: t('settings.browser.options.ask'), value: 'ask' },
    { label: t('settings.browser.options.never'), value: 'never' },
  ];
  const approvalOptions: readonly { label: string; value: BrowserApprovalPolicy }[] = [
    { label: t('settings.browser.options.alwaysAsk'), value: 'always-ask' },
    { label: t('settings.browser.options.trustedSites'), value: 'trusted-sites' },
    { label: t('settings.browser.options.neverAsk'), value: 'never-ask' },
  ];

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    try {
      if (file.size > 256 * 1_024) {
        throw new Error('Browser settings import is too large.');
      }
      const parsed = JSON.parse(await file.text()) as unknown;
      updatePreferences(parseBrowserSettingsImport(parsed, preferences));
      addToast(t('settings.browser.feedback.imported'), 'success');
    } catch {
      addToast(t('settings.browser.feedback.importFailed'), 'error');
    } finally {
      input.value = '';
    }
  };

  const handleClearBrowserData = () => {
    if (!window.confirm(t('settings.browser.feedback.confirmClearData'))) {
      return;
    }
    try {
      const removedCount = clearBirdCoderBrowserData([window.localStorage, window.sessionStorage]);
      addToast(t('settings.browser.feedback.dataCleared', { count: removedCount }), 'success');
    } catch {
      addToast(t('settings.browser.feedback.dataClearFailed'), 'error');
    }
  };

  const handleChooseDownloadLocation = async () => {
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
    if (!picker) {
      addToast(t('settings.browser.feedback.directoryPickerUnavailable'), 'error');
      return;
    }
    try {
      const handle = await picker({ mode: 'readwrite' });
      updatePreferences({ browserDownloadLocation: handle.name });
      addToast(t('settings.browser.feedback.downloadLocationChanged'), 'success');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      addToast(t('settings.browser.feedback.directoryPickerUnavailable'), 'error');
    }
  };

  const showDelegatedManagerNotice = () => {
    addToast(t('settings.browser.feedback.managedBySystemBrowser'), 'success');
  };

  const showDownloadHistory = () => {
    addToast(t('settings.browser.feedback.downloadHistoryEmpty'), 'success');
  };

  const openWebsitePermissions = () => {
    document.getElementById('browser-website-permissions')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <IntegrationSettingsPage
      description={(
        <>
          {t('settings.browser.description')}{' '}
          <button
            className="text-[#62a8ed] outline-none hover:text-[#8cc4fb] focus-visible:underline"
            onClick={onOpenComputerControl}
            type="button"
          >
            {t('settings.browser.computerControlLink')}
          </button>
        </>
      )}
      title={t('settings.browser.title')}
    >
      <div className="mt-6">
        <IntegrationSettingsCard ariaLabel={t('settings.browser.integrationLabel')}>
          <IntegrationSettingsRow
            description={t('settings.browser.builtInBrowserDesc')}
            icon={(
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.11] bg-[#171719] text-[#ededee]">
                <AppWindow aria-hidden="true" className="h-[18px] w-[18px]" />
              </span>
            )}
            title={t('settings.browser.builtInBrowser')}
          >
            <IntegrationSettingsSwitch
              checked={preferences.browserEnabled}
              label={t('settings.browser.builtInBrowser')}
              onCheckedChange={(browserEnabled) => updatePreferences({ browserEnabled })}
            />
          </IntegrationSettingsRow>
        </IntegrationSettingsCard>
      </div>

      <IntegrationSettingsSection
        action={(
          <>
            <input
              accept="application/json,.json"
              className="hidden"
              onChange={handleImport}
              ref={importInputRef}
              type="file"
            />
            <IntegrationSettingsButton
              icon={Import}
              onClick={() => importInputRef.current?.click()}
              variant="quiet"
            >
              {t('settings.browser.import')}
            </IntegrationSettingsButton>
          </>
        )}
        title={t('settings.browser.general')}
      >
        <IntegrationSettingsCard>
          <IntegrationSettingsRow
            description={t('settings.browser.webLinksDesc')}
            title={t('settings.browser.webLinks')}
          >
            <IntegrationSettingsSelect
              ariaLabel={t('settings.browser.webLinks')}
              disabled={!preferences.browserEnabled}
              onChange={(browserWebLinkOpenTarget) => updatePreferences({ browserWebLinkOpenTarget })}
              options={linkTargetOptions}
              value={preferences.browserWebLinkOpenTarget}
            />
          </IntegrationSettingsRow>
          <IntegrationSettingsRow
            description={t('settings.browser.localLinksDesc')}
            title={t('settings.browser.localLinks')}
          >
            <IntegrationSettingsSelect
              ariaLabel={t('settings.browser.localLinks')}
              disabled={!preferences.browserEnabled}
              onChange={(browserLocalLinkOpenTarget) => updatePreferences({ browserLocalLinkOpenTarget })}
              options={linkTargetOptions}
              value={preferences.browserLocalLinkOpenTarget}
            />
          </IntegrationSettingsRow>
          <IntegrationSettingsRow
            description={t('settings.browser.browserDataDesc')}
            title={t('settings.browser.browserData')}
          >
            <IntegrationSettingsButton icon={Trash2} onClick={handleClearBrowserData}>
              {t('settings.browser.clearBrowserData')}
            </IntegrationSettingsButton>
          </IntegrationSettingsRow>
          <IntegrationSettingsRow
            description={t('settings.browser.screenshotsDesc')}
            title={t('settings.browser.screenshots')}
          >
            <IntegrationSettingsSelect
              ariaLabel={t('settings.browser.screenshots')}
              disabled={!preferences.browserEnabled}
              onChange={(browserScreenshotPolicy) => updatePreferences({ browserScreenshotPolicy })}
              options={screenshotOptions}
              value={preferences.browserScreenshotPolicy}
            />
          </IntegrationSettingsRow>
        </IntegrationSettingsCard>
      </IntegrationSettingsSection>

      <IntegrationSettingsSection title={t('settings.browser.autofill')}>
        <IntegrationSettingsCard>
          <IntegrationSettingsRow
            description={t('settings.browser.passwordManagerDesc')}
            icon={<KeyRound aria-hidden="true" className="h-4 w-4 shrink-0 text-[#8e8f93]" />}
            title={t('settings.browser.passwordManager')}
          >
            <IntegrationSettingsButton onClick={showDelegatedManagerNotice}>
              {t('settings.browser.manage')}
            </IntegrationSettingsButton>
          </IntegrationSettingsRow>
          <IntegrationSettingsRow
            description={t('settings.browser.contactInfoDesc')}
            icon={<MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-[#8e8f93]" />}
            title={t('settings.browser.contactInfo')}
          >
            <IntegrationSettingsButton onClick={showDelegatedManagerNotice}>
              {t('settings.browser.manage')}
            </IntegrationSettingsButton>
          </IntegrationSettingsRow>
        </IntegrationSettingsCard>
      </IntegrationSettingsSection>

      <IntegrationSettingsSection title={t('settings.browser.downloads')}>
        <IntegrationSettingsCard>
          <IntegrationSettingsRow
            description={preferences.browserDownloadLocation || t('settings.browser.systemDownloads')}
            icon={<Download aria-hidden="true" className="h-4 w-4 shrink-0 text-[#8e8f93]" />}
            title={t('settings.browser.downloadLocation')}
          >
            <IntegrationSettingsButton onClick={handleChooseDownloadLocation}>
              {t('settings.browser.change')}
            </IntegrationSettingsButton>
          </IntegrationSettingsRow>
          <IntegrationSettingsRow
            description={t('settings.browser.askDownloadLocationDesc')}
            title={t('settings.browser.askDownloadLocation')}
          >
            <IntegrationSettingsSwitch
              checked={preferences.browserAskDownloadLocation}
              disabled={!preferences.browserEnabled}
              label={t('settings.browser.askDownloadLocation')}
              onCheckedChange={(browserAskDownloadLocation) => (
                updatePreferences({ browserAskDownloadLocation })
              )}
            />
          </IntegrationSettingsRow>
          <IntegrationSettingsRow
            description={t('settings.browser.downloadHistoryDesc')}
            title={t('settings.browser.downloadHistory')}
          >
            <IntegrationSettingsButton onClick={showDownloadHistory}>
              {t('settings.browser.manage')}
            </IntegrationSettingsButton>
          </IntegrationSettingsRow>
        </IntegrationSettingsCard>
      </IntegrationSettingsSection>

      <IntegrationSettingsSection title={t('settings.browser.permissions.title')}>
        <IntegrationSettingsCard>
          <IntegrationSettingsRow
            description={t('settings.browser.permissions.siteSettingsDesc')}
            icon={<ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-[#8e8f93]" />}
            title={t('settings.browser.permissions.siteSettings')}
          >
            <IntegrationSettingsButton onClick={openWebsitePermissions}>
              {t('settings.browser.manage')}
            </IntegrationSettingsButton>
          </IntegrationSettingsRow>
          <IntegrationSettingsRow
            description={t('settings.browser.permissions.approvalDesc')}
            title={t('settings.browser.permissions.approval')}
          >
            <IntegrationSettingsSelect
              ariaLabel={t('settings.browser.permissions.approval')}
              disabled={!preferences.browserEnabled}
              onChange={(browserApprovalPolicy) => updatePreferences({ browserApprovalPolicy })}
              options={approvalOptions}
              value={preferences.browserApprovalPolicy}
            />
          </IntegrationSettingsRow>
        </IntegrationSettingsCard>
      </IntegrationSettingsSection>

      <div id="browser-website-permissions">
        <BrowserWebsitePermissions
          allowedSites={preferences.browserAllowedSites}
          onAllowedSitesChange={(browserAllowedSites) => updatePreferences({ browserAllowedSites })}
        />
      </div>
    </IntegrationSettingsPage>
  );
}
