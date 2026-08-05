import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GENERATED_MAINSTREAM_AGENT_MODEL_FALLBACK,
  SDKWORK_OFFICIAL_MODEL_VENDOR_PRESETS,
  type AgentModelCatalogOption,
  type AgentProviderOption,
  type ModelAccessChannel,
  type ModelAccessChannelConfigurationDraft,
} from '@sdkwork/models-pc-picker';
import {
  ModelManagementSettingsCenter,
  type ModelManagementEngineSelection,
  type ModelManagementSettingsMessages,
} from '@sdkwork/models-pc-model-management';
import { createAgentModelAccessSelectorMessages } from '@sdkwork/birdcoder-pc-workbench/workbench/modelAccessBridging';
import { useIDEServices } from '@sdkwork/birdcoder-pc-workbench/context/IDEContext';
import { useWorkbenchPreferences } from '@sdkwork/birdcoder-pc-workbench/hooks/useWorkbenchPreferences';
import { listWorkbenchServerImplementedAgentEngines } from '@sdkwork/birdcoder-pc-workbench/workbench/agentEngineCatalog';
import {
  matchesWorkbenchModeEngineId,
  normalizeWorkbenchMode,
} from '@sdkwork/birdcoder-pc-workbench/workbench/workbenchMode';
import {
  AGENT_MODEL_PROVIDER_IDS,
  saveModelManagementChannel,
  type UserModelChannel,
  type UserModelEngineConfig,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime';

function dedupeCatalogModels(
  models: readonly AgentModelCatalogOption[],
): AgentModelCatalogOption[] {
  const seen = new Set<string>();
  const result: AgentModelCatalogOption[] = [];
  for (const model of models) {
    const identity = model.catalogKey?.trim().toLowerCase()
      ?? `${model.vendorCode.trim().toLowerCase()}\u0000${model.modelId.trim().toLowerCase()}`;
    if (!identity || seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    result.push(model);
  }
  return result;
}

function providerIdsForChannel(
  engineConfigs: readonly UserModelEngineConfig[],
  channelCode: string,
): string[] {
  return [...new Set(engineConfigs
    .filter((config) => config.channelCode.trim().toLowerCase() === channelCode.trim().toLowerCase())
    .map((config) => config.engineId))];
}

function toPickerChannel(
  channel: UserModelChannel,
  engineConfigs: readonly UserModelEngineConfig[],
): ModelAccessChannel {
  return {
    id: channel.code,
    code: channel.code,
    name: channel.name,
    kind: channel.kind,
    baseUrl: channel.baseUrl,
    description: channel.description,
    defaultVendorCode: channel.defaultVendorCode,
    defaultModelId: channel.defaultModelId,
    apiKeyConfigured: channel.apiKeyConfigured,
    // The per-provider bindings live in the engine-config rows; the picker
    // reopens the edit dialog with the same provider set the user checked.
    supportedAgentProviderIds: providerIdsForChannel(engineConfigs, channel.code),
    offerings: channel.offerings.map((offering) => ({
      vendorCode: offering.vendorCode,
      vendorName: offering.vendorName,
      models: offering.models.map((model) => ({
        model: model.modelId,
        displayName: model.displayName,
        // Token metadata round-trips through the edit dialog so imported
        // channels do not lose the gateway catalog's context/output info.
        ...(model.contextTokens == null ? {} : { contextTokens: model.contextTokens }),
        ...(model.maxOutputTokens == null ? {} : { maxOutputTokens: model.maxOutputTokens }),
        ...(model.toolCallRounds == null ? {} : { toolCallRounds: model.toolCallRounds }),
      })),
    })),
    sortOrder: channel.sortOrder ?? undefined,
  };
}

export function ModelManagementSettings() {
  const { t } = useTranslation();
  const { preferences, updatePreferences } = useWorkbenchPreferences();
  const {
    agentModelConfigurationService,
    userModelConfigService,
    modelAccessCatalogService,
  } = useIDEServices();
  const [channels, setChannels] = useState<UserModelChannel[]>([]);
  const [engineConfigs, setEngineConfigs] = useState<UserModelEngineConfig[]>([]);
  const [engineSelections, setEngineSelections] = useState<ModelManagementEngineSelection[]>([]);
  const [catalogModels, setCatalogModels] = useState<AgentModelCatalogOption[]>([]);

  const reload = useCallback(async () => {
    const [channelList, configList, selectionList] = await Promise.allSettled([
      userModelConfigService.listChannels(),
      userModelConfigService.listEngineConfigs(),
      userModelConfigService.listEngineSelections(),
    ]);
    if (channelList.status === 'fulfilled') {
      setChannels(channelList.value);
    }
    if (configList.status === 'fulfilled') {
      setEngineConfigs(configList.value);
    }
    if (selectionList.status === 'fulfilled') {
      setEngineSelections(selectionList.value.map((selection) => ({
        engineId: selection.engineId,
        channelCode: selection.channelCode,
        modelId: selection.modelId,
      })));
    }
    // The catalog loads independently: a slow or offline catalog must not
    // delay the channel list; the mainstream fallback catalog still covers
    // the inline form's model suggestions.
    void modelAccessCatalogService.loadCatalog({ fallbackModels: [] })
      .then((catalog) => setCatalogModels(catalog.models))
      .catch((error: unknown) => {
        console.warn('Failed to load the model catalog for model management.', error);
      });
  }, [modelAccessCatalogService, userModelConfigService]);

  useEffect(() => {
    void reload().catch((error: unknown) => {
      console.error('Failed to load model management data.', error);
    });
  }, [reload]);

  const projectChannels = useMemo(
    () => channels.map((channel) => toPickerChannel(channel, engineConfigs)),
    [channels, engineConfigs],
  );

  const models = useMemo(
    () => dedupeCatalogModels([
      ...catalogModels,
      ...GENERATED_MAINSTREAM_AGENT_MODEL_FALLBACK,
    ]),
    [catalogModels],
  );

  const providerOptions = useMemo<AgentProviderOption[]>(() => {
    const engines = listWorkbenchServerImplementedAgentEngines(preferences);
    const workbenchMode = normalizeWorkbenchMode(preferences.workbenchMode);
    // The provider options (and the checked-provider validation derived from
    // them) only admit the engines the active workbench mode supports.
    return AGENT_MODEL_PROVIDER_IDS
      .filter((providerId) => matchesWorkbenchModeEngineId(workbenchMode, providerId))
      .map((providerId) => {
        const engine = engines.find((item) => item.id === providerId);
        return { id: providerId, label: engine?.label ?? providerId };
      });
  }, [preferences]);

  const messages = useMemo<ModelManagementSettingsMessages>(() => ({
    title: t('settings.modelManagement.title'),
    description: t('settings.modelManagement.description'),
    officialSupplierLabel: t('settings.modelManagement.officialSupplierLabel'),
    officialSupplierDescription: t('settings.modelManagement.officialSupplierDescription'),
    defaultSupplierTag: t('settings.modelManagement.defaultSupplierTag'),
    relayStationsLabel: t('settings.modelManagement.relayStationsLabel'),
    customConfigsLabel: t('settings.modelManagement.customConfigsLabel'),
    addRelayStation: t('settings.modelManagement.addRelayStation'),
    addCustomConfig: t('settings.modelManagement.addCustomConfig'),
    addOfficialSupplier: t('settings.modelManagement.addOfficialSupplier'),
    emptyRelayStations: t('settings.modelManagement.emptyRelayStations'),
    emptyCustomConfigs: t('settings.modelManagement.emptyCustomConfigs'),
    emptyOfficialSuppliers: t('settings.modelManagement.emptyOfficialSuppliers'),
    officialVendorsLabel: t('settings.modelManagement.officialVendorsLabel'),
    officialVendorProtocol: t('settings.modelManagement.officialVendorProtocol'),
    officialVendorDefaultModel: t('settings.modelManagement.officialVendorDefaultModel'),
    noSelection: t('settings.modelManagement.noSelection'),
    edit: t('settings.modelManagement.edit'),
    delete: t('settings.modelManagement.delete'),
    deleteConfirm: t('settings.modelManagement.deleteConfirm'),
    cancel: t('settings.modelManagement.cancel'),
    save: t('settings.modelManagement.save'),
    saving: t('settings.modelManagement.saving'),
    deleting: t('settings.modelManagement.deleting'),
    saveFailed: t('settings.modelManagement.saveFailed'),
    deleteFailed: t('settings.modelManagement.deleteFailed'),
    channelNameLabel: t('settings.modelManagement.channelNameLabel'),
    baseUrlLabel: t('settings.modelManagement.baseUrlLabel'),
    apiKeyLabel: t('settings.modelManagement.apiKeyLabel'),
    apiKeyConfiguredHint: t('settings.modelManagement.apiKeyConfiguredHint'),
    defaultVendorLabel: t('settings.modelManagement.defaultVendorLabel'),
    defaultModelLabel: t('settings.modelManagement.defaultModelLabel'),
    offeringsLabel: t('settings.modelManagement.offeringsLabel'),
    vendorsLabel: t('settings.modelManagement.vendorsLabel'),
    keyConfigured: t('settings.modelManagement.keyConfigured'),
    keyNotConfigured: t('settings.modelManagement.keyNotConfigured'),
    engineBindingsLabel: t('settings.modelManagement.engineBindingsLabel'),
    engineBindingsEmpty: t('settings.modelManagement.engineBindingsEmpty'),
    kindLabel: t('settings.modelManagement.kindLabel'),
    modelCount: (count: number) => t('settings.modelManagement.modelCount', { count }),
  }), [t]);

  const formMessages = useMemo(
    () => createAgentModelAccessSelectorMessages(t),
    [t],
  );

  const handleSaveChannel = useCallback(async (
    draft: ModelAccessChannelConfigurationDraft,
  ): Promise<string> => {
    // The shared orchestrator persists the channel locally (single source of
    // truth), applies it to the agents runtime for every checked provider,
    // records the per-engine bindings, and persists the default selection so
    // the engine-bindings panel and the picker surfaces reflect the save
    // immediately instead of after the next restart.
    const { code } = await saveModelManagementChannel({
      agentModelConfigurationService,
      userModelConfigService,
      draft,
      // The checked provider set is validated against the engines the host
      // actually publishes instead of the full platform whitelist, so a
      // provider that is not implemented for this deployment is never
      // recorded as a binding.
      availableProviderIds: providerOptions.map((provider) => provider.id),
    });
    await reload();
    return code;
  }, [
    agentModelConfigurationService,
    providerOptions,
    reload,
    userModelConfigService,
  ]);

  const handleDeleteChannel = useCallback(async (channel: ModelAccessChannel) => {
    const code = channel.code?.trim() || channel.id.trim();
    if (!code) {
      return;
    }
    await userModelConfigService.deleteChannel(code);
    // Retire any engine preference still referencing the deleted channel so
    // the workbench falls back to the official relay default (or the next
    // stored selection) instead of a dangling channel id.
    updatePreferences((previousPreferences) => {
      const engineSettings = { ...previousPreferences.agentEngineSettings };
      let changed = false;
      for (const engineId of Object.keys(engineSettings)) {
        const settings = engineSettings[engineId];
        if (settings?.modelAccessChannelId?.trim().toLowerCase()
          === code.trim().toLowerCase()) {
          engineSettings[engineId] = { ...settings, modelAccessChannelId: undefined };
          changed = true;
        }
      }
      return changed
        ? { ...previousPreferences, agentEngineSettings: engineSettings }
        : previousPreferences;
    });
    await reload();
  }, [reload, updatePreferences, userModelConfigService]);

  return (
    <div className="h-full min-h-0 w-full">
      <ModelManagementSettingsCenter
        channels={projectChannels}
        engineSelections={engineSelections}
        formMessages={formMessages}
        messages={messages}
        models={models}
        officialPresets={SDKWORK_OFFICIAL_MODEL_VENDOR_PRESETS}
        onDeleteChannel={handleDeleteChannel}
        onSaveChannel={handleSaveChannel}
        providerOptions={providerOptions}
      />
    </div>
  );
}
