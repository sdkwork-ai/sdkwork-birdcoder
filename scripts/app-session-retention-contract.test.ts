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
  // Secure port contract: OS-backed credential stores (desktop keyring) may
  // persist long-lived rotating credentials. In-memory browser-local ports
  // must strip the refresh token instead (see the insecure-port assertion
  // below).
  secureTokenStorage: true,
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

// Insecure ports must fail closed: the rotating refresh token stays in
// memory only and is never written to browser-local persistence.
let insecurePersisted: string | null = null;
bindAppSessionPersistencePort({
  secureTokenStorage: false,
  read: () => insecurePersisted,
  remove: () => {
    insecurePersisted = null;
  },
  write: (raw) => {
    insecurePersisted = raw;
  },
});
resetAppSessionTokenStorageCache();
storeAppSessionFromResult({
  accessToken: 'access-token',
  authToken: 'auth-token',
  expiresAt,
  refreshToken: 'rotating-refresh-token',
  sessionId: 'session-id',
});
assert.ok(insecurePersisted, 'insecure port must receive a persisted record');
assert.equal(
  JSON.parse(insecurePersisted as string).refreshToken,
  undefined,
  'insecure browser-local persistence must never store the rotating refresh token',
);
resetAppSessionTokenStorageCache();
const insecureRestored = loadStoredAppSessionToken();
assert.equal(insecureRestored?.accessToken, 'access-token');
assert.equal(insecureRestored?.refreshToken, undefined);

resetBirdCoderGlobalTokenManager();
resetAppSessionTokenStorageCache();
resetAppSessionPersistencePort();

console.log('app session retention contract passed.');
