import type {
  CodeEngineCatalogEngine,
  CodeEngineModelCatalogEntry,
} from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import type { AgentsAppSdkClient } from '@sdkwork/birdcoder-pc-core/sdk';
import { getBirdCoderAgentsAppSdkClient } from './agentsSdkClients.ts';

export interface BirdCoderCodeEngineCatalogModelEntry {
  modelId: string;
  label: string;
  description: string;
  providerId: string;
  bindingId: string;
  defaultForEngine: boolean;
}

export interface BirdCoderCodeEngineCatalogEntry {
  engineId: string;
  agentId: string;
  displayName: string;
  providerId: string;
  bindingId: string;
  healthy: boolean;
  defaultModelId: string;
  models: readonly BirdCoderCodeEngineCatalogModelEntry[];
  tier?: string;
}

function toModelEntry(model: CodeEngineModelCatalogEntry): BirdCoderCodeEngineCatalogModelEntry {
  return {
    modelId: model.modelId,
    label: model.label,
    description: model.description,
    providerId: model.providerId,
    bindingId: model.bindingId,
    defaultForEngine: model.defaultForEngine,
  };
}

function toCatalogEntry(engine: CodeEngineCatalogEngine): BirdCoderCodeEngineCatalogEntry {
  const defaultModel = engine.models.find((model) => model.defaultForEngine) ?? engine.models[0];
  return {
    engineId: engine.engineKey,
    agentId: engine.agentId,
    displayName: engine.engineKey,
    providerId: defaultModel?.providerId ?? '',
    bindingId: engine.bindingId,
    healthy: engine.models.length > 0,
    defaultModelId: defaultModel?.modelId ?? '',
    models: engine.models.map(toModelEntry),
  };
}

export async function listBirdCoderCodeEngineCatalog(
  client: AgentsAppSdkClient = getBirdCoderAgentsAppSdkClient(),
): Promise<BirdCoderCodeEngineCatalogEntry[]> {
  const response = await client.ai.agents.codeEngines.list();
  return response.engines.map(toCatalogEntry);
}

export async function listBirdCoderMcpMarketplace(
  client: AgentsAppSdkClient = getBirdCoderAgentsAppSdkClient(),
) {
  return client.ai.agents.mcpServers.list();
}
