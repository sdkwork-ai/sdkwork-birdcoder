import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const h5CorePrefix = 'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-core/src';
const persistenceSource = read(`${h5CorePrefix}/bootstrap/appSessionPersistenceBinding.ts`);
const sessionStorageSource = read(`${h5CorePrefix}/session/birdCoderSessionStorage.ts`);
const tokenManagerSource = read(`${h5CorePrefix}/bootstrap/tokenManager.ts`);
const iamRuntimeSource = read(`${h5CorePrefix}/bootstrap/iamRuntime.ts`);
const bootstrapSource = read(
  'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-shell/src/bootstrap/createBootstrapRuntime.ts',
);
const authContextSource = read(
  'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-shell/src/auth/BirdCoderH5AuthContext.tsx',
);
const capacitorHostSource = read(
  'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-capacitor/src/hostAdapters.ts',
);

assert.match(persistenceSource, /readBirdCoderSessionRecord\(\)/u);
assert.match(persistenceSource, /getBirdCoderGlobalTokenManager\(\)/u);
assert.match(persistenceSource, /tokenManager\.setTokens/u);
assert.match(persistenceSource, /accessToken: session\.accessToken/u);
assert.match(persistenceSource, /authToken: session\.authToken/u);
assert.match(persistenceSource, /refreshToken: session\.refreshToken/u);
assert.doesNotMatch(
  persistenceSource,
  /bindAppSessionPersistencePort|hydrateAppSessionPersistence|birdcoder-pc/u,
);

assert.match(sessionStorageSource, /getBirdCoderSecureStorageAdapter/u);
assert.match(sessionStorageSource, /accessToken: string/u);
assert.match(sessionStorageSource, /authToken: string/u);
assert.match(sessionStorageSource, /refreshToken\?: string/u);
assert.match(sessionStorageSource, /sessionId\?: string/u);
assert.match(sessionStorageSource, /context\?: IamAppContext/u);
assert.match(sessionStorageSource, /writeBirdCoderSessionRecord/u);
assert.match(sessionStorageSource, /clearBirdCoderSessionRecord/u);

assert.match(tokenManagerSource, /__SDKWORK_BIRDCODER_H5_TOKEN_MANAGER__/u);
assert.match(tokenManagerSource, /createTokenManager\(\)/u);
assert.equal(
  (tokenManagerSource.match(/createTokenManager\(\)/gu) ?? []).length,
  1,
  'H5 core must construct exactly one global TokenManager.',
);

assert.match(iamRuntimeSource, /getBirdCoderGlobalTokenManager\(\)/u);
assert.match(iamRuntimeSource, /sessionBridge:/u);
assert.match(iamRuntimeSource, /clearBirdCoderSessionRecord\(\)/u);
assert.match(iamRuntimeSource, /writeBirdCoderSessionRecord\(persisted\)/u);
assert.match(iamRuntimeSource, /readSession: readBirdCoderSessionRecord/u);
assert.match(iamRuntimeSource, /sdkClients/u);

assert.match(authContextSource, /runtime\.hydrateTokenManager\(\)/u);
assert.match(authContextSource, /service\.auth\.sessions\.current\.retrieve\(\)/u);
assert.match(authContextSource, /service\.auth\.sessions\.current\.delete\(\)/u);
assert.match(authContextSource, /controller\.logout\(\)/u);
assert.doesNotMatch(authContextSource, /localStorage|sessionStorage|fetch\(/u);

assert.match(
  bootstrapSource,
  /await hydrateBirdCoderH5AppSessionPersistence\(\)/u,
  'H5 bootstrap must hydrate centralized session state before shell runtime bootstrap.',
);
assert.match(capacitorHostSource, /bindBirdCoderSecureStorageAdapter\(secureStorage\)/u);
assert.doesNotMatch(capacitorHostSource, /bindBirdCoderH5AppSessionPersistence/u);

console.log('h5 native IAM session persistence contract passed.');
