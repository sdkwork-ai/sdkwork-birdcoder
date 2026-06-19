import assert from 'node:assert/strict';

const sdkClientsModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts',
  import.meta.url,
);

function createEnvelope<TData>(data: TData, requestId: string) {
  return {
    requestId,
    timestamp: '2026-04-11T11:00:00.000Z',
    data,
    meta: {
      version: 'v1',
    },
  };
}

const observedRequests: Array<{
  body?: unknown;
  method: string;
  path: string;
}> = [];

const { createBirdCoderAppSdkApiClient } = await import(
  `${sdkClientsModulePath.href}?t=${Date.now()}`
);

const client = createBirdCoderAppSdkApiClient({
  transport: {
    async request<TResponse>(request: {
      body?: unknown;
      method: string;
      path: string;
    }): Promise<TResponse> {
      observedRequests.push({
        method: request.method,
        path: request.path,
        ...(request.body !== undefined ? { body: request.body } : {}),
      });

      switch (request.path) {
        case '/app/v3/api/intelligence/coding_sessions':
          return createEnvelope(
            {
              id: 'coding-session-generated-write',
              workspaceId: 'workspace-generated-write',
              projectId: 'project-generated-write',
              title: 'Generated App Runtime Write Session',
              status: 'active',
              hostMode: 'server',
              engineId: 'codex',
              modelId: 'gpt-5-codex',
              createdAt: '2026-04-11T11:00:00.000Z',
              updatedAt: '2026-04-11T11:00:00.000Z',
              lastTurnAt: '2026-04-11T11:00:00.000Z',
            },
            'req.app.create-session',
          ) as TResponse;
        case '/app/v3/api/intelligence/coding_sessions/coding-session-generated-write/fork':
          return createEnvelope(
            {
              id: 'coding-session-generated-write-fork',
              workspaceId: 'workspace-generated-write',
              projectId: 'project-generated-write',
              title: 'Forked Generated App Runtime Write Session',
              status: 'active',
              hostMode: 'server',
              engineId: 'codex',
              modelId: 'gpt-5-codex',
              createdAt: '2026-04-11T11:00:30.000Z',
              updatedAt: '2026-04-11T11:00:30.000Z',
              lastTurnAt: '2026-04-11T11:00:30.000Z',
            },
            'req.app.fork-session',
          ) as TResponse;
        case '/app/v3/api/intelligence/coding_sessions/coding-session-generated-write':
          if (request.method === 'PATCH') {
            return createEnvelope(
              {
                id: 'coding-session-generated-write',
                workspaceId: 'workspace-generated-write',
                projectId: 'project-generated-write',
                title: 'Renamed Generated App Runtime Write Session',
                status: 'paused',
                hostMode: 'server',
                engineId: 'codex',
                modelId: 'gpt-5-codex',
                createdAt: '2026-04-11T11:00:00.000Z',
                updatedAt: '2026-04-11T11:00:45.000Z',
                lastTurnAt: '2026-04-11T11:00:45.000Z',
              },
              'req.app.update-session',
            ) as TResponse;
          }
          if (request.method === 'DELETE') {
            return createEnvelope(
              {
                id: 'coding-session-generated-write',
              },
              'req.app.delete-session',
            ) as TResponse;
          }
          break;
        case '/app/v3/api/intelligence/coding_sessions/coding-session-generated-write/turns':
          return createEnvelope(
            {
              id: 'coding-turn-generated-write',
              codingSessionId: 'coding-session-generated-write',
              runtimeId: 'runtime-generated-write',
              requestKind: 'chat',
              status: 'running',
              inputSummary: 'Implement app runtime write turn facade',
              startedAt: '2026-04-11T11:01:00.000Z',
              completedAt: null,
            },
            'req.app.create-session-turn',
          ) as TResponse;
        case '/app/v3/api/intelligence/coding_sessions/coding-session-generated-write/checkpoints/checkpoint-generated-write/approval':
          return createEnvelope(
            {
              approvalId: 'approval-generated-write',
              checkpointId: 'checkpoint-generated-write',
              codingSessionId: 'coding-session-generated-write',
              decision: 'approved',
              decidedAt: '2026-04-11T11:02:00.000Z',
              operationId: 'coding-turn-generated-write:operation',
              operationStatus: 'running',
              reason: 'Looks safe',
              runtimeStatus: 'awaiting_tool',
              runtimeId: 'runtime-generated-write',
              turnId: 'coding-turn-generated-write',
            },
            'req.app.submit-approval-decision',
          ) as TResponse;
        case '/app/v3/api/intelligence/coding_sessions/coding-session-generated-write/questions/question-generated-write/answer':
          return createEnvelope(
            {
              questionId: 'question-generated-write',
              codingSessionId: 'coding-session-generated-write',
              answer: 'Run unit tests',
              answeredAt: '2026-04-11T11:03:00.000Z',
              runtimeStatus: 'awaiting_tool',
              runtimeId: 'runtime-generated-write',
              turnId: 'coding-turn-generated-write',
            },
            'req.app.submit-user-question-answer',
          ) as TResponse;
        case '/app/v3/api/intelligence/coding_sessions/coding-session-generated-write/questions/question-generated-write-reject/answer':
          return createEnvelope(
            {
              questionId: 'question-generated-write-reject',
              codingSessionId: 'coding-session-generated-write',
              rejected: true,
              answeredAt: '2026-04-11T11:03:30.000Z',
              runtimeStatus: 'failed',
              runtimeId: 'runtime-generated-write',
              turnId: 'coding-turn-generated-write',
            },
            'req.app.reject-user-question',
          ) as TResponse;
        default:
          throw new Error(`Unhandled request: ${request.method} ${request.path}`);
      }
    },
  },
});

