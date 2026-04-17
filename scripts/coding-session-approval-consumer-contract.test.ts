import assert from 'node:assert/strict';

import type {
  BirdCoderApprovalDecisionResult,
  BirdCoderCodingServerDescriptor,
  BirdCoderCodingSessionArtifact,
  BirdCoderCodingSessionCheckpoint,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionSummary,
  BirdCoderCoreHealthSummary,
  BirdCoderCoreRuntimeSummary,
  BirdCoderCoreWriteApiClient,
  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdCoderModelCatalogEntry,
  BirdCoderOperationDescriptor,
} from '@sdkwork/birdcoder-types';
import type {
  ICoreReadService,
  ICoreWriteService,
} from '../packages/sdkwork-birdcoder-infrastructure/src/index.ts';

const defaultServicesModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts',
  import.meta.url,
);
const projectionModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/hooks/useCodingSessionProjection.ts',
  import.meta.url,
);

const sessionId = 'approval-consumer-contract-session';
const approvalId = 'approval-consumer-contract-1';

const sessionFixture: BirdCoderCodingSessionSummary = {
  id: sessionId,
  workspaceId: 'workspace-approval-consumer-contract',
  projectId: 'project-approval-consumer-contract',
  title: 'Approval consumer contract',
  status: 'active',
  hostMode: 'server',
  engineId: 'codex',
  modelId: 'gpt-5-codex',
  createdAt: '2026-04-11T13:00:00.000Z',
  updatedAt: '2026-04-11T13:05:00.000Z',
  lastTurnAt: '2026-04-11T13:05:00.000Z',
};

const eventFixture: BirdCoderCodingSessionEvent = {
  id: 'approval-consumer-contract-event',
  codingSessionId: sessionId,
  turnId: 'approval-consumer-contract-turn',
  runtimeId: 'approval-consumer-contract-runtime',
  kind: 'approval.required',
  sequence: 3,
  payload: {
    approvalId,
    toolName: 'apply_patch',
    runtimeStatus: 'awaiting_approval',
  },
  createdAt: '2026-04-11T13:05:00.000Z',
};

const artifactFixture: BirdCoderCodingSessionArtifact = {
  id: 'approval-consumer-contract-artifact',
  codingSessionId: sessionId,
  turnId: 'approval-consumer-contract-turn',
  kind: 'patch',
  status: 'sealed',
  title: 'approval.patch',
  blobRef: 'memory://approval.patch',
  metadata: {
    operationId: 'approval-consumer-contract-turn:operation',
  },
  createdAt: '2026-04-11T13:05:00.000Z',
};

const checkpointFixture: BirdCoderCodingSessionCheckpoint = {
  id: 'approval-consumer-contract-checkpoint',
  codingSessionId: sessionId,
  runtimeId: 'approval-consumer-contract-runtime',
  checkpointKind: 'approval',
  resumable: true,
  state: {
    approvalId,
    reason: 'Review patch before applying',
  },
  createdAt: '2026-04-11T13:05:00.000Z',
};

const approvalResultFixture: BirdCoderApprovalDecisionResult = {
  approvalId,
  checkpointId: 'approval-consumer-contract-checkpoint',
  codingSessionId: sessionId,
  decision: 'approved',
  decidedAt: '2026-04-11T13:06:00.000Z',
  operationId: 'approval-consumer-contract-turn:operation',
  operationStatus: 'running',
  reason: 'Looks safe',
  runtimeStatus: 'awaiting_tool',
  runtimeId: 'approval-consumer-contract-runtime',
  turnId: 'approval-consumer-contract-turn',
};

const observedApprovals: Array<{
  approvalId: string;
  decision: string;
  reason?: string;
}> = [];

const coreReadService: ICoreReadService = {
  async getCodingSession() {
    return sessionFixture;
  },
  async getDescriptor(): Promise<BirdCoderCodingServerDescriptor> {
    throw new Error('not needed');
  },
  async getEngineCapabilities(): Promise<BirdCoderEngineCapabilityMatrix> {
    throw new Error('not needed');
  },
  async getHealth(): Promise<BirdCoderCoreHealthSummary> {
    throw new Error('not needed');
  },
  async getNativeSession() {
    throw new Error('not needed');
  },
  async getOperation(): Promise<BirdCoderOperationDescriptor> {
    throw new Error('not needed');
  },
  async getRuntime(): Promise<BirdCoderCoreRuntimeSummary> {
    throw new Error('not needed');
  },
  async listCodingSessionArtifacts() {
    return [artifactFixture];
  },
  async listCodingSessionCheckpoints() {
    return [checkpointFixture];
  },
  async listCodingSessionEvents() {
    return [eventFixture];
  },
  async listEngines(): Promise<BirdCoderEngineDescriptor[]> {
    throw new Error('not needed');
  },
  async listModels(): Promise<BirdCoderModelCatalogEntry[]> {
    throw new Error('not needed');
  },
  async listNativeSessions() {
    return [];
  },
  async listRoutes() {
    return [];
  },
};

const coreWriteClient: BirdCoderCoreWriteApiClient = {
  async createCodingSession() {
    throw new Error('not needed');
  },
  async createCodingSessionTurn() {
    throw new Error('not needed');
  },
  async submitApprovalDecision(requestApprovalId, request) {
    observedApprovals.push({
      approvalId: requestApprovalId,
      decision: request.decision,
      reason: request.reason,
    });
    return approvalResultFixture;
  },
};

const projectionModule = await import(`${projectionModulePath.href}?t=${Date.now()}`);
assert.equal(
  typeof projectionModule.loadCodingSessionApprovalState,
  'function',
  'coding session projection consumer module must export a pure approval-state loader.',
);
assert.equal(
  typeof projectionModule.submitCodingSessionApprovalDecision,
  'function',
  'coding session projection consumer module must export a pure approval-decision action.',
);

const { createDefaultBirdCoderIdeServices } = await import(
  `${defaultServicesModulePath.href}?t=${Date.now()}`
);

const services = createDefaultBirdCoderIdeServices({
  coreReadClient: coreReadService,
  coreWriteClient,
});

assert.equal(
  typeof services.coreWriteService.submitApprovalDecision,
  'function',
  'default IDE services must expose submitApprovalDecision through the shared core write service.',
);

const approvals = await projectionModule.loadCodingSessionApprovalState(
  services.coreReadService as Pick<
    ICoreReadService,
    'getCodingSession' | 'listCodingSessionArtifacts' | 'listCodingSessionCheckpoints' | 'listCodingSessionEvents'
  >,
  sessionId,
);

assert.deepEqual(approvals, [
  {
    approvalId,
    artifactIds: ['approval-consumer-contract-artifact'],
    checkpointId: 'approval-consumer-contract-checkpoint',
    codingSessionId: sessionId,
    operationId: 'approval-consumer-contract-turn:operation',
    reason: 'Review patch before applying',
    runtimeId: 'approval-consumer-contract-runtime',
    turnId: 'approval-consumer-contract-turn',
  },
]);

const approvalResult = await projectionModule.submitCodingSessionApprovalDecision(
  services.coreWriteService as Pick<ICoreWriteService, 'submitApprovalDecision'>,
  approvalId,
  {
    decision: 'approved',
    reason: 'Looks safe',
  },
);

assert.deepEqual(observedApprovals, [
  {
    approvalId,
    decision: 'approved',
    reason: 'Looks safe',
  },
]);
assert.deepEqual(approvalResult, approvalResultFixture);

console.log('coding session approval consumer contract passed.');
