export interface BirdCoderRebindProjectRuntimeLocationRequest {
  pathFlavor: 'windows' | 'posix';
  /** Opaque, path-free target locator. Do not provide a relative or absolute filesystem path. */
  rootLocator: string;
  /** Write-only replacement absolute path for encrypted-at-rest registration. It is never returned. */
  absolutePath: string;
  /** Safe display label for the rebound location. */
  displayName?: string;
}
