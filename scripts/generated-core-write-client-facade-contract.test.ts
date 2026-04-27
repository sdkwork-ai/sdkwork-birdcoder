import assert from 'node:assert/strict';

const typesEntryModulePath = new URL(
  '../packages/sdkwork-birdcoder-types/src/index.ts',
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

const { createBirdCoderGeneratedCoreWriteApiClient } = await import(
  `${typesEntryModulePath.href}?t=${Date.now()}`
);

const client = createBirdCoderGeneratedCoreWriteApiClient({
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
        case '/api/core/v1/coding-sessions':
          return createEnvelope(
            {
              id: 'coding-session-generated-write',
              workspaceId: 'workspace-generated-write',
              projectId: 'project-generated-write',
              title: 'Generated Core Write Session',
              status: 'active',
              hostMode: 'server',
              engineId: 'codex',
              modelId: 'gpt-5-codex',
              createdAt: '2026-04-11T11:00:00.000Z',
              updatedAt: '2026-04-11T11:00:00.000Z',
              lastTurnAt: '2026-04-11T11:00:00.000Z',
            },
            'req.core.create-session',
          ) as TResponse;
        case '/api/core/v1/coding-sessions/coding-session-generated-write/fork':
          return createEnvelope(
            {
              id: 'coding-session-generated-write-fork',
              workspaceId: 'workspace-generated-write',
              projectId: 'project-generated-write',
              title: 'Forked Generated Core Write Session',
              status: 'active',
              hostMode: 'server',
              engineId: 'codex',
              modelId: 'gpt-5-codex',
              createdAt: '2026-04-11T11:00:30.000Z',
              updatedAt: '2026-04-11T11:00:30.000Z',
              lastTurnAt: '2026-04-11T11:00:30.000Z',
            },
            'req.core.fork-session',
          ) as TResponse;
        case '/api/core/v1/coding-sessions/coding-session-generated-write':
          if (request.method === 'PATCH') {
            return createEnvelope(
              {
                id: 'coding-session-generated-write',
                workspaceId: 'workspace-generated-write',
                projectId: 'project-generated-write',
                title: 'Renamed Generated Core Write Session',
                status: 'paused',
                hostMode: 'server',
                engineId: 'codex',
                modelId: 'gpt-5-codex',
                createdAt: '2026-04-11T11:00:00.000Z',
                updatedAt: '2026-04-11T11:00:45.000Z',
                lastTurnAt: '2026-04-11T11:00:45.000Z',
              },
              'req.core.update-session',
            ) as TResponse;
          }
          if (request.method === 'DELETE') {
            return createEnvelope(
              {
                id: 'coding-session-generated-write',
              },
              'req.core.delete-session',
            ) as TResponse;
          }
          break;
        case '/api/core/v1/coding-sessions/coding-session-generated-write/messages/message-generated-write':
          return createEnvelope(
            {
              id: 'message-generated-write',
              codingSessionId: 'coding-session-generated-write',
            },
            'req.core.delete-session-message',
          ) as TResponse;
        case '/api/core/v1/coding-sessions/coding-session-generated-write/turns':
          return createEnvelope(
            {
              id: 'coding-turn-generated-write',
              codingSessionId: 'coding-session-generated-write',
              runtimeId: 'runtime-generated-write',
              requestKind: 'chat',
              status: 'running',
              inputSummary: 'Implement shared core write turn facade',
              startedAt: '2026-04-11T11:01:00.000Z',
              completedAt: null,
            },
            'req.core.create-session-turn',
          ) as TResponse;
        case '/api/core/v1/approvals/approval-generated-write/decision':
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
            'req.core.submit-approval-decision',
          ) as TResponse;
        case '/api/core/v1/questions/question-generated-write/answer':
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
            'req.core.submit-user-question-answer',
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
  title: 'Generated Core Write Session',
  hostMode: 'server',
  engineId: 'codex',
  modelId: 'gpt-5-codex',
});

assert.equal(createdSession.id, 'coding-session-generated-write');
assert.equal(createdSession.workspaceId, 'workspace-generated-write');
assert.equal(createdSession.projectId, 'project-generated-write');
assert.equal(createdSession.title, 'Generated Core Write Session');

const forkedSession = await client.forkCodingSession('coding-session-generated-write', {
  title: 'Forked Generated Core Write Session',
});

