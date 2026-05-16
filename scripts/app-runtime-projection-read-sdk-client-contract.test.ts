import assert from 'node:assert/strict';

const sdkClientsModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts',
  import.meta.url,
);

function createEnvelope<TData>(data: TData, requestId: string) {
  return {
    requestId,
    timestamp: '2026-04-11T10:00:00.000Z',
    data,
    meta: {
      version: 'v1',
    },
  };
}

function createListEnvelope<TItem>(items: readonly TItem[], requestId: string) {
  return {
    requestId,
    timestamp: '2026-04-11T10:00:00.000Z',
    items: [...items],
    meta: {
      page: 1,
      pageSize: items.length,
      total: items.length,
      version: 'v1',
    },
  };
}

const observedRequests: Array<{
  method: string;
  path: string;
}> = [];

const { createBirdCoderAppSdkApiClient } = await import(
  `${sdkClientsModulePath.href}?t=${Date.now()}`
);

const client = createBirdCoderAppSdkApiClient({
  transport: {
    async request<TResponse>(request: { method: string; path: string }): Promise<TResponse> {
      observedRequests.push({
        method: request.method,
        path: request.path,
      });

      switch (request.path) {
        case '/app/v3/api/coding_sessions/session-generated':
          return createEnvelope(
            {
              id: 'session-generated',
              workspaceId: 'workspace-1',
              projectId: 'project-1',
              engineKey: 'codex',
              title: 'Generated Core Projection Session',
              status: 'running',
              mode: 'agent',
              createdAt: '2026-04-11T10:00:00.000Z',
              updatedAt: '2026-04-11T10:05:00.000Z',
              lastTurnAt: '2026-04-11T10:04:00.000Z',
              lastErrorCode: undefined,
              lastErrorMessage: undefined,
            },
            'req.app.session',
          ) as TResponse;
        case '/app/v3/api/coding_sessions/session-generated/events':
          return createListEnvelope(
            [
              {
                id: 'event-1',
                sessionId: 'session-generated',
                kind: 'message.delta',
                payload: {
                  text: 'delta',
                },
                createdAt: '2026-04-11T10:01:00.000Z',
              },
            ],
            'req.app.events',
          ) as TResponse;
        case '/app/v3/api/coding_sessions/session-generated/artifacts':
          return createListEnvelope(
            [
              {
                id: 'artifact-1',
                sessionId: 'session-generated',
                artifactKind: 'patch',
                title: 'Patch Artifact',
                uri: 'file:///artifacts/patch.diff',
                createdAt: '2026-04-11T10:02:00.000Z',
              },
            ],
            'req.app.artifacts',
          ) as TResponse;
        case '/app/v3/api/coding_sessions/session-generated/checkpoints':
          return createListEnvelope(
            [
              {
                id: 'checkpoint-1',
                sessionId: 'session-generated',
                label: 'Before refactor',
                summary: 'Captured before projection facade refactor.',
                createdAt: '2026-04-11T10:03:00.000Z',
              },
            ],
            'req.app.checkpoints',
          ) as TResponse;
        default:
          throw new Error(`Unhandled request: ${request.method} ${request.path}`);
      }
    },
  },
});

const session = await client.getCodingSession('session-generated');
const events = await client.listCodingSessionEvents('session-generated');
const artifacts = await client.listCodingSessionArtifacts('session-generated');
const checkpoints = await client.listCodingSessionCheckpoints('session-generated');

assert.equal(session.id, 'session-generated');
assert.equal(events[0]?.id, 'event-1');
assert.equal(artifacts[0]?.id, 'artifact-1');
assert.equal(checkpoints[0]?.id, 'checkpoint-1');
assert.deepEqual(observedRequests, [
  {
    method: 'GET',
    path: '/app/v3/api/coding_sessions/session-generated',
  },
  {
    method: 'GET',
    path: '/app/v3/api/coding_sessions/session-generated/events',
  },
  {
    method: 'GET',
    path: '/app/v3/api/coding_sessions/session-generated/artifacts',
  },
  {
    method: 'GET',
    path: '/app/v3/api/coding_sessions/session-generated/checkpoints',
  },
]);

console.log('app runtime SDK projection read client facade contract passed.');
