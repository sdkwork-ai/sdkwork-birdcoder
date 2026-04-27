import assert from 'node:assert/strict';
import fs from 'node:fs';

const authContextSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/context/AuthContext.ts', import.meta.url),
  'utf8',
);

const refreshCurrentUserMatch = authContextSource.match(
  /const refreshCurrentUserWithFallback = useCallback\(async \(fallbackUser\?: User\) => \{([\s\S]*?)\n  \}, \[authService\]\);/,
);

assert.ok(
  refreshCurrentUserMatch,
  'AuthContext must keep fallback-aware current-user refresh as an explicit guarded internal callback.',
);

const refreshCurrentUserBody = refreshCurrentUserMatch[1];

assert.match(
  refreshCurrentUserBody,
  /const refreshAuthMutationVersion = authMutationVersionRef\.current;/,
  'Fallback-aware current-user refresh must capture the auth mutation version before awaiting profile hydration.',
);

assert.match(
  refreshCurrentUserBody,
  /if \(authMutationVersionRef\.current !== refreshAuthMutationVersion\) \{[\s\S]*return null;[\s\S]*\}/,
  'Fallback-aware current-user refresh must not publish a fallback or hydrated user when a newer login, registration, exchange, or logout happened while the profile request was in flight.',
);

const loadUserCenterConfigMatch = authContextSource.match(
  /const loadUserCenterConfig = async \(\) => \{([\s\S]*?)\n    \};/,
);

assert.ok(
  loadUserCenterConfigMatch,
  'AuthContext must keep user-center config hydration as an explicit bootstrap task.',
);

const loadUserCenterConfigBody = loadUserCenterConfigMatch[1];

assert.match(
  loadUserCenterConfigBody,
  /const configSyncAuthMutationVersion = authMutationVersionRef\.current;[\s\S]*const currentUserAfterConfigSync = await authService\.getCurrentUser\(\);[\s\S]*authMutationVersionRef\.current !== configSyncAuthMutationVersion/,
  'Config-synchronized profile retry must also be version guarded so a late metadata retry cannot resurrect a user after logout.',
);

console.log('auth interactive refresh stale mutation guard contract passed.');
