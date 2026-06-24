import assert from 'node:assert/strict';

import {
  AUTH_SURFACE_BASE_PATH,
  AUTH_SURFACE_DEFAULT_ROUTE,
  isAuthSurfaceLocationPath,
  normalizeAuthSurfaceLocationPath,
  shouldBootIntoAuthSurface,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/src/authSurface.ts';

assert.equal(normalizeAuthSurfaceLocationPath(' auth/login '), '/auth/login');
assert.equal(normalizeAuthSurfaceLocationPath('/auth/login'), '/auth/login');
assert.equal(normalizeAuthSurfaceLocationPath(''), '');

assert.equal(isAuthSurfaceLocationPath(AUTH_SURFACE_BASE_PATH), true);
assert.equal(isAuthSurfaceLocationPath(AUTH_SURFACE_DEFAULT_ROUTE), true);
assert.equal(isAuthSurfaceLocationPath('/app/chat'), false);

const originalWindow = globalThis.window;

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    location: {
      pathname: '/auth/login',
      search: '',
      hash: '',
    },
    history: {
      state: null,
      replaceState: () => undefined,
    },
  },
});

assert.equal(shouldBootIntoAuthSurface(), true);

globalThis.window.location.pathname = '/';
globalThis.window.location.hash = '#/auth/login';
assert.equal(shouldBootIntoAuthSurface(), true);

globalThis.window.location.hash = '';
assert.equal(shouldBootIntoAuthSurface(), false);

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: originalWindow,
});

console.log('auth surface routing contract passed.');
