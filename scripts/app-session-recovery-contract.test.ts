import assert from 'node:assert/strict';
import { syncBirdCoderGlobalTokenManagerFromStorage } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-core/src/appSessionTokenManager.ts';
import {
  clearStoredAppSessionToken,
  storeAppSessionFromResult,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSessionToken.ts';
import { executeBirdCoderProtectedOperationWithRecovery } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSessionRecovery.ts';
import { stopBirdCoderAppSessionRefreshLoop } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSessionRefresh.ts';
import { getBirdCoderGlobalTokenManager } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-core/src/appSessionTokenManager.ts';
import { BirdCoderApiTransportError } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/apiTransportError.ts';

const originalFetch = globalThis.fetch;
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const nextExpiresAt = Math.floor(Date.now() / 1000) + 3_600;
let refreshRequestCount = 0;
let refreshShouldFail = false;

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    __SDKWORK_PC_REACT_ENV__: {
      VITE_SDKWORK_BIRDCODER_PLATFORM_API_GATEWAY_HTTP_URL:
        'http://platform.test',
    },
    location: {
      hash: '#/workspace',
      origin: 'http://birdcoder.test',
      pathname: '/',
      replace() {},
      search: '',
    },
  },
});

storeAppSessionFromResult({
  accessToken: 'access-before-refresh',
  authToken: 'auth-before-refresh',
  expiresAt: Math.floor(Date.now() / 1000) + 300,
  refreshToken: 'refresh-before-refresh',
  sessionId: 'session-recovery-contract',
});
syncBirdCoderGlobalTokenManagerFromStorage();

globalThis.fetch = (async () => {
  refreshRequestCount += 1;
  await new Promise((resolve) => setTimeout(resolve, 5));
  if (refreshShouldFail) {
    return new Response(JSON.stringify({
      code: 50301,
      detail: 'The session authority is temporarily unavailable.',
      traceId: 'trace-refresh-failure-contract',
    }), {
      headers: { 'Content-Type': 'application/problem+json' },
      status: 503,
    });
  }
  return new Response(JSON.stringify({
    code: 0,
    data: {
      item: {
        accessToken: 'access-after-refresh',
        authToken: 'auth-after-refresh',
        expiresAt: nextExpiresAt,
        refreshToken: 'refresh-after-refresh',
        sessionId: 'session-recovery-contract',
      },
    },
    traceId: 'trace-refresh-contract',
  }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
}) as typeof fetch;

const unauthorized = new BirdCoderApiTransportError({
  code: 40101,
  detail: 'The authenticated session is no longer valid.',
  httpStatus: 401,
  method: 'GET',
  path: '/app/v3/api/drive/sandboxes',
});
const operationAttempts = [0, 0];

const results = await Promise.all(operationAttempts.map(async (_, index) => (
  executeBirdCoderProtectedOperationWithRecovery(async () => {
    operationAttempts[index] += 1;
    if (operationAttempts[index] === 1) {
      throw unauthorized;
    }
    return `recovered-${index}`;
  }, { retryAfterRefresh: true })
)));

assert.deepEqual(results, ['recovered-0', 'recovered-1']);
assert.deepEqual(operationAttempts, [2, 2]);
assert.equal(refreshRequestCount, 1, 'concurrent 401 responses must share one refresh request.');
assert.deepEqual(getBirdCoderGlobalTokenManager().getTokens(), {
  accessToken: 'access-after-refresh',
  authToken: 'auth-after-refresh',
  expiresAt: nextExpiresAt * 1000,
  refreshToken: 'refresh-after-refresh',
});

refreshShouldFail = true;
await assert.rejects(
  executeBirdCoderProtectedOperationWithRecovery(async () => {
    throw unauthorized;
  }, { retryAfterRefresh: true }),
  (error: unknown) => error === unauthorized,
);
assert.deepEqual(
  getBirdCoderGlobalTokenManager().getTokens(),
  {},
  'a failed refresh request must clear the global token manager.',
);

stopBirdCoderAppSessionRefreshLoop();
clearStoredAppSessionToken();
globalThis.fetch = originalFetch;
if (originalWindowDescriptor) {
  Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
} else {
  Reflect.deleteProperty(globalThis, 'window');
}

console.log('app session recovery contract passed.');
