export type WorkbenchGitRepositoryStatus =
  | 'ready'
  | 'not_repository'
  | 'repository_root_mismatch'
  | 'unavailable';

export type WorkbenchGitRepositoryDiagnosticCode =
  | 'git_command_failed'
  | 'git_executable_unavailable'
  | 'not_repository'
  | 'project_path_unavailable'
  | 'repository_root_mismatch';

export interface WorkbenchGitStatusCountsView {
  staged: number;
  unstaged: number;
  untracked: number;
}

export interface WorkbenchGitBranchView {
  isCurrent: boolean;
  isRemote: boolean;
  name: string;
}

export interface WorkbenchGitWorktreeView {
  branch?: string;
  head?: string;
  isCurrent: boolean;
  prunableReason?: string;
  worktreeKey?: string;
}

export interface WorkbenchGitOverviewView {
  branches: WorkbenchGitBranchView[];
  currentBranch?: string;
  currentRevision?: string;
  detachedHead: boolean;
  diagnosticCode?: WorkbenchGitRepositoryDiagnosticCode;
  status: WorkbenchGitRepositoryStatus;
  statusCounts: WorkbenchGitStatusCountsView;
  worktrees: WorkbenchGitWorktreeView[];
}

export interface WorkbenchGitDiffView {
  patch: string;
  truncated: boolean;
}

export interface CreateWorkbenchGitBranchInput {
  branchName: string;
}

export interface SwitchWorkbenchGitBranchInput {
  branchName: string;
}

export interface CommitWorkbenchGitChangesInput {
  includeUnstaged?: boolean;
  message: string;
}

export interface PushWorkbenchGitBranchInput {
  branchName?: string;
  forceWithLease?: boolean;
  remoteName?: string;
}

export interface CreateWorkbenchGitWorktreeInput {
  branchName: string;
}

export interface RemoveWorkbenchGitWorktreeInput {
  force?: boolean;
  worktreeKey: string;
}
