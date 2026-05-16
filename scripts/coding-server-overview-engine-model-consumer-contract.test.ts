import assert from 'node:assert/strict';
import type {
  BirdCoderApiRouteCatalogEntry,
  BirdCoderCodingServerDescriptor,
  BirdCoderCoreHealthSummary,
  BirdCoderCoreRuntimeSummary,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdCoderModelCatalogEntry,
  BirdCoderOperationDescriptor,
} from '@sdkwork/birdcoder-types';
import type { ICoreReadService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/ICoreReadService.ts';
import { loadCodingServerOverview } from '../packages/sdkwork-birdcoder-commons/src/hooks/useCodingServerOverview.ts';
import { TEST_CODE_ENGINE_MODEL_CONFIG } from './test-code-engine-model-config-fixture.ts';

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

const codexCapabilities: BirdCoderEngineCapabilityMatrix = {
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
};

const geminiCapabilities: BirdCoderEngineCapabilityMatrix = {
  ...codexCapabilities,
  ptyArtifacts: false,
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

const enginesFixture: BirdCoderEngineDescriptor[] = [
  {
    ...buildCatalogSummaryFixture('engine-registry:codex'),
    engineKey: 'codex',
    displayName: 'Codex',
    vendor: 'OpenAI',
    installationKind: 'external-cli',
    defaultModelId: 'gpt-5.4',
    homepage: 'https://openai.com/codex',
    supportedHostModes: ['web', 'desktop', 'server'],
    transportKinds: ['cli-jsonl', 'json-rpc-v2'],
    capabilityMatrix: codexCapabilities,
    status: 'active',
  },
  {
    ...buildCatalogSummaryFixture('engine-registry:gemini'),
    engineKey: 'gemini',
    displayName: 'Gemini',
    vendor: 'Google',
    installationKind: 'external-cli',
    defaultModelId: 'gemini',
    homepage: 'https://deepmind.google/technologies/gemini/',
    supportedHostModes: ['web', 'desktop', 'server'],
    transportKinds: ['sdk-stream', 'openapi-http'],
    capabilityMatrix: geminiCapabilities,
    status: 'active',
  },
];

const modelsFixture: BirdCoderModelCatalogEntry[] = [
  {
    ...buildCatalogSummaryFixture('model-catalog:codex:gpt-5.4'),
    engineKey: 'codex',
    modelId: 'gpt-5.4',
    displayName: 'GPT-5.4',
    providerId: 'openai',
    status: 'active',
    defaultForEngine: true,
    transportKinds: ['cli-jsonl', 'json-rpc-v2'],
    capabilityMatrix: {
      planning: true,
      toolCalls: true,
    },
  },
  {
    ...buildCatalogSummaryFixture('model-catalog:gemini:gemini-1.5-pro'),
    engineKey: 'gemini',
    modelId: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    providerId: 'google',
    status: 'active',
    defaultForEngine: false,
    transportKinds: ['sdk-stream', 'openapi-http'],
    capabilityMatrix: {
      planning: true,
    },
  },
];

const capabilityByEngineKey: Record<string, BirdCoderEngineCapabilityMatrix> = {
  codex: codexCapabilities,
  gemini: geminiCapabilities,
};

const routesFixture: BirdCoderApiRouteCatalogEntry[] = [
  {
    authMode: 'user',
    method: 'GET',
    openApiPath: '/app/v3/api/system/routes',
    operationId: 'routes.list',
    path: '/app/v3/api/system/routes',
    surface: 'app',
    summary: 'List unified API routes',
  },
];

const callLog: string[] = [];

const coreReadService: ICoreReadService = {
  async getCodingSession() {
    throw new Error('not needed');
  },
  async getDescriptor() {
    callLog.push('getDescriptor');
    return descriptorFixture;
  },
  async getHealth() {
    callLog.push('getHealth');
    return healthFixture;
  },
  async getModelConfig() {
    return TEST_CODE_ENGINE_MODEL_CONFIG;
  },
  async getNativeSession() {
    throw new Error('not needed');
  },
  async getEngineCapabilities(engineKey: string) {
    callLog.push(`getEngineCapabilities:${engineKey}`);
    return capabilityByEngineKey[engineKey] ?? codexCapabilities;
  },
  async getOperation(): Promise<BirdCoderOperationDescriptor> {
    throw new Error('not needed');
  },
  async getRuntime() {
    callLog.push('getRuntime');
    return runtimeFixture;
  },
  async listCodingSessionArtifacts() {
    throw new Error('not needed');
  },
  async listCodingSessionCheckpoints() {
    throw new Error('not needed');
  },
  async listCodingSessionEvents() {
    throw new Error('not needed');
  },
  async listCodingSessions() {
    return [];
  },
  async listEngines() {
    callLog.push('listEngines');
    return enginesFixture;
  },
  async listModels() {
    callLog.push('listModels');
    return modelsFixture;
  },
  async listNativeSessionProviders() {
    return [];
  },
  async listNativeSessions() {
    return [];
  },
  async listRoutes() {
    callLog.push('listRoutes');
    return routesFixture;
  },
};

const overview = await loadCodingServerOverview(coreReadService);

assert.deepEqual(overview, {
  descriptor: descriptorFixture,
  engines: enginesFixture,
  engineCapabilities: capabilityByEngineKey,
  health: healthFixture,
  models: modelsFixture,
  routes: routesFixture,
  runtime: runtimeFixture,
});

assert.deepEqual(callLog, [
  'getDescriptor',
  'getRuntime',
  'getHealth',
  'listEngines',
  'listModels',
  'listRoutes',
  'getEngineCapabilities:codex',
  'getEngineCapabilities:gemini',
]);

console.log('coding server overview engine/model consumer contract passed.');
