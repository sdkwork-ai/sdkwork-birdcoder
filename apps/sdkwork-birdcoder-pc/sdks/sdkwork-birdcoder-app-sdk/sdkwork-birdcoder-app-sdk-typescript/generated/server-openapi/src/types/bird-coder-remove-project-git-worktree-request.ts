export interface BirdCoderRemoveProjectGitWorktreeRequest {
  /** Verified project runtime-location identifier used for Git execution. */
  runtimeLocationId: string;
  force?: boolean;
  worktreeKey: string;
}
