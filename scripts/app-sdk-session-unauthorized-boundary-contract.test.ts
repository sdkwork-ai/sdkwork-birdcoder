import assert from 'node:assert/strict';
import { BirdCoderApiTransportError } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-core/src/birdCoderApiTransportError.ts';
import {
  createBirdCoderAppSdkApiClient,
  getBirdCoderGlobalTokenManager,
  resetBirdCoderSdkSessionAuthRedirectState,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';

const tokenManager = getBirdCoderGlobalTokenManager();
tokenManager.setTokens({
  accessToken: 'access-token-before-unauthorized-response',
  authToken: 'auth-token-before-unauthorized-response',
});
resetBirdCoderSdkSessionAuthRedirectState();

const unauthorizedError = new BirdCoderApiTransportError({
  code: 40101,
  detail: 'The authenticated session is no longer valid.',
  httpStatus: 401,
  method: 'GET',
  path: '/app/v3/api/intelligence/coding_sessions/session-unauthorized',
});
const client = createBirdCoderAppSdkApiClient({
  transport: {
    async request<TResponse>(): Promise<TResponse> {
      throw unauthorizedError;
    },
  },
});

await assert.rejects(
  client.getCodingSession('session-unauthorized'),
  (error: unknown) => error === unauthorizedError,
  'the composed SDK client must preserve the original unauthorized error for its caller.',
);
assert.deepEqual(
  tokenManager.getTokens(),
  {},
  'the composed SDK client must route 401 responses through the shared unauthorized boundary and clear the global session.',
);

console.log('app SDK session unauthorized boundary contract passed.');
