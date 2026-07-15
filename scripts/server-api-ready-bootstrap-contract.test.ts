import assert from 'node:assert/strict';

const modulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell-runtime/src/application/bootstrap/bootstrapServerApiReady.ts',
  import.meta.url,
);

const { BirdCoderApiReadyError, waitForBirdCoderApiReady } = await import(
  `${modulePath.href}?t=${Date.now()}`
);

const observedDefaultReadinessUrls: string[] = [];
const observedReadinessUrls: string[] = [];
const originalFetch = globalThis.fetch;

globalThis.fetch = (async (input: RequestInfo | URL) => {
  observedDefaultReadinessUrls.push(String(input));
  return {
    ok: true,
    status: 200,
  } as Response;
}) as typeof fetch;

try {
  await waitForBirdCoderApiReady('http://127.0.0.1:10240/birdcoder-gateway', {
    maxAttempts: 1,
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
  observedDefaultReadinessUrls.map((url) => new URL(url).pathname),
  ['/birdcoder-gateway/readyz'],
  'Startup API readiness must use the anonymous infrastructure readiness probe by default. Business app-api health routes require login credentials and must not be used as pre-auth server readiness probes.',
);

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
  await assert.rejects(async () => {
    try {
      await waitForBirdCoderApiReady('http://127.0.0.1:10240', {
        maxAttempts: 2,
        paths: ['/app/v3/api/system/health'],
        requestTimeoutMs: 10,
        retryDelayMs: 1,
        runtimeTarget: 'desktop',
      });
    } catch (error) {
      assert.ok(error instanceof BirdCoderApiReadyError);
      assert.equal(error.apiBaseUrl, 'http://127.0.0.1:10240');
      assert.equal(error.runtimeTarget, 'desktop');
      throw error;
    }
  }, /BirdCoder embedded API is unavailable at http:\/\/127\.0\.0\.1:10240/u,
  'Startup must classify an unavailable embedded API as a desktop runtime failure instead of instructing desktop users to start a separate server.');
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
