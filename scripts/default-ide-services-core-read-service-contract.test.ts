import assert from 'node:assert/strict';
import type {
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
  BirdCoderModelCatalogEntry,
  BirdCoderOperationDescriptor,
} from '@sdkwork/birdcoder-types';
import { createDefaultBirdCoderIdeServices } from '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts';

const descriptorFixture: BirdCoderCodingServerDescriptor = {
  apiVersion: 'v1',
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

const engineFixture: BirdCoderEngineDescriptor = {
  engineKey: 'codex',
  displayName: 'Codex',
  vendor: 'OpenAI',
  installationKind: 'external-cli',
  defaultModelId: 'codex',
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
};

const capabilityFixture: BirdCoderEngineCapabilityMatrix = {
  ...engineFixture.capabilityMatrix,
};

const modelFixture: BirdCoderModelCatalogEntry = {
  engineKey: 'codex',
  modelId: 'codex',
  displayName: 'Codex',
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
  modelId: 'codex',
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
  sequence: 1,
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
  async listEngines() {
    calls.push('listEngines');
    return [engineFixture];
  },
  async listModels() {
    calls.push('listModels');
    return [modelFixture];
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

assert.deepEqual(calls, [
  'getDescriptor',
  'getRuntime',
  'getHealth',
  'listEngines',
  `getEngineCapabilities:${engineFixture.engineKey}`,
  'listModels',
  `getOperation:${operationFixture.operationId}`,
  `getCodingSession:${sessionFixture.id}`,
  `listCodingSessionEvents:${sessionFixture.id}`,
  `listCodingSessionArtifacts:${sessionFixture.id}`,
  `listCodingSessionCheckpoints:${sessionFixture.id}`,
]);

console.log('default IDE services core read service contract passed.');
