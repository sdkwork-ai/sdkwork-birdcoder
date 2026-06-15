import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sdkTransportSharedModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkTransportShared.ts',
  import.meta.url,
);
const rustHostLibSource = readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/src-host/src/lib.rs', import.meta.url),
  'utf8',
).replace(/\r\n?/g, '\n');

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

const localCorsLayerStart = rustHostLibSource.indexOf('fn build_local_cors_layer() -> CorsLayer');
assert.notEqual(
  localCorsLayerStart,
  -1,
  'Rust local coding server must keep CORS policy centralized in build_local_cors_layer.',
);
const localCorsLayerEnd = rustHostLibSource.indexOf('        .max_age(', localCorsLayerStart);
assert.notEqual(
  localCorsLayerEnd,
  -1,
  'Rust local coding server CORS layer must keep an explicit max_age call after the allow-lists.',
);
const localCorsLayerSource = rustHostLibSource.slice(localCorsLayerStart, localCorsLayerEnd);

assert.match(
  localCorsLayerSource,
  /Method::PUT/,
  'Rust local CORS allow-methods must include PUT because app.syncModelConfig uses PUT /app/v3/api/model_config from browser-hosted clients.',
);

const rustPreflightTestStart = rustHostLibSource.indexOf(
  'async fn app_routes_accept_loopback_cors_preflight_requests()',
);
assert.notEqual(
  rustPreflightTestStart,
  -1,
  'Rust local coding server must keep a browser preflight regression test for app routes.',
);
const rustPreflightTestEnd = rustHostLibSource.indexOf('\n    }\n}', rustPreflightTestStart);
assert.notEqual(
  rustPreflightTestEnd,
  -1,
  'Rust local coding server browser preflight regression test must be syntactically discoverable by the API transport standard gate.',
);
const rustPreflightTestSource = rustHostLibSource.slice(
  rustPreflightTestStart,
  rustPreflightTestEnd,
);

assert.match(
  rustPreflightTestSource,
  /\.uri\("\/app\/v3\/api\/model_config"\)/,
  'Rust browser preflight regression test must cover the app model_config route that is called during startup preference sync.',
);
assert.match(
  rustPreflightTestSource,
  /\.header\("access-control-request-method", "PUT"\)/,
  'Rust browser preflight regression test must request PUT so model-config sync cannot regress CORS again.',
);

for (const [requiredHeader, allowListPattern, preflightPattern] of [
  [
    'authorization',
    /header::AUTHORIZATION/,
    /header::AUTHORIZATION\.as_str\(\)/,
  ],
  [
    'Access-Token',
    /parse_canonical_iam_header_name\(IAM_ACCESS_TOKEN_HEADER_NAME\)/,
    /IAM_ACCESS_TOKEN_HEADER_NAME/,
  ],
  [
    'refresh-token',
    /HeaderName::from_static\("refresh-token"\)/,
    /"refresh-token"/,
  ],
  [
    'idempotency-key',
    /HeaderName::from_static\("idempotency-key"\)/,
    /"idempotency-key"/,
  ],
  [
    'x-request-id',
    /HeaderName::from_static\("x-request-id"\)/,
    /"x-request-id"/,
  ],
] as const) {
  assert.match(
    localCorsLayerSource,
    allowListPattern,
    `Rust local CORS allow-list must allow the browser request header ${requiredHeader}.`,
  );
  assert.match(
    rustPreflightTestSource,
    preflightPattern,
    `Rust browser preflight regression test must request ${requiredHeader} so local web/desktop shells cannot regress the SDKWork IAM app API transport.`,
  );
}

console.log('http api transport cors contract passed.');
