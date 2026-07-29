import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_WORKBENCH_PREFERENCES,
  getComposerCapabilityPreferenceId,
  useComposerProviderCapabilities,
} from '@sdkwork/birdcoder-pc-workbench';
import { findWorkbenchCodeEngineDefinition } from '@sdkwork/birdcoder-pc-workbench/workbench/codeEngineCatalog';
import type { SettingsProps } from './types';
import { PluginCapabilityList } from './plugins/PluginCapabilityList';
import { PluginSettingsToolbar } from './plugins/PluginSettingsToolbar';
import type {
  PluginSettingsCapabilityItem,
  PluginSettingsTab,
  PluginSettingsTabDefinition,
} from './plugins/pluginSettingsTypes';

export function PluginSettings({
  updateWorkbenchPreferences,
  workbenchPreferences,
}: Pick<SettingsProps, 'updateWorkbenchPreferences' | 'workbenchPreferences'>) {
  const { t } = useTranslation();
  const preferences = workbenchPreferences ?? DEFAULT_WORKBENCH_PREFERENCES;
  const updatePreferences = updateWorkbenchPreferences ?? (() => undefined);
  const [activeTab, setActiveTab] = useState<PluginSettingsTab>('plugins');
  const [searchQuery, setSearchQuery] = useState('');
  const activeEngine = findWorkbenchCodeEngineDefinition(
    preferences.codeEngineId,
    preferences,
  );
  const agentId = activeEngine?.agentId || preferences.codeEngineId;
  const {
    capabilities,
    error,
    isLoading,
    refresh,
  } = useComposerProviderCapabilities({
    agentId,
    disabledCapabilityIds: preferences.disabledComposerCapabilityIds,
    isActive: true,
    pageSize: 50,
  });

  const pluginItems = useMemo<PluginSettingsCapabilityItem[]>(
    () => capabilities.plugins
      .filter((item) => item.source === 'local')
      .map((capability) => ({ capability, kind: 'plugin' })),
    [capabilities.plugins],
  );
  const mcpItems = useMemo<PluginSettingsCapabilityItem[]>(
    () => capabilities.plugins
      .filter((item) => item.source !== 'local')
      .map((capability) => ({ capability, kind: 'plugin' })),
    [capabilities.plugins],
  );
  const skillItems = useMemo<PluginSettingsCapabilityItem[]>(
    () => capabilities.skills.map((capability) => ({ capability, kind: 'skill' })),
    [capabilities.skills],
  );
  const tabItems = {
    plugins: pluginItems,
    mcp: mcpItems,
    skills: skillItems,
  } satisfies Record<PluginSettingsTab, PluginSettingsCapabilityItem[]>;
  const tabs: readonly PluginSettingsTabDefinition[] = [
    { id: 'plugins', label: t('settings.plugins.tabs.plugins'), count: pluginItems.length },
    { id: 'mcp', label: t('settings.plugins.tabs.mcp'), count: mcpItems.length },
    { id: 'skills', label: t('settings.plugins.tabs.skills'), count: skillItems.length },
  ];
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const visibleItems = tabItems[activeTab].filter((item) => (
    !normalizedSearchQuery
    || item.capability.name.toLocaleLowerCase().includes(normalizedSearchQuery)
    || item.capability.description.toLocaleLowerCase().includes(normalizedSearchQuery)
  ));
  const disabledCapabilityIds = new Set(preferences.disabledComposerCapabilityIds);
  const capabilityErrors = capabilities.errors
    .filter((entry) => (
      activeTab === 'plugins'
        ? entry.source === 'local'
        : entry.source === 'remote'
    ))
    .map((entry) => entry.message);
  if (error) {
    capabilityErrors.unshift(error.message);
  }

  const getPreferenceId = (item: PluginSettingsCapabilityItem) => (
    getComposerCapabilityPreferenceId(item.kind, item.capability)
  );
  const handleEnabledChange = (
    item: PluginSettingsCapabilityItem,
    enabled: boolean,
  ) => {
    const preferenceId = getPreferenceId(item);
    updatePreferences((previousState) => {
      const nextDisabledIds = new Set(previousState.disabledComposerCapabilityIds);
      if (enabled) {
        nextDisabledIds.delete(preferenceId);
      } else {
        nextDisabledIds.add(preferenceId);
      }
      return { disabledComposerCapabilityIds: [...nextDisabledIds] };
    });
  };

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-[#141416] px-6 pb-16 pt-[54px] sm:px-10">
      <div className="mx-auto w-full max-w-[616px] animate-in fade-in fill-mode-both">
        <h1 className="text-xl font-semibold leading-7 text-[#ededee]">
          {t('settings.plugins.title')}
        </h1>
        <p className="mt-1 text-[12px] leading-5 text-[#8e8f93]">
          {t('settings.plugins.description')}
        </p>

        <section aria-label={t('settings.plugins.capabilityListLabel')} className="mt-9">
          <PluginSettingsToolbar
            activeTab={activeTab}
            clearSearchLabel={t('settings.plugins.clearSearch')}
            onActiveTabChange={(nextTab) => {
              setActiveTab(nextTab);
              setSearchQuery('');
            }}
            onSearchQueryChange={setSearchQuery}
            searchLabel={t('settings.plugins.searchLabel')}
            searchPlaceholder={t(`settings.plugins.searchPlaceholder.${activeTab}`)}
            searchQuery={searchQuery}
            tabs={tabs}
          />

          <div className="mt-7">
            <PluginCapabilityList
              activeTab={activeTab}
              disabledCapabilityIds={disabledCapabilityIds}
              emptyDescription={t('settings.plugins.emptyDescription')}
              emptyTitle={normalizedSearchQuery
                ? t('settings.plugins.noSearchResults')
                : t('settings.plugins.emptyTitle')}
              errorDescription={capabilityErrors.join(' ')}
              errorTitle={t('settings.plugins.loadFailed')}
              getPreferenceId={getPreferenceId}
              isLoading={isLoading}
              items={visibleItems}
              loadingLabel={t('settings.plugins.loading')}
              onEnabledChange={handleEnabledChange}
              onRetry={refresh}
              retryLabel={t('settings.plugins.retry')}
              unavailableLabel={t('settings.plugins.unavailable')}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
