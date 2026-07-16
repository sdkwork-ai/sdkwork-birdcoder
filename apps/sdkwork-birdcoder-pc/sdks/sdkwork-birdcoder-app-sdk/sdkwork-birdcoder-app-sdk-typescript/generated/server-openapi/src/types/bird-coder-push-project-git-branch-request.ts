export interface BirdCoderPushProjectGitBranchRequest {
  /** Verified project runtime-location identifier used for Git execution. */
  runtimeLocationId: string;
  branchName?: string;
  remoteName?: string;
}
