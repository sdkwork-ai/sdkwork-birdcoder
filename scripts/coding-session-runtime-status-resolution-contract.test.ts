import assert from 'node:assert/strict';
import {
  isBirdCoderCodingSessionEngineBusy,
  resolveBirdCoderCodingSessionRuntimeStatus,
} from '../packages/sdkwork-birdcoder-types/src/coding-session.ts';

const lateStreamingProgressAfterAssistantCompletion =
  resolveBirdCoderCodingSessionRuntimeStatus([
    {
      kind: 'message.delta',
      payload: {
        role: 'assistant',
        contentDelta: 'Checking the send path.',
        runtimeStatus: 'streaming',
      },
      turnId: 'turn-late-progress-after-assistant-completion',
    },
    {
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'The send path is healthy.',
        runtimeStatus: 'completed',
      },
      turnId: 'turn-late-progress-after-assistant-completion',
    },
    {
      kind: 'operation.updated',
      payload: {
        runtimeStatus: 'streaming',
        status: 'running',
      },
      turnId: 'turn-late-progress-after-assistant-completion',
    },
  ]);

assert.equal(
  lateStreamingProgressAfterAssistantCompletion,
  'completed',
  'same-turn streaming progress that arrives after assistant message.completed must not regress the session row back to a spinning runtime.',
);
assert.equal(
  isBirdCoderCodingSessionEngineBusy({
    runtimeStatus: lateStreamingProgressAfterAssistantCompletion,
  }),
  false,
  'a completed assistant reply followed by stale progress must not keep the left session list spinner alive.',
);

const lateStreamingProgressAfterTurnCompletion =
  resolveBirdCoderCodingSessionRuntimeStatus([
    {
      kind: 'turn.started',
      payload: {
        runtimeStatus: 'streaming',
      },
      turnId: 'turn-late-progress-after-turn-completion',
    },
    {
      kind: 'turn.completed',
      payload: {
        runtimeStatus: 'completed',
      },
      turnId: 'turn-late-progress-after-turn-completion',
    },
    {
      kind: 'operation.updated',
      payload: {
        runtimeStatus: 'streaming',
      },
      turnId: 'turn-late-progress-after-turn-completion',
    },
  ]);

assert.equal(
  lateStreamingProgressAfterTurnCompletion,
  'completed',
  'same-turn streaming progress that arrives after turn.completed must not reopen a completed turn.',
);

const lateStreamingProgressAfterTurnFailure =
  resolveBirdCoderCodingSessionRuntimeStatus([
    {
      kind: 'turn.started',
      payload: {
        runtimeStatus: 'streaming',
      },
      turnId: 'turn-late-progress-after-turn-failure',
    },
    {
      kind: 'turn.failed',
      payload: {
        runtimeStatus: 'failed',
        errorMessage: 'Provider failed.',
      },
      turnId: 'turn-late-progress-after-turn-failure',
    },
    {
      kind: 'operation.updated',
      payload: {
        runtimeStatus: 'streaming',
      },
      turnId: 'turn-late-progress-after-turn-failure',
    },
  ]);

assert.equal(
  lateStreamingProgressAfterTurnFailure,
  'failed',
  'same-turn streaming progress that arrives after turn.failed must not hide the failure state.',
);

const nextTurnAfterCompletedTurn =
  resolveBirdCoderCodingSessionRuntimeStatus([
    {
      kind: 'turn.completed',
      payload: {
        runtimeStatus: 'completed',
      },
      turnId: 'turn-already-completed',
    },
    {
      kind: 'turn.started',
      payload: {
        runtimeStatus: 'streaming',
      },
      turnId: 'turn-new-active',
    },
  ]);

assert.equal(
  nextTurnAfterCompletedTurn,
  'streaming',
  'a genuinely new turn after a completed turn must still mark the coding session as streaming.',
);

const approvalAfterAssistantCompletion =
  resolveBirdCoderCodingSessionRuntimeStatus([
    {
      kind: 'message.completed',
      payload: {
        role: 'assistant',
        content: 'I need permission before editing.',
        runtimeStatus: 'completed',
      },
      turnId: 'turn-awaiting-approval-after-message',
    },
    {
      kind: 'approval.required',
      payload: {
        runtimeStatus: 'awaiting_approval',
      },
      turnId: 'turn-awaiting-approval-after-message',
    },
  ]);

assert.equal(
  approvalAfterAssistantCompletion,
  'awaiting_approval',
  'real user-decision waits after an assistant message must still win over older completed content.',
);

console.log('coding session runtime status resolution contract passed.');
