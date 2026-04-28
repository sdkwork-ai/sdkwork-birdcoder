import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  clearWorkbenchChatQueuedMessages,
  canFlushWorkbenchChatQueuedMessages,
  createWorkbenchChatQueueFlushGateState,
  dequeueWorkbenchChatQueuedMessage,
  enqueueWorkbenchChatQueuedMessage,
  markWorkbenchChatQueuedTurnDispatchStarted,
  observeWorkbenchChatQueuedTurnBusyState,
  peekWorkbenchChatQueuedMessages,
  restoreWorkbenchChatQueuedMessagesToFront,
  settleWorkbenchChatQueuedTurnDispatch,
  setWorkbenchChatQueuedMessages,
} from '../packages/sdkwork-birdcoder-commons/src/chat/messageQueueStore.ts';

const universalChatSource = await readFile(
  resolve('packages/sdkwork-birdcoder-ui/src/components/UniversalChat.tsx'),
  'utf8',
);
const handleSendStartIndex = universalChatSource.indexOf('const handleSend = async');
const handleSendEndIndex = universalChatSource.indexOf('useEffect(() => {', handleSendStartIndex);
const universalChatHandleSendSource = universalChatSource.slice(
  handleSendStartIndex,
  handleSendEndIndex,
);
const markQueuedTurnDispatchStartedStartIndex = universalChatSource.indexOf(
  'const markQueuedTurnDispatchStarted = useCallback',
);
const markQueuedTurnDispatchStartedEndIndex = universalChatSource.indexOf(
  'const syncHistoryPrompts',
  markQueuedTurnDispatchStartedStartIndex,
);
const markQueuedTurnDispatchStartedSource =
  markQueuedTurnDispatchStartedStartIndex >= 0 &&
  markQueuedTurnDispatchStartedEndIndex > markQueuedTurnDispatchStartedStartIndex
    ? universalChatSource.slice(
        markQueuedTurnDispatchStartedStartIndex,
        markQueuedTurnDispatchStartedEndIndex,
      )
    : '';
const busyObserverEffectStartIndex = universalChatSource.indexOf(
  'useEffect(() => {\n    setQueuedTurnFlushGate((previousState) =>\n      observeWorkbenchChatQueuedTurnBusyState',
);
const busyObserverEffectEndIndex = universalChatSource.indexOf(
  'useEffect(() => {\n    setIsQueueExpanded(false);',
  busyObserverEffectStartIndex,
);
const busyObserverEffectSource =
  busyObserverEffectStartIndex >= 0 &&
  busyObserverEffectEndIndex > busyObserverEffectStartIndex
    ? universalChatSource.slice(busyObserverEffectStartIndex, busyObserverEffectEndIndex)
    : '';
const submitPendingUserQuestionAnswerStartIndex = universalChatSource.indexOf(
  'const submitPendingUserQuestionAnswer = useCallback',
);
const submitPendingApprovalDecisionStartIndex = universalChatSource.indexOf(
  'const submitPendingApprovalDecision = useCallback',
);
const submitPendingUserQuestionAnswerSource =
  submitPendingUserQuestionAnswerStartIndex >= 0 &&
  submitPendingApprovalDecisionStartIndex > submitPendingUserQuestionAnswerStartIndex
    ? universalChatSource.slice(
        submitPendingUserQuestionAnswerStartIndex,
        submitPendingApprovalDecisionStartIndex,
      )
    : '';
const handleSubmitPendingApprovalDecisionStartIndex = universalChatSource.indexOf(
  'const handleSubmitPendingApprovalDecision = useCallback',
);
const submitPendingApprovalDecisionSource =
  submitPendingApprovalDecisionStartIndex >= 0 &&
  handleSubmitPendingApprovalDecisionStartIndex > submitPendingApprovalDecisionStartIndex
    ? universalChatSource.slice(
        submitPendingApprovalDecisionStartIndex,
        handleSubmitPendingApprovalDecisionStartIndex,
      )
    : '';
const commonsIndexSource = await readFile(
  resolve('packages/sdkwork-birdcoder-commons/src/index.ts'),
  'utf8',
);

clearWorkbenchChatQueuedMessages('workspace-a/project-a/session-a');
clearWorkbenchChatQueuedMessages('workspace-b/project-b/session-a');
clearWorkbenchChatQueuedMessages('workspace-a/project-a/session-b');

enqueueWorkbenchChatQueuedMessage('workspace-a/project-a/session-a', 'first');
enqueueWorkbenchChatQueuedMessage('workspace-a/project-a/session-a', 'second');
enqueueWorkbenchChatQueuedMessage('workspace-b/project-b/session-a', 'other-scope');

assert.deepEqual(
  peekWorkbenchChatQueuedMessages('workspace-a/project-a/session-a').map((message) => message.text),
  ['first', 'second'],
  'queued messages must stay FIFO within a session scope.',
);

