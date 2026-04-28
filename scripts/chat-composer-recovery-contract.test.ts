import assert from 'node:assert/strict';

import {
  resolveComposerInputAfterSendFailure,
  restoreQueuedMessagesAfterSendFailure,
} from '../packages/sdkwork-birdcoder-ui/src/components/chatComposerRecovery.ts';

assert.equal(
  resolveComposerInputAfterSendFailure('draft message', ''),
  'draft message',
  'failed sends must restore the previous composer draft when the composer is still empty',
);

assert.equal(
  resolveComposerInputAfterSendFailure('draft message', 'new draft'),
  'new draft',
  'failed sends must not overwrite a newer draft that the user typed while the request was inflight',
);

assert.deepEqual(
  restoreQueuedMessagesAfterSendFailure(
    [
      { id: 'queued-message-1', text: 'queued-1' },
      { id: 'queued-message-2', text: 'queued-2' },
    ],
    [{ id: 'queued-message-3', text: 'queued-3' }],
  ),
  [
    { id: 'queued-message-1', text: 'queued-1' },
    { id: 'queued-message-2', text: 'queued-2' },
    { id: 'queued-message-3', text: 'queued-3' },
  ],
  'failed sends must restore the dispatched queue ahead of any messages that were queued while the request was inflight',
);

assert.deepEqual(
  restoreQueuedMessagesAfterSendFailure([], [{ id: 'queued-message-3', text: 'queued-3' }]),
  [{ id: 'queued-message-3', text: 'queued-3' }],
  'queue restoration should stay stable when there was no dispatched queue snapshot to restore',
);

assert.deepEqual(
  restoreQueuedMessagesAfterSendFailure(
    [{ id: 'queued-message-1', text: 'repeat' }],
    [
      { id: 'queued-message-1', text: 'repeat' },
      { id: 'queued-message-2', text: 'repeat' },
    ],
  ),
  [
    { id: 'queued-message-1', text: 'repeat' },
    { id: 'queued-message-2', text: 'repeat' },
  ],
  'queue restoration must be idempotent by message identity while preserving separately queued duplicate text',
);

console.log('chat composer recovery contract passed.');
