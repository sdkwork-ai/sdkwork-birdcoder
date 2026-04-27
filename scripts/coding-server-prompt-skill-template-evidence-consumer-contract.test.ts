import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { BirdCoderEngineCapabilityMatrix } from '@sdkwork/birdcoder-types';
import { createBirdCoderStorageProvider } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/dataKernel.ts';
import { createBirdCoderPromptSkillTemplateEvidenceRepositories } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/promptSkillTemplateEvidenceRepository.ts';
import { getBirdCoderSchemaMigrationDefinition } from '../packages/sdkwork-birdcoder-infrastructure/src/storage/providers.ts';
import { createProviderBackedBirdCoderCoreSessionProjectionStore } from '../packages/sdkwork-birdcoder-server/src/projectionRepository.ts';

const serverIndexPath = new URL(
  '../packages/sdkwork-birdcoder-server/src/index.ts',
  import.meta.url,
);
const serverIndexSource = fs.readFileSync(serverIndexPath, 'utf8');

assert.match(
  serverIndexSource,
  /export async function executeBirdCoderCoreSessionRun/u,
  'coding-server module must expose the canonical core-session execution entrypoint.',
);
assert.match(
  serverIndexSource,
  /export async function persistBirdCoderCoreSessionRunProjection/u,
  'coding-server module must expose the canonical core-session projection persistence entrypoint.',
);

const provider = createBirdCoderStorageProvider('sqlite');
await provider.open();
await provider.runMigrations([getBirdCoderSchemaMigrationDefinition('coding-server-kernel-v2')]);

const evidenceRepositories = createBirdCoderPromptSkillTemplateEvidenceRepositories({
  providerId: provider.providerId,
  storage: provider,
});

await Promise.all([
  evidenceRepositories.promptRuns.clear(),
  evidenceRepositories.promptEvaluations.clear(),
  evidenceRepositories.templateInstantiations.clear(),
]);

const store = createProviderBackedBirdCoderCoreSessionProjectionStore(
  'coding-session-evidence-consumer-contract',
  provider,
);

const capabilitySnapshot: BirdCoderEngineCapabilityMatrix = {
  chat: true,
  streaming: true,
  structuredOutput: true,
  toolCalls: true,
  planning: true,
  patchArtifacts: true,
  commandArtifacts: true,
  todoArtifacts: true,
  ptyArtifacts: true,
  previewArtifacts: true,
  testArtifacts: true,
  approvalCheckpoints: true,
  sessionResume: true,
  remoteBridge: false,
  mcp: true,
};

const projection = {
  runtime: {
    id: 'runtime-evidence-consumer-contract',
    codingSessionId: 'coding-session-evidence-consumer-contract',
    hostMode: 'server',
    status: 'ready',
    engineId: 'codex',
    modelId: 'codex',
    nativeRef: {
      engineId: 'codex',
      transportKind: 'stdio',
      nativeSessionId: 'coding-session-evidence-consumer-contract',
      nativeTurnContainerId: 'turn-evidence-consumer-contract',
      metadata: {},
    },
    capabilitySnapshot,
    metadata: {},
    createdAt: '2026-04-12T11:00:00.000Z',
    updatedAt: '2026-04-12T11:00:09.000Z',
  },
  events: [
    {
      id: 'event-evidence-consumer-contract-1',
      codingSessionId: 'coding-session-evidence-consumer-contract',
      turnId: 'turn-evidence-consumer-contract',
      runtimeId: 'runtime-evidence-consumer-contract',
      kind: 'turn.completed',
      sequence: '1',
      payload: {
        runtimeStatus: 'ready',
      },
      createdAt: '2026-04-12T11:00:09.000Z',
    },
  ],
  artifacts: [
    {
      id: 'artifact-evidence-consumer-contract-1',
      codingSessionId: 'coding-session-evidence-consumer-contract',
      turnId: 'turn-evidence-consumer-contract',
      kind: 'transcript',
      status: 'sealed',
      title: 'Coding Server Transcript Artifact',
      blobRef: 'memory://artifact-evidence-consumer-contract-1',
      metadata: {},
      createdAt: '2026-04-12T11:00:09.000Z',
    },
  ],
  operation: {
    operationId: 'turn-evidence-consumer-contract:operation',
    status: 'succeeded',
    artifactRefs: ['artifact-evidence-consumer-contract-1'],
    streamUrl: '/api/core/v1/coding-sessions/coding-session-evidence-consumer-contract/events',
    streamKind: 'sse',
  },
} satisfies Parameters<typeof store.persistRunProjection>[0];

await store.persistRunProjection(projection);

const promptRunId = `prompt-run-${projection.operation.operationId}`;
const promptEvaluationId = `prompt-evaluation-${projection.operation.operationId}`;

const promptRun = await evidenceRepositories.promptRuns.findById(promptRunId);
assert.ok(promptRun, 'coding-server projection persistence should write prompt run evidence.');
assert.equal(promptRun?.projectId, projection.runtime.codingSessionId);
assert.equal(promptRun?.codingSessionId, projection.runtime.codingSessionId);
assert.equal(promptRun?.promptBundleId, `coding-server-${projection.runtime.engineId}-prompt-bundle`);
assert.equal(
  promptRun?.promptAssetVersionId,
  `coding-server-${projection.runtime.engineId}-${projection.runtime.modelId}-prompt-asset-version`,
);
assert.equal(promptRun?.status, 'completed');
assert.equal(
  promptRun?.inputSnapshotRef,
  `coding-session:${projection.runtime.codingSessionId}:turn:turn-evidence-consumer-contract:input`,
);
assert.equal(
  promptRun?.outputSnapshotRef,
  `coding-session:${projection.runtime.codingSessionId}:turn:turn-evidence-consumer-contract:output`,
);

const promptEvaluation = await evidenceRepositories.promptEvaluations.findById(promptEvaluationId);
assert.ok(
  promptEvaluation,
  'coding-server projection persistence should write prompt evaluation evidence.',
);
assert.equal(promptEvaluation?.promptRunId, promptRunId);
assert.equal(promptEvaluation?.evaluator, 'coding-server-projection-store');
assert.equal(promptEvaluation?.score, 100);
assert.equal(promptEvaluation?.status, 'completed');
assert.equal(promptEvaluation?.summary.operationId, projection.operation.operationId);
assert.equal(promptEvaluation?.summary.eventCount, projection.events.length);
assert.equal(promptEvaluation?.summary.artifactCount, projection.artifacts.length);
assert.equal(promptEvaluation?.summary.engineId, projection.runtime.engineId);
assert.equal(promptEvaluation?.summary.modelId, projection.runtime.modelId);

console.log('coding server prompt skill template evidence consumer contract passed.');
