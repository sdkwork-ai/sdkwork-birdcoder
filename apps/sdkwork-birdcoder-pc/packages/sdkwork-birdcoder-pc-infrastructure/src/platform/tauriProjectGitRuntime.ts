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
