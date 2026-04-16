import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@sdkwork/birdcoder-ui';
import { useToast } from '@sdkwork/birdcoder-commons';
import { useTranslation } from 'react-i18next';
import { SettingsProps } from './types';

function normalizeServerBaseUrl(value?: string | null): string | undefined {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(trimmedValue);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return undefined;
    }

    const normalizedPathname = parsedUrl.pathname.replace(/\/+$/, '');
    const pathname = normalizedPathname === '/' ? '' : normalizedPathname;
    return `${parsedUrl.origin}${pathname}`;
  } catch {
    return undefined;
  }
}

export function ConfigSettings({
  bootServerBaseUrlOverride,
  settings,
  updateSetting,
  currentServerBaseUrl: runtimeServerBaseUrl,
}: SettingsProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [serverBaseUrlDraft, setServerBaseUrlDraft] = useState(settings.serverBaseUrl ?? '');

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

  return (
    <div className="flex-1 overflow-y-auto p-12 bg-[#0e0e11]">
      <div
        className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
        style={{ animationDelay: '0ms' }}
      >
        <h1 className="text-2xl font-semibold text-white mb-2">{t('settings.config.title')}</h1>
        <div className="text-sm text-gray-400 mb-8">
          {t('settings.config.description')}{' '}
          <a href="#" className="text-blue-400 hover:underline">
            {t('settings.config.learnMore')}
          </a>
        </div>

        <div className="bg-[#18181b] rounded-xl border border-white/10 overflow-hidden mb-8">
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
            <div className="relative flex-1 max-w-[200px]">
              <select className="appearance-none bg-transparent text-sm text-white outline-none cursor-pointer w-full font-medium">
                <option>{t('settings.config.userConfig')}</option>
              </select>
              <ChevronDown
                size={16}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
            <Button
              variant="link"
              className="h-auto p-0 text-gray-300 hover:text-white"
              onClick={() => addToast('Opening config.toml in editor...', 'info')}
            >
              {t('settings.config.openConfigToml')} <span className="text-xs ml-1">-&gt;</span>
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div>
              <div className="text-white font-medium">{t('settings.config.approvalPolicy')}</div>
              <div className="text-sm text-gray-500">{t('settings.config.approvalPolicyDesc')}</div>
            </div>
            <div className="relative">
              <select
                value={settings.approvalPolicy}
                onChange={(e) => updateSetting('approvalPolicy', e.target.value)}
                className="appearance-none bg-[#0e0e11] border border-white/10 rounded-lg px-4 py-2 pr-10 text-sm text-white outline-none hover:border-gray-500 cursor-pointer w-64"
              >
                <option>On request</option>
                <option>Always</option>
                <option>Never</option>
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          <div className="p-4 border-b border-white/10">
            <div className="flex items-start justify-between gap-6">
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
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <div className="text-white font-medium">{t('settings.config.savedServerBaseUrl')}</div>
                <div className="text-sm text-gray-500 mt-1">{t('settings.config.savedServerBaseUrlDesc')}</div>
              </div>
              <div className="w-full max-w-md">
                <input
                  value={serverBaseUrlDraft}
                  onChange={(event) => setServerBaseUrlDraft(event.target.value)}
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

          <div className="flex items-center justify-between p-4">
            <div>
              <div className="text-white font-medium">{t('settings.config.sandboxSettings')}</div>
              <div className="text-sm text-gray-500">{t('settings.config.sandboxSettingsDesc')}</div>
            </div>
            <div className="relative">
              <select
                value={settings.sandboxSettings}
                onChange={(e) => updateSetting('sandboxSettings', e.target.value)}
                className="appearance-none bg-[#0e0e11] border border-white/10 rounded-lg px-4 py-2 pr-10 text-sm text-white outline-none hover:border-gray-500 cursor-pointer w-64"
              >
                <option>Read only</option>
                <option>Read and write</option>
                <option>Full access</option>
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

        <div className="bg-[#18181b] rounded-xl border border-white/10 p-4 flex items-center justify-between">
          <div>
            <div className="text-white font-medium">{t('settings.config.importConfiguration')}</div>
            <div className="text-sm text-gray-500">{t('settings.config.importConfigurationDesc')}</div>
          </div>
          <div className="relative">
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept=".json"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  addToast(t('settings.config.configurationImported'), 'success');
                }
              }}
            />
            <Button variant="outline">{t('common.selectFile')}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
