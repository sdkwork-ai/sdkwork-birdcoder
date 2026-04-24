import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type {
  BirdCoderGitWorktreeSummary,
  BirdCoderProjectGitOverview,
} from '@sdkwork/birdcoder-types';
import { useIDEServices } from '../context/ideServices.ts';
import { subscribeProjectGitOverviewRefresh } from '../workbench/projectGitOverview.ts';

interface ProjectGitOverviewSnapshot {
  isLoading: boolean;
  loadErrorMessage: string | null;
  overview: BirdCoderProjectGitOverview | null;
}

interface ProjectGitOverviewCacheEntry {
  inFlight: Promise<BirdCoderProjectGitOverview | null> | null;
  listeners: Set<() => void>;
  requestVersion: number;
  snapshot: ProjectGitOverviewSnapshot;
}

export interface UseProjectGitOverviewOptions {
  isActive?: boolean;
  projectId?: string | null;
}

export interface ProjectGitOverviewViewState extends ProjectGitOverviewSnapshot {
  applyGitOverview: (overview: BirdCoderProjectGitOverview) => void;
  branches: string[];
  currentBranchLabel: string;
  currentWorktree: BirdCoderGitWorktreeSummary | null;
  currentWorktreeLabel: string;
  isGitRepositoryReady: boolean;
  normalizedProjectId: string;
  refreshGitOverview: () => Promise<BirdCoderProjectGitOverview | null>;
  worktrees: BirdCoderGitWorktreeSummary[];
}

export interface UseProjectGitOverviewResult extends ProjectGitOverviewViewState {}

const EMPTY_SNAPSHOT: ProjectGitOverviewSnapshot = Object.freeze({
  isLoading: false,
  loadErrorMessage: null,
  overview: null,
});

const projectGitOverviewCache = new Map<string, ProjectGitOverviewCacheEntry>();

function peekProjectGitOverviewCacheEntry(projectId: string): ProjectGitOverviewCacheEntry | undefined {
  return projectGitOverviewCache.get(projectId);
}

function createProjectGitOverviewCacheEntry(): ProjectGitOverviewCacheEntry {
  return {
    inFlight: null,
    listeners: new Set(),
    requestVersion: 0,
    snapshot: {
      ...EMPTY_SNAPSHOT,
    },
  };
}

function getProjectGitOverviewCacheEntry(projectId: string): ProjectGitOverviewCacheEntry {
  let entry = peekProjectGitOverviewCacheEntry(projectId);
  if (!entry) {
    entry = createProjectGitOverviewCacheEntry();
    projectGitOverviewCache.set(projectId, entry);
  }

  return entry;
}

function emitProjectGitOverviewCacheEntry(entry: ProjectGitOverviewCacheEntry): void {
  for (const listener of Array.from(entry.listeners)) {
    listener();
  }
}

function cleanupProjectGitOverviewCacheEntry(
  projectId: string,
  entry: ProjectGitOverviewCacheEntry,
): void {
  if (entry.listeners.size > 0 || entry.inFlight) {
    return;
  }

  projectGitOverviewCache.delete(projectId);
}

function getProjectGitOverviewSnapshot(projectId: string): ProjectGitOverviewSnapshot {
  if (!projectId) {
    return EMPTY_SNAPSHOT;
  }

  return peekProjectGitOverviewCacheEntry(projectId)?.snapshot ?? EMPTY_SNAPSHOT;
}

function applyProjectGitOverviewSnapshot(
  projectId: string,
  overview: BirdCoderProjectGitOverview,
): void {
  if (!projectId) {
    return;
  }

  const entry = getProjectGitOverviewCacheEntry(projectId);
  entry.requestVersion += 1;
  entry.inFlight = null;
  entry.snapshot = {
    isLoading: false,
    loadErrorMessage: null,
    overview,
  };
  emitProjectGitOverviewCacheEntry(entry);
  cleanupProjectGitOverviewCacheEntry(projectId, entry);
}

