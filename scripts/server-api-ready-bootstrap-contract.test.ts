import assert from 'node:assert/strict';

const modulePath = new URL(
  '../packages/sdkwork-birdcoder-shell-runtime/src/application/bootstrap/bootstrapServerApiReady.ts',
  import.meta.url,
);

const { waitForBirdCoderApiReady } = await import(`${modulePath.href}?t=${Date.now()}`);

const observedReadinessUrls: string[] = [];
const originalFetch = globalThis.fetch;

globalThis.fetch = (async (input: RequestInfo | URL) => {
  observedReadinessUrls.push(String(input));
  return {
    ok: true,
    status: 200,
  } as Response;
}) as typeof fetch;

try {
  await waitForBirdCoderApiReady('http://127.0.0.1:10240/birdcoder-gateway', {
    maxAttempts: 1,
    paths: ['/app/v3/api/system/health', 'app/v3/api/system/iam/runtime'],
    requestTimeoutMs: 10,
    retryDelayMs: 1,
  });
} finally {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  } else {
    Reflect.deleteProperty(globalThis, 'fetch');
  }
}

assert.deepEqual(
  observedReadinessUrls.map((url) => new URL(url).pathname),
  [
    '/birdcoder-gateway/app/v3/api/system/health',
    '/birdcoder-gateway/app/v3/api/system/iam/runtime',
  ],
  'Startup API readiness probes must preserve the configured server Base URL path prefix so sub-path and reverse-proxy deployments do not probe the wrong gateway.',
);

let failedProbeCount = 0;
globalThis.fetch = (async () => {
  failedProbeCount += 1;
  throw new Error('connect ECONNREFUSED 127.0.0.1:10240');
}) as typeof fetch;

try {
  await assert.rejects(
    waitForBirdCoderApiReady('http://127.0.0.1:10240', {
      maxAttempts: 2,
      paths: ['/app/v3/api/system/health'],
      requestTimeoutMs: 10,
      retryDelayMs: 1,
    }),
    /BirdCoder local API is unavailable at http:\/\/127\.0\.0\.1:10240/u,
    'Startup must fail fast when a configured local BirdCoder API cannot be reached, instead of rendering appbase SDK consumers that then flood the browser with ERR_CONNECTION_REFUSED.',
  );
} finally {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  } else {
    Reflect.deleteProperty(globalThis, 'fetch');
  }
}

assert.equal(
  failedProbeCount,
  2,
  'Startup readiness should honor maxAttempts before surfacing the local API startup failure.',
);

console.log('server api ready bootstrap contract passed.');
