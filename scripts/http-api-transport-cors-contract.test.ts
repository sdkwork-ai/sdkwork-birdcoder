import assert from 'node:assert/strict';

const appAdminApiClientModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts',
  import.meta.url,
);

let capturedInit: RequestInit | undefined;

const { createBirdCoderHttpApiTransport } = await import(
  `${appAdminApiClientModulePath.href}?t=${Date.now()}`
);

const transport = createBirdCoderHttpApiTransport({
  baseUrl: 'http://127.0.0.1:10240',
  fetchImpl: async (_input, init) => {
    capturedInit = init;
    return new Response(
      JSON.stringify({
        items: [],
        meta: {
          page: 1,
          pageSize: 0,
          total: 0,
          version: 'v1',
        },
        requestId: 'req.http-api-transport-cors-contract',
        timestamp: '2026-04-16T00:00:00.000Z',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  },
});

await transport.request({
  method: 'GET',
  path: '/api/app/v1/workspaces',
});

assert.equal(capturedInit?.method, 'GET');
assert.deepEqual(
  capturedInit?.headers,
  {
    Accept: 'application/json',
  },
  'cross-origin GET requests must not send a synthetic Content-Type header when there is no body, otherwise the browser escalates the request into an unnecessary CORS preflight.',
);

console.log('http api transport cors contract passed.');
