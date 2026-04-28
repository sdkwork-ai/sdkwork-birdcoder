import assert from 'node:assert/strict';
import type {
  BirdCoderCodingSessionArtifact,
  BirdCoderCodingSessionCheckpoint,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionSummary,
} from '@sdkwork/birdcoder-types';
import {
  loadCodingSessionPendingInteractionState,
} from '../packages/sdkwork-birdcoder-commons/src/hooks/useCodingSessionProjection.ts';

const sessionId = 'coding-session-pending-interactions-stability';
const session: BirdCoderCodingSessionSummary = {
  id: sessionId,
  workspaceId: 'workspace-pending-interactions-stability',
  projectId: 'project-pending-interactions-stability',
  title: 'Pending interactions stability',
  status: 'active',
  hostMode: 'desktop',
  engineId: 'codex',
  modelId: 'gpt-5.4',
  createdAt: '2026-04-28T10:00:00.000Z',
  updatedAt: '2026-04-28T10:00:00.000Z',
};

const duplicateApprovalCheckpoints: BirdCoderCodingSessionCheckpoint[] = [
  {
    id: 'approval-checkpoint-older',
    codingSessionId: sessionId,
    runtimeId: 'runtime-pending-approval',
    checkpointKind: 'approval',
    resumable: true,
    state: {
      approvalId: 'approval-duplicate',
      reason: 'Older approval projection',
    },
    createdAt: '2026-04-28T10:01:00.000Z',
  },
  {
    id: 'approval-checkpoint-newer',
    codingSessionId: sessionId,
    runtimeId: 'runtime-pending-approval',
    checkpointKind: 'approval',
    resumable: true,
    state: {
      approvalId: 'approval-duplicate',
      reason: 'Newer approval projection',
    },
    createdAt: '2026-04-28T10:02:00.000Z',
  },
];

const duplicateQuestionEvents: BirdCoderCodingSessionEvent[] = [
  {
    id: 'question-event-older',
    codingSessionId: sessionId,
    turnId: 'turn-pending-question',
    runtimeId: 'runtime-pending-question',
    kind: 'tool.call.requested',
    sequence: '1',
    payload: {
      toolCallId: 'tool-question-older',
      toolName: 'question',
      runtimeStatus: 'awaiting_user',
      toolArguments: JSON.stringify({
        requestId: 'question-duplicate',
        questions: [
          {
            question: 'Older question projection',
          },
        ],
      }),
    },
    createdAt: '2026-04-28T10:01:00.000Z',
  },
  {
    id: 'question-event-newer',
    codingSessionId: sessionId,
    turnId: 'turn-pending-question',
    runtimeId: 'runtime-pending-question',
    kind: 'tool.call.requested',
    sequence: '2',
    payload: {
      toolCallId: 'tool-question-newer',
      toolName: 'question',
      runtimeStatus: 'awaiting_user',
      toolArguments: JSON.stringify({
        requestId: 'question-duplicate',
        questions: [
          {
            question: 'Newer question projection',
          },
        ],
      }),
    },
    createdAt: '2026-04-28T10:02:00.000Z',
  },
];

const readCalls: string[] = [];
const coreReadService = {
  async getCodingSession(codingSessionId: string): Promise<BirdCoderCodingSessionSummary> {
    readCalls.push(`getCodingSession:${codingSessionId}`);
    return session;
  },
  async listCodingSessionArtifacts(
    codingSessionId: string,
  ): Promise<BirdCoderCodingSessionArtifact[]> {
    readCalls.push(`listCodingSessionArtifacts:${codingSessionId}`);
    return [];
  },
  async listCodingSessionCheckpoints(
    codingSessionId: string,
  ): Promise<BirdCoderCodingSessionCheckpoint[]> {
    readCalls.push(`listCodingSessionCheckpoints:${codingSessionId}`);
    return [];
  },
  async listCodingSessionEvents(
    codingSessionId: string,
  ): Promise<BirdCoderCodingSessionEvent[]> {
    readCalls.push(`listCodingSessionEvents:${codingSessionId}`);
    return [];
  },
};