assert.equal(forkedSession.id, 'coding-session-generated-write-fork');
assert.equal(forkedSession.title, 'Forked Generated Core Write Session');

const updatedSession = await client.updateCodingSession('coding-session-generated-write', {
  title: 'Renamed Generated Core Write Session',
  status: 'paused',
});

assert.equal(updatedSession.id, 'coding-session-generated-write');
assert.equal(updatedSession.title, 'Renamed Generated Core Write Session');
assert.equal(updatedSession.status, 'paused');
assert.equal(updatedSession.modelId, 'gpt-5-codex');

await assert.rejects(
  () => client.updateCodingSession('coding-session-generated-write', {}),
  /update coding session request must include at least one field\./,
);

const deletedMessage = await client.deleteCodingSessionMessage(
  'coding-session-generated-write',
  'message-generated-write',
);

assert.equal(deletedMessage.id, 'message-generated-write');
assert.equal(deletedMessage.codingSessionId, 'coding-session-generated-write');

const deletedSession = await client.deleteCodingSession('coding-session-generated-write');

assert.equal(deletedSession.id, 'coding-session-generated-write');

const createdTurn = await client.createCodingSessionTurn('coding-session-generated-write', {
  runtimeId: 'runtime-generated-write',
  requestKind: 'chat',
  inputSummary: 'Implement shared core write turn facade',
});

assert.equal(createdTurn.id, 'coding-turn-generated-write');
assert.equal(createdTurn.codingSessionId, 'coding-session-generated-write');
assert.equal(createdTurn.runtimeId, 'runtime-generated-write');
assert.equal(createdTurn.requestKind, 'chat');
assert.equal(createdTurn.inputSummary, 'Implement shared core write turn facade');

const approvalResult = await client.submitApprovalDecision('approval-generated-write', {
  decision: 'approved',
  reason: 'Looks safe',
});

assert.equal(approvalResult.approvalId, 'approval-generated-write');
assert.equal(approvalResult.codingSessionId, 'coding-session-generated-write');
assert.equal(approvalResult.operationId, 'coding-turn-generated-write:operation');
assert.equal(approvalResult.decision, 'approved');
assert.equal(approvalResult.reason, 'Looks safe');

const questionAnswerResult = await client.submitUserQuestionAnswer('question-generated-write', {
  answer: 'Run unit tests',
  optionLabel: 'Unit',
});

assert.equal(questionAnswerResult.questionId, 'question-generated-write');
assert.equal(questionAnswerResult.codingSessionId, 'coding-session-generated-write');
assert.equal(questionAnswerResult.answer, 'Run unit tests');
assert.deepEqual(observedRequests, [
  {
    method: 'POST',
    path: '/api/core/v1/coding-sessions',
    body: {
      workspaceId: 'workspace-generated-write',
      projectId: 'project-generated-write',
      title: 'Generated Core Write Session',
      hostMode: 'server',
      engineId: 'codex',
      modelId: 'gpt-5-codex',
    },
  },
  {
    method: 'POST',
    path: '/api/core/v1/coding-sessions/coding-session-generated-write/fork',
    body: {
      title: 'Forked Generated Core Write Session',
    },
  },
  {
    method: 'PATCH',
    path: '/api/core/v1/coding-sessions/coding-session-generated-write',
    body: {
      title: 'Renamed Generated Core Write Session',
      status: 'paused',
    },
  },
  {
    method: 'DELETE',
    path: '/api/core/v1/coding-sessions/coding-session-generated-write/messages/message-generated-write',
  },
  {
    method: 'DELETE',
    path: '/api/core/v1/coding-sessions/coding-session-generated-write',
  },
  {
    method: 'POST',
    path: '/api/core/v1/coding-sessions/coding-session-generated-write/turns',
    body: {
      runtimeId: 'runtime-generated-write',
      requestKind: 'chat',
      inputSummary: 'Implement shared core write turn facade',
    },
  },
  {
    method: 'POST',
    path: '/api/core/v1/approvals/approval-generated-write/decision',
    body: {
      decision: 'approved',
      reason: 'Looks safe',
    },
  },
  {
    method: 'POST',
    path: '/api/core/v1/questions/question-generated-write/answer',
    body: {
      answer: 'Run unit tests',
      optionLabel: 'Unit',
    },
  },
]);

console.log('generated core write client facade contract passed.');
