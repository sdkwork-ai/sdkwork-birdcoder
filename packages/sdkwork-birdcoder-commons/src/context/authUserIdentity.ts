import type { User } from '@sdkwork/birdcoder-types';

interface BirdCoderAuthUserIdentityParts {
  email: string | null;
  id: string | null;
}

function normalizeBirdCoderAuthIdentityText(value: string | null | undefined): string | null {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  return normalizedValue || null;
}

function resolveBirdCoderAuthUserIdentityParts(
  user: User | null | undefined,
): BirdCoderAuthUserIdentityParts {
  return {
    email: normalizeBirdCoderAuthIdentityText(user?.email)?.toLowerCase() ?? null,
    id: normalizeBirdCoderAuthIdentityText(user?.id),
  };
}

export function hasSameBirdCoderAuthUserIdentity(left: User, right: User): boolean {
  const leftIdentity = resolveBirdCoderAuthUserIdentityParts(left);
  const rightIdentity = resolveBirdCoderAuthUserIdentityParts(right);

  if (leftIdentity.id && rightIdentity.id && leftIdentity.id === rightIdentity.id) {
    return true;
  }

  return Boolean(
    leftIdentity.email &&
    rightIdentity.email &&
    leftIdentity.email === rightIdentity.email,
  );
}

export function resolveFallbackAwareCurrentUser(
  currentUser: User | null,
  fallbackUser?: User,
): User | null {
  if (!fallbackUser) {
    return currentUser;
  }

  if (!currentUser) {
    return fallbackUser;
  }

  if (hasSameBirdCoderAuthUserIdentity(currentUser, fallbackUser)) {
    return currentUser;
  }

  return fallbackUser;
}
