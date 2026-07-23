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

export interface IGitService {
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
  getProjectGitOverview(projectId: string): Promise<WorkbenchGitOverviewView>;
  getProjectGitDiff(projectId: string): Promise<WorkbenchGitDiffView>;
  pushProjectGitBranch(
    projectId: string,
    request: PushWorkbenchGitBranchInput,
  ): Promise<WorkbenchGitOverviewView>;
  pruneProjectGitWorktrees(projectId: string): Promise<WorkbenchGitOverviewView>;
  removeProjectGitWorktree(
    projectId: string,
    request: RemoveWorkbenchGitWorktreeInput,
  ): Promise<WorkbenchGitOverviewView>;
  switchProjectGitBranch(
    projectId: string,
    request: SwitchWorkbenchGitBranchInput,
  ): Promise<WorkbenchGitOverviewView>;
}
