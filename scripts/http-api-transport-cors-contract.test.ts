import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  readCanonicalServerRustSource,
  CANONICAL_SERVER_RUST_PATHS,
} from './birdcoder-canonical-server-rust-sources.mjs';

const sdkTransportSharedModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkTransportShared.ts',
  import.meta.url,
);
const apiServerAuthSource = readCanonicalServerRustSource(CANONICAL_SERVER_RUST_PATHS.apiServerAuth);
const apiServerBootstrapSmokeSource = readCanonicalServerRustSource(
  CANONICAL_SERVER_RUST_PATHS.apiServerBootstrapSmoke,
);

let capturedInit: RequestInit | undefined;

const { createBirdCoderHttpApiTransport } = await import(
  `${sdkTransportSharedModulePath.href}?t=${Date.now()}`
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
  path: '/app/v3/api/workspaces',
});

assert.equal(capturedInit?.method, 'GET');
assert.deepEqual(
  capturedInit?.headers,
  {
    Accept: 'application/json',
  },
  'cross-origin GET requests must not send a synthetic Content-Type header when there is no body, otherwise the browser escalates the request into an unnecessary CORS preflight.',
);

assert.match(
  apiServerAuthSource,
  /build_security_policy\(config: &BirdServerConfig\) -> SecurityPolicy/,
  'api-server auth bootstrap must centralize CORS policy in build_security_policy.',
);
assert.match(
  apiServerAuthSource,
  /CorsPolicy \{/,
  'api-server auth bootstrap must configure sdkwork-web-core CorsPolicy.',
);
assert.match(
  apiServerAuthSource,
  /allowed_origins: default_loopback_cors_origins\(\)/,
  'loopback api-server hosts must use explicit loopback CORS origins for browser shells.',
);

assert.match(
  apiServerBootstrapSmokeSource,
  /cors_layer_allows_configured_origins/,
  'api-server bootstrap smoke tests must keep a CORS regression test for configured origins.',
);

console.log('http api transport cors contract passed.');
