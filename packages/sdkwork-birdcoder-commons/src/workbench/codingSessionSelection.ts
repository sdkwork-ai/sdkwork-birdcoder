import {
  resolveBirdCoderSessionSortTimestamp,
  type BirdCoderCodingSession,
  type BirdCoderProject,
} from '@sdkwork/birdcoder-types';

export interface BirdCoderResolvedCodingSessionLocation {
  codingSession: BirdCoderCodingSession;
  project: BirdCoderProject;
}

export function resolveCodingSessionLocationInProjects(
  projects: readonly BirdCoderProject[],
  codingSessionId: string | null | undefined,
): BirdCoderResolvedCodingSessionLocation | null {
  const normalizedCodingSessionId = codingSessionId?.trim() ?? '';
  if (!normalizedCodingSessionId) {
    return null;
  }

  for (const project of projects) {
    const codingSession = project.codingSessions.find(
      (candidate) => candidate.id === normalizedCodingSessionId,
    );
    if (codingSession) {
      return {
        codingSession,
        project,
      };
    }
  }

  return null;
}

export function resolveProjectIdByCodingSessionId(
  projects: readonly BirdCoderProject[],
  codingSessionId: string | null | undefined,
): string {
  return resolveCodingSessionLocationInProjects(projects, codingSessionId)?.project.id ?? '';
}

export function resolveLatestCodingSessionIdForProject(
  projects: readonly BirdCoderProject[],
  projectId: string | null | undefined,
): string | null {
  const normalizedProjectId = projectId?.trim() ?? '';
  if (!normalizedProjectId) {
    return null;
  }

  const project = projects.find((candidate) => candidate.id === normalizedProjectId);
  if (!project || project.codingSessions.length === 0) {
    return null;
  }

  return [...project.codingSessions]
    .sort(
      (left, right) =>
        resolveBirdCoderSessionSortTimestamp(right) -
          resolveBirdCoderSessionSortTimestamp(left) ||
        left.id.localeCompare(right.id),
    )[0]?.id ?? null;
}
