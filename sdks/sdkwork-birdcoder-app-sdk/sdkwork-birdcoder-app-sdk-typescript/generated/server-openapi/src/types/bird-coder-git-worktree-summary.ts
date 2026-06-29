export interface BirdCoderGitWorktreeSummary {
  branch?: string;
  head?: string;
  id: string;
  isCurrent: boolean;
  isDetached: boolean;
  isLocked: boolean;
  isPrunable: boolean;
  label: string;
  lockedReason?: string;
  prunableReason?: string;
  path: string;
}
