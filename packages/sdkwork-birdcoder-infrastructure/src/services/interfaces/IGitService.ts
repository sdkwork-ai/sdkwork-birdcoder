import type {
  BirdCoderCommitProjectGitChangesRequest,
  BirdCoderCreateProjectGitBranchRequest,
  BirdCoderCreateProjectGitWorktreeRequest,
  BirdCoderProjectGitOverview,
  BirdCoderPushProjectGitBranchRequest,
  BirdCoderRemoveProjectGitWorktreeRequest,
  BirdCoderSwitchProjectGitBranchRequest,
} from '@sdkwork/birdcoder-types';

export interface IGitService {
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
  getProjectGitOverview(projectId: string): Promise<BirdCoderProjectGitOverview>;
  pushProjectGitBranch(
    projectId: string,
    request: BirdCoderPushProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview>;
  pruneProjectGitWorktrees(projectId: string): Promise<BirdCoderProjectGitOverview>;
  removeProjectGitWorktree(
    projectId: string,
    request: BirdCoderRemoveProjectGitWorktreeRequest,
  ): Promise<BirdCoderProjectGitOverview>;
  switchProjectGitBranch(
    projectId: string,
    request: BirdCoderSwitchProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview>;
}