assert.deepEqual(
  peekWorkbenchChatQueuedMessages('workspace-b/project-b/session-a').map((message) => message.text),
  ['other-scope'],
  'queued messages must be isolated by the full session scope, not just the raw session id.',
);

assert.equal(
  dequeueWorkbenchChatQueuedMessage('workspace-a/project-a/session-a')?.text,
  'first',
  'queued message dequeue must remove exactly the oldest item.',
);

assert.deepEqual(
  peekWorkbenchChatQueuedMessages('workspace-a/project-a/session-a').map((message) => message.text),
  ['second'],
  'dequeue must leave later queued messages in place.',
);

setWorkbenchChatQueuedMessages('workspace-a/project-a/session-b', [
  { id: 'queued-message-third', text: 'third' },
]);
restoreWorkbenchChatQueuedMessagesToFront(
  'workspace-a/project-a/session-b',
  [
    { id: 'queued-message-failed-first', text: 'failed-first' },
    { id: 'queued-message-failed-second', text: 'failed-second' },
  ],
);

assert.deepEqual(
  peekWorkbenchChatQueuedMessages('workspace-a/project-a/session-b').map((message) => message.text),
  ['failed-first', 'failed-second', 'third'],
  'failed queued dispatches must be restored to the front without dropping newer queued input.',
);

restoreWorkbenchChatQueuedMessagesToFront(
  'workspace-a/project-a/session-b',
  [{ id: 'queued-message-failed-first', text: 'failed-first' }],
);

assert.deepEqual(
  peekWorkbenchChatQueuedMessages('workspace-a/project-a/session-b').map((message) => message.text),
  ['failed-first', 'failed-second', 'third'],
  'failed queued dispatch restoration must be idempotent by message identity so repeated recovery does not create duplicate React keys.',
);

clearWorkbenchChatQueuedMessages('workspace-a/project-a/session-duplicate-text');
const repeatedQueueAfterFirstEnqueue = enqueueWorkbenchChatQueuedMessage(
  'workspace-a/project-a/session-duplicate-text',
  'repeat',
);
const repeatedQueueAfterSecondEnqueue = enqueueWorkbenchChatQueuedMessage(
  'workspace-a/project-a/session-duplicate-text',
  'repeat',
);
assert.notEqual(
  repeatedQueueAfterFirstEnqueue[0]?.id,
  repeatedQueueAfterSecondEnqueue[1]?.id,
  'separately queued duplicate text must receive distinct stable identities.',
);
const failedRepeatedMessage = dequeueWorkbenchChatQueuedMessage(
  'workspace-a/project-a/session-duplicate-text',
);
restoreWorkbenchChatQueuedMessagesToFront(
  'workspace-a/project-a/session-duplicate-text',
  failedRepeatedMessage ? [failedRepeatedMessage] : [],
);
assert.deepEqual(
  peekWorkbenchChatQueuedMessages('workspace-a/project-a/session-duplicate-text').map(
    (message) => message.text,
  ),
  ['repeat', 'repeat'],
  'identity-based restoration must preserve intentionally duplicated queued text.',
);
assert.equal(
  new Set(
    peekWorkbenchChatQueuedMessages('workspace-a/project-a/session-duplicate-text').map(
      (message) => message.id,
    ),
  ).size,
  2,
  'identity-based queued messages must keep duplicate text renderable with unique React keys.',
);

let flushGateState = createWorkbenchChatQueueFlushGateState();
assert.equal(
  canFlushWorkbenchChatQueuedMessages(flushGateState, {
    disabled: false,
    editingQueueIndex: -1,
    isActive: true,
    isComposerBusy: false,
    isQueueExpanded: false,
    queueLength: 1,
  }),
  true,
  'queued flush gate must allow flushing while the active composer is idle and no post-dispatch turn is pending.',
);

flushGateState = markWorkbenchChatQueuedTurnDispatchStarted(flushGateState, false);
assert.equal(
  canFlushWorkbenchChatQueuedMessages(flushGateState, {
    disabled: false,
    editingQueueIndex: -1,
    isActive: true,
    isComposerBusy: false,
    isQueueExpanded: false,
    queueLength: 1,
  }),
  false,
  'queued flush gate must block the next queued dispatch immediately after turn creation even before runtimeStatus renders busy.',
);

flushGateState = observeWorkbenchChatQueuedTurnBusyState(flushGateState, true);
assert.equal(
  canFlushWorkbenchChatQueuedMessages(flushGateState, {
    disabled: false,
    editingQueueIndex: -1,
    isActive: true,
    isComposerBusy: true,
    isQueueExpanded: false,
    queueLength: 1,
  }),
  false,
  'queued flush gate must keep blocking while the engine is streaming.',
);

