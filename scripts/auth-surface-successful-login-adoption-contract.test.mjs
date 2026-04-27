import assert from 'node:assert/strict';
import fs from 'node:fs';

const authContextSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/context/AuthContext.ts', import.meta.url),
  'utf8',
);
const authUserIdentitySource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-commons/src/context/authUserIdentity.ts', import.meta.url),
  'utf8',
);
const authPageSource = fs.readFileSync(
  new URL('../packages/sdkwork-birdcoder-auth/src/pages/AuthPage.tsx', import.meta.url),
  'utf8',
);

assert.match(
  authContextSource,
  /refreshCurrentUser:\s*\(\) => Promise<User \| null>;/,
  'AuthContext public refreshCurrentUser must not accept fallback users; authenticated-user adoption must go through domain-level auth mutation methods.',
);

assert.doesNotMatch(
  authContextSource,
  /refreshCurrentUser:\s*\(fallbackUser\?: User\)/,
  'AuthContext must not expose fallback-user adoption through public refreshCurrentUser.',
);

assert.match(
  authContextSource,
  /adoptAuthenticatedUser:\s*\(authenticatedUser: User\) => Promise<User \| null>;/,
  'AuthContext must expose a domain-level authenticated-user adoption method for auth surface flows such as confirmed QR login.',
);

assert.match(
  authContextSource,
  /refreshAuthenticatedUserFromRuntime:\s*\(\) => Promise<User \| null>;/,
  'AuthContext must expose a domain-level runtime profile refresh method for external auth confirmations without an embedded user.',
);

assert.match(
  authContextSource,
  /signInWithEmailCode:\s*NonNullable<IAuthService\['signInWithEmailCode'\]>;/,
  'AuthContext must expose email-code sign-in as a domain method instead of making auth surfaces call the runtime auth service through a generic mutation helper.',
);

assert.match(
  authContextSource,
  /signInWithOAuth:\s*NonNullable<IAuthService\['signInWithOAuth'\]>;/,
  'AuthContext must expose OAuth sign-in as a domain method instead of making auth surfaces call the runtime auth service through a generic mutation helper.',
);

assert.match(
  authContextSource,
  /signInWithPhoneCode:\s*NonNullable<IAuthService\['signInWithPhoneCode'\]>;/,
  'AuthContext must expose phone-code sign-in as a domain method instead of making auth surfaces call the runtime auth service through a generic mutation helper.',
);

