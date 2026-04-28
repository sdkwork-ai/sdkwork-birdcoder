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
    paths: ['/api/core/v1/health', 'api/app/v1/auth/config'],
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
    '/birdcoder-gateway/api/core/v1/health',
    '/birdcoder-gateway/api/app/v1/auth/config',
  ],
  'Startup API readiness probes must preserve the configured server Base URL path prefix so sub-path and reverse-proxy deployments do not probe the wrong gateway.',
);

console.log('server api ready bootstrap contract passed.');
