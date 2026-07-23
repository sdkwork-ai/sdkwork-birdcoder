export interface BirdCoderRebindProjectRuntimeLocationRequest {
  pathFlavor: 'windows' | 'posix' | 'virtual';
  /** Write-only replacement absolute path for encrypted-at-rest registration. It is never returned. */
  absolutePath: string;
  displayName?: string | null;
}
