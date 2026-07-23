import assert from 'node:assert/strict';

import { getBirdCoderGlobalTokenManager } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-core/src/appSessionTokenManager.ts';
import { createBirdCoderAppClient } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/birdCoderSdkClient.ts';
import { resetBirdCoderSdkSessionAuthRedirectState } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkSession.ts';

const originalFetch = globalThis.fetch;
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const redirects: string[] = [];

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    location: {
      hash: '#/app/workspace',
      origin: 'https://birdcoder.test',
      pathname: '/',
      replace(path: string) {
        redirects.push(path);
      },
      search: '',
    },
  },
});

const tokenManager = getBirdCoderGlobalTokenManager();
tokenManager.setTokens({
  accessToken: 'access-token-before-unauthorized-response',
  authToken: 'auth-token-before-unauthorized-response',
});
resetBirdCoderSdkSessionAuthRedirectState();

globalThis.fetch = (async () => new Response(JSON.stringify({
  code: 40101,
  detail: 'The authenticated session is no longer valid.',
  status: 401,
  title: 'Unauthorized',
  traceId: 'trace-app-sdk-session-unauthorized',
  type: 'https://sdkwork.com/problems/authentication-required',
}), {
  headers: { 'Content-Type': 'application/problem+json' },
  status: 401,
  statusText: 'Unauthorized',
})) as typeof fetch;

const client = createBirdCoderAppClient({
  apiBaseUrl: 'https://birdcoder.test',
  tokenManager,
});

await assert.rejects(
  client.intelligence.projects.retrieve('project-unauthorized'),
  (error: unknown) => error instanceof Error && error.message.includes('session is no longer valid'),
  'The generated client must preserve its authentication error for the caller.',
);
assert.deepEqual(
  tokenManager.getTokens(),
  {},
  'The composed client must route 401 responses through the shared unauthorized boundary.',
);
assert.equal(redirects.length, 1, 'Concurrent-safe unauthorized handling must redirect once.');
assert.match(redirects[0]!, /\/auth\/login/u);

globalThis.fetch = originalFetch;
if (originalWindowDescriptor) {
  Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
} else {
  Reflect.deleteProperty(globalThis, 'window');
}

console.log('app SDK session unauthorized boundary contract passed.');