assert.doesNotMatch(
  authContextSource,
  /runAuthenticatedUserMutation:\s*\(operation:/,
  'AuthContext must not expose the generic authenticated-user mutation helper as public context API.',
);

assert.match(
  authContextSource,
  /import \{\s*resolveFallbackAwareCurrentUser,\s*\} from '\.\/authUserIdentity\.ts';/,
  'AuthContext must use the shared auth user identity helper instead of embedding ad hoc fallback matching logic.',
);

assert.match(
  authUserIdentitySource,
  /function resolveBirdCoderAuthUserIdentityParts\([\s\S]*\): BirdCoderAuthUserIdentityParts \{[\s\S]*email: normalizeBirdCoderAuthIdentityText\(user\?\.email\)\?\.toLowerCase\(\) \?\? null,[\s\S]*id: normalizeBirdCoderAuthIdentityText\(user\?\.id\),[\s\S]*\}/,
  'Auth user identity matching must normalize both trimmed ids and lower-cased emails as first-class identity parts.',
);

assert.match(
  authUserIdentitySource,
  /if \(leftIdentity\.id && rightIdentity\.id && leftIdentity\.id === rightIdentity\.id\) \{[\s\S]*return true;[\s\S]*\}[\s\S]*leftIdentity\.email &&[\s\S]*rightIdentity\.email &&[\s\S]*leftIdentity\.email === rightIdentity\.email/,
  'Auth user identity matching must accept either matching canonical ids or matching normalized emails so QR/OAuth fallback users can be upgraded to richer runtime profiles.',
);

assert.match(
  authUserIdentitySource,
  /export function resolveFallbackAwareCurrentUser\(\s*currentUser: User \| null,\s*fallbackUser\?: User,\s*\): User \| null \{[\s\S]*if \(!fallbackUser\) \{[\s\S]*return currentUser;[\s\S]*\}[\s\S]*if \(!currentUser\) \{[\s\S]*return fallbackUser;[\s\S]*\}[\s\S]*if \(hasSameBirdCoderAuthUserIdentity\(currentUser, fallbackUser\)\) \{[\s\S]*return currentUser;[\s\S]*\}[\s\S]*return fallbackUser;[\s\S]*\}/,
  'AuthContext fallback-aware refresh must keep the just-authenticated fallback user when runtime profile hydration returns a different non-null user.',
);

assert.match(
  authContextSource,
  /const refreshCurrentUserWithFallback = useCallback\(async \(fallbackUser\?: User\) => \{[\s\S]*const resolvedCurrentUser = resolveFallbackAwareCurrentUser\(currentUser, fallbackUser\);[\s\S]*setUser\(resolvedCurrentUser\);[\s\S]*return resolvedCurrentUser;/,
  'AuthContext internal fallback-aware refresh must resolve runtime profile results through identity-aware fallback precedence before publishing user state.',
);

assert.match(
  authContextSource,
  /catch \(error\) \{[\s\S]*if \(fallbackUser\) \{[\s\S]*setUser\(fallbackUser\);[\s\S]*return fallbackUser;[\s\S]*\}[\s\S]*throw error;/,
  'AuthContext refreshCurrentUser must preserve a just-authenticated user even if the profile hydration request fails transiently.',
);

assert.match(
  authContextSource,
  /const runAuthenticatedUserMutation = useCallback\(\s*async \(operation: \(\) => Promise<User>\) => \{[\s\S]*const authMutationVersion = authMutationVersionRef\.current \+ 1;[\s\S]*authMutationVersionRef\.current = authMutationVersion;[\s\S]*const authenticatedUser = await operation\(\);[\s\S]*if \(authMutationVersionRef\.current !== authMutationVersion\) \{[\s\S]*return authenticatedUser;[\s\S]*\}[\s\S]*setUser\(authenticatedUser\);[\s\S]*return authenticatedUser;/,
  'AuthContext internal runAuthenticatedUserMutation helper must invalidate stale profile/bootstrap requests before awaiting the auth service and must not publish an older auth result after a newer mutation starts.',
);

assert.match(
  authContextSource,
  /const refreshCurrentUserAfterAuthMutation = useCallback\(\s*async \(fallbackUser\?: User\) => \{[\s\S]*const authMutationVersion = authMutationVersionRef\.current \+ 1;[\s\S]*authMutationVersionRef\.current = authMutationVersion;[\s\S]*return await refreshCurrentUserWithFallback\(fallbackUser\);/,
  'AuthContext internal auth-mutation refresh helper must invalidate stale profile/bootstrap requests before hydrating the current user after an external auth mutation.',
);

assert.match(
  authContextSource,
  /finally \{[\s\S]*if \(authMutationVersionRef\.current === authMutationVersion\) \{[\s\S]*setIsLoading\(false\);[\s\S]*\}/,
  'AuthContext auth mutation helpers must only clear loading for the latest mutation.',
);

assert.doesNotMatch(
  authPageSource,
  /authService\.(?:login|logout|register|exchangeUserCenterSession)\s*[!(]/,
  'AuthPage must not call core auth mutations directly; it must use AuthContext so stale bootstrap/profile work is invalidated before the mutation starts.',
);

for (const methodName of ['login', 'register', 'logout', 'exchangeUserCenterSession']) {
  assert.match(
    authPageSource,
    new RegExp(`${methodName}:\\s*(?:authService\\.exchangeUserCenterSession\\s*\\?\\s*)?async \\(\\.\\.\\.args:[\\s\\S]*?\\) => \\{?\\s*(?:(?:return|await)\\s+)?${methodName}\\(\\.\\.\\.args\\)`),
    `AuthPage ${methodName} wrapper must delegate to the mutation-aware AuthContext method instead of calling authService directly.`,
  );
}

for (const methodName of ['signInWithEmailCode', 'signInWithOAuth', 'signInWithPhoneCode']) {
  assert.match(
    authPageSource,
    new RegExp(`${methodName}:\\s*authService\\.${methodName}\\s*\\?\\s*async \\(\\.\\.\\.args:[\\s\\S]*?\\) => \\{?\\s*return ${methodName}\\(\\.\\.\\.args\\)`),
    `AuthPage ${methodName} wrapper must delegate to the domain-level AuthContext ${methodName} method instead of using a generic mutation helper.`,
  );
}

assert.doesNotMatch(
  authPageSource,
  /runAuthenticatedUserMutation/,
  'AuthPage must not know about AuthContext generic mutation internals.',
);

assert.match(
  authPageSource,
  /function mapBirdCoderQrAuthenticatedUser\(user: SdkworkAuthUser\): User \{[\s\S]*displayName[\s\S]*username[\s\S]*email[\s\S]*\}/,
  'AuthPage must normalize QR auth-surface users into the canonical BirdCoder User shape before adopting them.',
);

assert.match(
  authPageSource,
  /if \(result\.status === "confirmed" && result\.user\) \{[\s\S]*await adoptAuthenticatedUser\(\s*mapBirdCoderQrAuthenticatedUser\(result\.user\),?\s*\);[\s\S]*\}/,
  'AuthPage QR confirmation must adopt the normalized confirmed user through the domain-level AuthContext adoption method while profile hydration catches up.',
);

assert.match(
  authPageSource,
  /else if \(result\.status === "confirmed"\) \{[\s\S]*await refreshAuthenticatedUserFromRuntime\(\);[\s\S]*\}/,
  'AuthPage QR confirmation without an embedded user must still invalidate stale auth work before hydrating the runtime profile.',
);

console.log('auth surface successful login adoption contract passed.');
