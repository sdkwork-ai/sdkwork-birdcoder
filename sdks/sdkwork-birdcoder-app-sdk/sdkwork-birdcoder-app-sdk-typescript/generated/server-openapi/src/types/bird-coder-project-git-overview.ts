import type { BirdCoderGitBranchSummary } from './bird-coder-git-branch-summary';
import type { BirdCoderGitStatusCounts } from './bird-coder-git-status-counts';
import type { BirdCoderGitWorktreeSummary } from './bird-coder-git-worktree-summary';

export interface BirdCoderProjectGitOverview {
  branches: BirdCoderGitBranchSummary[];
  currentBranch?: string;
  currentRevision?: string;
  currentWorktreePath?: string;
  detachedHead: boolean;
  repositoryRootPath?: string;
  status: 'ready' | 'not_repository';
  statusCounts: BirdCoderGitStatusCounts;
  worktrees: BirdCoderGitWorktreeSummary[];
}
