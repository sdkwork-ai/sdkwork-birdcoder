import assert from 'node:assert/strict';

import {
  resolveComposerInputAfterSendFailure,
  restoreQueuedAgentTurnInputsAfterSendFailure,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/agentTurnInputRecovery.ts';

assert.equal(
  resolveComposerInputAfterSendFailure('draft input', ''),
  'draft input',
  'failed sends must restore the previous composer draft when the composer is still empty',
);

assert.equal(
  resolveComposerInputAfterSendFailure('draft input', 'new draft'),
  'new draft',
  'failed sends must not overwrite a newer draft that the user typed while the request was inflight',
);

assert.deepEqual(
  restoreQueuedAgentTurnInputsAfterSendFailure(
    [
      { id: 'queued-agent-turn-input-1', text: 'queued-1' },
      { id: 'queued-agent-turn-input-2', text: 'queued-2' },
    ],
    [{ id: 'queued-agent-turn-input-3', text: 'queued-3' }],
  ),
  [
    { id: 'queued-agent-turn-input-1', text: 'queued-1' },
    { id: 'queued-agent-turn-input-2', text: 'queued-2' },
    { id: 'queued-agent-turn-input-3', text: 'queued-3' },
  ],
  'failed sends must restore dispatched inputs ahead of inputs queued while the request was inflight',
);

assert.deepEqual(
  restoreQueuedAgentTurnInputsAfterSendFailure(
    [],
    [{ id: 'queued-agent-turn-input-3', text: 'queued-3' }],
  ),
  [{ id: 'queued-agent-turn-input-3', text: 'queued-3' }],
  'queue restoration should stay stable when there was no dispatched input snapshot to restore',
);

assert.deepEqual(
  restoreQueuedAgentTurnInputsAfterSendFailure(
    [{ id: 'queued-agent-turn-input-1', text: 'repeat' }],
    [
      { id: 'queued-agent-turn-input-1', text: 'repeat' },
      { id: 'queued-agent-turn-input-2', text: 'repeat' },
    ],
  ),
  [
    { id: 'queued-agent-turn-input-1', text: 'repeat' },
    { id: 'queued-agent-turn-input-2', text: 'repeat' },
  ],
  'queue restoration must be idempotent by input identity while preserving duplicate text',
);

console.log('agent turn input recovery contract passed.');
