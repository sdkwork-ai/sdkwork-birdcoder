import assert from 'node:assert/strict';

import { listWorkbenchCliEngines } from '../packages/sdkwork-birdcoder-commons/src/workbench/kernel.ts';
import {
  BIRDCODER_CODING_SESSION_EVENT_KINDS,
  BIRDCODER_CODING_SESSION_RUNTIME_STATUSES,
  type BirdCoderCodingSessionCheckpoint,
} from '../packages/sdkwork-birdcoder-types/src/coding-session.ts';
import { getBirdCoderEntityDefinition } from '../packages/sdkwork-birdcoder-types/src/data.ts';

assert.equal(BIRDCODER_CODING_SESSION_RUNTIME_STATUSES.includes('awaiting_approval'), true);
assert.equal(BIRDCODER_CODING_SESSION_RUNTIME_STATUSES.includes('failed'), true);
assert.equal(BIRDCODER_CODING_SESSION_RUNTIME_STATUSES.includes('terminated'), true);
assert.equal(BIRDCODER_CODING_SESSION_EVENT_KINDS.includes('approval.required'), true);
assert.equal(BIRDCODER_CODING_SESSION_EVENT_KINDS.includes('turn.failed'), true);
assert.equal(BIRDCODER_CODING_SESSION_EVENT_KINDS.includes('operation.updated'), true);

const checkpointDefinition = getBirdCoderEntityDefinition('coding_session_checkpoint');
assert.equal(checkpointDefinition.tableName, 'coding_session_checkpoints');
assert.equal(
  checkpointDefinition.columns.some((column) => column.name === 'checkpoint_kind'),
  true,
  'coding_session_checkpoint must persist checkpoint kind for resume/recovery flows',
);
assert.equal(
  checkpointDefinition.columns.some((column) => column.name === 'state_json'),
  true,
  'coding_session_checkpoint must persist recovery state snapshots',
);

const sampleCheckpoint: BirdCoderCodingSessionCheckpoint = {
  id: 'checkpoint-1',
  codingSessionId: 'coding-session-1',
  runtimeId: 'runtime-1',
  checkpointKind: 'resume',
  resumable: true,
  state: {
    reason: 'approval-required',
  },
  createdAt: new Date().toISOString(),
};

assert.equal(sampleCheckpoint.checkpointKind, 'resume');
assert.equal(sampleCheckpoint.resumable, true);

for (const engine of listWorkbenchCliEngines()) {
  assert.equal(
    engine.descriptor.capabilityMatrix.approvalCheckpoints,
    true,
    `${engine.id} must advertise approval checkpoints`,
  );
  assert.equal(
    engine.descriptor.capabilityMatrix.sessionResume,
    true,
    `${engine.id} must advertise resumable sessions`,
  );
}

console.log('engine resume recovery contract passed.');
