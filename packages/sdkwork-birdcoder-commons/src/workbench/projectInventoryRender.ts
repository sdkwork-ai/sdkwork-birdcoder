import type {
  BirdCoderCodingSession,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import { mergeProjectsForStore } from '../stores/projectsStore.ts';

const RENDER_SESSION_INVENTORY_PROJECT_ID = '__birdcoder_render_session_inventory__';

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

function buildRenderSessionInventoryProject(
  codingSessions: readonly BirdCoderCodingSession[],
): BirdCoderProject {
  return {
    id: RENDER_SESSION_INVENTORY_PROJECT_ID,
    workspaceId: '',
    name: RENDER_SESSION_INVENTORY_PROJECT_ID,
    path: '',
    createdAt: '',
    updatedAt: '',
    archived: false,
    codingSessions: codingSessions as BirdCoderCodingSession[],
  };
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
  if (!hasDuplicateIdentity(codingSessions, (codingSession) => codingSession.id)) {
    return codingSessions as BirdCoderCodingSession[];
  }

  const renderProject = buildRenderSessionInventoryProject(codingSessions);
  return mergeProjectsForStore([renderProject], [renderProject])[0]?.codingSessions ?? [];
}