const createdSession = await client.createCodingSession({
  workspaceId: 'workspace-generated-write',
  projectId: 'project-generated-write',
  title: 'Generated App Runtime Write Session',
  hostMode: 'server',
  engineId: 'codex',
  modelId: 'gpt-5-codex',
});

assert.equal(createdSession.id, 'coding-session-generated-write');
assert.equal(createdSession.workspaceId, 'workspace-generated-write');
assert.equal(createdSession.projectId, 'project-generated-write');
assert.equal(createdSession.title, 'Generated App Runtime Write Session');

const forkedSession = await client.forkCodingSession('coding-session-generated-write', {
  title: 'Forked Generated App Runtime Write Session',
});

assert.equal(forkedSession.id, 'coding-session-generated-write-fork');
assert.equal(forkedSession.title, 'Forked Generated App Runtime Write Session');

const updatedSession = await client.updateCodingSession('coding-session-generated-write', {
  title: 'Renamed Generated App Runtime Write Session',
  status: 'paused',
});

assert.equal(updatedSession.id, 'coding-session-generated-write');
assert.equal(updatedSession.title, 'Renamed Generated App Runtime Write Session');
assert.equal(updatedSession.status, 'paused');
assert.equal(updatedSession.modelId, 'gpt-5-codex');

await assert.rejects(
  () =>
    client.editCodingSessionMessage('coding-session-generated-write', 'message-generated-write', {
      content: 'Edited generated write message',
    }),
  /does not expose coding session message edit over HTTP/,
);

await assert.rejects(
  () => client.deleteCodingSessionMessage('coding-session-generated-write', 'message-generated-write'),
  /does not expose coding session message delete over HTTP/,
);

const deletedSession = await client.deleteCodingSession('coding-session-generated-write');

assert.equal(deletedSession.id, 'coding-session-generated-write');

const createdTurn = await client.createCodingSessionTurn('coding-session-generated-write', {
  runtimeId: 'runtime-generated-write',
  requestKind: 'chat',
  inputSummary: 'Implement app runtime write turn facade',
  stream: true,
});

