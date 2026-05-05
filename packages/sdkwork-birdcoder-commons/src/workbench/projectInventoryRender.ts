import type {
  BirdCoderCodingSession,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import { mergeProjectsForStore } from '../stores/projectsStore.ts';

function hasDuplicateIdentity<TValue>(
  values: readonly TValue[],
  getIdentity: (value: TValue) => string,
): boolean {
  if (values.length < 2) {
    return false;
  }

  const seenIdentities = new Set<string>();
  for (const value of values) {
    const identity = getIdentity(value);
    if (seenIdentities.has(identity)) {
      return true;
    }
    seenIdentities.add(identity);
  }

  return false;
}

function hasDuplicateProjectRenderIdentity(
  projects: readonly BirdCoderProject[],
): boolean {
  if (hasDuplicateIdentity(projects, (project) => project.id)) {
    return true;
  }

  return projects.some((project) =>
    hasDuplicateIdentity(project.codingSessions, (codingSession) => codingSession.id),
  );
}

function buildCodingSessionRenderIdentity(codingSession: BirdCoderCodingSession): string {
  return codingSession.id;
}

export function deduplicateBirdCoderProjectsForRender(
  projects: readonly BirdCoderProject[],
): BirdCoderProject[] {
  if (!hasDuplicateProjectRenderIdentity(projects)) {
    return projects as BirdCoderProject[];
  }

  return mergeProjectsForStore(projects, projects);
}

export function deduplicateBirdCoderCodingSessionsForRender(
  codingSessions: readonly BirdCoderCodingSession[],
): BirdCoderCodingSession[] {
  if (!hasDuplicateIdentity(codingSessions, buildCodingSessionRenderIdentity)) {
    return codingSessions as BirdCoderCodingSession[];
  }

  const codingSessionsById = new Map<string, BirdCoderCodingSession>();
  for (const codingSession of codingSessions) {
    const identity = buildCodingSessionRenderIdentity(codingSession);
    const previousCodingSession = codingSessionsById.get(identity);
    if (!previousCodingSession) {
      codingSessionsById.set(identity, codingSession);
      continue;
    }

    codingSessionsById.set(
      identity,
      codingSession.messages.length === 0 && previousCodingSession.messages.length > 0
        ? { ...codingSession, messages: previousCodingSession.messages }
        : codingSession,
    );
  }
  return Array.from(codingSessionsById.values());
}
