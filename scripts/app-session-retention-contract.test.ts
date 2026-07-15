import assert from 'node:assert/strict';

import {
  bindAppSessionPersistencePort,
  resetAppSessionPersistencePort,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-core/src/appSessionPersistence.ts';
import {
  loadStoredAppSessionToken,
  resetAppSessionTokenStorageCache,
  storeAppSessionFromResult,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-core/src/appSessionToken.ts';
import {
  getBirdCoderGlobalTokenManager,
  resetBirdCoderGlobalTokenManager,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-core/src/appSessionTokenManager.ts';

let persistedSession: string | null = null;
bindAppSessionPersistencePort({
  read: () => persistedSession,
  remove: () => {
    persistedSession = null;
  },
  write: (raw) => {
    persistedSession = raw;
  },
});

const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
storeAppSessionFromResult({
  accessToken: 'access-token',
  authToken: 'auth-token',
  expiresAt,
  refreshToken: 'rotating-refresh-token',
  sessionId: 'session-id',
});

resetAppSessionTokenStorageCache();
resetBirdCoderGlobalTokenManager();

const restored = loadStoredAppSessionToken();
assert.equal(restored?.accessToken, 'access-token');
assert.equal(restored?.authToken, 'auth-token');
assert.equal(restored?.refreshToken, 'rotating-refresh-token');
assert.equal(restored?.expiresAt, expiresAt);

const tokenManager = getBirdCoderGlobalTokenManager();
assert.equal(tokenManager.getAccessToken(), 'access-token');
assert.equal(tokenManager.getAuthToken(), 'auth-token');
assert.equal(tokenManager.getRefreshToken(), 'rotating-refresh-token');

resetBirdCoderGlobalTokenManager();
resetAppSessionTokenStorageCache();
resetAppSessionPersistencePort();

console.log('app session retention contract passed.');
