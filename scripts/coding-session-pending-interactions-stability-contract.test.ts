import assert from 'node:assert/strict';
import type {
  BirdCoderCodingSessionArtifact,
  BirdCoderCodingSessionCheckpoint,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionSummary,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import {
  loadCodingSessionPendingInteractionState,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useCodingSessionProjection.ts';

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
    id: 'approval-event-duplicate',
    codingSessionId: sessionId,
    turnId: 'turn-pending-approval',
    runtimeId: 'runtime-pending-approval',
    kind: 'approval.required',
    sequence: '0',
    payload: {
      approvalId: 'approval-duplicate',
      interactionId: 'approval-duplicate',
      interactionKind: 'approval',
      reason: 'Canonical approval projection',
      runtimeStatus: 'awaiting_approval',
    },
    createdAt: '2026-04-28T10:00:30.000Z',
  },
  {
    id: 'question-event-older',
    codingSessionId: sessionId,
    turnId: 'turn-pending-question',
    runtimeId: 'runtime-pending-question',
    kind: 'user.question.required',
    sequence: '1',
    payload: {
      interactionId: 'question-duplicate',
      interactionKind: 'user_question',
      toolCallId: 'tool-question-duplicate',
      runtimeStatus: 'awaiting_user',
      questions: [{ question: 'Older question projection' }],
    },
    createdAt: '2026-04-28T10:01:00.000Z',
  },
  {
    id: 'question-event-newer',
    codingSessionId: sessionId,
    turnId: 'turn-pending-question',
    runtimeId: 'runtime-pending-question',
    kind: 'user.question.required',
    sequence: '2',
    payload: {
      interactionId: 'question-duplicate',
      interactionKind: 'user_question',
      toolCallId: 'tool-question-duplicate',
      runtimeStatus: 'awaiting_user',
      questions: [{ question: 'Newer question projection' }],
    },
    createdAt: '2026-04-28T10:02:00.000Z',
  },
];

const readCalls: string[] = [];
const appRuntimeReadService = {
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

const duplicateProjectionAppRuntimeReadService = {
  ...appRuntimeReadService,
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

const reversedDuplicateProjectionAppRuntimeReadService = {
  ...appRuntimeReadService,
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

const first = await loadCodingSessionPendingInteractionState(appRuntimeReadService, sessionId);
const second = await loadCodingSessionPendingInteractionState(appRuntimeReadService, sessionId);

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
  duplicateProjectionAppRuntimeReadService,
  sessionId,
);

assert.deepEqual(
  deduplicated.approvals.map((approval) => ({
    approvalId: approval.approvalId,
    interactionEventId: approval.interactionEventId,
    reason: approval.reason,
  })),
  [
    {
      approvalId: 'approval-duplicate',
      interactionEventId: 'approval-event-duplicate',
      reason: 'Canonical approval projection',
    },
  ],
  'checkpoint snapshots must not replace the canonical approval source-event identity.',
);

assert.deepEqual(
  deduplicated.questions.map((question) => ({
    interactionEventId: question.interactionEventId,
    questionId: question.questionId,
    prompt: question.prompt,
    toolCallId: question.toolCallId,
  })),
  [
    {
      interactionEventId: 'question-event-newer',
      questionId: 'question-duplicate',
      prompt: 'Newer question projection',
      toolCallId: 'tool-question-duplicate',
    },
  ],
  'duplicate canonical user_question events must collapse by provider interaction while retaining the newest durable source-event id.',
);

readCalls.length = 0;
const reverseOrderedDeduplicated = await loadCodingSessionPendingInteractionState(
  reversedDuplicateProjectionAppRuntimeReadService,
  sessionId,
);

assert.equal(
  reverseOrderedDeduplicated.approvals[0]?.interactionEventId,
  'approval-event-duplicate',
  'approval projection must retain the durable source-event id when checkpoint rows arrive out of order.',
);
assert.equal(
  reverseOrderedDeduplicated.questions[0]?.toolCallId,
  'tool-question-duplicate',
  'duplicate user-question deduplication must choose the newest event by sequence even when the repository returns events out of order.',
);

const missingProjectScopedProjectionAppRuntimeReadService = {
  ...duplicateProjectionAppRuntimeReadService,
  async getCodingSession(codingSessionId: string): Promise<BirdCoderCodingSessionSummary> {
    readCalls.push(`getCodingSession:${codingSessionId}:missing-project`);
    const missingProjectSession = {
      ...session,
    } as Partial<BirdCoderCodingSessionSummary>;
    delete missingProjectSession.projectId;
    return missingProjectSession as BirdCoderCodingSessionSummary;
  },
};

readCalls.length = 0;
const missingProjectScopedPendingInteractions =
  await loadCodingSessionPendingInteractionState(
    missingProjectScopedProjectionAppRuntimeReadService,
    sessionId,
    session.projectId,
  );
assert.equal(
  missingProjectScopedPendingInteractions.approvals.length,
  0,
  'pending approvals must not be shown for an expected project when the authoritative session summary has no projectId.',
);
assert.equal(
  missingProjectScopedPendingInteractions.questions.length,
  0,
  'pending user questions must not be shown for an expected project when the authoritative session summary has no projectId.',
);

console.log('coding session pending interactions stability contract passed.');
