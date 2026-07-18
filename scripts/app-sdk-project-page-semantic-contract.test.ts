import assert from 'node:assert/strict';
import type {
  BirdCoderApiTransport,
  BirdCoderApiTransportRequest,
} from '@sdkwork/birdcoder-pc-contracts-commons';

const sdkClientsModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts',
  import.meta.url,
);

interface BirdCoderProjectPage {
  items: Array<{
    id: string;
  }>;
  pageInfo: {
    hasMore: boolean;
    mode: 'offset';
    page: number;
    pageSize: number;
    totalItems: string;
    totalPages: number;
  };
}

interface BirdCoderProjectPageSemanticFacade {
  listProjectPage(input: {
    page: number;
    pageSize: number;
    workspaceId: string;
  }): Promise<BirdCoderProjectPage>;
}

const workspaceId = 'workspace-semantic-project-page-contract';
const observedRequests: BirdCoderApiTransportRequest[] = [];
const projectPageResponse = {
  code: 0 as const,
  data: {
    items: [
      {
        createdAt: '2026-07-10T00:00:00.000Z',
        id: 'project-semantic-page-21',
        name: 'Semantic Project Page 21',
        status: 'active' as const,
        updatedAt: '2026-07-10T00:00:00.000Z',
        workspaceId,
      },
      {
        createdAt: '2026-07-10T00:00:00.000Z',
        id: 'project-semantic-page-22',
        name: 'Semantic Project Page 22',
        status: 'active' as const,
        updatedAt: '2026-07-10T00:00:00.000Z',
        workspaceId,
      },
    ],
    pageInfo: {
      hasMore: false,
      mode: 'offset' as const,
      page: 2,
      pageSize: 20,
      totalItems: '22',
      totalPages: 2,
    },
  },
  traceId: 'trace-semantic-project-page-contract',
};

const transport: BirdCoderApiTransport = {
  async request<TResponse>(request: BirdCoderApiTransportRequest): Promise<TResponse> {
    observedRequests.push(request);
    return projectPageResponse as TResponse;
  },
};

const { createBirdCoderAppSdkApiClient } = await import(
  `${sdkClientsModulePath.href}?t=${Date.now()}`,
);
const appClient = createBirdCoderAppSdkApiClient({ transport });
const semanticFacade = appClient as unknown as BirdCoderProjectPageSemanticFacade;
const projectPage = await semanticFacade.listProjectPage({
  page: 2,
  pageSize: 20,
  workspaceId,
});

assert.deepEqual(
  observedRequests.map((request) => ({
    method: request.method,
    path: request.path,
    query: request.query,
  })),
  [
    {
      method: 'GET',
      path: '/app/v3/api/projects',
      query: {
        page: 2,
        page_size: 20,
        workspaceId,
      },
    },
  ],
  'the semantic project page facade must preserve standard page and page_size on the composed app SDK wire.',
);

assert.deepEqual(
  projectPage,
  {
    items: projectPageResponse.data.items,
    pageInfo: projectPageResponse.data.pageInfo,
  },
  'the semantic project page facade must retain the complete standard PageInfo instead of collapsing the result to items.',
);

const requestCountBeforeInvalidInput = observedRequests.length;
await assert.rejects(
  () =>
    semanticFacade.listProjectPage({
      page: 0,
      pageSize: 20,
      workspaceId,
    }),
  /positive integer/u,
  'the semantic project page facade must reject page zero before it reaches the composed SDK transport.',
);
await assert.rejects(
  () =>
    semanticFacade.listProjectPage({
      page: 1,
      pageSize: 201,
      workspaceId,
    }),
  /between 1 and 200/u,
  'the semantic project page facade must reject page sizes above the standard maximum before it reaches the composed SDK transport.',
);
await assert.rejects(
  () =>
    semanticFacade.listProjectPage({
      page: 1,
      pageSize: 20,
      workspaceId: ' \t ',
    }),
  /must not be blank/u,
  'the semantic project page facade must reject a blank workspace id before it reaches the composed SDK transport.',
);
assert.equal(
  observedRequests.length,
  requestCountBeforeInvalidInput,
  'invalid semantic project page input must not issue a transport request.',
);

console.log('app SDK semantic project page contract passed.');
