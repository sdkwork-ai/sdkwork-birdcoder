import type { UnifiedAgentModelOption } from '@sdkwork/models-pc-picker';
import type {
  WorkbenchCodeEngineDefinition,
  WorkbenchUnifiedCustomAgentModelDefinition,
} from '@sdkwork/birdcoder-pc-workbench/workbench/codeEngineCatalog';

export interface WorkbenchUnifiedAgentModelSelectorCatalog {
  options: UnifiedAgentModelOption[];
  optionIdByProviderModel: ReadonlyMap<string, string>;
}

function providerModelIdentity(providerId: string, modelId: string): string {
  return `${providerId.trim().toLowerCase()}\u0000${modelId.trim().toLowerCase()}`;
}

function builtInOptionId(modelId: string): string {
  return `built-in:${encodeURIComponent(modelId.trim().toLowerCase())}`;
}

function customOptionId(configurationId: string, modelId: string): string {
  return [
    'custom',
    encodeURIComponent(configurationId.trim().toLowerCase()),
    encodeURIComponent(modelId.trim().toLowerCase()),
  ].join(':');
}

export function createWorkbenchUnifiedAgentModelSelectorCatalog(
  engines: readonly WorkbenchCodeEngineDefinition[],
  customModels: readonly WorkbenchUnifiedCustomAgentModelDefinition[],
): WorkbenchUnifiedAgentModelSelectorCatalog {
  const optionsById = new Map<string, UnifiedAgentModelOption>();
  const optionIdByProviderModel = new Map<string, string>();

  for (const engine of engines) {
    for (const model of engine.models.filter((entry) => entry.source === 'agents-catalog')) {
      const optionId = builtInOptionId(model.id);
      const existing = optionsById.get(optionId);
      const supportedProviderIds = existing?.supportedProviderIds
        ? [...existing.supportedProviderIds]
        : [];
      if (!supportedProviderIds.includes(engine.id)) {
        supportedProviderIds.push(engine.id);
      }
      optionsById.set(optionId, {
        id: optionId,
        modelId: model.id,
        label: existing?.label ?? model.label,
        description: existing?.description || model.description,
        iconKey: existing?.iconKey ?? engine.id,
        kind: 'built-in',
        metadataLabel: supportedProviderIds.length === 1 ? engine.label : undefined,
        supportedProviderIds,
      });
      optionIdByProviderModel.set(
        providerModelIdentity(engine.id, model.id),
        optionId,
      );
    }
  }

  for (const configuration of customModels) {
    for (const modelId of configuration.supportedModelIds) {
      const optionId = customOptionId(configuration.configurationId, modelId);
      optionsById.set(optionId, {
        id: optionId,
        configurationId: configuration.configurationId,
        modelId,
        label: modelId === configuration.modelId ? configuration.label : modelId,
        description: configuration.description,
        iconKey: configuration.supportedProviderIds[0],
        kind: 'custom',
        vendorCode: configuration.vendorCode,
        baseUrl: configuration.baseUrl,
        supportedModelIds: configuration.supportedModelIds,
        supportedProviderIds: configuration.supportedProviderIds,
        inputContextTokens: configuration.inputContextTokens,
        outputContextTokens: configuration.outputContextTokens,
        toolCallRounds: configuration.toolCallRounds,
        supportsMultimodal: configuration.supportsMultimodal,
        apiKeyConfigured: configuration.apiKeyConfigured,
      });
      for (const providerId of configuration.supportedProviderIds) {
        optionIdByProviderModel.set(
          providerModelIdentity(providerId, modelId),
          optionId,
        );
      }
    }
  }

  return {
    options: [...optionsById.values()],
    optionIdByProviderModel,
  };
}

export function resolveWorkbenchUnifiedAgentModelOptionId(
  catalog: WorkbenchUnifiedAgentModelSelectorCatalog,
  providerId: string,
  modelId: string,
): string {
  return catalog.optionIdByProviderModel.get(providerModelIdentity(providerId, modelId)) ?? '';
}