export function useProjectGitOverview({
  isActive = true,
  projectId,
}: UseProjectGitOverviewOptions): UseProjectGitOverviewResult {
  const normalizedProjectId = projectId?.trim() ?? '';
  const { gitService } = useIDEServices();

  const subscribe = useCallback(
    (listener: () => void) => {
      if (!normalizedProjectId || !isActive) {
        return () => undefined;
      }

      const entry = getProjectGitOverviewCacheEntry(normalizedProjectId);
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
        cleanupProjectGitOverviewCacheEntry(normalizedProjectId, entry);
      };
    },
    [isActive, normalizedProjectId],
  );

  const getSnapshot = useCallback(
    () => getProjectGitOverviewSnapshot(normalizedProjectId),
    [normalizedProjectId],
  );

  const { isLoading, loadErrorMessage, overview } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );

  const refreshGitOverview = useCallback(async (): Promise<BirdCoderProjectGitOverview | null> => {
    if (!normalizedProjectId) {
      return null;
    }

    const entry = getProjectGitOverviewCacheEntry(normalizedProjectId);
    if (entry.inFlight) {
      return entry.inFlight;
    }

    const requestVersion = entry.requestVersion + 1;
    entry.requestVersion = requestVersion;
    entry.snapshot = {
      ...entry.snapshot,
      isLoading: true,
      loadErrorMessage: null,
    };
    emitProjectGitOverviewCacheEntry(entry);

    const request = (async () => {
      try {
        const nextOverview = await gitService.getProjectGitOverview(normalizedProjectId);
        if (entry.requestVersion !== requestVersion) {
          return entry.snapshot.overview;
        }

        entry.snapshot = {
          isLoading: false,
          loadErrorMessage: null,
          overview: nextOverview,
        };
        emitProjectGitOverviewCacheEntry(entry);
        return nextOverview;
      } catch (error) {
        if (entry.requestVersion !== requestVersion) {
          return entry.snapshot.overview;
        }

        console.error('Failed to load project Git overview', error);
        entry.snapshot = {
          ...entry.snapshot,
          isLoading: false,
          loadErrorMessage:
            error instanceof Error && error.message.trim()
              ? error.message
              : 'Failed to load project Git overview.',
        };
        emitProjectGitOverviewCacheEntry(entry);
        return entry.snapshot.overview;
      } finally {
        if (entry.requestVersion === requestVersion) {
          entry.inFlight = null;
        }
        cleanupProjectGitOverviewCacheEntry(normalizedProjectId, entry);
      }
    })();

    entry.inFlight = request;
    return request;
  }, [gitService, normalizedProjectId]);

  const applyGitOverview = useCallback(
    (nextOverview: BirdCoderProjectGitOverview) => {
      applyProjectGitOverviewSnapshot(normalizedProjectId, nextOverview);
    },
    [normalizedProjectId],
  );

  useEffect(() => {
    if (!isActive || !normalizedProjectId || overview || isLoading || loadErrorMessage) {
      return;
    }

    void refreshGitOverview();
  }, [isActive, isLoading, loadErrorMessage, normalizedProjectId, overview, refreshGitOverview]);

  useEffect(() => {
    if (!isActive || !normalizedProjectId) {
      return;
    }

    return subscribeProjectGitOverviewRefresh((refreshedProjectId) => {
      if (refreshedProjectId !== normalizedProjectId) {
        return;
      }

      void refreshGitOverview();
    });
  }, [isActive, normalizedProjectId, refreshGitOverview]);

  const currentWorktree =
    overview?.worktrees.find((worktree) => worktree.isCurrent)
    ?? overview?.worktrees[0]
    ?? null;
  const branches = overview?.branches.map((branch) => branch.name) ?? [];
  const currentBranchLabel =
    overview?.currentBranch?.trim() || overview?.currentRevision?.slice(0, 8) || branches[0] || '';
  const worktrees = overview?.worktrees ?? [];
  const currentWorktreeLabel = currentWorktree?.label?.trim() || currentWorktree?.path || '';
  const isGitRepositoryReady = overview?.status === 'ready';

  return useMemo(
    () => ({
      applyGitOverview,
      branches,
      currentBranchLabel,
      currentWorktree,
      currentWorktreeLabel,
      isGitRepositoryReady,
      isLoading,
      loadErrorMessage,
      normalizedProjectId,
      overview,
      refreshGitOverview,
      worktrees,
    }),
    [
      applyGitOverview,
      branches,
      currentBranchLabel,
      currentWorktree,
      currentWorktreeLabel,
      isGitRepositoryReady,
      isLoading,
      loadErrorMessage,
      normalizedProjectId,
      overview,
      refreshGitOverview,
      worktrees,
    ],
  );
}