assert.equal(createdTurn.id, 'coding-turn-generated-write');
assert.equal(createdTurn.codingSessionId, 'coding-session-generated-write');
assert.equal(createdTurn.runtimeId, 'runtime-generated-write');
assert.equal(createdTurn.requestKind, 'chat');
assert.equal(createdTurn.inputSummary, 'Implement app runtime write turn facade');

const approvalResult = await client.submitApprovalDecision(
  'coding-session-generated-write',
  'checkpoint-generated-write',
  {
    decision: 'approved',
    reason: 'Looks safe',
  },
);

assert.equal(approvalResult.approvalId, 'approval-generated-write');
assert.equal(approvalResult.codingSessionId, 'coding-session-generated-write');
assert.equal(approvalResult.operationId, 'coding-turn-generated-write:operation');
assert.equal(approvalResult.decision, 'approved');
assert.equal(approvalResult.reason, 'Looks safe');

const questionAnswerResult = await client.submitUserQuestionAnswer(
  'coding-session-generated-write',
  'question-generated-write',
  {
    answer: 'Run unit tests',
    optionLabel: 'Unit',
  },
);

assert.equal(questionAnswerResult.questionId, 'question-generated-write');
assert.equal(questionAnswerResult.codingSessionId, 'coding-session-generated-write');
assert.equal(questionAnswerResult.answer, 'Run unit tests');

const questionRejectResult = await client.submitUserQuestionAnswer(
  'coding-session-generated-write',
  'question-generated-write-reject',
  {
    rejected: true,
  },
);

assert.equal(questionRejectResult.questionId, 'question-generated-write-reject');
assert.equal(questionRejectResult.rejected, true);
assert.equal(
  questionRejectResult.answer,
  undefined,
  'app runtime write client must not fake an empty answer when rejecting a user question.',
);
assert.deepEqual(observedRequests, [
  {
    method: 'POST',
    path: '/app/v3/api/intelligence/coding_sessions',
    body: {
      workspaceId: 'workspace-generated-write',
      projectId: 'project-generated-write',
      title: 'Generated App Runtime Write Session',
      hostMode: 'server',
      engineId: 'codex',
      modelId: 'gpt-5-codex',
    },
  },
  {
    method: 'POST',
    path: '/app/v3/api/intelligence/coding_sessions/coding-session-generated-write/fork',
    body: {
      title: 'Forked Generated App Runtime Write Session',
    },
  },
  {
    method: 'PATCH',
    path: '/app/v3/api/intelligence/coding_sessions/coding-session-generated-write',
    body: {
      title: 'Renamed Generated App Runtime Write Session',
      status: 'paused',
    },
  },
  {
    method: 'DELETE',
    path: '/app/v3/api/intelligence/coding_sessions/coding-session-generated-write',
  },
  {
    method: 'POST',
    path: '/app/v3/api/intelligence/coding_sessions/coding-session-generated-write/turns',
    body: {
      runtimeId: 'runtime-generated-write',
      requestKind: 'chat',
      inputSummary: 'Implement app runtime write turn facade',
      stream: true,
    },
  },
  {
    method: 'POST',
    path: '/app/v3/api/intelligence/coding_sessions/coding-session-generated-write/checkpoints/checkpoint-generated-write/approval',
    body: {
      decision: 'approved',
      reason: 'Looks safe',
    },
  },
  {
    method: 'POST',
    path: '/app/v3/api/intelligence/coding_sessions/coding-session-generated-write/questions/question-generated-write/answer',
    body: {
      answer: 'Run unit tests',
      optionLabel: 'Unit',
    },
  },
  {
    method: 'POST',
    path: '/app/v3/api/intelligence/coding_sessions/coding-session-generated-write/questions/question-generated-write-reject/answer',
    body: {
      rejected: true,
    },
  },
]);

console.log('app runtime SDK write client facade contract passed.');
