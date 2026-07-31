import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { AgentTurnInputQueueEntry } from '@sdkwork/birdcoder-pc-core/sdk/agents-app';

import {
  clearWorkbenchAgentTurnInputQueueMemory,
  MAX_QUEUED_AGENT_TURN_INPUT_SCOPES,
  MAX_QUEUED_AGENT_TURN_INPUTS_PER_SCOPE,
  removeWorkbenchQueuedAgentTurnInputProjection,
  setWorkbenchQueuedAgentTurnInputs,
  upsertWorkbenchQueuedAgentTurnInput,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/chat/agentTurnInputQueueStore.ts';

const requestedAt = '2026-07-31T00:00:00.000Z';
const agentId = 'agent.code-engine.codex';
const sessionId = 'session.queue-contract';

function createQueueEntry(
  queueEntryId: string,
  overrides: Partial<AgentTurnInputQueueEntry> = {},
): AgentTurnInputQueueEntry {
  return {
    accessModeId: 'full_access',
    agentId,
    attachmentNames: [],
    claimExpiresAt: null,
    claimOwner: null,
    claimedAt: null,
    clientRequestId: `${queueEntryId}.request`,
    content: `content:${queueEntryId}`,
    contentType: 'text/plain',
    createdAt: requestedAt,
    displayText: `display:${queueEntryId}`,
    driveRefs: [],
    errorCode: null,
    errorDetail: null,
    failedAt: null,
    fencingToken: '0',
    idempotencyKey: `${queueEntryId}.idempotency`,
    payloadHash: `sha256:${queueEntryId}`,
    position: '1',
    queueEntryId,
    requestedModelId: 'gpt-5',
    runtimeBindingId: 'runtime-binding.queue-contract',
    sessionId,
    status: 'queued',
    turnMode: 'interactive',
    updatedAt: requestedAt,
    version: '0',
    ...overrides,
  };
}

async function readSource(path: string): Promise<string> {
  return readFile(resolve(path), 'utf8');
}

const [
  queueProjectionSource,
  queueHookSource,
  universalChatSource,
  sessionServiceSource,
  authContextSource,
  workbenchIndexSource,
] = await Promise.all([
  readSource('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/chat/agentTurnInputQueueStore.ts'),
  readSource('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useAgentTurnInputQueue.ts'),
  readSource('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx'),
  readSource('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/agentsSessionService.ts'),
  readSource('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/context/AuthContext.ts'),
  readSource('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/index.ts'),
]);

clearWorkbenchAgentTurnInputQueueMemory();

const second = createQueueEntry('queue-entry.second', { position: '2' });
const first = createQueueEntry('queue-entry.first', { position: '1' });
const otherSession = createQueueEntry('queue-entry.other-session', {
  position: '1',
  sessionId: 'session.other',
});

const initialProjection = setWorkbenchQueuedAgentTurnInputs(sessionId, [second]);
assert.deepEqual(initialProjection.map((entry) => entry.queueEntryId), ['queue-entry.second']);
assert.deepEqual(
  setWorkbenchQueuedAgentTurnInputs('session.other', [otherSession]).map(
    (entry) => entry.queueEntryId,
  ),
  ['queue-entry.other-session'],
  'remote projections must remain isolated by the full Session scope key.',
);

const orderedProjection = upsertWorkbenchQueuedAgentTurnInput(sessionId, first);
assert.deepEqual(
  orderedProjection.map((entry) => entry.queueEntryId),
  ['queue-entry.first', 'queue-entry.second'],
  'the disposable projection must preserve the authoritative numeric FIFO position.',
);
assert.ok(Object.isFrozen(orderedProjection));
assert.ok(Object.isFrozen(orderedProjection[0]));
assert.ok(Object.isFrozen(orderedProjection[0]?.attachmentNames));
assert.ok(Object.isFrozen(orderedProjection[0]?.driveRefs));

const executingFirst = createQueueEntry('queue-entry.first', {
  claimExpiresAt: '2026-07-31T00:00:30.000Z',
  claimOwner: 'birdcoder-window-a',
  claimedAt: requestedAt,
  fencingToken: '1',
  position: '1',
  status: 'executing',
  version: '1',
});
assert.match(
  upsertWorkbenchQueuedAgentTurnInput(sessionId, executingFirst)[0]?.status ?? '',
  /^executing$/u,
  'an authoritative version update must replace the same stable queue entry identity.',
);
assert.deepEqual(
  removeWorkbenchQueuedAgentTurnInputProjection(
    sessionId,
    executingFirst.queueEntryId,
  ).map((entry) => entry.queueEntryId),
  ['queue-entry.second'],
  'projection removal must target the stable server queueEntryId, never message text.',
);

assert.throws(
  () => setWorkbenchQueuedAgentTurnInputs(sessionId, [first, first]),
  /invalid or duplicate entry ID/u,
  'duplicate stable IDs must be rejected before they can produce ambiguous mutations or React keys.',
);
assert.throws(
  () => setWorkbenchQueuedAgentTurnInputs(
    sessionId,
    Array.from(
      { length: MAX_QUEUED_AGENT_TURN_INPUTS_PER_SCOPE + 1 },
      (_, index) => createQueueEntry(`queue-entry.capacity-${index}`, { position: `${index + 1}` }),
    ),
  ),
  /at most 32 entries/u,
  'the client projection must enforce the same bounded Session capacity as the API.',
);
assert.throws(
  () => setWorkbenchQueuedAgentTurnInputs(sessionId, [
    createQueueEntry('queue-entry.memory-budget', { content: 'x'.repeat(4 * 1_048_576 + 1) }),
  ]),
  /Session memory budget/u,
  'untrusted remote projection content must not exceed the per-Session memory budget.',
);

clearWorkbenchAgentTurnInputQueueMemory();
for (let index = 0; index < MAX_QUEUED_AGENT_TURN_INPUT_SCOPES; index += 1) {
  setWorkbenchQueuedAgentTurnInputs(
    `session.scope-${index}`,
    [createQueueEntry(`queue-entry.scope-${index}`, { sessionId: `session.scope-${index}` })],
  );
}
assert.throws(
  () => setWorkbenchQueuedAgentTurnInputs(
    'session.scope-overflow',
    [createQueueEntry('queue-entry.scope-overflow', { sessionId: 'session.scope-overflow' })],
  ),
  /at most 32 Session scopes/u,
  'the process projection must remain bounded when many Session tabs are opened.',
);
clearWorkbenchAgentTurnInputQueueMemory();

assert.doesNotMatch(
  queueProjectionSource,
  /localStorage|sessionStorage|indexedDB/u,
  'the browser projection must not become a second persistence authority.',
);
assert.doesNotMatch(
  queueProjectionSource,
  /enqueueWorkbenchQueuedAgentTurnInput|dequeueWorkbenchQueuedAgentTurnInput|restoreWorkbenchQueuedAgentTurnInputsToFront/u,
  'removed memory-owned enqueue, dequeue, and restoration APIs must stay removed.',
);
assert.match(
  workbenchIndexSource,
  /export \* from '\.\/chat\/agentTurnInputQueueStore\.ts';[\s\S]*export \* from '\.\/hooks\/useAgentTurnInputQueue\.ts';/u,
  'the queue controller and projection must be exposed through the Workbench package boundary.',
);

assert.match(
  queueHookSource,
  /listTurnInputQueueEntries\([\s\S]*replaceQueuedTurnInputProjection\(page\.items\)[\s\S]*setHydratedIdentityKey/u,
  'mount and restart recovery must hydrate the queue from the authoritative service before processing.',
);
assert.match(
  queueHookSource,
  /generationRef\.current \+= 1;[\s\S]*controller\.abort\(\)/u,
  'Session identity changes must invalidate and abort stale hydration work.',
);
assert.match(
  queueHookSource,
  /generation !== generationRef\.current/gmu,
  'stale processing generations must be fenced from a newly selected Session.',
);
assert.match(
  queueHookSource,
  /claimNextTurnInputQueueEntry\([\s\S]*claimOwner: claimOwnerRef\.current[\s\S]*leaseSeconds: QUEUE_CLAIM_LEASE_SECONDS/u,
  'each window must compete through an atomic server claim with a bounded lease.',
);
assert.match(
  queueHookSource,
  /claim\.outcome === 'blocked'[\s\S]*claim\.outcome === 'busy' \|\| claim\.outcome === 'active_turn'/u,
  'failed heads and authoritative active Turns must block unsafe queue advancement.',
);
assert.match(
  queueHookSource,
  /dispatchOutcome === 'rejected'[\s\S]*failTurnInputQueueEntry\([\s\S]*claimToken: claim\.claimToken[\s\S]*fencingToken: claim\.entry\.fencingToken/u,
  'rejected delivery must transition through the server using claim and fencing tokens.',
);
assert.match(
  queueHookSource,
  /dispatchOutcome === 'accepted_uncertain'[\s\S]*scheduleReconciliation\(\)/u,
  'uncertain acceptance must reconcile instead of duplicating a possibly accepted Turn.',
);
assert.match(
  queueHookSource,
  /QUEUE_PROCESSING_ITERATION_LIMIT = 34[\s\S]*for \(let iteration = 0; iteration < QUEUE_PROCESSING_ITERATION_LIMIT/u,
  'queue draining must be bounded per processing pass to protect the UI thread and service.',
);
assert.match(
  queueHookSource,
  /BroadcastChannel\(QUEUE_BROADCAST_CHANNEL\)[\s\S]*event\.data\.sourceId !== sourceIdRef\.current[\s\S]*void hydrate\(\)/u,
  'other application windows must refresh their disposable projection after mutations.',
);
assert.match(
  queueHookSource,
  /addEventListener\('focus', refresh\)[\s\S]*addEventListener\('online', refresh\)[\s\S]*addEventListener\('visibilitychange', refreshWhenVisible\)/u,
  'focus, reconnect, and visibility recovery must converge on server state.',
);
assert.match(
  queueHookSource,
  /if \(mutationRef\.current\)[\s\S]*mutation is already in progress/u,
  'overlapping user mutations must be rejected instead of racing optimistic versions.',
);
for (const operation of [
  'createTurnInputQueueEntry',
  'clearTurnInputQueueEntries',
  'reorderTurnInputQueueEntries',
  'updateTurnInputQueueEntry',
  'removeTurnInputQueueEntry',
  'retryTurnInputQueueEntry',
] as const) {
  assert.match(queueHookSource, new RegExp(`agentSessionService\\.${operation}\\(`, 'u'));
}

assert.match(
  sessionServiceSource,
  /this\.client\.ai\.agents\.turnInputQueueEntries\.list\(/u,
  'the infrastructure adapter must consume the generated Agents App SDK queue family.',
);
for (const generatedMethod of [
  'create',
  'clear',
  'reorder',
  'claimNext',
  'update',
  'delete',
  'fail',
  'retry',
] as const) {
  assert.match(
    sessionServiceSource,
    new RegExp(`this\\.client\\.ai\\.agents\\.turnInputQueueEntries\\.${generatedMethod}\\(`, 'u'),
    `the ${generatedMethod} queue operation must remain on the generated SDK family.`,
  );
}
assert.doesNotMatch(
  sessionServiceSource.slice(
    sessionServiceSource.indexOf('async listTurnInputQueueEntries('),
    sessionServiceSource.indexOf('async submitTurn('),
  ),
  /fetch\(|axios\.|Authorization|Access-Token/u,
  'queue integration must not bypass the generated SDK with raw transport or manual auth.',
);

assert.match(
  universalChatSource,
  /const shouldQueueComposerSubmission =\s*isComposerTurnBlocked \|\| agentTurnInputQueue\.length > 0;/u,
  'typed input must queue while a Turn is active or an earlier queue entry still owns FIFO priority.',
);
assert.match(
  universalChatSource,
  /if \(shouldQueueComposerSubmission\)[\s\S]*await enqueueAgentTurnInput\(\{[\s\S]*clearInputValue\(\);[\s\S]*clearComposerAttachments\(\);/u,
  'the composer must clear visible input only after the durable create operation succeeds.',
);
for (const queueAction of [
  'clearAgentTurnInputQueue',
  'updateAgentTurnInput',
  'reorderAgentTurnInputs',
  'retryAgentTurnInput',
  'removeAgentTurnInput',
] as const) {
  assert.match(
    universalChatSource,
    new RegExp(`${queueAction}\\(`, 'u'),
    `UnifiedChat must expose the ${queueAction} lifecycle action.`,
  );
}
assert.match(
  universalChatSource,
  /queuedAgentTurnInput\.status === 'executing'[\s\S]*removeAgentTurnInput\(queuedAgentTurnInput\)/u,
  'executing entries must keep destructive removal disabled while queued and failed entries remain removable.',
);

assert.match(
  authContextSource,
  /function clearAuthenticatedConversationMemory\(\): void \{[\s\S]*clearWorkbenchAgentTurnInputQueueMemory\(\);/u,
  'logout must clear the user-scoped in-memory projection.',
);
assert.match(
  authContextSource,
  /const logout = useCallback\(async \(\) => \{[\s\S]*try \{[\s\S]*await authService\.logout\(\);[\s\S]*\} finally \{[\s\S]*clearAuthenticatedConversationMemory\(\);/u,
  'projection cleanup must run even when remote logout fails.',
);
assert.doesNotMatch(
  authContextSource,
  /clearTurnInputQueueEntries/u,
  'logout must never delete the durable server queue that is required after application restart.',
);

console.log('agent turn input queue contract passed.');
