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

const descriptorFixture: BirdCoderCodingServerDescriptor = {
  apiVersion: 'v1',
  gateway: {
    basePath: '/api',
    docsPath: '/docs',
    liveOpenApiPath: '/openapi.json',
    openApiPath: '/openapi/coding-server-v1.json',
    routeCatalogPath: '/api/core/v1/routes',
    routeCount: 57,
    routesBySurface: {
      core: 19,
      app: 31,
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
        routeCount: 31,
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

const enginesFixture: BirdCoderEngineDescriptor[] = [
  {
    engineKey: 'codex',
    displayName: 'Codex',
    vendor: 'OpenAI',
    installationKind: 'external-cli',
    defaultModelId: 'codex',
    homepage: 'https://openai.com/codex',
    supportedHostModes: ['web', 'desktop', 'server'],
    transportKinds: ['cli-jsonl', 'json-rpc-v2'],
    capabilityMatrix: codexCapabilities,
  },
  {
    engineKey: 'gemini',
    displayName: 'Gemini',
    vendor: 'Google',
    installationKind: 'external-cli',
    defaultModelId: 'gemini',
    homepage: 'https://deepmind.google/technologies/gemini/',
    supportedHostModes: ['web', 'desktop', 'server'],
    transportKinds: ['sdk-stream', 'openapi-http'],
    capabilityMatrix: geminiCapabilities,
  },
];

const modelsFixture: BirdCoderModelCatalogEntry[] = [
  {
    engineKey: 'codex',
    modelId: 'codex',
    displayName: 'Codex',
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
    authMode: 'host',
    method: 'GET',
    openApiPath: '/api/core/v1/routes',
    operationId: 'core.listRoutes',
    path: '/api/core/v1/routes',
    surface: 'core',
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
