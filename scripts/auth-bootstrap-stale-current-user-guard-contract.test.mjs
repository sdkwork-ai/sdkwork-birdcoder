import assert from 'node:assert/strict';
import fs from 'node:fs';

const authContextSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/context/AuthContext.ts', import.meta.url),
  'utf8',
);

assert.match(
  authContextSource,
  /const authMutationVersionRef = useRef\(0\);/,
  'AuthContext must track auth mutations so in-flight current-user requests cannot publish stale results over user actions.',
);

assert.match(
  authContextSource,
  /async function loadCurrentUser\(\) \{\s*const currentAuthMutationVersion = authMutationVersionRef\.current;[\s\S]*if \(!isMounted \|\| authMutationVersionRef\.current !== currentAuthMutationVersion\) \{[\s\S]*return;[\s\S]*\}[\s\S]*setUser\(currentUser\);/u,
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

console.log('auth bootstrap stale current-user guard contract passed.');
