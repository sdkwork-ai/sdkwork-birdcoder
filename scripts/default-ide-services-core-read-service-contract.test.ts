import assert from 'node:assert/strict';
import type {
  BirdCoderApiRouteCatalogEntry,
  BirdCoderCodingServerDescriptor,
  BirdCoderCodingSessionArtifact,
  BirdCoderCodingSessionCheckpoint,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionSummary,
  BirdCoderCoreHealthSummary,
  BirdCoderCoreReadApiClient,
  BirdCoderCoreRuntimeSummary,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdCoderNativeSessionProviderSummary,
  BirdCoderModelCatalogEntry,
  BirdCoderOperationDescriptor,
} from '@sdkwork/birdcoder-types';
import { createDefaultBirdCoderIdeServices } from '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts';
import { ApiBackedCoreReadService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedCoreReadService.ts';

const routeFixture: BirdCoderApiRouteCatalogEntry = {
  authMode: 'host',
  method: 'GET',
  openApiPath: '/api/core/v1/routes',
  operationId: 'core.listRoutes',
  path: '/api/core/v1/routes',
  surface: 'core',
  summary: 'List unified API routes',
};

const descriptorFixture: BirdCoderCodingServerDescriptor = {
  apiVersion: 'v1',
  gateway: {
    basePath: '/api',
    docsPath: '/docs',
    liveOpenApiPath: '/openapi.json',
    openApiPath: '/openapi/coding-server-v1.json',
    routeCatalogPath: '/api/core/v1/routes',
    routeCount: 58,
    routesBySurface: {
      core: 19,
      app: 32,
      admin: 7,
    },
    surfaces: [
      {
        authMode: 'host',
        basePath: '/api/core/v1',
        description: 'Core coding runtime, engine catalog, session execution, and operation control.',
        name: 'core',
        routeCount: 19,
      },
      {
        authMode: 'user',
        basePath: '/api/app/v1',
        description: 'Application-facing workspace, project, collaboration, and user-center routes.',
        name: 'app',
        routeCount: 32,
      },
      {
        authMode: 'admin',
        basePath: '/api/admin/v1',
        description: 'Administrative governance, audit, release, deployment, and team-management routes.',
        name: 'admin',
        routeCount: 7,
      },
    ],
  },
  hostMode: 'desktop',
  moduleId: 'coding-server',
  openApiPath: '/openapi/coding-server-v1.json',
  surfaces: ['core', 'app', 'admin'],
};

const runtimeFixture: BirdCoderCoreRuntimeSummary = {
  host: '127.0.0.1',
  port: 10240,
  configFileName: 'birdcoder.local.json',
};

const healthFixture: BirdCoderCoreHealthSummary = {
  status: 'healthy',
};

function buildCatalogSummaryFixture(id: string) {
  return {
    id,
    uuid: `${id}-uuid`,
    tenantId: '0',
    organizationId: undefined,
    createdAt: '2026-04-24T00:00:00.000Z',
    updatedAt: '2026-04-24T00:00:00.000Z',
  } as const;
}

const engineFixture: BirdCoderEngineDescriptor = {
  ...buildCatalogSummaryFixture('engine-registry:codex'),
  engineKey: 'codex',
  displayName: 'Codex',
  vendor: 'OpenAI',
  installationKind: 'external-cli',
  defaultModelId: 'gpt-5.4',
  homepage: 'https://openai.com/codex',
  supportedHostModes: ['web', 'desktop', 'server'],
  transportKinds: ['cli-jsonl'],
  capabilityMatrix: {
    approvalCheckpoints: true,
    chat: true,
    commandArtifacts: true,
    mcp: true,
    patchArtifacts: true,
    planning: true,
    previewArtifacts: true,
    ptyArtifacts: true,
    remoteBridge: false,
    sessionResume: true,
    streaming: true,
    structuredOutput: true,
    testArtifacts: true,
    todoArtifacts: true,
    toolCalls: true,
  },
  status: 'active',
};

const capabilityFixture: BirdCoderEngineCapabilityMatrix = {
  ...engineFixture.capabilityMatrix,
};

const modelFixture: BirdCoderModelCatalogEntry = {
  ...buildCatalogSummaryFixture('model-catalog:codex:gpt-5.4'),
  engineKey: 'codex',
  modelId: 'gpt-5.4',
  displayName: 'GPT-5.4',
  providerId: 'openai',
  status: 'active',
  defaultForEngine: true,
  transportKinds: ['cli-jsonl'],
  capabilityMatrix: {
    chat: true,
    planning: true,
    toolCalls: true,
  },
};

const nativeSessionProviderFixture: BirdCoderNativeSessionProviderSummary = {
  engineId: 'codex',
  displayName: 'Codex',
  nativeSessionIdPrefix: 'codex-native:',
  transportKinds: ['cli-jsonl'],
  discoveryMode: 'passive-global',
};

const operationFixture: BirdCoderOperationDescriptor = {
  operationId: 'operation-core-read-contract',
  status: 'running',
  artifactRefs: ['artifact-core-read-contract'],
  streamKind: 'sse',
  streamUrl: '/api/core/v1/coding-sessions/session-core-read-contract/events',
};

const sessionFixture: BirdCoderCodingSessionSummary = {
  id: 'session-core-read-contract',
  workspaceId: 'workspace-core-read-contract',
  projectId: 'project-core-read-contract',
  title: 'Core read service contract',
  status: 'active',
  hostMode: 'desktop',
  engineId: 'codex',
  modelId: 'gpt-5.4',
  createdAt: '2026-04-11T10:00:00.000Z',
  updatedAt: '2026-04-11T10:05:00.000Z',
  lastTurnAt: '2026-04-11T10:05:00.000Z',
};

const eventFixture: BirdCoderCodingSessionEvent = {
  id: 'event-core-read-contract',
  codingSessionId: sessionFixture.id,
  turnId: 'turn-core-read-contract',
  runtimeId: 'runtime-core-read-contract',
  kind: 'message.completed',
  sequence: '1',
  payload: {
    content: 'completed',
  },
  createdAt: '2026-04-11T10:05:00.000Z',
};

const artifactFixture: BirdCoderCodingSessionArtifact = {
  id: 'artifact-core-read-contract',
  codingSessionId: sessionFixture.id,
  turnId: 'turn-core-read-contract',
  kind: 'diff',
  status: 'sealed',
  title: 'Patch',
  blobRef: 'memory://artifact-core-read-contract',
  metadata: {},
  createdAt: '2026-04-11T10:05:00.000Z',
};

const checkpointFixture: BirdCoderCodingSessionCheckpoint = {
  id: 'checkpoint-core-read-contract',
  codingSessionId: sessionFixture.id,
  runtimeId: 'runtime-core-read-contract',
  checkpointKind: 'resume',
  resumable: true,
  state: {
    step: 'resume',
  },
  createdAt: '2026-04-11T10:05:00.000Z',
};

const calls: string[] = [];

const coreReadClient: BirdCoderCoreReadApiClient = {
  async getCodingSession(codingSessionId) {
    calls.push(`getCodingSession:${codingSessionId}`);
    return sessionFixture;
  },
  async getDescriptor() {
    calls.push('getDescriptor');
    return descriptorFixture;
  },
  async getHealth() {
    calls.push('getHealth');
    return healthFixture;
  },
  async getNativeSession() {
    calls.push('getNativeSession');
    throw new Error('not needed');
  },
  async getEngineCapabilities(engineKey) {
    calls.push(`getEngineCapabilities:${engineKey}`);
    return capabilityFixture;
  },
  async getOperation(operationId) {
    calls.push(`getOperation:${operationId}`);
    return operationFixture;
  },
  async getRuntime() {
    calls.push('getRuntime');
    return runtimeFixture;
  },
  async listCodingSessionArtifacts(codingSessionId) {
    calls.push(`listCodingSessionArtifacts:${codingSessionId}`);
    return [artifactFixture];
  },
  async listCodingSessionCheckpoints(codingSessionId) {
    calls.push(`listCodingSessionCheckpoints:${codingSessionId}`);
    return [checkpointFixture];
  },
  async listCodingSessionEvents(codingSessionId) {
    calls.push(`listCodingSessionEvents:${codingSessionId}`);
    return [eventFixture];
  },
  async listCodingSessions() {
    return [sessionFixture];
  },
  async listEngines() {
    calls.push('listEngines');
    return [engineFixture];
  },
  async listModels() {
    calls.push('listModels');
    return [modelFixture];
  },
  async listNativeSessionProviders() {
    calls.push('listNativeSessionProviders');
    return [nativeSessionProviderFixture];
  },
  async listNativeSessions() {
    calls.push('listNativeSessions');
    return [];
  },
  async listRoutes() {
    calls.push('listRoutes');
    return [routeFixture];
  },
};

const services = createDefaultBirdCoderIdeServices({
  coreReadClient,
});

assert.deepEqual(await services.coreReadService.getDescriptor(), descriptorFixture);
assert.deepEqual(await services.coreReadService.getRuntime(), runtimeFixture);
assert.deepEqual(await services.coreReadService.getHealth(), healthFixture);
assert.deepEqual(await services.coreReadService.listEngines(), [engineFixture]);
assert.deepEqual(
  await services.coreReadService.getEngineCapabilities(engineFixture.engineKey),
  capabilityFixture,
);
assert.deepEqual(await services.coreReadService.listModels(), [modelFixture]);
assert.deepEqual(await services.coreReadService.listNativeSessionProviders(), [
  nativeSessionProviderFixture,
]);
assert.deepEqual(await services.coreReadService.listRoutes(), [routeFixture]);
assert.deepEqual(
  await services.coreReadService.getOperation(operationFixture.operationId),
  operationFixture,
);
assert.deepEqual(
  await services.coreReadService.getCodingSession(sessionFixture.id),
  sessionFixture,
);
assert.deepEqual(
  await services.coreReadService.listCodingSessionEvents(sessionFixture.id),
  [eventFixture],
);
assert.deepEqual(
  await services.coreReadService.listCodingSessionArtifacts(sessionFixture.id),
  [artifactFixture],
);
assert.deepEqual(
  await services.coreReadService.listCodingSessionCheckpoints(sessionFixture.id),
  [checkpointFixture],
);

const longCacheKeyCalls: unknown[] = [];
const longSafeCacheService = new ApiBackedCoreReadService({
  client: {
    ...coreReadClient,
    async listCodingSessions(request) {
      longCacheKeyCalls.push(request);
      return [sessionFixture];
    },
  },
  identityProvider: {
    async getCurrentUser() {
      return {
        id: '101777208078558057',
      } as never;
    },
  },
});
assert.deepEqual(
  await (longSafeCacheService.listCodingSessions as unknown as (
    request: Record<string, unknown>,
  ) => Promise<BirdCoderCodingSessionSummary[]>)({
    projectId: 101777208078558059n,
    workspaceId: 101777208078558061n,
  }),
  [sessionFixture],
  'core read service cache keys must serialize provider-native bigint request ids without crashing before the generated client boundary.',
);
assert.deepEqual(longCacheKeyCalls, [
  {
    projectId: 101777208078558059n,
    workspaceId: 101777208078558061n,
  },
]);

assert.deepEqual(calls, [
  'getDescriptor',
  'getRuntime',
  'getHealth',
  'listEngines',
  `getEngineCapabilities:${engineFixture.engineKey}`,
  'listModels',
  'listNativeSessionProviders',
  'listRoutes',
  `getOperation:${operationFixture.operationId}`,
  `getCodingSession:${sessionFixture.id}`,
  `listCodingSessionEvents:${sessionFixture.id}`,
  `listCodingSessionArtifacts:${sessionFixture.id}`,
  `listCodingSessionCheckpoints:${sessionFixture.id}`,
]);

console.log('default IDE services core read service contract passed.');
