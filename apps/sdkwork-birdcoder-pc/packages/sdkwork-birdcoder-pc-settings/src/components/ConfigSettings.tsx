import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { ChevronDown, FileJson, ShieldAlert } from 'lucide-react';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';
import {
  normalizeTerminalApprovalPolicySetting,
  normalizeTerminalCommandGuardSetting,
  useToast,
} from '@sdkwork/birdcoder-pc-workbench';
import { useTranslation } from 'react-i18next';
import {
  AppSettingsImportError,
  normalizeServerBaseUrl,
  parseAppSettingsImport,
} from './appSettingsImport';
import type { SettingsProps } from './types';

export function ConfigSettings({
  bootServerBaseUrlOverride,
  settings,
  updateSetting,
  updateSettings,
  currentServerBaseUrl: runtimeServerBaseUrl,
}: SettingsProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [serverBaseUrlDraft, setServerBaseUrlDraft] = useState(settings.serverBaseUrl ?? '');
  const [isImportingConfiguration, setIsImportingConfiguration] = useState(false);

  useEffect(() => {
    setServerBaseUrlDraft(settings.serverBaseUrl ?? '');
  }, [settings.serverBaseUrl]);

  const savedServerBaseUrl = useMemo(
    () => normalizeServerBaseUrl(settings.serverBaseUrl),
    [settings.serverBaseUrl],
  );
  const currentServerBaseUrl = useMemo(
    () => normalizeServerBaseUrl(runtimeServerBaseUrl),
    [runtimeServerBaseUrl],
  );
  const bootServerBaseUrl = useMemo(
    () => normalizeServerBaseUrl(bootServerBaseUrlOverride),
    [bootServerBaseUrlOverride],
  );
  const normalizedDraftServerBaseUrl = useMemo(
    () => normalizeServerBaseUrl(serverBaseUrlDraft),
    [serverBaseUrlDraft],
  );
  const hasPendingServerBaseUrlChange = savedServerBaseUrl
    ? savedServerBaseUrl !== currentServerBaseUrl
    : !!bootServerBaseUrl && bootServerBaseUrl === currentServerBaseUrl;
  const isInvalidServerBaseUrlDraft =
    serverBaseUrlDraft.trim().length > 0 && !normalizedDraftServerBaseUrl;

  const handleSaveServerBaseUrl = () => {
    if (!serverBaseUrlDraft.trim()) {
      updateSetting('serverBaseUrl', '');
      addToast(t('settings.config.serverBaseUrlReset'), 'success');
      return;
    }

    if (!normalizedDraftServerBaseUrl) {
      addToast(t('settings.config.serverBaseUrlInvalid'), 'error');
      return;
    }

    updateSetting('serverBaseUrl', normalizedDraftServerBaseUrl);
    addToast(t('settings.config.serverBaseUrlSaved'), 'success');
  };

  const handleResetServerBaseUrl = () => {
    setServerBaseUrlDraft('');
    updateSetting('serverBaseUrl', '');
    addToast(t('settings.config.serverBaseUrlReset'), 'success');
  };

  const handleImportConfiguration = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || isImportingConfiguration) {
      return;
    }

    setIsImportingConfiguration(true);
    try {
      const imported = await parseAppSettingsImport(file);
      updateSettings(imported.settings);
      addToast(
        t('settings.config.configurationImported', {
          count: imported.importedKeys.length,
        }),
        'success',
      );
    } catch (error) {
      const errorKey =
        error instanceof AppSettingsImportError
          ? `settings.config.configurationImportError.${error.code}`
          : 'settings.config.configurationImportError.unknown';
      addToast(t(errorKey), 'error');
    } finally {
      input.value = '';
      setIsImportingConfiguration(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0e0e11] p-6 lg:p-12">
      <div
        className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
        style={{ animationDelay: '0ms' }}
      >
        <h1 className="text-2xl font-semibold text-white mb-2">{t('settings.config.title')}</h1>
        <div className="text-sm text-gray-400 mb-6">{t('settings.config.description')}</div>

        <div
          className="mb-6 flex items-start gap-3 border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-100"
          role="note"
        >
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-300" />
          <div>
            <div className="font-medium">{t('settings.config.governanceScopeTitle')}</div>
            <div className="mt-1 text-amber-100/70">
              {t('settings.config.governanceScopeDescription')}
            </div>
          </div>
        </div>

        <div className="bg-[#18181b] rounded-xl border border-white/10 overflow-hidden mb-8">
          <div className="flex flex-col gap-3 border-b border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-medium text-white">
              {t('settings.config.userConfig')}
            </div>
            <div className="text-right">
              <Button
                variant="link"
                className="h-auto p-0 text-gray-500"
                disabled
              >
                {t('settings.config.openConfigToml')}{' '}
                <span className="text-xs ml-1">-&gt;</span>
              </Button>
              <div className="mt-1 text-xs text-gray-500">
                {t('settings.config.configFileUnavailable')}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-white font-medium">{t('settings.config.approvalPolicy')}</div>
              <div className="text-sm text-gray-500">{t('settings.config.approvalPolicyDesc')}</div>
            </div>
            <div className="relative w-full sm:w-auto">
              <select
                value={settings.approvalPolicy}
                onChange={(event) =>
                  updateSetting(
                    'approvalPolicy',
                    normalizeTerminalApprovalPolicySetting(event.target.value),
                  )
                }
                aria-label={t('settings.config.approvalPolicy')}
                className="w-full appearance-none rounded-lg border border-white/10 bg-[#0e0e11] px-4 py-2 pr-10 text-sm text-white outline-none hover:border-gray-500 sm:w-64"
              >
                <option value="AutoAllow">{t('settings.config.approvalAutoAllow')}</option>
                <option value="OnRequest">{t('settings.config.approvalOnRequest')}</option>
                <option value="Restricted">{t('settings.config.approvalRestricted')}</option>
                <option value="ReleaseOnly">{t('settings.config.approvalReleaseOnly')}</option>
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          <div className="p-4 border-b border-white/10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1">
                <div className="text-white font-medium">{t('settings.config.serverBaseUrl')}</div>
                <div className="text-sm text-gray-500 mt-1">{t('settings.config.serverBaseUrlDesc')}</div>
              </div>
              <div className="w-full max-w-md">
                <div className="text-xs uppercase tracking-[0.18em] text-gray-500 mb-2">
                  {t('settings.config.currentServerBaseUrl')}
                </div>
                <div className="rounded-lg border border-white/10 bg-[#0e0e11] px-3 py-2 text-sm text-gray-200 break-all min-h-11">
                  {currentServerBaseUrl || t('settings.config.serverBaseUrlInherited')}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-white/10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1">
                <div className="text-white font-medium">{t('settings.config.savedServerBaseUrl')}</div>
                <div className="text-sm text-gray-500 mt-1">{t('settings.config.savedServerBaseUrlDesc')}</div>
              </div>
              <div className="w-full max-w-md">
                <input
                  value={serverBaseUrlDraft}
                  onChange={(event) => setServerBaseUrlDraft(event.target.value)}
                  aria-label={t('settings.config.savedServerBaseUrl')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleSaveServerBaseUrl();
                    }
                  }}
                  placeholder="http://127.0.0.1:10240"
                  className={`w-full rounded-lg border bg-[#0e0e11] px-4 py-2.5 text-sm text-white outline-none transition-colors ${
                    isInvalidServerBaseUrlDraft
                      ? 'border-red-500/70 focus:border-red-400'
                      : 'border-white/10 hover:border-gray-500 focus:border-blue-500'
                  }`}
                />
                <div className="mt-2 text-xs text-gray-500 break-all">
                  {savedServerBaseUrl || t('settings.config.useRuntimeDefault')}
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button onClick={handleSaveServerBaseUrl}>{t('common.save')}</Button>
                  <Button variant="outline" onClick={handleResetServerBaseUrl}>
                    {t('settings.config.useRuntimeDefault')}
                  </Button>
                  <Button variant="secondary" onClick={() => window.location.reload()}>
                    {t('settings.config.reloadApp')}
                  </Button>
                </div>
                <div
                  className={`mt-3 text-xs ${
                    hasPendingServerBaseUrlChange ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {hasPendingServerBaseUrlChange
                    ? t('settings.config.serverBaseUrlReloadRequired')
                    : t('settings.config.serverBaseUrlInSync')}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-white font-medium">{t('settings.config.sandboxSettings')}</div>
              <div className="text-sm text-gray-500">{t('settings.config.sandboxSettingsDesc')}</div>
            </div>
            <div className="relative w-full sm:w-auto">
              <select
                value={settings.sandboxSettings}
                onChange={(event) =>
                  updateSetting(
                    'sandboxSettings',
                    normalizeTerminalCommandGuardSetting(event.target.value),
                  )
                }
                aria-label={t('settings.config.sandboxSettings')}
                className="w-full appearance-none rounded-lg border border-white/10 bg-[#0e0e11] px-4 py-2 pr-10 text-sm text-white outline-none hover:border-gray-500 sm:w-64"
              >
                <option value="ReadOnly">{t('settings.config.commandGuardReadOnly')}</option>
                <option value="ReadWrite">{t('settings.config.commandGuardReadWrite')}</option>
                <option value="FullAccess">{t('settings.config.commandGuardFullAccess')}</option>
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>
        </div>

        <h2 className="text-lg font-medium text-white mb-2">{t('settings.config.importExternalAgentConfig')}</h2>
        <div className="text-sm text-gray-400 mb-4">
          {t('settings.config.importExternalAgentConfigDesc')}
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-[#18181b] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-white font-medium">{t('settings.config.importConfiguration')}</div>
            <div className="text-sm text-gray-500">{t('settings.config.importConfigurationDesc')}</div>
          </div>
          <div className="relative self-start sm:self-auto">
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept=".json,application/json"
              aria-label={t('settings.config.importConfiguration')}
              disabled={isImportingConfiguration}
              onChange={handleImportConfiguration}
            />
            <Button variant="outline" disabled={isImportingConfiguration}>
              <FileJson size={15} />
              {isImportingConfiguration ? t('common.loading') : t('common.selectFile')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

