import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createBirdCoderAppSdkApiClient } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import type {
  BirdCoderApiEnvelope,
  BirdCoderApiTransport,
  BirdCoderCodeEngineModelConfig,
  BirdCoderCodeEngineModelConfigSyncResult,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/index.ts';
import {
  buildBirdCoderCodingServerOpenApiDocument,
  getBirdCoderAppRuntimeApiContract,
  listBirdCoderCodingServerRouteCatalogEntries,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src/index.ts';
import {
  createBirdCoderInProcessAppRuntimeTransport,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appRuntimeTransport.ts';

const appRuntime = getBirdCoderAppRuntimeApiContract();
assert.equal(appRuntime.modelConfig.method, 'GET');
assert.equal(appRuntime.modelConfig.path, '/app/v3/api/model_config');
assert.equal(appRuntime.syncModelConfig.method, 'PUT');
assert.equal(appRuntime.syncModelConfig.path, '/app/v3/api/model_config');

const routeCatalog = listBirdCoderCodingServerRouteCatalogEntries();
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'modelConfig.retrieve'),
  {
    authMode: 'user',
    method: 'GET',
    openApiPath: '/app/v3/api/model_config',
    operationId: 'modelConfig.retrieve',
    path: '/app/v3/api/model_config',
    surface: 'app',
    summary: 'Get code engine model configuration',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'modelConfig.update'),
  {
    authMode: 'user',
    method: 'PUT',
    openApiPath: '/app/v3/api/model_config',
    operationId: 'modelConfig.update',
    path: '/app/v3/api/model_config',
    surface: 'app',
    summary: 'Sync code engine model configuration',
  },
);

const openApiDocument = buildBirdCoderCodingServerOpenApiDocument();
assert.equal(
  openApiDocument.paths['/app/v3/api/model_config']?.get?.operationId,
  'modelConfig.retrieve',
);
assert.equal(
  openApiDocument.paths['/app/v3/api/model_config']?.put?.operationId,
  'modelConfig.update',
);
assert.ok(openApiDocument.components.schemas?.BirdCoderCodeEngineModelConfig);
assert.ok(openApiDocument.components.schemas?.BirdCoderCodeEngineModelConfigSyncResult);
assert.equal(
  openApiDocument.components.schemas?.BirdCoderCodeEngineModelConfigCustomModel,
  undefined,
  'The server OpenAPI contract must not advertise unsupported custom code-engine models.',
);
assert.equal(
  openApiDocument.components.schemas?.BirdCoderCodeEngineModelConfigEngine?.properties
    ?.customModels,
  undefined,
  'The server OpenAPI contract must expose only server-authoritative built-in model selections.',
);
const composedAppSdkTypes = readFileSync(
  fileURLToPath(
    new URL(
      '../sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript/src/types/index.ts',
      import.meta.url,
    ),
  ),
  'utf8',
);
assert.equal(
  composedAppSdkTypes.includes('BirdCoderCodeEngineModelConfigCustomModel'),
  false,
  'The composed app SDK must not retain the removed custom-model type after regeneration.',
);

const fixtureConfig: BirdCoderCodeEngineModelConfig = {
  schemaVersion: 1,
  source: 'server',
  version: 'v1',
  updatedAt: '2026-04-28T00:00:00.000Z',
  engines: {
    codex: {
      engineId: 'codex',
      defaultModelId: 'gpt-5-codex',
      selectedModelId: 'gpt-5-codex',
      models: [],
    },
  },
};

const observedRequests: Array<{ body?: unknown; method: string; path: string }> = [];
const transport: BirdCoderApiTransport = {
  async request<TResponse>(request): Promise<TResponse> {
    observedRequests.push({
      method: request.method,
      path: request.path,
      ...(request.body !== undefined ? { body: request.body } : {}),
    });

    if (request.path === '/app/v3/api/model_config' && request.method === 'GET') {
      return {
        requestId: 'req.model-config',
        timestamp: '2026-04-28T00:00:00.000Z',
        data: fixtureConfig,
        meta: { version: 'v1' },
      } satisfies BirdCoderApiEnvelope<BirdCoderCodeEngineModelConfig> as TResponse;
    }

    if (request.path === '/app/v3/api/model_config' && request.method === 'PUT') {
      return {
        requestId: 'req.sync-model-config',
        timestamp: '2026-04-28T00:00:01.000Z',
        data: {
          action: 'noop',
          authoritativeSource: 'equal',
          config: fixtureConfig,
          shouldWriteLocal: false,
          shouldWriteServer: false,
        },
        meta: { version: 'v1' },
      } satisfies BirdCoderApiEnvelope<BirdCoderCodeEngineModelConfigSyncResult> as TResponse;
    }

    throw new Error(`Unhandled request: ${request.method} ${request.path}`);
  },
};

const appClient = createBirdCoderAppSdkApiClient({ transport });
const readConfig = await appClient.getModelConfig();
const syncResult = await appClient.syncModelConfig({ localConfig: fixtureConfig });

assert.equal(readConfig.engines.codex.defaultModelId, 'gpt-5-codex');
assert.equal(syncResult.action, 'noop');
assert.deepEqual(observedRequests, [
  {
    method: 'GET',
    path: '/app/v3/api/model_config',
  },
  {
    method: 'PUT',
    path: '/app/v3/api/model_config',
    body: {
      localConfig: fixtureConfig,
    },
  },
]);

const unusedProjectService = {
  async addCodingSessionMessage() {
    throw new Error('not used');
  },
  async createCodingSession() {
    throw new Error('not used');
  },
  async deleteCodingSession() {
    throw new Error('not used');
  },
  async deleteCodingSessionMessage() {
    throw new Error('not used');
  },
  async editCodingSessionMessage() {
    throw new Error('not used');
  },
  async forkCodingSession() {
    throw new Error('not used');
  },
  async getProjectById() {
    return null;
  },
  async getProjects() {
    return [];
  },
  async renameCodingSession() {
    throw new Error('not used');
  },
  async updateCodingSession() {
    throw new Error('not used');
  },
};
const inProcessTransport = createBirdCoderInProcessAppRuntimeTransport({
  projectService: unusedProjectService,
});
const inProcessAppClient = createBirdCoderAppSdkApiClient({
  transport: inProcessTransport,
});
const localNewerConfig: BirdCoderCodeEngineModelConfig = {
  ...fixtureConfig,
  version: 'v2',
  updatedAt: '2026-04-28T00:10:00.000Z',
};
const inProcessSyncResult = await inProcessAppClient.syncModelConfig({
  localConfig: localNewerConfig,
});
const inProcessSyncedConfig = await inProcessAppClient.getModelConfig();
assert.equal(inProcessSyncResult.action, 'push-local');
assert.equal(
  inProcessSyncedConfig.version,
  'v2',
  'In-process app runtime model-config sync must overwrite the server copy when the local config is newer.',
);

console.log('coding server model config contract passed.');
