/**
 * Host-local identity for a desktop runtime location. Values are opaque and
 * safe to use as server identifiers; native filesystem paths are never
 * returned from this boundary.
 */
export interface DesktopRuntimeLocationBindingIdentity {
  displayName: string;
  locationKind: 'local_directory';
  pathFlavor: 'windows' | 'posix';
  rootLocator: string;
  runtimeTargetId: string;
  runtimeTargetKind: 'desktop';
}

export interface DesktopRuntimeLocationIdentityPort {
  resolveDesktopRuntimeLocationBinding(input: {
    absolutePath: string;
    projectId: string;
  }): Promise<DesktopRuntimeLocationBindingIdentity | null>;
}
