import { useEffect, type Dispatch, type SetStateAction } from 'react';

import type { BirdCoderProject } from '@sdkwork/birdcoder-pc-contracts-commons';

interface UseStudioProjectInventoryReconciliationOptions {
  currentProjectId: string;
  hasFetchedProjects: boolean;
  isActive: boolean;
  menuActiveProjectId: string;
  notifyProjectChange: (projectId: string) => void;
  projectId?: string;
  projects: readonly BirdCoderProject[];
  resolveCodingSessionLocation: (codingSessionId: string, projectId?: string | null) => unknown;
  resolveProjectById: (projectId: string) => unknown;
  selectedSessionProjectId: string | null;
  sessionId: string;
  setMenuActiveProjectId: Dispatch<SetStateAction<string>>;
  setSelectedSessionProjectId: Dispatch<SetStateAction<string | null>>;
  setSessionId: Dispatch<SetStateAction<string>>;
}

export function useStudioProjectInventoryReconciliation({
  currentProjectId,
  hasFetchedProjects,
  isActive,
  menuActiveProjectId,
  notifyProjectChange,
  projectId,
  projects,
  resolveCodingSessionLocation,
  resolveProjectById,
  selectedSessionProjectId,
  sessionId,
  setMenuActiveProjectId,
  setSelectedSessionProjectId,
  setSessionId,
}: UseStudioProjectInventoryReconciliationOptions): void {
  useEffect(() => {
    if (!isActive || !hasFetchedProjects) {
      return;
    }

    if (projects.length === 0) {
      setMenuActiveProjectId('');
      if (currentProjectId) {
        notifyProjectChange('');
      }
      setSessionId('');
      setSelectedSessionProjectId(null);
      return;
    }

    if (!menuActiveProjectId || !resolveProjectById(menuActiveProjectId)) {
      setMenuActiveProjectId(projects[0].id);
    }
    if (currentProjectId && !resolveProjectById(currentProjectId)) {
      notifyProjectChange('');
      setSessionId('');
      setSelectedSessionProjectId(null);
      return;
    }
    if (!sessionId) {
      return;
    }

    const retainedProjectId =
      selectedSessionProjectId?.trim() || projectId?.trim() || currentProjectId;
    if (
      !resolveCodingSessionLocation(sessionId, retainedProjectId) &&
      (!retainedProjectId || !resolveProjectById(retainedProjectId))
    ) {
      setSessionId('');
      setSelectedSessionProjectId(retainedProjectId || null);
    }
  }, [
    currentProjectId,
    hasFetchedProjects,
    isActive,
    menuActiveProjectId,
    notifyProjectChange,
    projectId,
    projects,
    resolveCodingSessionLocation,
    resolveProjectById,
    selectedSessionProjectId,
    sessionId,
    setMenuActiveProjectId,
    setSelectedSessionProjectId,
    setSessionId,
  ]);
}
