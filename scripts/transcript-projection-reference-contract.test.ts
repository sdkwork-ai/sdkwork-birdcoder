import assert from 'node:assert/strict';

import {
  composeAgentSessionTranscriptActivity,
  type AgentSessionItemView,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';
import { reconcileTranscriptProjectionReferences } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/transcriptProjection.ts';

const sessionId = 'session-projection-reference';
const turnId = 'turn-projection-reference';
const firstToolMessage: AgentSessionItemView = {
  content: 'Read the workspace metadata.',
  createdAt: '2026-07-29T00:00:00.000Z',
  id: 'tool-first',
  role: 'tool',
  sessionId,
  turnId,
};
const secondToolMessage: AgentSessionItemView = {
  content: 'Read the package metadata.',
  createdAt: '2026-07-29T00:00:01.000Z',
  id: 'tool-second',
  lifecycleEvents: [{
    detail: 'Reading package metadata.',
    id: 'tool-lifecycle',
    kind: 'started',
  }],
  role: 'tool',
  sessionId,
  turnId,
};
const firstStreamingTail: AgentSessionItemView = {
  content: 'x',
  createdAt: '2026-07-29T00:00:02.000Z',
  id: 'assistant-tail',
  role: 'assistant',
  sessionId,
  turnId,
};
const nextStreamingTail: AgentSessionItemView = {
  ...firstStreamingTail,
  content: 'xy',
};

const firstProjection = composeAgentSessionTranscriptActivity([
  firstToolMessage,
  secondToolMessage,
  firstStreamingTail,
]);
const nextProjection = composeAgentSessionTranscriptActivity([
  firstToolMessage,
  secondToolMessage,
  nextStreamingTail,
]);

assert.equal(firstProjection.length, 2, 'The fixture must fold contiguous tool activity.');
assert.equal(nextProjection.length, 2, 'Streaming must not alter activity folding.');
assert.notStrictEqual(
  firstProjection[0],
  nextProjection[0],
  'Raw activity composition must recreate the folded historical item so this test covers the reference-churn regression.',
);

const reconciledProjection = reconcileTranscriptProjectionReferences(
  firstProjection,
  nextProjection,
);
assert.strictEqual(
  reconciledProjection[0],
  firstProjection[0],
  'A semantically unchanged folded activity row must retain its committed object reference.',
);
assert.notStrictEqual(
  reconciledProjection[1],
  firstProjection[1],
  'A changed streaming tail must not retain its previous object reference.',
);
assert.equal(reconciledProjection[1]?.content, 'xy');
assert.deepEqual(
  reconciledProjection,
  nextProjection,
  'Reference reconciliation must not alter transcript projection semantics.',
);

const changedFoldedActivityProjection = composeAgentSessionTranscriptActivity([
  firstToolMessage,
  {
    ...secondToolMessage,
    lifecycleEvents: [{
      detail: 'Package metadata read.',
      id: 'tool-lifecycle',
      kind: 'completed',
    }],
  },
  nextStreamingTail,
]);
const reconciledChangedFoldedActivity = reconcileTranscriptProjectionReferences(
  reconciledProjection,
  changedFoldedActivityProjection,
);
assert.strictEqual(
  reconciledChangedFoldedActivity[0],
  changedFoldedActivityProjection[0],
  'A semantic change inside a folded activity group must replace the historical projection even when its row key is stable.',
);
assert.notStrictEqual(
  reconciledChangedFoldedActivity[0],
  reconciledProjection[0],
);

const prependedUserMessage: AgentSessionItemView = {
  content: 'Inspect the project.',
  createdAt: '2026-07-28T23:59:59.000Z',
  id: 'user-prepended',
  role: 'user',
  sessionId,
  turnId: 'turn-prepended',
};
const prependedProjection = composeAgentSessionTranscriptActivity([
  prependedUserMessage,
  firstToolMessage,
  secondToolMessage,
  nextStreamingTail,
]);
const reconciledPrependedProjection = reconcileTranscriptProjectionReferences(
  reconciledProjection,
  prependedProjection,
);
assert.strictEqual(reconciledPrependedProjection[0], prependedUserMessage);
assert.strictEqual(
  reconciledPrependedProjection[1],
  reconciledProjection[0],
  'A stable folded row must retain its committed reference when prepended history shifts its index.',
);
assert.strictEqual(
  reconciledPrependedProjection[2],
  reconciledProjection[1],
  'A stable tail must retain its committed reference when prepended history shifts its index.',
);

const semanticallyUnchangedProjection = composeAgentSessionTranscriptActivity([
  firstToolMessage,
  secondToolMessage,
  { ...nextStreamingTail },
]);
assert.strictEqual(
  reconcileTranscriptProjectionReferences(
    reconciledProjection,
    semanticallyUnchangedProjection,
  ),
  reconciledProjection,
  'A semantic no-op must preserve the complete committed projection array reference.',
);

const duplicateBase: AgentSessionItemView = {
  content: 'duplicate-a',
  createdAt: '2026-07-29T00:01:00.000Z',
  id: 'duplicate-id',
  role: 'assistant',
  sessionId,
  turnId: 'turn-duplicates',
};
const duplicateVariant: AgentSessionItemView = {
  ...duplicateBase,
  content: 'duplicate-b',
};
const duplicatePrevious = [duplicateBase, duplicateVariant];
const duplicateNext = [{ ...duplicateVariant }, { ...duplicateBase }];
const duplicateReconciled = reconcileTranscriptProjectionReferences(
  duplicatePrevious,
  duplicateNext,
);
assert.strictEqual(duplicateReconciled[0], duplicateVariant);
assert.strictEqual(duplicateReconciled[1], duplicateBase);
assert.notStrictEqual(
  duplicateReconciled[0],
  duplicateReconciled[1],
  'Duplicate keys must consume distinct equivalent candidates instead of reusing one prior row twice.',
);

const repeatedDuplicateNext = [{ ...duplicateBase }, { ...duplicateBase }];
const repeatedDuplicateReconciled = reconcileTranscriptProjectionReferences(
  [duplicateBase],
  repeatedDuplicateNext,
);
assert.strictEqual(repeatedDuplicateReconciled[0], duplicateBase);
assert.strictEqual(
  repeatedDuplicateReconciled[1],
  repeatedDuplicateNext[1],
  'One committed candidate must not be reused by a second semantically identical duplicate row.',
);

console.log('transcript projection reference contract passed.');
