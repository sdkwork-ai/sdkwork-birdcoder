/**
 * Host-local identity for a desktop runtime location. Values are opaque and
 * safe to use as server identifiers; native filesystem paths are never
 * returned from this boundary.
 */
export interface DesktopRuntimeLocationBindingIdentity {
  displayName: string;
  locationKind: 'desktop_checkout';
  pathFlavor: 'windows' | 'posix';
  requiresRebind: boolean;
  rootLocator: string;
  runtimeLocationCreateGeneration: number;
  runtimeLocationId?: string;
  runtimeLocationVersion?: string;
  runtimeTargetId: string;
  runtimeTargetKind: 'desktop_device';
}

export interface DesktopRuntimeLocationIdentityPort {
  resolveDesktopRuntimeLocationBinding(input: {
    absolutePath: string;
    projectId: string;
  }): Promise<DesktopRuntimeLocationBindingIdentity | null>;

  persistRemoteRuntimeLocationBinding(input: {
    absolutePath: string;
    projectId: string;
    rootLocator: string;
    runtimeLocationId: string;
    runtimeLocationVersion: string;
  }): Promise<void>;

  clearRemoteRuntimeLocationBinding(input: {
    absolutePath: string;
    projectId: string;
    rootLocator: string;
  }): Promise<void>;
}
