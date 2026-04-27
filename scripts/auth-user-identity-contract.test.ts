import assert from 'node:assert/strict';
import {
  hasSameBirdCoderAuthUserIdentity,
  resolveFallbackAwareCurrentUser,
} from '../packages/sdkwork-birdcoder-commons/src/context/authUserIdentity.ts';
import type { User } from '../packages/sdkwork-birdcoder-types/src/index.ts';

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
  'Canonical user-center profile',
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
  'Auth identity matching must treat same email as the same user even when a QR/OAuth fallback id differs from the canonical user-center profile id.',
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

console.log('auth user identity contract passed.');
