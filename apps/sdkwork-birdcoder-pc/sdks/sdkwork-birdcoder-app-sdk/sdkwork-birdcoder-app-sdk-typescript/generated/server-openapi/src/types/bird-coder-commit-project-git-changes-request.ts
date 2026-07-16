export interface BirdCoderCommitProjectGitChangesRequest {
  /** Verified project runtime-location identifier used for Git execution. */
  runtimeLocationId: string;
  includeUnstaged?: boolean;
  /** Required non-blank Git commit message. */
  message: string;
}
