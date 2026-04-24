import { useCallback, useState } from 'react';
import type {
  BirdCoderCommitProjectGitChangesRequest,
  BirdCoderProjectGitOverview,
  BirdCoderPushProjectGitBranchRequest,
  BirdCoderRemoveProjectGitWorktreeRequest,
} from '@sdkwork/birdcoder-types';
import { useIDEServices } from '../context/ideServices.ts';
import { normalizeGitBranchName } from '../workbench/gitBranches.ts';

export interface UseProjectGitMutationActionsOptions {
  applyGitOverview: (overview: BirdCoderProjectGitOverview) => void;
  projectId?: string | null;
}

export interface UseProjectGitMutationActionsResult {
  commitChanges: (message: string) => Promise<string>;
  createBranch: (branchName: string) => Promise<string>;
  createWorktree: (branchName: string, path: string) => Promise<{ branchName: string; path: string }>;
  isCommitting: boolean;
  isCreatingBranch: boolean;
  isCreatingWorktree: boolean;
  isPruningWorktrees: boolean;
  isPushingBranch: boolean;
  isRemovingWorktree: boolean;
  isSwitchingBranch: boolean;
  pushBranch: (request: BirdCoderPushProjectGitBranchRequest) => Promise<string>;
  pruneWorktrees: () => Promise<void>;
  removeWorktree: (
    request: BirdCoderRemoveProjectGitWorktreeRequest,
  ) => Promise<{ path: string }>;
  switchBranch: (branchName: string) => Promise<string>;
}

export function useProjectGitMutationActions({
  applyGitOverview,
  projectId,
}: UseProjectGitMutationActionsOptions): UseProjectGitMutationActionsResult {
  const normalizedProjectId = projectId?.trim() ?? '';
  const { gitService } = useIDEServices();
  const [isCommitting, setIsCommitting] = useState(false);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [isCreatingWorktree, setIsCreatingWorktree] = useState(false);
  const [isPushingBranch, setIsPushingBranch] = useState(false);
  const [isRemovingWorktree, setIsRemovingWorktree] = useState(false);
  const [isSwitchingBranch, setIsSwitchingBranch] = useState(false);
  const [isPruningWorktrees, setIsPruningWorktrees] = useState(false);

  const requireProjectId = useCallback((): string => {
    if (!normalizedProjectId) {
      throw new Error('Project is required before mutating Git state.');
    }

    return normalizedProjectId;
  }, [normalizedProjectId]);

  const commitChanges = useCallback(async (message: string): Promise<string> => {
    const nextProjectId = requireProjectId();
    const normalizedMessage = message.trim();
    if (!normalizedMessage) {
      throw new Error('Commit message is required before committing Git changes.');
    }

    const request: BirdCoderCommitProjectGitChangesRequest = {
      message: normalizedMessage,
    };

    setIsCommitting(true);
    try {
      applyGitOverview(await gitService.commitProjectGitChanges(nextProjectId, request));
      return normalizedMessage;
    } finally {
      setIsCommitting(false);
    }
  }, [applyGitOverview, gitService, requireProjectId]);

  const createBranch = useCallback(async (branchName: string): Promise<string> => {
    const nextProjectId = requireProjectId();
    const normalizedBranchName = normalizeGitBranchName(branchName);
    setIsCreatingBranch(true);
    try {
      applyGitOverview(
        await gitService.createProjectGitBranch(nextProjectId, {
          branchName: normalizedBranchName,
        }),
      );
      return normalizedBranchName;
    } finally {
      setIsCreatingBranch(false);
    }
  }, [applyGitOverview, gitService, requireProjectId]);

  const createWorktree = useCallback(async (
    branchName: string,
    path: string,
  ): Promise<{ branchName: string; path: string }> => {
    const nextProjectId = requireProjectId();
    const normalizedBranchName = normalizeGitBranchName(branchName);
    const normalizedPath = path.trim();
    if (!normalizedPath) {
      throw new Error('Worktree path is required before creating a Git worktree.');
    }

    setIsCreatingWorktree(true);
    try {
      applyGitOverview(
        await gitService.createProjectGitWorktree(nextProjectId, {
          branchName: normalizedBranchName,
          path: normalizedPath,
        }),
      );
      return {
        branchName: normalizedBranchName,
        path: normalizedPath,
      };
    } finally {
      setIsCreatingWorktree(false);
    }
  }, [applyGitOverview, gitService, requireProjectId]);

  const switchBranch = useCallback(async (branchName: string): Promise<string> => {
    const nextProjectId = requireProjectId();
    const normalizedBranchName = normalizeGitBranchName(branchName);
    setIsSwitchingBranch(true);
    try {
      applyGitOverview(
        await gitService.switchProjectGitBranch(nextProjectId, {
          branchName: normalizedBranchName,
        }),
      );
      return normalizedBranchName;
    } finally {
      setIsSwitchingBranch(false);
    }
  }, [applyGitOverview, gitService, requireProjectId]);

  const pushBranch = useCallback(async (
    request: BirdCoderPushProjectGitBranchRequest,
  ): Promise<string> => {
    const nextProjectId = requireProjectId();
    const normalizedBranchName = normalizeGitBranchName(request.branchName?.trim() ?? '');

    setIsPushingBranch(true);
    try {
      applyGitOverview(
        await gitService.pushProjectGitBranch(nextProjectId, {
          ...request,
          branchName: normalizedBranchName,
        }),
      );
      return normalizedBranchName;
    } finally {
      setIsPushingBranch(false);
    }
  }, [applyGitOverview, gitService, requireProjectId]);

  const removeWorktree = useCallback(async (
    request: BirdCoderRemoveProjectGitWorktreeRequest,
  ): Promise<{ path: string }> => {
    const nextProjectId = requireProjectId();
    const normalizedPath = request.path.trim();
    if (!normalizedPath) {
      throw new Error('Worktree path is required before removing a Git worktree.');
    }

    setIsRemovingWorktree(true);
    try {
      applyGitOverview(
        await gitService.removeProjectGitWorktree(nextProjectId, {
          ...request,
          path: normalizedPath,
        }),
      );
      return {
        path: normalizedPath,
      };
    } finally {
      setIsRemovingWorktree(false);
    }
  }, [applyGitOverview, gitService, requireProjectId]);

  const pruneWorktrees = useCallback(async (): Promise<void> => {
    const nextProjectId = requireProjectId();
    setIsPruningWorktrees(true);
    try {
      applyGitOverview(await gitService.pruneProjectGitWorktrees(nextProjectId));
    } finally {
      setIsPruningWorktrees(false);
    }
  }, [applyGitOverview, gitService, requireProjectId]);

  return {
    commitChanges,
    createBranch,
    createWorktree,
    isCommitting,
    isCreatingBranch,
    isCreatingWorktree,
    isPruningWorktrees,
    isPushingBranch,
    isRemovingWorktree,
    isSwitchingBranch,
    pushBranch,
    pruneWorktrees,
    removeWorktree,
    switchBranch,
  };
}
