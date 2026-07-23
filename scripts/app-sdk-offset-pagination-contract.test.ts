import assert from 'node:assert/strict';
import type {
  BirdCoderApiTransport,
  BirdCoderApiTransportRequest,
} from '@sdkwork/birdcoder-pc-contracts-commons';

const sdkClientsModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts',
  import.meta.url,
);

const observedRequests: BirdCoderApiTransportRequest[] = [];
const transport: BirdCoderApiTransport = {
  async request<TResponse>(request: BirdCoderApiTransportRequest): Promise<TResponse> {
    observedRequests.push(request);
    return {
      code: 0,
      data: {
        items: [],
        pageInfo: {
          hasMore: false,
          mode: 'offset',
          page: 1,
          pageSize: 20,
          totalItems: '0',
          totalPages: 0,
        },
      },
      traceId: 'trace-app-sdk-offset-pagination-contract',
    } as TResponse;
  },
};

const { createBirdCoderAppSdkApiClient } = await import(
  `${sdkClientsModulePath.href}?t=${Date.now()}`,
);
const client = createBirdCoderAppSdkApiClient({ transport });

await client.listAgentSessions();
await client.listAgentSessions({ limit: 40, offset: 80 });
await client.listAgentSessions({ limit: 20, offset: 0 });

assert.deepEqual(
  observedRequests.map((request) => request.query),
  [
    { page_size: 20 },
    { page: 3, page_size: 40 },
    { page: 1, page_size: 20 },
  ],
  'offset pagination must preserve the default page size and convert aligned offsets exactly.',
);

const requestCountBeforeInvalidInputs = observedRequests.length;

for (const limit of [0, -1, 1.5, 201, Number.NaN, Number.POSITIVE_INFINITY]) {
  await assert.rejects(
    () => client.listAgentSessions({ limit }),
    /limit must be an integer between 1 and 200/u,
    `invalid pagination limit ${String(limit)} must fail before transport dispatch.`,
  );
}

for (const offset of [
  -1,
  1.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.MAX_SAFE_INTEGER + 1,
]) {
  await assert.rejects(
    () => client.listAgentSessions({ limit: 20, offset }),
    /offset must be a non-negative safe integer/u,
    `invalid pagination offset ${String(offset)} must fail before transport dispatch.`,
  );
}

await assert.rejects(
  () => client.listAgentSessions({ limit: 20, offset: 5 }),
  /offset must be aligned to page size 20/u,
  'a non-aligned offset must not silently select the wrong generated SDK page.',
);

await assert.rejects(
  () => client.listAgentSessions({ limit: 1, offset: Number.MAX_SAFE_INTEGER }),
  /offset produces an unsafe page number/u,
  'an aligned safe offset must still fail when the generated one-based page would overflow.',
);

assert.equal(
  observedRequests.length,
  requestCountBeforeInvalidInputs,
  'invalid pagination inputs must fail before dispatching a generated SDK transport request.',
);

console.log('app SDK offset pagination contract passed.');
