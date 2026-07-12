import assert from 'node:assert/strict';
import {
  hasSameBirdCoderAuthUserIdentity,
  resolveFallbackAwareCurrentUser,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/context/authUserIdentity.ts';
import { CurrentUserScopeResolver } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/currentUserScope.ts';
import { isBirdCoderSessionRefreshRequestCurrent } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSessionRefresh.ts';
import type { StoredAppSessionToken } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSessionToken.ts';
import type { User } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/index.ts';

function buildUser(id: string, email: string, name = email): User {
  return {
    email,
    id,
    name,
  };
}

const qrFallbackUser = buildUser(
  'sdkwork-auth-openid-user',
  'USER@Example.COM',
  'QR confirmed user',
);
const canonicalRuntimeUser = buildUser(
  '100000000000000501',
  'user@example.com',
  'Canonical IAM profile',
);
const staleRuntimeUser = buildUser(
  '100000000000000999',
  'old-user@example.com',
  'Old profile',
);
const sameIdRuntimeUser = buildUser(
  ' sdkwork-auth-openid-user ',
  'renamed@example.com',
  'Same id profile',
);

assert.equal(
  hasSameBirdCoderAuthUserIdentity(qrFallbackUser, canonicalRuntimeUser),
  true,
  'Auth identity matching must treat same email as the same user even when a QR/OAuth fallback id differs from the canonical IAM profile id.',
);

assert.equal(
  resolveFallbackAwareCurrentUser(canonicalRuntimeUser, qrFallbackUser),
  canonicalRuntimeUser,
  'Fallback-aware refresh must adopt the richer canonical runtime profile when it has the same normalized email as the just-confirmed auth-surface user.',
);

assert.equal(
  resolveFallbackAwareCurrentUser(staleRuntimeUser, qrFallbackUser),
  qrFallbackUser,
  'Fallback-aware refresh must preserve the just-confirmed user when runtime profile id and email both point to a different stale user.',
);

assert.equal(
  resolveFallbackAwareCurrentUser(sameIdRuntimeUser, qrFallbackUser),
  sameIdRuntimeUser,
  'Fallback-aware refresh must adopt the runtime profile when trimmed ids match even if the profile email changed.',
);

assert.equal(
  resolveFallbackAwareCurrentUser(null, qrFallbackUser),
  qrFallbackUser,
  'Fallback-aware refresh must preserve a just-confirmed user while runtime profile hydration is still catching up.',
);

let resolveStaleCurrentUser!: (user: User | null) => void;
let currentUserLoader = () => new Promise<User | null>((resolve) => {
  resolveStaleCurrentUser = resolve;
});
const currentUserScopeResolver = new CurrentUserScopeResolver({
  cacheTtlMs: 10_000,
  currentUserProvider: {
    getCurrentUser: () => currentUserLoader(),
  },
});
const staleScopeRequest = currentUserScopeResolver.resolve();
currentUserScopeResolver.clear();
resolveStaleCurrentUser(staleRuntimeUser);
assert.deepEqual(
  await staleScopeRequest,
  {
    cacheable: false,
    userId: 'anonymous',
  },
  'A current-user request invalidated by logout or account switch must resolve as uncacheable instead of returning the previous user id.',
);

currentUserLoader = async () => canonicalRuntimeUser;
assert.deepEqual(
  await currentUserScopeResolver.resolve(),
  {
    cacheable: true,
    userId: canonicalRuntimeUser.id,
  },
  'CurrentUserScopeResolver must load and cache the replacement account after a stale request is invalidated.',
);

const refreshRequestToken: StoredAppSessionToken = {
  accessToken: 'access-token-1',
  authToken: 'auth-token-1',
  expiresAt: 4_102_444_800,
  refreshToken: 'refresh-token-1',
  sessionId: 'session-1',
  storedAt: 1_700_000_000,
};
assert.equal(
  isBirdCoderSessionRefreshRequestCurrent(
    refreshRequestToken,
    { ...refreshRequestToken },
  ),
  true,
  'A refresh response may be adopted while the initiating session token is still current.',
);
assert.equal(
  isBirdCoderSessionRefreshRequestCurrent(refreshRequestToken, null),
  false,
  'A refresh response must be discarded after logout clears the session.',
);
assert.equal(
  isBirdCoderSessionRefreshRequestCurrent(refreshRequestToken, {
    ...refreshRequestToken,
    accessToken: 'access-token-2',
    authToken: 'auth-token-2',
    sessionId: 'session-2',
  }),
  false,
  'A refresh response must be discarded after a newer login replaces the session.',
);

console.log('auth user identity contract passed.');