flushGateState = observeWorkbenchChatQueuedTurnBusyState(flushGateState, false);
assert.equal(
  canFlushWorkbenchChatQueuedMessages(flushGateState, {
    disabled: false,
    editingQueueIndex: -1,
    isActive: true,
    isComposerBusy: false,
    isQueueExpanded: false,
    queueLength: 1,
  }),
  true,
  'queued flush gate must reopen only after a busy-to-idle runtime transition is observed.',
);

flushGateState = createWorkbenchChatQueueFlushGateState();
flushGateState = markWorkbenchChatQueuedTurnDispatchStarted(flushGateState, true);
flushGateState = observeWorkbenchChatQueuedTurnBusyState(flushGateState, false);
assert.equal(
  canFlushWorkbenchChatQueuedMessages(flushGateState, {
    disabled: false,
    editingQueueIndex: -1,
    isActive: true,
    isComposerBusy: false,
    isQueueExpanded: false,
    queueLength: 1,
  }),
  true,
  'queued flush gate must reopen after the local dispatch busy state settles even when provider runtime busy was never observed.',
);

flushGateState = createWorkbenchChatQueueFlushGateState();
flushGateState = markWorkbenchChatQueuedTurnDispatchStarted(flushGateState, false);
flushGateState = settleWorkbenchChatQueuedTurnDispatch(flushGateState);
assert.equal(
  canFlushWorkbenchChatQueuedMessages(flushGateState, {
    disabled: false,
    editingQueueIndex: -1,
    isActive: true,
    isComposerBusy: false,
    isQueueExpanded: false,
    queueLength: 1,
  }),
  true,
  'queued flush gate must have an explicit settle path so a batched send that never renders busy cannot leave "checking send message" stuck forever.',
);

assert.match(
  commonsIndexSource,
  /export \* from '\.\/chat\/messageQueueStore\.ts';/,
  'commons must export the canonical workbench queued-message store.',
);

assert.doesNotMatch(
  universalChatSource,
  /const \[messageQueue,\s*setMessageQueue\] = useState<string\[\]>\(\[\]\);/,
  'UniversalChat must not keep queued messages in component-local state because queues must survive rerenders and stay isolated by session scope.',
);

assert.match(
  universalChatSource,
  /useWorkbenchChatMessageQueue\(normalizedQueueScopeKey\)/,
  'UniversalChat must bind queued messages to the canonical session-scoped queue store.',
);

assert.match(
  universalChatSource,
  /dequeueQueuedMessage\(\)/,
  'UniversalChat must atomically dequeue a single queued message when it starts an automatic queued dispatch.',
);

assert.match(
  universalChatSource,
  /void dispatchQueuedMessage\(nextQueuedMessage\);/,
  'UniversalChat must automatically flush the next queued message when the active session becomes idle.',
);

assert.match(
  markQueuedTurnDispatchStartedSource,
  /isDispatchingMessageRef\.current/,
  'UniversalChat must close the queued-message flush gate using the local dispatch busy state as well as provider runtime busy so queues cannot deadlock when provider busy is not observed.',
);

assert.match(
  markQueuedTurnDispatchStartedSource,
  /markWorkbenchChatQueuedTurnDispatchStarted\([\s\S]*isTurnDispatchBusy[\s\S]*\)/,
  'UniversalChat must pass the resolved dispatch busy signal into the queued-message flush gate.',
);

assert.match(
  busyObserverEffectSource,
  /observeWorkbenchChatQueuedTurnBusyState\([\s\S]*isComposerTurnBlocked[\s\S]*\)/,
  'UniversalChat must observe full turn-blocked transitions before allowing the next queued turn to flush.',
);

assert.match(
  universalChatSource,
  /settleWorkbenchChatQueuedTurnDispatch/,
  'UniversalChat must use an explicit queued-turn settlement path for sends that complete before React renders a busy transition.',
);

