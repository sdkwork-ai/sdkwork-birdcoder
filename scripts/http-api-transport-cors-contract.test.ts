import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appAdminApiClientModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts',
  import.meta.url,
);
const rustHostLibSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-server/src-host/src/lib.rs', import.meta.url),
  'utf8',
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
  'Rust local CORS allow-methods must include PUT because core.syncModelConfig uses PUT /api/core/v1/model-config from browser-hosted clients.',
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
  /\.uri\("\/api\/core\/v1\/model-config"\)/,
  'Rust browser preflight regression test must cover the core model-config route that is called during startup preference sync.',
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
    'x-sdkwork-user-center-session-id',
    /HeaderName::from_static\(BIRDCODER_SESSION_HEADER_NAME\)/,
    /BIRDCODER_SESSION_HEADER_NAME/,
  ],
  [
    'access-token',
    /HeaderName::from_static\("access-token"\)/,
    /"access-token"/,
  ],
  [
    'refresh-token',
    /HeaderName::from_static\("refresh-token"\)/,
    /"refresh-token"/,
  ],
  [
    'x-sdkwork-app-id',
    /HeaderName::from_static\(USER_CENTER_APP_ID_HEADER_NAME\)/,
    /USER_CENTER_APP_ID_HEADER_NAME/,
  ],
  [
    'x-sdkwork-user-center-provider-key',
    /HeaderName::from_static\(USER_CENTER_PROVIDER_KEY_HEADER_NAME\)/,
    /USER_CENTER_PROVIDER_KEY_HEADER_NAME/,
  ],
  [
    'x-sdkwork-user-center-handshake-mode',
    /HeaderName::from_static\(USER_CENTER_HANDSHAKE_MODE_HEADER_NAME\)/,
    /USER_CENTER_HANDSHAKE_MODE_HEADER_NAME/,
  ],
  [
    'x-sdkwork-user-center-secret-id',
    /HeaderName::from_static\(USER_CENTER_SECRET_ID_HEADER_NAME\)/,
    /USER_CENTER_SECRET_ID_HEADER_NAME/,
  ],
  [
    'x-sdkwork-user-center-signature',
    /HeaderName::from_static\(USER_CENTER_SIGNATURE_HEADER_NAME\)/,
    /USER_CENTER_SIGNATURE_HEADER_NAME/,
  ],
  [
    'x-sdkwork-user-center-signed-at',
    /HeaderName::from_static\(USER_CENTER_SIGNED_AT_HEADER_NAME\)/,
    /USER_CENTER_SIGNED_AT_HEADER_NAME/,
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
    `Rust browser preflight regression test must request ${requiredHeader} so local web/desktop shells cannot regress the user-center app API handshake.`,
  );
}

console.log('http api transport cors contract passed.');
