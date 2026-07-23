import assert from 'node:assert/strict';

import {
  buildBirdCoderProtectedLoginPath,
  isBirdCoderAuthSurfacePath,
} from '@sdkwork/birdcoder-pc-contracts-commons/authSurfacePaths';
import { BirdCoderApiTransportError, readBirdCoderApiTransportErrorHttpStatus } from '@sdkwork/birdcoder-pc-contracts-commons/apiTransportError';
import { buildBirdCoderProtectedLoginBrowserUrl } from '@sdkwork/birdcoder-pc-core/appSessionAuthRedirect';

assert.equal(buildBirdCoderProtectedLoginPath('/app/chat'), '/auth/login?redirect=%2Fapp%2Fchat');
assert.equal(buildBirdCoderProtectedLoginPath('/auth/login'), '/auth/login');
assert.equal(
  buildBirdCoderProtectedLoginPath('/authentication'),
  '/auth/login?redirect=%2Fauthentication',
);
assert.equal(isBirdCoderAuthSurfacePath('/auth/login'), true);
assert.equal(isBirdCoderAuthSurfacePath('/app/chat'), false);

const originalWindow = globalThis.window;

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    location: {
      pathname: '/',
      search: '',
      hash: '#/app/chat',
    },
  },
});

assert.equal(
  buildBirdCoderProtectedLoginBrowserUrl('/app/chat'),
  '/#/auth/login?redirect=%2Fapp%2Fchat',
);
assert.equal(
  buildBirdCoderProtectedLoginBrowserUrl(),
  '/#/auth/login?redirect=%2F%23%2Fapp%2Fchat',
);

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: originalWindow,
});

const transportError = new BirdCoderApiTransportError({
  detail: 'session required',
  httpStatus: 401,
  method: 'GET',
  path: '/app/v3/api/workspaces',
});

assert.equal(readBirdCoderApiTransportErrorHttpStatus(transportError), 401);
assert.equal(
  readBirdCoderApiTransportErrorHttpStatus(
    new Error('BirdCoder API request failed: GET /app/v3/api/workspaces -> 401 (session required)'),
  ),
  401,
);

console.log('birdcoder session auth redirect contract passed.');
