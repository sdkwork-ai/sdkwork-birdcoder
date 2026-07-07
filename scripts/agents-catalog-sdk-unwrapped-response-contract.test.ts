import assert from 'node:assert/strict';

import type { AgentsAppSdkClient } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-core/src/sdk/agents-app-sdk.ts';
import {
  listBirdCoderCodeEngineCatalog,
  type BirdCoderCodeEngineCatalogEntry,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/agentsCatalogService.ts';

function createAgentsAppClientReturning(payload: unknown): AgentsAppSdkClient {
  return {
    ai: {
      agents: {
        codeEngines: {
          async list() {
            return payload;
          },
        },
      },
    },
  } as unknown as AgentsAppSdkClient;
}

function assertCatalogEntry(entry: BirdCoderCodeEngineCatalogEntry): void {
  assert.deepEqual(
    entry,
    {
      engineId: 'codex',
      displayName: 'Codex 1',
      providerId: 'provider.codex',
      bindingId: 'binding.agent-provider.codex',
      healthy: true,
      tier: 'p0',
    },
    'agents code engine catalog must preserve generated SDK catalog fields',
  );
}

const generatedUnwrappedResourcePayload = {
  item: {
    engines: [
      {
        engineKey: 'codex',
        agentId: 'agent.code-engine.codex',
        bindingId: 'binding.agent-provider.codex',
        tier: 'p0',
        models: [
          {
            engineKey: 'codex',
            modelId: 'codex-1',
            label: 'Codex 1',
            description: 'codex',
            providerId: 'provider.codex',
            bindingId: 'binding.agent-provider.codex',
            defaultForEngine: true,
          },
        ],
      },
    ],
  },
};

const unwrappedCatalog = await listBirdCoderCodeEngineCatalog(
  createAgentsAppClientReturning(generatedUnwrappedResourcePayload),
);
assert.equal(
  unwrappedCatalog.length,
  1,
  'agents app SDK default unwrapped SdkWorkResourceData response must populate code engine catalog',
);
assertCatalogEntry(unwrappedCatalog[0]!);

const rawEnvelopeCatalog = await listBirdCoderCodeEngineCatalog(
  createAgentsAppClientReturning({
    code: 0,
    data: generatedUnwrappedResourcePayload,
    traceId: 'trace.agents-catalog-sdk-unwrapped-response-contract',
  }),
);
assert.equal(
  rawEnvelopeCatalog.length,
  1,
  'agents app SDK raw envelope response must remain parseable for diagnostic callers',
);
assertCatalogEntry(rawEnvelopeCatalog[0]!);

console.log('agents catalog SDK unwrapped response contract passed.');
