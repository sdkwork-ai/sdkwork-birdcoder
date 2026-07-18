import assert from 'node:assert/strict';
import fs from 'node:fs';

const authContextSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/context/AuthContext.ts', import.meta.url),
  'utf8',
);
const authGateSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/src/AuthGate.tsx', import.meta.url),
  'utf8',
);
const currentUserScopeSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/currentUserScope.ts', import.meta.url),
  'utf8',
);
const appSessionRefreshSource = fs.readFileSync(
  new URL('../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSessionRefresh.ts', import.meta.url),
  'utf8',
);

assert.match(
  authContextSource,
  /const authMutationVersionRef = useRef\(0\);/,
  'AuthContext must track auth mutations so in-flight current-user requests cannot publish stale results over user actions.',
);

assert.match(
  authContextSource,
  /async function loadCurrentUser\(\) \{\s*if \(loadingInProgress\) \{\s*reloadRequested = true;\s*return;\s*\}\s*loadingInProgress = true;\s*const currentAuthMutationVersion = authMutationVersionRef\.current;[\s\S]*if \(!isMounted \|\| authMutationVersionRef\.current !== currentAuthMutationVersion\) \{[\s\S]*return;[\s\S]*\}[\s\S]*setUser\(currentUser\);/u,
  'Each current-user hydration pass must capture its own auth mutation version so app-session changes after mount can publish fresh SDKWork IAM users.',
);

assert.match(
  authContextSource,
  /catch \(error\) \{[\s\S]*if \(!isMounted \|\| authMutationVersionRef\.current !== currentAuthMutationVersion\) \{[\s\S]*return;[\s\S]*\}[\s\S]*setUser\(null\);/u,
  'Current-user hydration failures must not clear a user adopted by a newer auth mutation.',
);

assert.match(
  authContextSource,
  /finally \{[\s\S]*if \(isMounted && authMutationVersionRef\.current === currentAuthMutationVersion\) \{[\s\S]*setIsLoading\(false\);[\s\S]*\}/u,
  'Current-user hydration must only close the loading gate for the latest auth mutation version.',
);

assert.match(
  authContextSource,
  /const refreshAuthMutationVersion = authMutationVersionRef\.current;[\s\S]*if \(authMutationVersionRef\.current !== refreshAuthMutationVersion\) \{[\s\S]*return null;[\s\S]*\}/u,
  'Manual current-user refresh must not publish a stale SDKWork IAM profile when a newer auth mutation starts while the request is in flight.',
);

assert.match(
  authContextSource,
  /const logout = useCallback\(async \(\) => \{[\s\S]*const authMutationVersion = authMutationVersionRef\.current \+ 1;[\s\S]*authMutationVersionRef\.current = authMutationVersion;[\s\S]*await authService\.logout\(\);[\s\S]*if \(authMutationVersionRef\.current === authMutationVersion\) \{[\s\S]*setUser\(null\);[\s\S]*\}/,
  'AuthContext logout must invalidate stale startup current-user hydration before awaiting logout and must not clear a newer login result if it completes late.',
);

assert.doesNotMatch(
  authGateSource,
  /if \(user && onAuthSurface\) \{\s*return <AuthGateLoadingState \/>;\s*\}/,
  'Authenticated users must never remain behind the auth validation loading state when opening /auth directly.',
);

assert.match(
  currentUserScopeSource,
  /private requestGeneration = 0;[\s\S]*clear\(\): void \{[\s\S]*this\.requestGeneration \+= 1;/,
  'CurrentUserScopeResolver.clear must invalidate in-flight user-scope requests during logout or account switch.',
);

assert.match(
  currentUserScopeSource,
  /const requestGeneration = this\.requestGeneration;[\s\S]*if \(this\.requestGeneration !== requestGeneration\) \{\s*return UNRESOLVED_USER_SCOPE;\s*\}/,
  'A stale current-user request must not repopulate the cache or return the previous account scope after session invalidation.',
);

assert.match(
  appSessionRefreshSource,
  /if \(!isBirdCoderSessionRefreshRequestCurrent\(token, loadStoredAppSessionToken\(\)\)\) \{\s*return false;\s*\}[\s\S]*storeAppSessionFromResult\(envelope,/,
  'A session refresh response must be discarded when logout or a newer login replaces the token while refresh is in flight.',
);

console.log('auth bootstrap stale current-user guard contract passed.');
