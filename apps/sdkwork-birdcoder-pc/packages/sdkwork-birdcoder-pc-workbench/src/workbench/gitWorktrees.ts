import type { WorkbenchGitWorktreeView } from '@sdkwork/birdcoder-pc-contracts-commons';

export function getProjectGitWorktreeKey(
  worktree: WorkbenchGitWorktreeView | null | undefined,
): string {
  return worktree?.worktreeKey?.trim() ?? '';
}

export function getProjectGitWorktreeDisplayName(
  worktree: WorkbenchGitWorktreeView | null | undefined,
): string {
  return (
    worktree?.branch?.trim()
    || getProjectGitWorktreeKey(worktree)
    || worktree?.head?.trim()
    || ''
  );
}

export function isProjectGitWorktreePrunable(
  worktree: WorkbenchGitWorktreeView | null | undefined,
): boolean {
  return Boolean(worktree?.prunableReason?.trim());
}

export function isProjectGitWorktreeRemovable(
  worktree: WorkbenchGitWorktreeView,
): boolean {
  return !worktree.isCurrent && Boolean(getProjectGitWorktreeKey(worktree));
}