assert.match(
  submitPendingUserQuestionAnswerSource,
  /await Promise\.resolve\(onSubmitUserQuestionAnswer\(questionId,\s*request\)\);[\s\S]*markQueuedTurnDispatchStarted\(\);[\s\S]*didMarkQueuedTurnDispatch\s*=\s*true;[\s\S]*finally \{[\s\S]*finishPendingInteractionSubmission\(interactionId\);[\s\S]*if \(didMarkQueuedTurnDispatch\) \{[\s\S]*scheduleQueuedTurnDispatchSettlementCheck\(\);/s,
  'Submitting a pending user-question answer must close the same queued-turn settlement gate as normal sends so queued follow-ups wait for the resumed turn to settle.',
);

assert.match(
  submitPendingApprovalDecisionSource,
  /await Promise\.resolve\(onSubmitApprovalDecision\(approvalId,\s*request\)\);[\s\S]*markQueuedTurnDispatchStarted\(\);[\s\S]*didMarkQueuedTurnDispatch\s*=\s*true;[\s\S]*finally \{[\s\S]*finishPendingInteractionSubmission\(interactionId\);[\s\S]*if \(didMarkQueuedTurnDispatch\) \{[\s\S]*scheduleQueuedTurnDispatchSettlementCheck\(\);/s,
  'Submitting a pending approval decision must close the same queued-turn settlement gate as normal sends so queued follow-ups wait for the resumed turn to settle.',
);

assert.match(
  universalChatSource,
  /canFlushWorkbenchChatQueuedMessages\(/,
  'UniversalChat must use the canonical flush-gate predicate instead of ad hoc queue flushing conditions.',
);

assert.doesNotMatch(
  universalChatSource,
  /const fullText = \[\.\.\.messageQueue,\s*currentInput\]\.filter\(Boolean\)\.join\('\\n\\n'\);/,
  'UniversalChat must not collapse multiple queued messages and the current draft into one turn.',
);

assert.doesNotMatch(
  universalChatSource,
  /messageQueue\.map\(\(msg, idx\)[\s\S]*key=\{idx\}/,
  'UniversalChat must not render queued messages with array-index keys because recovery/reorder operations require stable queue item identity.',
);

assert.match(
  universalChatSource,
  /messageQueue\.map\(\(queuedMessage, idx\)[\s\S]*key=\{queuedMessage\.id\}/,
  'UniversalChat must render queued messages with the canonical queued-message identity.',
);

assert.match(
  universalChatSource,
  /\(\(isComposerTurnBlocked \|\| isAwaitingQueuedTurnSettlement\) \? canQueueTypedMessage : canSendQueuedOrTypedMessage\)/,
  'UniversalChat send button must allow typed messages to enter the queue while the active turn is blocked.',
);

assert.match(
  universalChatHandleSendSource,
  /canFlushQueuedMessageFromUserAction\s*=\s*canFlushWorkbenchChatQueuedMessages\(\s*queuedTurnFlushGateRef\.current,\s*\{[\s\S]*queueLength:\s*messageQueue\.length,[\s\S]*\}\s*,?\s*\)/,
  'Manual send actions must evaluate the same queued-message flush gate as automatic flushes before dispatching a queued turn.',
);

assert.match(
  universalChatHandleSendSource,
  /if \(!canFlushQueuedMessageFromUserAction\) \{\s*return;\s*\}[\s\S]*const nextQueuedMessage = dequeueQueuedMessage\(\);/,
  'Manual send actions must not dequeue queued messages while the post-dispatch turn-settlement gate is closed.',
);

assert.match(
  universalChatHandleSendSource,
  /isAwaitingQueuedTurnSettlement\s*=\s*queuedTurnFlushGateRef\.current\.awaitingTurnSettlement[\s\S]*if \(isComposerTurnBlocked \|\| isAwaitingQueuedTurnSettlement\) \{[\s\S]*enqueueQueuedMessage\(currentInput\);/,
  'Manual typed sends must enter the queue while a just-created turn is waiting for runtime busy observation.',
);

assert.match(
  universalChatSource,
  /const isAwaitingQueuedTurnSettlement =\s*queuedTurnFlushGateRef\.current\.awaitingTurnSettlement;[\s\S]*const canSubmitPendingUserQuestionAnswer/s,
  'UniversalChat composer affordances must read the queued-turn settlement gate before deriving send/queue button state.',
);

assert.match(
  universalChatSource,
  /const canQueueTypedMessage =[\s\S]*\(isBusy \|\| isAwaitingQueuedTurnSettlement\)[\s\S]*!hasPendingUserQuestionReplyTarget[\s\S]*hasTypedComposerInput;/,
  'UniversalChat must show queue affordances while a just-created turn is awaiting runtime busy observation, even if runtimeStatus has not rendered busy yet.',
);

assert.match(
  universalChatSource,
  /\(\(isComposerTurnBlocked \|\| isAwaitingQueuedTurnSettlement\) \? canQueueTypedMessage : canSendQueuedOrTypedMessage\)/,
  'UniversalChat send button enablement must use the same post-dispatch settlement gate as handleSend so the button does not advertise direct send while clicks will enqueue.',
);

assert.match(
  universalChatSource,
  /setInputValue\(\(previousInputValue\) =>\s*resolveComposerInputAfterSendFailure\(submittedTextSnapshot,\s*previousInputValue\),?\s*\)/,
  'Manual send failure recovery must restore the submitted draft without clobbering newer input.',
);

assert.match(
  universalChatSource,
  /catch \(error\) \{[\s\S]*restoreQueuedMessagesToFront\(\[submittedQueuedMessage\]\);[\s\S]*t\('chat\.sendMessageFailed'\)/,
  'Queued auto-flush failure recovery must restore the dispatched queued message to the front of the queue.',
);

console.log('universal chat queued message standard contract passed.');
