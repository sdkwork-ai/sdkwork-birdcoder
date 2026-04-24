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
    ['queued-1', 'queued-2'],
    ['queued-3'],
  ),
  ['queued-1', 'queued-2', 'queued-3'],
  'failed sends must restore the dispatched queue ahead of any messages that were queued while the request was inflight',
);

assert.deepEqual(
  restoreQueuedMessagesAfterSendFailure([], ['queued-3']),
  ['queued-3'],
  'queue restoration should stay stable when there was no dispatched queue snapshot to restore',
);

console.log('chat composer recovery contract passed.');
