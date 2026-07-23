export interface BirdCoderProjectRuntimeLocation {
  id: string;
  uuid: string;
  projectId: string;
  runtimeTargetId: string;
  runtimeTargetKind: 'desktop' | 'server' | 'runner' | 'container' | 'remote';
  locationKind: 'local_directory' | 'server_workspace' | 'runner_workspace' | 'container_workspace' | 'remote_workspace';
  pathFlavor: 'windows' | 'posix' | 'virtual';
  /** Safe display label for this location. */
  displayName: string;
  terminalAvailable: boolean;
  gitAvailable: boolean;
  buildAvailable: boolean;
  filesystemAvailable: boolean;
  healthStatus: 'pending' | 'healthy' | 'degraded' | 'unreachable' | 'revoked';
  lastVerifiedAt?: string;
  lastSeenAt?: string;
  /** Optimistic concurrency version used with the If-Match request header. */
  version: string;
  createdAt: string;
  updatedAt: string;
}
