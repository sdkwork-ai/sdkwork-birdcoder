import assert from 'node:assert/strict';

const sdkClientsModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts',
  import.meta.url,
);

function createEnvelope<TData>(data: TData, traceId: string) {
  return {
    code: 0 as const,
    traceId,
    data,
  };
}

interface OffsetPageFixture {
  hasMore: boolean;
  page: number;
  pageSize: number;
  totalItems: string;
  totalPages: number;
}

function createListEnvelope<TItem>(
  items: readonly TItem[],
  traceId: string,
  pageInfo: OffsetPageFixture,
) {
  return {
    code: 0 as const,
    traceId,
    data: {
      items: [...items],
      pageInfo: {
        mode: 'offset' as const,
        ...pageInfo,
      },
    },
  };
}

const observedRequests: Array<{
  method: string;
  path: string;
  query?: Record<string, unknown>;
}> = [];

const eventFixtures = Array.from({ length: 205 }, (_, index) => ({
  id: `event-${String(index + 1).padStart(3, '0')}`,
  codingSessionId: 'session-generated',
  kind: index % 2 === 0 ? 'message.delta' : 'message.completed',
  sequence: String(index + 1),
  payload: {
    text: `event ${index + 1}`,
  },
  createdAt: new Date(Date.UTC(2026, 3, 11, 10, 1, index)).toISOString(),
}));

const { createBirdCoderAppSdkApiClient } = await import(
  `${sdkClientsModulePath.href}?t=${Date.now()}`
);

const client = createBirdCoderAppSdkApiClient({
  transport: {
    async request<TResponse>(request: {
      method: string;
      path: string;
      query?: Record<string, unknown>;
    }): Promise<TResponse> {
      observedRequests.push({
        method: request.method,
        path: request.path,
        ...(request.query ? { query: request.query } : {}),
      });

      switch (request.path) {
        case '/app/v3/api/intelligence/coding_sessions/session-generated':
          return createEnvelope(
            {
              id: 'session-generated',
              workspaceId: 'workspace-1',
              projectId: 'project-1',
              engineKey: 'codex',
              title: 'Generated App Runtime Projection Session',
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
        case '/app/v3/api/intelligence/coding_sessions/session-generated/events':
          if (request.query?.page === 1 && request.query.page_size === 200) {
            return createListEnvelope(
              eventFixtures.slice(0, 200),
              'req.app.events.page-1',
              {
                hasMore: true,
                page: 1,
                pageSize: 200,
                totalItems: '205',
                totalPages: 2,
              },
            ) as TResponse;
          }
          if (request.query?.page === 2 && request.query.page_size === 200) {
            return createListEnvelope(
              eventFixtures.slice(200),
              'req.app.events.page-2',
              {
                hasMore: false,
                page: 2,
                pageSize: 200,
                totalItems: '205',
                totalPages: 2,
              },
            ) as TResponse;
          }
          throw new Error(`Unhandled event page query: ${JSON.stringify(request.query)}`);
        case '/app/v3/api/intelligence/coding_sessions/session-generated/artifacts':
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
            {
              hasMore: false,
              page: 1,
              pageSize: 20,
              totalItems: '1',
              totalPages: 1,
            },
          ) as TResponse;
        case '/app/v3/api/intelligence/coding_sessions/session-generated/checkpoints':
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
            {
              hasMore: false,
              page: 1,
              pageSize: 20,
              totalItems: '1',
              totalPages: 1,
            },
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
assert.equal(events.length, 205);
assert.equal(events[0]?.id, 'event-001');
assert.equal(events.at(-1)?.id, 'event-205');
assert.equal(artifacts[0]?.id, 'artifact-1');
assert.equal(checkpoints[0]?.id, 'checkpoint-1');
assert.deepEqual(observedRequests, [
  {
    method: 'GET',
    path: '/app/v3/api/intelligence/coding_sessions/session-generated',
  },
  {
    method: 'GET',
    path: '/app/v3/api/intelligence/coding_sessions/session-generated/events',
    query: {
      page: 1,
      page_size: 200,
    },
  },
  {
    method: 'GET',
    path: '/app/v3/api/intelligence/coding_sessions/session-generated/events',
    query: {
      page: 2,
      page_size: 200,
    },
  },
  {
    method: 'GET',
    path: '/app/v3/api/intelligence/coding_sessions/session-generated/artifacts',
  },
  {
    method: 'GET',
    path: '/app/v3/api/intelligence/coding_sessions/session-generated/checkpoints',
  },
]);

const repeatedPageRequests: Array<Record<string, unknown> | undefined> = [];
const repeatedPageClient = createBirdCoderAppSdkApiClient({
  transport: {
    async request<TResponse>(request: {
      method: string;
      path: string;
      query?: Record<string, unknown>;
    }): Promise<TResponse> {
      repeatedPageRequests.push(request.query);
      return createListEnvelope(
        eventFixtures.slice(0, 200),
        'req.app.events.repeated-page',
        {
          hasMore: true,
          page: 1,
          pageSize: 200,
          totalItems: '205',
          totalPages: 2,
        },
      ) as TResponse;
    },
  },
});

await assert.rejects(
  () => repeatedPageClient.listCodingSessionEvents('session-generated'),
  /requested page 2 but received page 1/u,
);
assert.deepEqual(repeatedPageRequests, [
  { page: 1, page_size: 200 },
  { page: 2, page_size: 200 },
]);

console.log('app runtime SDK projection read client facade contract passed.');
