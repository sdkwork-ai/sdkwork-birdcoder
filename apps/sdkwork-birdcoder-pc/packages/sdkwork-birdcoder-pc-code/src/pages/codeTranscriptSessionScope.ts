export function resolveCodeTranscriptSessionScopeKey(
  projectId: string | null | undefined,
  sessionId: string | null | undefined,
): string | undefined {
  const normalizedSessionId = sessionId?.trim() ?? '';
  if (!normalizedSessionId) {
    return undefined;
  }

  const normalizedProjectId = projectId?.trim() ?? '';
  return normalizedProjectId
    ? `${normalizedProjectId}\u0001${normalizedSessionId}`
    : normalizedSessionId;
}
