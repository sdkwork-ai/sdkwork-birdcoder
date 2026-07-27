import type {
  CommitWorkbenchGitChangesInput,
  CreateWorkbenchGitBranchInput,
  CreateWorkbenchGitWorktreeInput,
  PushWorkbenchGitBranchInput,
  RemoveWorkbenchGitWorktreeInput,
  SwitchWorkbenchGitBranchInput,
  WorkbenchGitDiffView,
  WorkbenchGitOverviewView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { isBirdCoderTauriRuntime } from './tauriRuntime.ts';

type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export type TauriProjectGitRuntimeUnavailableReason =
  | 'runtime_unavailable'
  | 'project_path_unavailable';

export class TauriProjectGitRuntimeUnavailableError extends Error {
  readonly code = 'tauri_project_git_runtime_unavailable';
  readonly reason: TauriProjectGitRuntimeUnavailableReason;

  constructor(
    reason: TauriProjectGitRuntimeUnavailableReason = 'runtime_unavailable',
    message?: string,
  ) {
    super(
      message
      ?? (reason === 'project_path_unavailable'
        ? 'The current project does not have a recoverable local path. Mount a local folder for this project first.'
        : 'The Tauri project Git runtime is unavailable.'),
    );
    this.name = 'TauriProjectGitRuntimeUnavailableError';
    this.reason = reason;
  }
}

export function isTauriProjectGitRuntimeUnavailableError(error: unknown): boolean {
  return error instanceof TauriProjectGitRuntimeUnavailableError;
}

export interface TauriProjectGitRuntime {
  commitProjectGitChanges(
    projectId: string,
    request: CommitWorkbenchGitChangesInput,
  ): Promise<WorkbenchGitOverviewView>;
  createProjectGitBranch(
    projectId: string,
    request: CreateWorkbenchGitBranchInput,
  ): Promise<WorkbenchGitOverviewView>;
  createProjectGitWorktree(
    projectId: string,
    request: CreateWorkbenchGitWorktreeInput,
  ): Promise<WorkbenchGitOverviewView>;
  getProjectGitDiff(projectId: string): Promise<WorkbenchGitDiffView>;
  getProjectGitOverview(projectId: string): Promise<WorkbenchGitOverviewView>;
  pruneProjectGitWorktrees(projectId: string): Promise<WorkbenchGitOverviewView>;
  pushProjectGitBranch(
    projectId: string,
    request: PushWorkbenchGitBranchInput,
  ): Promise<WorkbenchGitOverviewView>;
  removeProjectGitWorktree(
    projectId: string,
    request: RemoveWorkbenchGitWorktreeInput,
  ): Promise<WorkbenchGitOverviewView>;
  switchProjectGitBranch(
    projectId: string,
    request: SwitchWorkbenchGitBranchInput,
  ): Promise<WorkbenchGitOverviewView>;
}

export interface CreateTauriProjectGitRuntimeOptions {
  invoke?: TauriInvoke;
  isTauriRuntime?: () => boolean | Promise<boolean>;
  resolveProjectRoot: (projectId: string) => Promise<string | null>;
}

function createProjectPathUnavailableOverview(): WorkbenchGitOverviewView {
  return {
    branches: [],
    currentBranch: undefined,
    currentRevision: undefined,
    detachedHead: false,
    diagnosticCode: 'project_path_unavailable',
    status: 'unavailable',
    statusCounts: { staged: 0, unstaged: 0, untracked: 0 },
    worktrees: [],
  };
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
        'project_path_unavailable',
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
      return invokeProjectGit<WorkbenchGitOverviewView>(
        projectId,
        'git_project_overview',
      ).catch((error: unknown) => {
        if (
          error instanceof TauriProjectGitRuntimeUnavailableError
          && error.reason === 'project_path_unavailable'
        ) {
          return createProjectPathUnavailableOverview();
        }
        throw error;
      });
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
