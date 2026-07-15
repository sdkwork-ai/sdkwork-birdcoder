import type {
  BirdCoderCommitProjectGitChangesRequest,
  BirdCoderCreateProjectGitBranchRequest,
  BirdCoderCreateProjectGitWorktreeRequest,
  BirdCoderProjectGitDiff,
  BirdCoderProjectGitOverview,
  BirdCoderPushProjectGitBranchRequest,
  BirdCoderRemoveProjectGitWorktreeRequest,
  BirdCoderSwitchProjectGitBranchRequest,
} from '@sdkwork/birdcoder-pc-types';
import { isBirdCoderTauriRuntime } from './tauriRuntime.ts';

type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export class TauriProjectGitRuntimeUnavailableError extends Error {
  readonly code = 'tauri_project_git_runtime_unavailable';

  constructor(message = 'The Tauri project Git runtime is unavailable.') {
    super(message);
    this.name = 'TauriProjectGitRuntimeUnavailableError';
  }
}

export function isTauriProjectGitRuntimeUnavailableError(error: unknown): boolean {
  return error instanceof TauriProjectGitRuntimeUnavailableError;
}

export interface TauriProjectGitRuntime {
  commitProjectGitChanges(
    projectId: string,
    request: BirdCoderCommitProjectGitChangesRequest,
  ): Promise<BirdCoderProjectGitOverview>;
  createProjectGitBranch(
    projectId: string,
    request: BirdCoderCreateProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview>;
  createProjectGitWorktree(
    projectId: string,
    request: BirdCoderCreateProjectGitWorktreeRequest,
  ): Promise<BirdCoderProjectGitOverview>;
  getProjectGitDiff(projectId: string): Promise<BirdCoderProjectGitDiff>;
  getProjectGitOverview(projectId: string): Promise<BirdCoderProjectGitOverview>;
  pruneProjectGitWorktrees(projectId: string): Promise<BirdCoderProjectGitOverview>;
  pushProjectGitBranch(
    projectId: string,
    request: BirdCoderPushProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview>;
  removeProjectGitWorktree(
    projectId: string,
    request: BirdCoderRemoveProjectGitWorktreeRequest,
  ): Promise<BirdCoderProjectGitOverview>;
  switchProjectGitBranch(
    projectId: string,
    request: BirdCoderSwitchProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview>;
}

export interface CreateTauriProjectGitRuntimeOptions {
  invoke?: TauriInvoke;
  isTauriRuntime?: () => Promise<boolean>;
  resolveProjectRoot: (projectId: string) => Promise<string | null>;
}

async function resolveTauriInvoke(explicitInvoke?: TauriInvoke): Promise<TauriInvoke> {
  if (explicitInvoke) {
    return explicitInvoke;
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke;
  } catch {
    throw new TauriProjectGitRuntimeUnavailableError();
  }
}

export function createTauriProjectGitRuntime({
  invoke: explicitInvoke,
  isTauriRuntime = isBirdCoderTauriRuntime,
  resolveProjectRoot,
}: CreateTauriProjectGitRuntimeOptions): TauriProjectGitRuntime {
  const invokeProjectGit = async <T>(
    projectId: string,
    command: string,
    args: Record<string, unknown> = {},
  ): Promise<T> => {
    if (!(await isTauriRuntime())) {
      throw new TauriProjectGitRuntimeUnavailableError();
    }
    const rootPath = (await resolveProjectRoot(projectId))?.trim() ?? '';
    if (!rootPath) {
      throw new TauriProjectGitRuntimeUnavailableError(
        'The project does not have an active Tauri folder mount.',
      );
    }
    const invoke = await resolveTauriInvoke(explicitInvoke);
    return invoke<T>(command, { rootPath, ...args });
  };

  return {
    commitProjectGitChanges(projectId, request) {
      return invokeProjectGit(projectId, 'git_commit_changes', {
        includeUnstaged: request.includeUnstaged ?? true,
        message: request.message,
      });
    },
    createProjectGitBranch(projectId, request) {
      return invokeProjectGit(projectId, 'git_create_branch', {
        branchName: request.branchName,
      });
    },
    createProjectGitWorktree(projectId, request) {
      return invokeProjectGit(projectId, 'git_create_worktree', {
        branchName: request.branchName,
      });
    },
    getProjectGitDiff(projectId) {
      return invokeProjectGit(projectId, 'git_project_diff');
    },
    getProjectGitOverview(projectId) {
      return invokeProjectGit(projectId, 'git_project_overview');
    },
    pruneProjectGitWorktrees(projectId) {
      return invokeProjectGit(projectId, 'git_prune_worktrees');
    },
    pushProjectGitBranch(projectId, request) {
      return invokeProjectGit(projectId, 'git_push_branch', {
        ...(request.branchName ? { branchName: request.branchName } : {}),
        ...(request.remoteName ? { remoteName: request.remoteName } : {}),
      });
    },
    removeProjectGitWorktree(projectId, request) {
      return invokeProjectGit(projectId, 'git_remove_worktree', {
        force: request.force ?? false,
        worktreeKey: request.worktreeKey,
      });
    },
    switchProjectGitBranch(projectId, request) {
      return invokeProjectGit(projectId, 'git_switch_branch', {
        branchName: request.branchName,
      });
    },
  };
}
