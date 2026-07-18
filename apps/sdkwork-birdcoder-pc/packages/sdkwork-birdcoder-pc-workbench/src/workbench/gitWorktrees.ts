import type { BirdCoderGitWorktreeSummary } from '@sdkwork/birdcoder-pc-contracts-commons';

export function getProjectGitWorktreeKey(
  worktree: BirdCoderGitWorktreeSummary | null | undefined,
): string {
  return worktree?.worktreeKey?.trim() ?? '';
}

export function getProjectGitWorktreeDisplayName(
  worktree: BirdCoderGitWorktreeSummary | null | undefined,
): string {
  return (
    worktree?.branch?.trim()
    || getProjectGitWorktreeKey(worktree)
    || worktree?.head?.trim()
    || ''
  );
}

export function isProjectGitWorktreePrunable(
  worktree: BirdCoderGitWorktreeSummary | null | undefined,
): boolean {
  return Boolean(worktree?.prunableReason?.trim());
}

export function isProjectGitWorktreeRemovable(
  worktree: BirdCoderGitWorktreeSummary,
): boolean {
  return !worktree.isCurrent && Boolean(getProjectGitWorktreeKey(worktree));
}