const duplicateProjectionCoreReadService = {
  ...coreReadService,
  async listCodingSessionCheckpoints(
    codingSessionId: string,
  ): Promise<BirdCoderCodingSessionCheckpoint[]> {
    readCalls.push(`listCodingSessionCheckpoints:${codingSessionId}:duplicates`);
    return duplicateApprovalCheckpoints;
  },
  async listCodingSessionEvents(
    codingSessionId: string,
  ): Promise<BirdCoderCodingSessionEvent[]> {
    readCalls.push(`listCodingSessionEvents:${codingSessionId}:duplicates`);
    return duplicateQuestionEvents;
  },
};

const reversedDuplicateProjectionCoreReadService = {
  ...coreReadService,
  async listCodingSessionCheckpoints(
    codingSessionId: string,
  ): Promise<BirdCoderCodingSessionCheckpoint[]> {
    readCalls.push(`listCodingSessionCheckpoints:${codingSessionId}:reversed-duplicates`);
    return [...duplicateApprovalCheckpoints].reverse();
  },
  async listCodingSessionEvents(
    codingSessionId: string,
  ): Promise<BirdCoderCodingSessionEvent[]> {
    readCalls.push(`listCodingSessionEvents:${codingSessionId}:reversed-duplicates`);
    return [...duplicateQuestionEvents].reverse();
  },
};

const first = await loadCodingSessionPendingInteractionState(coreReadService, sessionId);
const second = await loadCodingSessionPendingInteractionState(coreReadService, sessionId);

assert.equal(first.approvals.length, 0);
assert.equal(first.questions.length, 0);
assert.equal(
  first.approvals,
  second.approvals,
  'empty pending approval lists must reuse a stable reference across refreshes to avoid UniversalChat rerender churn.',
);
assert.equal(
  first.questions,
  second.questions,
  'empty pending user-question lists must reuse a stable reference across refreshes to avoid UniversalChat rerender churn.',
);
assert.deepEqual(
  readCalls,
  [
    `getCodingSession:${sessionId}`,
    `listCodingSessionEvents:${sessionId}`,
    `listCodingSessionArtifacts:${sessionId}`,
    `listCodingSessionCheckpoints:${sessionId}`,
    `getCodingSession:${sessionId}`,
    `listCodingSessionEvents:${sessionId}`,
    `listCodingSessionArtifacts:${sessionId}`,
    `listCodingSessionCheckpoints:${sessionId}`,
  ],
  'pending interaction loading must still use one batched projection read per refresh.',
);

readCalls.length = 0;
const deduplicated = await loadCodingSessionPendingInteractionState(
  duplicateProjectionCoreReadService,
  sessionId,
);

assert.deepEqual(
  deduplicated.approvals.map((approval) => ({
    approvalId: approval.approvalId,
    checkpointId: approval.checkpointId,
    reason: approval.reason,
  })),
  [
    {
      approvalId: 'approval-duplicate',
      checkpointId: 'approval-checkpoint-newer',
      reason: 'Newer approval projection',
    },
  ],
  'duplicate approval checkpoints with the same approvalId must collapse to the newest pending approval before React renders key={approvalId}.',
);

assert.deepEqual(
  deduplicated.questions.map((question) => ({
    questionId: question.questionId,
    prompt: question.prompt,
    toolCallId: question.toolCallId,
  })),
  [
    {
      questionId: 'question-duplicate',
      prompt: 'Newer question projection',
      toolCallId: 'tool-question-newer',
    },
  ],
  'duplicate user_question events with the same questionId must collapse to the newest pending question before React renders key={questionId}.',
);

readCalls.length = 0;
const reverseOrderedDeduplicated = await loadCodingSessionPendingInteractionState(
  reversedDuplicateProjectionCoreReadService,
  sessionId,
);

assert.equal(
  reverseOrderedDeduplicated.approvals[0]?.checkpointId,
  'approval-checkpoint-newer',
  'duplicate approval deduplication must choose the newest checkpoint by timestamp even when the repository returns checkpoints out of order.',
);
assert.equal(
  reverseOrderedDeduplicated.questions[0]?.toolCallId,
  'tool-question-newer',
  'duplicate user-question deduplication must choose the newest event by sequence even when the repository returns events out of order.',
);

console.log('coding session pending interactions stability contract passed.');
