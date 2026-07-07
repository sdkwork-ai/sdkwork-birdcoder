import type { AgentsAppSdkClient } from '@sdkwork/birdcoder-pc-core/sdk';
import { getBirdCoderAgentsAppSdkClient } from './agentsSdkClients.ts';

export interface BirdCoderCodeEngineCatalogEntry {
  engineId: string;
  displayName: string;
  providerId: string;
  bindingId: string;
  healthy: boolean;
  tier?: string;
}

function readCatalogItems(payload: Record<string, unknown>): BirdCoderCodeEngineCatalogEntry[] {
  const item = readResourceItem(payload);
  if (!item) {
    return [];
  }

  const engines = item.engines;
  if (!Array.isArray(engines)) {
    return [];
  }

  return engines.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }
    const row = entry as Record<string, unknown>;
    const model = readFirstModel(row);
    const engineId = readString(row, 'engineId', 'engine_id', 'engineKey', 'engine_key');
    if (!engineId) {
      return [];
    }
    return [{
      engineId,
      displayName: readString(row, 'displayName', 'display_name', 'label') || readString(model, 'label') || engineId,
      providerId: readString(row, 'providerId', 'provider_id') || readString(model, 'providerId', 'provider_id'),
      bindingId: readString(row, 'bindingId', 'binding_id') || readString(model, 'bindingId', 'binding_id'),
      healthy: typeof row.healthy === 'boolean' ? row.healthy : true,
      tier: typeof row.tier === 'string' ? row.tier : undefined,
    }];
  });
}

function readResourceItem(payload: Record<string, unknown>): Record<string, unknown> | null {
  if (payload.item && typeof payload.item === 'object') {
    return payload.item as Record<string, unknown>;
  }

  const data = payload.data;
  if (!data || typeof data !== 'object') {
    return null;
  }

  const item = (data as Record<string, unknown>).item;
  return item && typeof item === 'object' ? item as Record<string, unknown> : null;
}

function readFirstModel(row: Record<string, unknown>): Record<string, unknown> {
  const models = row.models;
  const model = Array.isArray(models) ? models[0] : undefined;
  return model && typeof model === 'object' ? model as Record<string, unknown> : {};
}

function readString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return '';
}

export async function listBirdCoderCodeEngineCatalog(
  client: AgentsAppSdkClient = getBirdCoderAgentsAppSdkClient(),
): Promise<BirdCoderCodeEngineCatalogEntry[]> {
  const response = await client.ai.agents.codeEngines.list();
  return readCatalogItems(response as Record<string, unknown>);
}

export async function listBirdCoderMcpMarketplace(
  client: AgentsAppSdkClient = getBirdCoderAgentsAppSdkClient(),
) {
  return client.ai.agents.mcpServers.list();
}
