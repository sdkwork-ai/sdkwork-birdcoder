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
        body: request.body,
        method: request.method,
        path: request.path,
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
]);

console.log('generated core write client facade contract passed.');
