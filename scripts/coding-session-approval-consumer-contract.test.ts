import type {
  BirdCoderAppRuntimeWriteSdkApiClient,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';
import assert from 'node:assert/strict';

import type {
  BirdCoderApprovalDecisionResult,
  BirdCoderCodingServerDescriptor,
  BirdCoderCodingSessionArtifact,
  BirdCoderCodingSessionCheckpoint,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionSummary,
  BirdCoderCoreHealthSummary,
  BirdCoderCoreRuntimeSummary,  BirdCoderEngineCapabilityMatrix,
  BirdCoderEngineDescriptor,
  BirdCoderModelCatalogEntry,
  BirdCoderOperationDescriptor,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type {
  IAppRuntimeReadService,
  IAppRuntimeWriteService,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/index.ts';
import {
  TEST_CODE_ENGINE_MODEL_CONFIG,
  buildTestCodeEngineModelConfigSyncResult,
} from './test-code-engine-model-config-fixture.ts';
import { installBirdCoderTestRuntimeEnv } from './test-birdcoder-runtime-env-fixture.ts';

const defaultServicesModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServices.ts',
  import.meta.url,
);
const projectionModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useCodingSessionProjection.ts',
  import.meta.url,
);

const sessionId = 'approval-consumer-contract-session';
const approvalId = 'approval-consumer-contract-1';
const unsafeApprovalId = '101777208078558015';

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
  sequence: '3',
  payload: {
    approvalId,
    interactionId: approvalId,
    interactionKind: 'approval',
    reason: 'Review patch before applying',
    toolName: 'apply_patch',
    runtimeStatus: 'awaiting_approval',
  },
  createdAt: '2026-04-11T13:05:00.000Z',
};

const approvalDecisionEventFixture: BirdCoderCodingSessionEvent = {
  id: 'approval-consumer-contract-decision-event',
  codingSessionId: sessionId,
  turnId: 'approval-consumer-contract-turn',
  runtimeId: 'approval-consumer-contract-runtime',
  kind: 'operation.updated',
  sequence: '4',
  payload: {
    interactionEventId: 'approval-consumer-contract-event',
    interactionId: approvalId,
    interactionKind: 'approval',
    approvalId,
    checkpointId: 'approval-consumer-contract-event',
    approvalDecision: 'approved',
    runtimeStatus: 'awaiting_tool',
    operationStatus: 'running',
  },
  createdAt: '2026-04-11T13:06:00.000Z',
};

const unsafeLongApprovalDecisionEventFixture: BirdCoderCodingSessionEvent = {
  ...approvalDecisionEventFixture,
  id: 'approval-consumer-contract-long-id-decision-event',
  payload: {
    toolName: 'permission_request',
    toolArguments: `{
      "approvalId": ${unsafeApprovalId},
      "approvalDecision": "approved",
      "runtimeStatus": "awaiting_tool"
    }`,
  },
};

const permissionIdApprovalDecisionEventFixture: BirdCoderCodingSessionEvent = {
  ...approvalDecisionEventFixture,
  id: 'approval-consumer-contract-permission-id-decision-event',
  payload: {
    interactionEventId: 'approval-consumer-contract-event',
    interactionId: approvalId,
    interactionKind: 'approval',
    status: 'approved',
    runtimeStatus: 'awaiting_tool',
  },
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

const unsafeLongCheckpointFixture: BirdCoderCodingSessionCheckpoint = {
  ...checkpointFixture,
  id: 'approval-consumer-contract-long-id-checkpoint',
  state: {
    approvalId: unsafeApprovalId,
    reason: 'Review long-id approval before applying',
  },
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
  codingSessionId: string;
  decision: string;
  reason?: string;
}> = [];

const appRuntimeReadService: IAppRuntimeReadService = {
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
  async getModelConfig() {
    return TEST_CODE_ENGINE_MODEL_CONFIG;
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
  async listCodingSessions() {
    return [sessionFixture];
  },
  async listEngines(): Promise<BirdCoderEngineDescriptor[]> {
    throw new Error('not needed');
  },
  async listModels(): Promise<BirdCoderModelCatalogEntry[]> {
    throw new Error('not needed');
  },
  async listNativeSessionProviders() {
    return [];
  },
  async listNativeSessions() {
    return [];
  },
  async listRoutes() {
    return [];
  },
};

const codingRuntimeClient: BirdCoderAppRuntimeWriteSdkApiClient = {
  async createCodingSession() {
    throw new Error('not needed');
  },
  async updateCodingSession() {
    throw new Error('not needed');
  },
  async forkCodingSession() {
    throw new Error('not needed');
  },
  async deleteCodingSession() {
    throw new Error('not needed');
  },
  async createCodingSessionTurn() {
    throw new Error('not needed');
  },
  async submitApprovalDecision(requestCodingSessionId, requestApprovalId, request) {
    observedApprovals.push({
      approvalId: requestApprovalId,
      codingSessionId: requestCodingSessionId,
      decision: request.decision,
      reason: request.reason,
    });
    return approvalResultFixture;
  },
  async submitUserQuestionAnswer() {
    throw new Error('not needed');
  },
  async syncModelConfig(request) {
    return buildTestCodeEngineModelConfigSyncResult(request.localConfig);
  },
  async editCodingSessionMessage() {
    throw new Error('not needed');
  },
  async deleteCodingSessionMessage() {
    throw new Error('not needed');
  },
};

const restoreRuntimeEnv = installBirdCoderTestRuntimeEnv();
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
  appRuntimeClient: {
    ...appRuntimeReadService,
    ...codingRuntimeClient,
  },
});

