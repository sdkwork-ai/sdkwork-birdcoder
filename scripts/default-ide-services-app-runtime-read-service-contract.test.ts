import type {
  BirdCoderAppRuntimeReadSdkApiClient,
} from '../packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts';
import assert from 'node:assert/strict';
import type {
  BirdCoderApiRouteCatalogEntry,
  BirdCoderCodingServerDescriptor,
  BirdCoderCodingSessionArtifact,
  BirdCoderCodingSessionCheckpoint,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionSummary,
  BirdCoderCoreHealthSummary,
  BirdCoderCoreRuntimeSummary,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdCoderNativeSessionProviderSummary,
  BirdCoderModelCatalogEntry,
  BirdCoderOperationDescriptor,
} from '@sdkwork/birdcoder-types';
import { createDefaultBirdCoderIdeServices } from '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts';
import { ApiBackedAppRuntimeReadService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/ApiBackedAppRuntimeReadService.ts';
import { TEST_CODE_ENGINE_MODEL_CONFIG } from './test-code-engine-model-config-fixture.ts';

const routeFixture: BirdCoderApiRouteCatalogEntry = {
  authMode: 'user',
  method: 'GET',
  openApiPath: '/app/v3/api/system/routes',
  operationId: 'routes.list',
  path: '/app/v3/api/system/routes',
  surface: 'app',
  summary: 'List unified API routes',
};

const descriptorFixture: BirdCoderCodingServerDescriptor = {
  apiVersion: 'v1',
  gateway: {
    docsPath: '/docs',
    liveOpenApiPath: '/openapi.json',
    openApiPath: '/openapi/coding-server-v1.json',
    routeCatalogPath: '/app/v3/api/system/routes',
    routeCount: 58,
    routesBySurface: {
      app: 51,
      backend: 7,
    },
    surfaces: [
      {
        authMode: 'user',
        basePath: '/app/v3/api',
        description: 'Application-facing coding runtime, workspace, project, collaboration, and user-center routes.',
        name: 'app',
        routeCount: 51,
      },
      {
        authMode: 'admin',
        basePath: '/backend/v3/api',
        description: 'Backend governance, audit, release, deployment, and team-management routes.',
        name: 'backend',
        routeCount: 7,
      },
    ],
  },
  hostMode: 'desktop',
  moduleId: 'coding-server',
  openApiPath: '/openapi/coding-server-v1.json',
  surfaces: ['app', 'backend'],
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
  operationId: 'operation-app-runtime-read-contract',
  status: 'running',
  artifactRefs: ['artifact-app-runtime-read-contract'],
  streamKind: 'sse',
  streamUrl: '/app/v3/api/coding_sessions/session-app-runtime-read-contract/events',
};

const sessionFixture: BirdCoderCodingSessionSummary = {
  id: 'session-app-runtime-read-contract',
  workspaceId: 'workspace-app-runtime-read-contract',
  projectId: 'project-app-runtime-read-contract',
  title: 'App runtime read service contract',
  status: 'active',
  hostMode: 'desktop',
  engineId: 'codex',
  modelId: 'gpt-5.4',
  createdAt: '2026-04-11T10:00:00.000Z',
  updatedAt: '2026-04-11T10:05:00.000Z',
  lastTurnAt: '2026-04-11T10:05:00.000Z',
};

const eventFixture: BirdCoderCodingSessionEvent = {
  id: 'event-app-runtime-read-contract',
  codingSessionId: sessionFixture.id,
  turnId: 'turn-app-runtime-read-contract',
  runtimeId: 'runtime-app-runtime-read-contract',
  kind: 'message.completed',
  sequence: '1',
  payload: {
    content: 'completed',
  },
  createdAt: '2026-04-11T10:05:00.000Z',
};

const artifactFixture: BirdCoderCodingSessionArtifact = {
  id: 'artifact-app-runtime-read-contract',
  codingSessionId: sessionFixture.id,
  turnId: 'turn-app-runtime-read-contract',
  kind: 'diff',
  status: 'sealed',
  title: 'Patch',
  blobRef: 'memory://artifact-app-runtime-read-contract',
  metadata: {},
  createdAt: '2026-04-11T10:05:00.000Z',
};

const checkpointFixture: BirdCoderCodingSessionCheckpoint = {
  id: 'checkpoint-app-runtime-read-contract',
  codingSessionId: sessionFixture.id,
  runtimeId: 'runtime-app-runtime-read-contract',
  checkpointKind: 'resume',
  resumable: true,
  state: {
    step: 'resume',
  },
  createdAt: '2026-04-11T10:05:00.000Z',
};

const calls: string[] = [];

const codingRuntimeClient: BirdCoderAppRuntimeReadSdkApiClient = {
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
  async getModelConfig() {
    calls.push('getModelConfig');
    return TEST_CODE_ENGINE_MODEL_CONFIG;
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
  appRuntimeClient: codingRuntimeClient,
});

assert.deepEqual(await services.appRuntimeReadService.getDescriptor(), descriptorFixture);
assert.deepEqual(await services.appRuntimeReadService.getRuntime(), runtimeFixture);
assert.deepEqual(await services.appRuntimeReadService.getHealth(), healthFixture);
assert.deepEqual(await services.appRuntimeReadService.listEngines(), [engineFixture]);
assert.deepEqual(
  await services.appRuntimeReadService.getEngineCapabilities(engineFixture.engineKey),
  capabilityFixture,
);
assert.deepEqual(await services.appRuntimeReadService.listModels(), [modelFixture]);
assert.deepEqual(await services.appRuntimeReadService.listNativeSessionProviders(), [
  nativeSessionProviderFixture,
]);
assert.deepEqual(await services.appRuntimeReadService.listRoutes(), [routeFixture]);
assert.deepEqual(
  await services.appRuntimeReadService.getOperation(operationFixture.operationId),
  operationFixture,
);
assert.deepEqual(
  await services.appRuntimeReadService.getCodingSession(sessionFixture.id),
  sessionFixture,
);
assert.deepEqual(
  await services.appRuntimeReadService.listCodingSessionEvents(sessionFixture.id),
  [eventFixture],
);
assert.deepEqual(
  await services.appRuntimeReadService.listCodingSessionArtifacts(sessionFixture.id),
  [artifactFixture],
);
assert.deepEqual(
  await services.appRuntimeReadService.listCodingSessionCheckpoints(sessionFixture.id),
  [checkpointFixture],
);

const longCacheKeyCalls: unknown[] = [];
const longSafeCacheService = new ApiBackedAppRuntimeReadService({
  client: {
    ...codingRuntimeClient,
    async listCodingSessions(request) {
      longCacheKeyCalls.push(request);
      return [sessionFixture];
    },
  },
  currentUserProvider: {
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
  'app runtime read service cache keys must serialize provider-native bigint request ids without crashing before the generated client boundary.',
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

console.log('default IDE services app runtime read service contract passed.');
