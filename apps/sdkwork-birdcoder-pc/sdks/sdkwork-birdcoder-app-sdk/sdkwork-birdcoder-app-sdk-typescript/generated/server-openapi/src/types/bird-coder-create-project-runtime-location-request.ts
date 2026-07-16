export interface BirdCoderCreateProjectRuntimeLocationRequest {
  runtimeTargetId: string;
  runtimeTargetKind: 'desktop_device' | 'server' | 'runner' | 'container' | 'remote_workspace';
  locationKind: 'desktop_checkout' | 'server_workspace' | 'runner_worktree' | 'container_volume' | 'remote_workspace';
  pathFlavor: 'windows' | 'posix';
  /** Opaque, path-free target locator. Do not provide a relative or absolute filesystem path. */
  rootLocator: string;
  /** Write-only absolute path for encrypted-at-rest registration. It is never returned. */
  absolutePath: string;
  /** Safe display label for the registered location. */
  displayName?: string;
}
