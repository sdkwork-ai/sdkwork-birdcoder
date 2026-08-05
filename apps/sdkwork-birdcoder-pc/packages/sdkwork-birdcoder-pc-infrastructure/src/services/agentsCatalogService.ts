import type {
  AgentEngineAccessModeCatalogEntry,
  AgentEngineCatalogEngine,
  AgentEngineModelCatalogEntry,
} from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import type { AgentsAppSdkClient } from '@sdkwork/birdcoder-pc-core/sdk/agents-app';
import { getBirdCoderAgentsAppSdkClient } from './agentsSdkClients.ts';

export interface BirdCoderAgentEngineCatalogModelEntry {
  modelId: string;
  label: string;
  description: string;
  providerId: string;
  bindingId: string;
  defaultForEngine: boolean;
}

export interface BirdCoderAgentEngineAccessModeEntry {
  modeId: string;
  displayName: string;
  description: string;
  approvalBehavior: AgentEngineAccessModeCatalogEntry['approvalBehavior'];
  workspaceAccess: AgentEngineAccessModeCatalogEntry['workspaceAccess'];
  networkAccess: AgentEngineAccessModeCatalogEntry['networkAccess'];
  riskLevel: AgentEngineAccessModeCatalogEntry['riskLevel'];
  enabled: boolean;
  disabledReason?: string;
}

export type BirdCoderAgentEngineKind =
  | 'code'
  | 'work'
  | 'simple'
  | 'unknown';

export interface BirdCoderAgentEngineCatalogEntry {
  engineId: string;
  agentId: string;
  displayName: string;
  providerId: string;
  bindingId: string;
  healthy: boolean;
  defaultModelId: string;
  models: readonly BirdCoderAgentEngineCatalogModelEntry[];
  tier: string;
  engineKind: BirdCoderAgentEngineKind;
  defaultAccessModeId: string;
  accessModes: readonly BirdCoderAgentEngineAccessModeEntry[];
}

function toModelEntry(model: AgentEngineModelCatalogEntry): BirdCoderAgentEngineCatalogModelEntry {
  return {
    modelId: model.modelId,
    label: model.label,
    description: model.description,
    providerId: model.providerId,
    bindingId: model.bindingId,
    defaultForEngine: model.defaultForEngine,
  };
}

function toAccessModeEntry(
  mode: AgentEngineAccessModeCatalogEntry,
): BirdCoderAgentEngineAccessModeEntry {
  return {
    modeId: mode.modeId,
    displayName: mode.displayName,
    description: mode.description,
    approvalBehavior: mode.approvalBehavior,
    workspaceAccess: mode.workspaceAccess,
    networkAccess: mode.networkAccess,
    riskLevel: mode.riskLevel,
    enabled: mode.enabled,
    ...(mode.disabledReason ? { disabledReason: mode.disabledReason } : {}),
  };
}

function toCatalogEntry(engine: AgentEngineCatalogEngine): BirdCoderAgentEngineCatalogEntry {
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
    tier: engine.tier ?? '',
    engineKind: engine.engineKind ?? 'unknown',
    defaultAccessModeId: engine.defaultAccessModeId ?? '',
    accessModes: (engine.accessModes ?? []).map(toAccessModeEntry),
  };
}

export async function listBirdCoderAgentEngineCatalog(
  client: AgentsAppSdkClient = getBirdCoderAgentsAppSdkClient(),
): Promise<BirdCoderAgentEngineCatalogEntry[]> {
  const response = await client.ai.agents.agentEngines.list();
  return response.engines.map(toCatalogEntry);
}

export async function listBirdCoderMcpMarketplace(
  client: AgentsAppSdkClient = getBirdCoderAgentsAppSdkClient(),
) {
  return client.ai.agents.mcpServers.list();
}
