import assert from 'node:assert/strict';

import { BirdCoderApiTransportError } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/apiTransportError.ts';
import { createBirdCoderHttpApiTransport } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkTransportShared.ts';

const transport = createBirdCoderHttpApiTransport({
  baseUrl: 'http://127.0.0.1:13003',
  fetchImpl: async () => new Response(JSON.stringify({
    type: 'https://sdkwork.com/problems/invalid-parameter',
    title: 'Invalid parameter',
    status: 400,
    code: 40003,
    traceId: '4f9af4b9-f0b1-4a90-b414-510d0f16bf4c',
    detail: 'page_size must be between 1 and 200.',
  }), {
    status: 400,
    headers: {
      'Content-Type': 'application/problem+json',
    },
  }),
});

await assert.rejects(
  () => transport.request({
    method: 'GET',
    path: '/app/v3/api/workspaces',
  }),
  (error: unknown) => {
    assert.equal(error instanceof BirdCoderApiTransportError, true);
    const transportError = error as BirdCoderApiTransportError;
    assert.equal(transportError.httpStatus, 400);
    assert.equal(transportError.code, 40003);
    assert.equal(transportError.traceId, '4f9af4b9-f0b1-4a90-b414-510d0f16bf4c');
    assert.equal(transportError.detail, 'page_size must be between 1 and 200.');
    return true;
  },
  'SDKWork ProblemDetail fields must remain typed on the PC transport error.',
);

console.log('http api transport ProblemDetail contract passed.');
