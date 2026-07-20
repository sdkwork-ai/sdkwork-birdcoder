const ANONYMOUS_AUTH_SESSION_SCOPE = 'anonymous';

function normalizeAuthSessionUserId(userId: string | null | undefined): string {
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
  return normalizedUserId || ANONYMOUS_AUTH_SESSION_SCOPE;
}

export function buildBirdCoderAuthSessionInventoryScope(
  userId: string | null | undefined,
  sessionRevision: number,
): string {
  const normalizedSessionRevision =
    Number.isSafeInteger(sessionRevision) && sessionRevision >= 0
      ? sessionRevision
      : 0;
  return `${normalizeAuthSessionUserId(userId)}::session:${normalizedSessionRevision}`;
}
