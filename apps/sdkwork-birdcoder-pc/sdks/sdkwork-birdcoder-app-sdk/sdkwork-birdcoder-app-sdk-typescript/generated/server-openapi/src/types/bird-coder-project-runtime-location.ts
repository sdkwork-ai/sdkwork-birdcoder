export interface BirdCoderProjectRuntimeLocation {
  id: string;
  uuid?: string;
  projectId: string;
  runtimeTargetId: string;
  runtimeTargetKind: 'desktop_device' | 'server' | 'runner' | 'container' | 'remote_workspace';
  locationKind: 'desktop_checkout' | 'server_workspace' | 'runner_worktree' | 'container_volume' | 'remote_workspace';
  pathFlavor: 'windows' | 'posix';
  /** Opaque, path-free runtime target locator. It is not a filesystem path. */
  rootLocator: string;
  /** Safe display label for this location. */
  displayName: string;
  /** Whether encrypted absolute path material is registered. The path itself is never returned. */
  hasAbsolutePath: boolean;
  terminalAvailable: boolean;
  gitAvailable: boolean;
  buildAvailable: boolean;
  fileSystemAvailable: boolean;
  healthStatus: 'pending_verification' | 'local_observed' | 'healthy' | 'degraded' | 'unavailable' | 'revoked';
  lastVerifiedAt?: string;
  lastSeenAt?: string;
  /** Credential-free sanitized Git repository URL reported by a trusted target. */
  gitRepositoryUrl?: string;
  gitRemoteName?: string;
  gitBranch?: string;
  gitCommit?: string;
  gitWorktreeKey?: string;
  /** Optimistic concurrency version used with the If-Match request header. */
  version: string;
  createdAt: string;
  updatedAt: string;
}
