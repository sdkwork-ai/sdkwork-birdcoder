export interface BirdCoderCreateProjectRuntimeLocationRequest {
  runtimeTargetId: string;
  runtimeTargetKind: 'desktop' | 'server' | 'runner' | 'container' | 'remote';
  locationKind: 'local_directory' | 'server_workspace' | 'runner_workspace' | 'container_workspace' | 'remote_workspace';
  pathFlavor: 'windows' | 'posix' | 'virtual';
  /** Write-only absolute path for encrypted-at-rest registration. It is never returned. */
  absolutePath: string;
  /** Safe display label for the registered location. */
  displayName?: string;
}
