import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  clearWorkbenchQueuedAgentTurnInputs,
  canFlushWorkbenchQueuedAgentTurnInputs,
  createWorkbenchAgentTurnInputQueueFlushGateState,
  dequeueWorkbenchQueuedAgentTurnInput,
  enqueueWorkbenchQueuedAgentTurnInput,
  markWorkbenchQueuedAgentTurnDispatchStarted,
  observeWorkbenchQueuedAgentTurnBusyState,
  peekWorkbenchQueuedAgentTurnInputs,
  restoreWorkbenchQueuedAgentTurnInputsToFront,
  settleWorkbenchQueuedAgentTurnDispatch,
  setWorkbenchQueuedAgentTurnInputs,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/chat/agentTurnInputQueueStore.ts';

const universalChatSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/UniversalChat.tsx'),
  'utf8',
);

function indexOfSourcePattern(source: string, pattern: RegExp, startIndex = 0): number {
  const match = pattern.exec(source.slice(startIndex));
  return match?.index === undefined ? -1 : startIndex + match.index;
}

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
const busyObserverEffectStartIndex = indexOfSourcePattern(
  universalChatSource,
  /useEffect\(\(\) => \{\r?\n    setQueuedTurnFlushGate\(\(previousState\) =>\r?\n      observeWorkbenchQueuedAgentTurnBusyState/u,
);
const busyObserverEffectEndIndex = indexOfSourcePattern(
  universalChatSource,
  /useEffect\(\(\) => \{\r?\n    setIsQueueExpanded\(false\);/u,
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
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/index.ts'),
  'utf8',
);

clearWorkbenchQueuedAgentTurnInputs('project-a/session-a');
clearWorkbenchQueuedAgentTurnInputs('project-b/session-a');
clearWorkbenchQueuedAgentTurnInputs('project-a/session-b');

enqueueWorkbenchQueuedAgentTurnInput('project-a/session-a', 'first');
enqueueWorkbenchQueuedAgentTurnInput('project-a/session-a', 'second');
enqueueWorkbenchQueuedAgentTurnInput('project-b/session-a', 'other-scope');

assert.deepEqual(
  peekWorkbenchQueuedAgentTurnInputs('project-a/session-a').map((turnInput) => turnInput.text),
  ['first', 'second'],
  'queued turn inputs must stay FIFO within a session scope.',
);

assert.deepEqual(
  peekWorkbenchQueuedAgentTurnInputs('project-b/session-a').map((turnInput) => turnInput.text),
  ['other-scope'],
  'queued turn inputs must be isolated by the full session scope, not just the raw session id.',
);

assert.equal(
  dequeueWorkbenchQueuedAgentTurnInput('project-a/session-a')?.text,
  'first',
  'queued turn input dequeue must remove exactly the oldest item.',
);

assert.deepEqual(
  peekWorkbenchQueuedAgentTurnInputs('project-a/session-a').map((turnInput) => turnInput.text),
  ['second'],
  'dequeue must leave later queued turn inputs in place.',
);

setWorkbenchQueuedAgentTurnInputs('project-a/session-b', [
  { id: 'queued-turn-input-third', text: 'third' },
]);
restoreWorkbenchQueuedAgentTurnInputsToFront(
  'project-a/session-b',
  [
    { id: 'queued-turn-input-failed-first', text: 'failed-first' },
    { id: 'queued-turn-input-failed-second', text: 'failed-second' },
  ],
);

assert.deepEqual(
  peekWorkbenchQueuedAgentTurnInputs('project-a/session-b').map((turnInput) => turnInput.text),
  ['failed-first', 'failed-second', 'third'],
  'failed queued dispatches must be restored to the front without dropping newer queued input.',
);

restoreWorkbenchQueuedAgentTurnInputsToFront(
  'project-a/session-b',
  [{ id: 'queued-turn-input-failed-first', text: 'failed-first' }],
);

assert.deepEqual(
  peekWorkbenchQueuedAgentTurnInputs('project-a/session-b').map((turnInput) => turnInput.text),
  ['failed-first', 'failed-second', 'third'],
  'failed queued dispatch restoration must be idempotent by turn-input identity so repeated recovery does not create duplicate React keys.',
);

clearWorkbenchQueuedAgentTurnInputs('project-a/session-duplicate-text');
const repeatedQueueAfterFirstEnqueue = enqueueWorkbenchQueuedAgentTurnInput(
  'project-a/session-duplicate-text',
  'repeat',
);
const repeatedQueueAfterSecondEnqueue = enqueueWorkbenchQueuedAgentTurnInput(
  'project-a/session-duplicate-text',
  'repeat',
);
assert.notEqual(
  repeatedQueueAfterFirstEnqueue[0]?.id,
  repeatedQueueAfterSecondEnqueue[1]?.id,
  'separately queued duplicate text must receive distinct stable identities.',
);
const failedRepeatedTurnInput = dequeueWorkbenchQueuedAgentTurnInput(
  'project-a/session-duplicate-text',
);
restoreWorkbenchQueuedAgentTurnInputsToFront(
  'project-a/session-duplicate-text',
  failedRepeatedTurnInput ? [failedRepeatedTurnInput] : [],
);
assert.deepEqual(
  peekWorkbenchQueuedAgentTurnInputs('project-a/session-duplicate-text').map(
    (turnInput) => turnInput.text,
  ),
  ['repeat', 'repeat'],
  'identity-based restoration must preserve intentionally duplicated queued text.',
);
assert.equal(
  new Set(
    peekWorkbenchQueuedAgentTurnInputs('project-a/session-duplicate-text').map(
      (turnInput) => turnInput.id,
    ),
  ).size,
  2,
  'identity-based queued turn inputs must keep duplicate text renderable with unique React keys.',
);

let flushGateState = createWorkbenchAgentTurnInputQueueFlushGateState();
assert.equal(
  canFlushWorkbenchQueuedAgentTurnInputs(flushGateState, {
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

flushGateState = markWorkbenchQueuedAgentTurnDispatchStarted(flushGateState, false);
assert.equal(
  canFlushWorkbenchQueuedAgentTurnInputs(flushGateState, {
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

flushGateState = observeWorkbenchQueuedAgentTurnBusyState(flushGateState, true);
assert.equal(
  canFlushWorkbenchQueuedAgentTurnInputs(flushGateState, {
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

flushGateState = observeWorkbenchQueuedAgentTurnBusyState(flushGateState, false);
assert.equal(
  canFlushWorkbenchQueuedAgentTurnInputs(flushGateState, {
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

flushGateState = createWorkbenchAgentTurnInputQueueFlushGateState();
flushGateState = markWorkbenchQueuedAgentTurnDispatchStarted(flushGateState, true);
flushGateState = observeWorkbenchQueuedAgentTurnBusyState(flushGateState, false);
assert.equal(
  canFlushWorkbenchQueuedAgentTurnInputs(flushGateState, {
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

flushGateState = createWorkbenchAgentTurnInputQueueFlushGateState();
flushGateState = markWorkbenchQueuedAgentTurnDispatchStarted(flushGateState, false);
flushGateState = settleWorkbenchQueuedAgentTurnDispatch(flushGateState);
assert.equal(
  canFlushWorkbenchQueuedAgentTurnInputs(flushGateState, {
    disabled: false,
    editingQueueIndex: -1,
    isActive: true,
    isComposerBusy: false,
    isQueueExpanded: false,
    queueLength: 1,
  }),
  true,
  'queued flush gate must have an explicit settle path so a batched submission that never renders busy cannot leave turn settlement stuck forever.',
);

assert.match(
  commonsIndexSource,
  /export \* from '\.\/chat\/agentTurnInputQueueStore\.ts';/,
  'Workbench must export the canonical AgentTurnInput queue store.',
);

assert.doesNotMatch(
  universalChatSource,
  /const \[agentTurnInputQueue,\s*setAgentTurnInputQueue\] = useState<string\[\]>\(\[\]\);/,
  'UniversalChat must not keep queued turn inputs in component-local state because queues must survive rerenders and stay isolated by session scope.',
);

assert.match(
  universalChatSource,
  /useWorkbenchAgentTurnInputQueue\(normalizedQueueScopeKey\)/,
  'UniversalChat must bind queued turn inputs to the canonical session-scoped queue store.',
);

assert.match(
  universalChatSource,
  /dequeueQueuedTurnInput\(\)/,
  'UniversalChat must atomically dequeue one queued turn input when it starts an automatic dispatch.',
);

assert.match(
  universalChatSource,
  /void dispatchQueuedAgentTurnInput\(nextQueuedAgentTurnInput\);/,
  'UniversalChat must automatically flush the next queued turn input when the active session becomes idle.',
);

assert.match(
  markQueuedTurnDispatchStartedSource,
  /isDispatchingMessageRef\.current/,
  'UniversalChat must close the queued-turn-input flush gate using the local dispatch busy state as well as provider runtime busy so queues cannot deadlock when provider busy is not observed.',
);

assert.match(
  markQueuedTurnDispatchStartedSource,
  /markWorkbenchQueuedAgentTurnDispatchStarted\([\s\S]*isTurnDispatchBusy[\s\S]*\)/,
  'UniversalChat must pass the resolved dispatch busy signal into the queued-turn-input flush gate.',
);

assert.match(
  busyObserverEffectSource,
  /observeWorkbenchQueuedAgentTurnBusyState\([\s\S]*isComposerTurnBlocked[\s\S]*\)/,
  'UniversalChat must observe full turn-blocked transitions before allowing the next queued turn to flush.',
);

assert.match(
  universalChatSource,
  /settleWorkbenchQueuedAgentTurnDispatch/,
  'UniversalChat must use an explicit queued-turn settlement path for sends that complete before React renders a busy transition.',
);

assert.match(
  submitPendingUserQuestionAnswerSource,
  /await Promise\.resolve\(onSubmitUserQuestionAnswer\(interactionId,\s*request\)\);[\s\S]*markQueuedTurnDispatchStarted\(\);[\s\S]*didMarkQueuedTurnDispatch\s*=\s*true;[\s\S]*finally \{[\s\S]*finishPendingInteractionSubmission\(pendingInteractionId\);[\s\S]*if \(didMarkQueuedTurnDispatch\) \{[\s\S]*scheduleQueuedTurnDispatchSettlementCheck\(\);/s,
  'Submitting a pending user-question answer must close the same queued-turn settlement gate as normal sends so queued follow-ups wait for the resumed turn to settle.',
);

assert.match(
  submitPendingApprovalDecisionSource,
  /await Promise\.resolve\(onSubmitApprovalDecision\(interactionId,\s*request\)\);[\s\S]*markQueuedTurnDispatchStarted\(\);[\s\S]*didMarkQueuedTurnDispatch\s*=\s*true;[\s\S]*finally \{[\s\S]*finishPendingInteractionSubmission\(pendingInteractionId\);[\s\S]*if \(didMarkQueuedTurnDispatch\) \{[\s\S]*scheduleQueuedTurnDispatchSettlementCheck\(\);/s,
  'Submitting a pending approval decision must close the same queued-turn settlement gate as normal sends so queued follow-ups wait for the resumed turn to settle.',
);

assert.match(
  universalChatSource,
  /canFlushWorkbenchQueuedAgentTurnInputs\(/,
  'UniversalChat must use the canonical flush-gate predicate instead of ad hoc queue flushing conditions.',
);

assert.doesNotMatch(
  universalChatSource,
  /const fullText = \[\.\.\.agentTurnInputQueue,\s*currentInput\]\.filter\(Boolean\)\.join\('\\n\\n'\);/,
  'UniversalChat must not collapse multiple queued turn inputs and the current draft into one turn.',
);

assert.doesNotMatch(
  universalChatSource,
  /agentTurnInputQueue\.map\(\(msg, idx\)[\s\S]*key=\{idx\}/,
  'UniversalChat must not render queued turn inputs with array-index keys because recovery/reorder operations require stable queue item identity.',
);

assert.match(
  universalChatSource,
  /agentTurnInputQueue\.map\(\(queuedAgentTurnInput, idx\)[\s\S]*key=\{queuedAgentTurnInput\.id\}/,
  'UniversalChat must render queued turn inputs with the canonical turn-input identity.',
);

assert.match(
  universalChatSource,
  /\(\(isComposerTurnBlocked \|\| isAwaitingQueuedTurnSettlement\) \? canQueueTypedMessage : canSendQueuedOrTypedMessage\)/,
  'UniversalChat send button must allow typed turn input to enter the queue while the active turn is blocked.',
);

assert.match(
  universalChatHandleSendSource,
  /canFlushQueuedAgentTurnInputFromUserAction\s*=\s*canFlushWorkbenchQueuedAgentTurnInputs\(\s*queuedTurnFlushGateRef\.current,\s*\{[\s\S]*queueLength:\s*agentTurnInputQueue\.length,[\s\S]*\}\s*,?\s*\)/,
  'Manual submit actions must evaluate the same queued-turn-input flush gate as automatic flushes before dispatching a queued turn.',
);

assert.match(
  universalChatHandleSendSource,
  /if \(!canFlushQueuedAgentTurnInputFromUserAction\) \{\s*return;\s*\}[\s\S]*const nextQueuedAgentTurnInput = dequeueQueuedTurnInput\(\);/,
  'Manual submit actions must not dequeue queued turn inputs while the post-dispatch turn-settlement gate is closed.',
);

assert.match(
  universalChatHandleSendSource,
  /isAwaitingQueuedTurnSettlement\s*=\s*queuedTurnFlushGateRef\.current\.awaitingTurnSettlement[\s\S]*if \(isComposerTurnBlocked \|\| isAwaitingQueuedTurnSettlement\) \{[\s\S]*enqueueQueuedTurnInput\(currentInput,\s*currentComposerSelection\);/,
  'Manual typed sends must enter the queue with the current composer selection while a just-created turn is waiting for runtime busy observation.',
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
  /catch \(error\) \{[\s\S]*restoreQueuedTurnInputsToFront\(\[submittedAgentTurnInput\]\);[\s\S]*t\('chat\.sendMessageFailed'\)/,
  'Queued auto-flush failure recovery must restore the dispatched queued turn input to the front of the queue.',
);

console.log('agent turn input queue contract passed.');
