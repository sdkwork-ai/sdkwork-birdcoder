import type {
  LocalFolderMountSource,
  ProjectDeviceMountState,
} from '@sdkwork/birdcoder-pc-types';

export type ProjectRuntimeLocationCapability =
  | 'terminal'
  | 'git'
  | 'build'
  | 'file_system';

export interface ProjectRuntimeLocationResolutionRequest {
  allowFolderSelection?: boolean;
  capability: ProjectRuntimeLocationCapability;
  mountedPath?: string;
}

export interface ResolvedProjectRuntimeLocation {
  /**
   * The safe identifier returned by the optional authoritative registration
   * adapter. Local-only resolution does not expose or synthesize one.
   */
  runtimeLocationId?: string;
  projectId: string;
  localWorkingDirectory: string;
  /**
   * Reports only the local registration lifecycle. It is not a server health,
   * verification, Git, or capability claim.
   */
  remoteSynchronization: ProjectRuntimeLocationRemoteSynchronization;
  source: 'active_mount' | 'recovered_mount' | 'selected_folder';
}

export type ProjectRuntimeLocationRemoteSynchronization =
  | 'not_configured'
  | 'pending'
  | 'registered';

export type ProjectRuntimeLocationExecutionUnavailableCode =
  | 'cancelled'
  | 'missing_runtime_location_id'
  | 'runtime_location_unavailable';

/**
 * Typed failure used when an app workflow needs a remote execution binding.
 * It intentionally carries only a project id and opaque failure code, never a
 * local path, browser handle, or target credential.
 */
export class ProjectRuntimeLocationExecutionUnavailableError extends Error {
  readonly code: ProjectRuntimeLocationExecutionUnavailableCode;
  readonly projectId: string;

  constructor({
    code,
    message,
    projectId,
  }: {
    code: ProjectRuntimeLocationExecutionUnavailableCode;
    message: string;
    projectId: string;
  }) {
    super(message);
    this.name = 'ProjectRuntimeLocationExecutionUnavailableError';
    this.code = code;
    this.projectId = projectId;
  }
}

export type ProjectRuntimeLocationResolution =
  | {
      location: ResolvedProjectRuntimeLocation;
      status: 'resolved';
    }
  | {
      projectId: string;
      status: 'cancelled';
    }
  | {
      message: string;
      projectId: string;
      status: 'unsupported';
    }
  | {
      code:
        | 'browser_path_unavailable'
        | 'mount_required'
        | 'persistence_failed'
        | 'session_required'
        | 'unavailable';
      message: string;
      mountState?: ProjectDeviceMountState;
      projectId: string;
      status: 'unavailable';
    };

/**
 * Converts a local runtime-location resolution into the opaque identifier
 * required by remote execution APIs. A local desktop path is never returned
 * from this helper or used as a substitute for the identifier.
 */
export function requireProjectRuntimeLocationExecutionId(
  resolution: ProjectRuntimeLocationResolution,
): string {
  if (resolution.status === 'cancelled') {
    throw new ProjectRuntimeLocationExecutionUnavailableError({
      code: 'cancelled',
      message: 'Project runtime-location selection was cancelled.',
      projectId: resolution.projectId,
    });
  }

  if (resolution.status !== 'resolved') {
    throw new ProjectRuntimeLocationExecutionUnavailableError({
      code: 'runtime_location_unavailable',
      message: resolution.message,
      projectId: resolution.projectId,
    });
  }

  const runtimeLocationId = resolution.location.runtimeLocationId?.trim();
  if (!runtimeLocationId || resolution.location.remoteSynchronization !== 'registered') {
    throw new ProjectRuntimeLocationExecutionUnavailableError({
      code: 'missing_runtime_location_id',
      message:
        'A registered project runtime location is required before remote coding-session execution.',
      projectId: resolution.location.projectId,
    });
  }

  return runtimeLocationId;
}

export type ProjectRuntimeLocationBindingResult =
  | {
      host: LocalFolderMountSource['type'];
      projectId: string;
      remoteSynchronization: ProjectRuntimeLocationRemoteSynchronization;
      runtimeLocationId?: string;
      status: 'bound';
    }
  | {
      code: 'persistence_failed' | 'session_required' | 'unavailable';
      message: string;
      projectId: string;
      status: 'failed';
    };

/**
 * An optional composed-SDK adapter synchronizes a trusted desktop target
 * binding after local durability succeeds. Browser directory handles never
 * enter this boundary as native paths.
 */
export interface ProjectRuntimeLocationRegistrationInput {
  absolutePath: string;
  displayName: string | null;
  projectId: string;
}

export interface ProjectRuntimeLocationRegistrationResult {
  remoteSynchronization: ProjectRuntimeLocationRemoteSynchronization;
  runtimeLocationId?: string;
}

export interface ProjectRuntimeLocationRegistrationPort {
  inspectLocalDesktopRuntimeLocation(
    input: ProjectRuntimeLocationRegistrationInput,
  ): Promise<ProjectRuntimeLocationRegistrationResult>;

  synchronizeLocalDesktopRuntimeLocation(
    input: ProjectRuntimeLocationRegistrationInput,
  ): Promise<ProjectRuntimeLocationRegistrationResult>;
}

export interface IProjectRuntimeLocationService {
  bindLocalProjectRuntimeLocation(
    projectId: string,
    source: LocalFolderMountSource,
  ): Promise<ProjectRuntimeLocationBindingResult>;

  resolveProjectRuntimeLocation(
    projectId: string,
    request: ProjectRuntimeLocationResolutionRequest,
  ): Promise<ProjectRuntimeLocationResolution>;
}
