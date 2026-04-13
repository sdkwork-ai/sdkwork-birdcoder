import assert from 'node:assert/strict';
import type { ICoreReadService } from '../packages/sdkwork-birdcoder-infrastructure/src/services/interfaces/ICoreReadService.ts';
import type {
  BirdCoderCodingSessionArtifact,
  BirdCoderCodingSessionCheckpoint,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionSummary,
  BirdCoderCodingServerDescriptor,
  BirdCoderCoreHealthSummary,
  BirdCoderCoreRuntimeSummary,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdCoderModelCatalogEntry,
  BirdCoderOperationDescriptor,
} from '@sdkwork/birdcoder-types';
import { loadCodingSessionProjection } from '../packages/sdkwork-birdcoder-commons/src/hooks/useCodingSessionProjection.ts';

const sessionId = 'session-projection-consumer-contract';

const sessionFixture: BirdCoderCodingSessionSummary = {
  id: sessionId,
  workspaceId: 'workspace-projection-consumer-contract',
  projectId: 'project-projection-consumer-contract',
  title: 'Projection consumer contract',
  status: 'active',
  hostMode: 'desktop',
  engineId: 'codex',
  modelId: 'codex',
  createdAt: '2026-04-11T11:00:00.000Z',
  updatedAt: '2026-04-11T11:05:00.000Z',
  lastTurnAt: '2026-04-11T11:05:00.000Z',
};

const eventFixture: BirdCoderCodingSessionEvent = {
  id: 'event-projection-consumer-contract',
  codingSessionId: sessionId,
  turnId: 'turn-projection-consumer-contract',
  runtimeId: 'runtime-projection-consumer-contract',
  kind: 'turn.completed',
  sequence: 1,
  payload: {
    summary: 'done',
  },
  createdAt: '2026-04-11T11:05:00.000Z',
};

const artifactFixture: BirdCoderCodingSessionArtifact = {
  id: 'artifact-projection-consumer-contract',
  codingSessionId: sessionId,
  turnId: 'turn-projection-consumer-contract',
  kind: 'diff',
  status: 'sealed',
  title: 'diff.patch',
  blobRef: 'memory://artifact-projection-consumer-contract',
  metadata: {},
  createdAt: '2026-04-11T11:05:00.000Z',
};

const checkpointFixture: BirdCoderCodingSessionCheckpoint = {
  id: 'checkpoint-projection-consumer-contract',
  codingSessionId: sessionId,
  runtimeId: 'runtime-projection-consumer-contract',
  checkpointKind: 'resume',
  resumable: true,
  state: {
    turn: 'turn-projection-consumer-contract',
  },
  createdAt: '2026-04-11T11:05:00.000Z',
};

const callLog: string[] = [];

const coreReadService: ICoreReadService = {
  async getCodingSession(codingSessionId: string) {
    callLog.push(`getCodingSession:${codingSessionId}`);
    return sessionFixture;
  },
  async getDescriptor(): Promise<BirdCoderCodingServerDescriptor> {
    throw new Error('not needed');
  },
  async getHealth(): Promise<BirdCoderCoreHealthSummary> {
    throw new Error('not needed');
  },
  async getEngineCapabilities(): Promise<BirdCoderEngineCapabilityMatrix> {
    throw new Error('not needed');
  },
  async getOperation(): Promise<BirdCoderOperationDescriptor> {
    throw new Error('not needed');
  },
  async getRuntime(): Promise<BirdCoderCoreRuntimeSummary> {
    throw new Error('not needed');
  },
  async listCodingSessionArtifacts(codingSessionId: string) {
    callLog.push(`listCodingSessionArtifacts:${codingSessionId}`);
    return [artifactFixture];
  },
  async listCodingSessionCheckpoints(codingSessionId: string) {
    callLog.push(`listCodingSessionCheckpoints:${codingSessionId}`);
    return [checkpointFixture];
  },
  async listCodingSessionEvents(codingSessionId: string) {
    callLog.push(`listCodingSessionEvents:${codingSessionId}`);
    return [eventFixture];
  },
  async listEngines(): Promise<BirdCoderEngineDescriptor[]> {
    throw new Error('not needed');
  },
  async listModels(): Promise<BirdCoderModelCatalogEntry[]> {
    throw new Error('not needed');
  },
};

const projection = await loadCodingSessionProjection(coreReadService, sessionId);

assert.deepEqual(projection, {
  artifacts: [artifactFixture],
  checkpoints: [checkpointFixture],
  events: [eventFixture],
  session: sessionFixture,
});

assert.deepEqual(callLog, [
  `getCodingSession:${sessionId}`,
  `listCodingSessionEvents:${sessionId}`,
  `listCodingSessionArtifacts:${sessionId}`,
  `listCodingSessionCheckpoints:${sessionId}`,
]);

console.log('coding session projection app consumer contract passed.');