assert.equal(
  typeof services.appRuntimeWriteService.submitApprovalDecision,
  'function',
  'default IDE services must expose submitApprovalDecision through the shared app runtime write service.',
);

const approvals = await projectionModule.loadCodingSessionApprovalState(
  services.appRuntimeReadService as Pick<
    IAppRuntimeReadService,
    'getCodingSession' | 'listCodingSessionArtifacts' | 'listCodingSessionCheckpoints' | 'listCodingSessionEvents'
  >,
  sessionId,
);

assert.deepEqual(approvals, [
  {
    approvalId,
    artifactIds: ['approval-consumer-contract-artifact'],
    codingSessionId: sessionId,
    interactionEventId: 'approval-consumer-contract-event',
    operationId: 'approval-consumer-contract-turn:operation',
    reason: 'Review patch before applying',
    runtimeId: 'approval-consumer-contract-runtime',
    turnId: 'approval-consumer-contract-turn',
  },
]);

const decidedAppRuntimeReadService: IAppRuntimeReadService = {
  ...appRuntimeReadService,
  async listCodingSessionEvents() {
    return [eventFixture, approvalDecisionEventFixture];
  },
};

const decidedApprovals = await projectionModule.loadCodingSessionApprovalState(
  decidedAppRuntimeReadService as Pick<
    IAppRuntimeReadService,
    'getCodingSession' | 'listCodingSessionArtifacts' | 'listCodingSessionCheckpoints' | 'listCodingSessionEvents'
  >,
  sessionId,
);

assert.deepEqual(
  decidedApprovals,
  [],
  'approval decision lifecycle events must settle pending approvals even if a stale checkpoint snapshot still says resumable.',
);

const permissionIdDecisionAppRuntimeReadService: IAppRuntimeReadService = {
  ...appRuntimeReadService,
  async listCodingSessionEvents() {
    return [eventFixture, permissionIdApprovalDecisionEventFixture];
  },
};

const permissionIdDecidedApprovals = await projectionModule.loadCodingSessionApprovalState(
  permissionIdDecisionAppRuntimeReadService as Pick<
    IAppRuntimeReadService,
    'getCodingSession' | 'listCodingSessionArtifacts' | 'listCodingSessionCheckpoints' | 'listCodingSessionEvents'
  >,
  sessionId,
);

assert.deepEqual(
  permissionIdDecidedApprovals,
  [],
  'canonical interactionEventId settlement must remove stale approval UI state.',
);

const unsafeLongApprovalAppRuntimeReadService: IAppRuntimeReadService = {
  ...appRuntimeReadService,
  async listCodingSessionCheckpoints() {
    return [unsafeLongCheckpointFixture];
  },
  async listCodingSessionEvents() {
    return [unsafeLongApprovalDecisionEventFixture];
  },
};

const unsafeLongApprovals = await projectionModule.loadCodingSessionApprovalState(
  unsafeLongApprovalAppRuntimeReadService as Pick<
    IAppRuntimeReadService,
    'getCodingSession' | 'listCodingSessionArtifacts' | 'listCodingSessionCheckpoints' | 'listCodingSessionEvents'
  >,
  sessionId,
);

assert.deepEqual(
  unsafeLongApprovals,
  [],
  'a legacy provider-only approval identifier must not create a replyable interaction.',
);

const approvalResult = await projectionModule.submitCodingSessionApprovalDecision(
  services.appRuntimeWriteService as Pick<IAppRuntimeWriteService, 'submitApprovalDecision'>,
  sessionId,
  'approval-consumer-contract-event',
  {
    decision: 'approved',
    reason: 'Looks safe',
  },
);

assert.deepEqual(observedApprovals, [
  {
    // The composed SDK receives the durable source-event id, never the provider id.
    approvalId: 'approval-consumer-contract-event',
    codingSessionId: sessionId,
    decision: 'approved',
    reason: 'Looks safe',
  },
]);
assert.deepEqual(approvalResult, approvalResultFixture);

restoreRuntimeEnv();
console.log('coding session approval consumer contract passed.');
