import assert from 'node:assert/strict';

import type { AgentsAppSdkClient } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-core/src/sdk/agents-app-sdk.ts';
import {
  listBirdCoderAgentEngineCatalog,
  type BirdCoderAgentEngineCatalogEntry,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/agentsCatalogService.ts';

function createAgentsAppClientReturning(payload: unknown): AgentsAppSdkClient {
  return {
    ai: {
      agents: {
        agentEngines: {
          async list() {
            return payload;
          },
        },
      },
    },
  } as unknown as AgentsAppSdkClient;
}

function assertCatalogEntry(entry: BirdCoderAgentEngineCatalogEntry): void {
  assert.deepEqual(
    entry,
    {
      engineId: 'codex',
      agentId: 'agent.codex',
      displayName: 'codex',
      providerId: 'provider.codex',
      bindingId: 'binding.codex',
      healthy: true,
      defaultModelId: 'codex-1',
      tier: 'official-sdk',
      engineKind: 'code',
      available: true,
      defaultAccessModeId: 'ask_for_approval',
      accessModes: [
        {
          modeId: 'ask_for_approval',
          displayName: 'Ask for approval',
          description: 'Ask before risky operations',
          approvalBehavior: 'user_review',
          workspaceAccess: 'workspace_write',
          networkAccess: 'restricted',
          riskLevel: 'scoped',
          enabled: true,
        },
      ],
      models: [
        {
          modelId: 'codex-1',
          label: 'Codex 1',
          description: 'codex',
          providerId: 'provider.codex',
          bindingId: 'binding.codex',
          defaultForEngine: true,
        },
      ],
    },
    'agents agent engine catalog must preserve the generated SDK catalog fields',
  );
}

const catalog = await listBirdCoderAgentEngineCatalog(
  createAgentsAppClientReturning({
    engines: [
      {
        engineKey: 'codex',
        engineKind: 'code',
        available: true,
        agentId: 'agent.codex',
        bindingId: 'binding.codex',
        tier: 'official-sdk',
        defaultAccessModeId: 'ask_for_approval',
        accessModes: [
          {
            modeId: 'ask_for_approval',
            displayName: 'Ask for approval',
            description: 'Ask before risky operations',
            approvalBehavior: 'user_review',
            workspaceAccess: 'workspace_write',
            networkAccess: 'restricted',
            riskLevel: 'scoped',
            enabled: true,
          },
        ],
        models: [
          {
            engineKey: 'codex',
            modelId: 'codex-1',
            label: 'Codex 1',
            description: 'codex',
            providerId: 'provider.codex',
            bindingId: 'binding.codex',
            defaultForEngine: true,
          },
        ],
      },
    ],
  }),
);

assert.equal(
  catalog.length,
  1,
  'agents app SDK standard response must populate the agent engine catalog',
);
assertCatalogEntry(catalog[0]!);

console.log('agents catalog SDK contract passed.');
