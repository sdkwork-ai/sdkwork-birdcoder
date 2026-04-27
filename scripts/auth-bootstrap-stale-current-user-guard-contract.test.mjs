import assert from 'node:assert/strict';
import fs from 'node:fs';

const authContextSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/context/AuthContext.ts', import.meta.url),
  'utf8',
);

assert.match(
  authContextSource,
  /const authMutationVersionRef = useRef\(0\);/,
  'AuthContext must track auth mutations so startup profile requests cannot publish stale results over user actions.',
);

assert.match(
  authContextSource,
  /const initialAuthMutationVersion = authMutationVersionRef\.current;[\s\S]*const loadCurrentUser = async \(\) => \{[\s\S]*if \(!isMounted \|\| authMutationVersionRef\.current !== initialAuthMutationVersion\) \{[\s\S]*return;[\s\S]*\}[\s\S]*setUser\(currentUser\);/,
  'Initial current-user hydration must skip publishing when a login, registration, exchange, or logout happened after bootstrap began.',
);

assert.match(
  authContextSource,
  /catch \(error\) \{[\s\S]*if \(!isMounted \|\| authMutationVersionRef\.current !== initialAuthMutationVersion\) \{[\s\S]*return;[\s\S]*\}[\s\S]*setUser\(null\);/,
  'Initial current-user hydration failures must not clear a user adopted by a newer auth mutation.',
);

assert.match(
  authContextSource,
  /const runAuthenticatedUserMutation = useCallback\(\s*async \(operation: \(\) => Promise<User>\) => \{[\s\S]*authMutationVersionRef\.current = authMutationVersion;[\s\S]*const authenticatedUser = await operation\(\);/,
  'AuthContext must centralize authenticated-user mutations so every login-like operation invalidates stale startup current-user hydration before awaiting the auth service.',
);

assert.match(
  authContextSource,
  /const refreshCurrentUserAfterAuthMutation = useCallback\(\s*async \(fallbackUser\?: User\) => \{[\s\S]*authMutationVersionRef\.current = authMutationVersion;[\s\S]*return await refreshCurrentUserWithFallback\(fallbackUser\);/,
  'AuthContext must provide a mutation-aware refresh path for external auth confirmations that do not directly return through a context login method.',
);

for (const operation of ['login', 'register', 'exchangeUserCenterSession']) {
  assert.match(
    authContextSource,
    new RegExp(`const ${operation} = useCallback[\\s\\S]*runAuthenticatedUserMutation\\(`),
    `AuthContext ${operation} must use the centralized authenticated-user mutation boundary.`,
  );
}

assert.match(
  authContextSource,
  /const logout = useCallback\(async \(\) => \{[\s\S]*const authMutationVersion = authMutationVersionRef\.current \+ 1;[\s\S]*authMutationVersionRef\.current = authMutationVersion;[\s\S]*await authService\.logout\(\);[\s\S]*if \(authMutationVersionRef\.current === authMutationVersion\) \{[\s\S]*setUser\(null\);[\s\S]*\}/,
  'AuthContext logout must invalidate stale startup current-user hydration before awaiting logout and must not clear a newer login result if it completes late.',
);

console.log('auth bootstrap stale current-user guard contract passed.');
