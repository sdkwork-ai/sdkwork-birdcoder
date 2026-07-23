import type {
  LocalFolderMountSource,
  ProjectDeviceMountState,
} from '@sdkwork/birdcoder-pc-contracts-commons';

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
  localWorkingDirectory: string;
  projectId: string;
  /** Opaque host identity. Native paths and browser handles never enter this field. */
  runtimeLocationId?: string;
  source: 'active_mount' | 'recovered_mount' | 'selected_folder';
}

export type ProjectRuntimeLocationExecutionUnavailableCode =
  | 'cancelled'
  | 'missing_runtime_location_id'
  | 'runtime_location_unavailable';

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
  if (!runtimeLocationId) {
    throw new ProjectRuntimeLocationExecutionUnavailableError({
      code: 'missing_runtime_location_id',
      message: 'An opaque host runtime location is required before creating a coding session.',
      projectId: resolution.location.projectId,
    });
  }

  return runtimeLocationId;
}

export type ProjectRuntimeLocationBindingResult =
  | {
      host: LocalFolderMountSource['type'];
      projectId: string;
      runtimeLocationId?: string;
      status: 'bound';
    }
  | {
      code: 'persistence_failed' | 'session_required' | 'unavailable';
      message: string;
      projectId: string;
      status: 'failed';
    };

export interface IProjectRuntimeLocationService {
  bindLocalProjectRuntimeLocation(
    projectId: string,
    source: LocalFolderMountSource,
  ): Promise<ProjectRuntimeLocationBindingResult>;

  resolveProjectRuntimeLocation(
    projectId: string,
    request: ProjectRuntimeLocationResolutionRequest,
  ): Promise<ProjectRuntimeLocationResolution>;

  resolveProjectRuntimeLocationExecutionId(
    projectId: string,
    capability: ProjectRuntimeLocationCapability,
    options?: { allowFolderSelection?: boolean },
  ): Promise<string>;

  resolveProjectRuntimeLocationId(
    projectId: string,
    capability: ProjectRuntimeLocationCapability,
  ): Promise<string | null>;
}
