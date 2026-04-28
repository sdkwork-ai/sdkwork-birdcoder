import assert from 'node:assert/strict';

import {
  createBirdCoderGeneratedCoreReadApiClient,
  createBirdCoderGeneratedCoreWriteApiClient,
  type BirdCoderApiEnvelope,
  type BirdCoderApiTransport,
  type BirdCoderCodeEngineModelConfig,
  type BirdCoderCodeEngineModelConfigSyncResult,
} from '../packages/sdkwork-birdcoder-types/src/index.ts';
import {
  buildBirdCoderCodingServerOpenApiDocumentSeed,
  getBirdCoderCoreApiContract,
  listBirdCoderCodingServerRouteCatalogEntries,
} from '../packages/sdkwork-birdcoder-server/src/index.ts';
import {
  createBirdCoderInProcessCoreApiTransport,
} from '../packages/sdkwork-birdcoder-infrastructure/src/services/coreApiClient.ts';

const core = getBirdCoderCoreApiContract();
assert.equal(core.modelConfig.method, 'GET');
assert.equal(core.modelConfig.path, '/api/core/v1/model-config');
assert.equal(core.syncModelConfig.method, 'PUT');
assert.equal(core.syncModelConfig.path, '/api/core/v1/model-config');

const routeCatalog = listBirdCoderCodingServerRouteCatalogEntries();
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'core.getModelConfig'),
  {
    authMode: 'host',
    method: 'GET',
    openApiPath: '/api/core/v1/model-config',
    operationId: 'core.getModelConfig',
    path: '/api/core/v1/model-config',
    surface: 'core',
    summary: 'Get code engine model configuration',
  },
);
assert.deepEqual(
  routeCatalog.find((route) => route.operationId === 'core.syncModelConfig'),
  {
    authMode: 'host',
    method: 'PUT',
    openApiPath: '/api/core/v1/model-config',
    operationId: 'core.syncModelConfig',
    path: '/api/core/v1/model-config',
    surface: 'core',
    summary: 'Sync code engine model configuration',
  },
);

const openApiSeed = buildBirdCoderCodingServerOpenApiDocumentSeed();
assert.equal(
  openApiSeed.paths['/api/core/v1/model-config']?.get?.operationId,
  'core.getModelConfig',
);
assert.equal(
  openApiSeed.paths['/api/core/v1/model-config']?.put?.operationId,
  'core.syncModelConfig',
);
assert.ok(openApiSeed.components.schemas?.BirdCoderCodeEngineModelConfig);
assert.ok(openApiSeed.components.schemas?.BirdCoderCodeEngineModelConfigSyncResult);

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
      customModels: [],
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

    if (request.path === '/api/core/v1/model-config' && request.method === 'GET') {
      return {
        requestId: 'req.model-config',
        timestamp: '2026-04-28T00:00:00.000Z',
        data: fixtureConfig,
        meta: { version: 'v1' },
      } satisfies BirdCoderApiEnvelope<BirdCoderCodeEngineModelConfig> as TResponse;
    }

    if (request.path === '/api/core/v1/model-config' && request.method === 'PUT') {
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

const readClient = createBirdCoderGeneratedCoreReadApiClient({ transport });
const writeClient = createBirdCoderGeneratedCoreWriteApiClient({ transport });
const readConfig = await readClient.getModelConfig();
const syncResult = await writeClient.syncModelConfig({ localConfig: fixtureConfig });

assert.equal(readConfig.engines.codex.defaultModelId, 'gpt-5-codex');
assert.equal(syncResult.action, 'noop');
assert.deepEqual(observedRequests, [
  {
    method: 'GET',
    path: '/api/core/v1/model-config',
  },
  {
    method: 'PUT',
    path: '/api/core/v1/model-config',
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
const inProcessTransport = createBirdCoderInProcessCoreApiTransport({
  projectService: unusedProjectService,
});
const inProcessReadClient = createBirdCoderGeneratedCoreReadApiClient({
  transport: inProcessTransport,
});
const inProcessWriteClient = createBirdCoderGeneratedCoreWriteApiClient({
  transport: inProcessTransport,
});
const localNewerConfig: BirdCoderCodeEngineModelConfig = {
  ...fixtureConfig,
  version: 'v2',
  updatedAt: '2026-04-28T00:10:00.000Z',
};
const inProcessSyncResult = await inProcessWriteClient.syncModelConfig({
  localConfig: localNewerConfig,
});
const inProcessSyncedConfig = await inProcessReadClient.getModelConfig();
assert.equal(inProcessSyncResult.action, 'push-local');
assert.equal(
  inProcessSyncedConfig.version,
  'v2',
  'In-process core model-config sync must overwrite the server copy when the local config is newer.',
);

console.log('coding server model config contract passed.');
