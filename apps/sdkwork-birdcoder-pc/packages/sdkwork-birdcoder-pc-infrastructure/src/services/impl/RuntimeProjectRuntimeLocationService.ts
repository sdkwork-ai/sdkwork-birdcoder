import type {
  LocalFolderMountSource,
  ProjectDeviceMountState,
} from '@sdkwork/birdcoder-pc-contracts-commons';

import { openLocalFolder } from '../../platform/openLocalFolder.ts';
import type { IFileSystemService } from '../interfaces/IFileSystemService.ts';
import type { DesktopRuntimeLocationIdentityPort } from '../interfaces/IDesktopRuntimeLocationIdentityPort.ts';
import type {
  IProjectRuntimeLocationService,
  ProjectRuntimeLocationBindingResult,
  ProjectRuntimeLocationCapability,
  ProjectRuntimeLocationInput,
  ProjectRuntimeLocationResolution,
  ProjectRuntimeLocationResolutionRequest,
} from '../interfaces/IProjectRuntimeLocationService.ts';
import {
  normalizeProjectRuntimeLocationInput,
  ProjectRuntimeLocationExecutionUnavailableError,
  requireProjectRuntimeLocationExecutionId,
} from '../interfaces/IProjectRuntimeLocationService.ts';
import type { BirdCoderExecutionLocation } from '../runtimeTopology.ts';

export interface RuntimeProjectRuntimeLocationServiceOptions {
  executionLocation?: BirdCoderExecutionLocation;
  fileSystemService: IFileSystemService;
  identityPort?: Pick<DesktopRuntimeLocationIdentityPort, 'resolveDesktopRuntimeLocationBinding'>;
  openLocalFolder?: typeof openLocalFolder;
}

function readProjectId(project: ProjectRuntimeLocationInput): string {
  return (typeof project === 'string' ? project : project.projectId).trim();
}

function mapUnavailableMountState(
  projectId: string,
  mountState: ProjectDeviceMountState | undefined,
): Extract<ProjectRuntimeLocationResolution, { status: 'unavailable' }> {
  switch (mountState?.status) {
    case 'session_required':
      return {
        code: 'session_required',
        message: 'Sign in before accessing this project runtime location.',
        mountState,
        projectId,
        status: 'unavailable',
      };
    case 'permission_required':
    case 'mount_required':
      return {
        code: 'mount_required',
        message: 'The current project does not have a recoverable local path on this desktop.',
        mountState,
        projectId,
        status: 'unavailable',
      };
    case 'mounted':
    case 'recoverable':
      return {
        code: 'browser_path_unavailable',
        message: 'This project mount does not expose a native desktop path.',
        mountState,
        projectId,
        status: 'unavailable',
      };
    default:
      return {
        code: 'unavailable',
        message: 'A usable local project runtime location is unavailable.',
        mountState,
        projectId,
        status: 'unavailable',
      };
  }
}

function mapBindingFailure(projectId: string, error: unknown): ProjectRuntimeLocationBindingResult {
  const message = error instanceof Error && error.message.trim()
    ? error.message.trim()
    : 'The local project folder could not be persisted.';
  return {
    code: /sign in|session/iu.test(message) ? 'session_required' : 'persistence_failed',
    message,
    projectId,
    status: 'failed',
  };
}

export class RuntimeProjectRuntimeLocationService implements IProjectRuntimeLocationService {
  private readonly executionLocation: BirdCoderExecutionLocation;
  private readonly fileSystemService: IFileSystemService;
  private readonly identityPort?: RuntimeProjectRuntimeLocationServiceOptions['identityPort'];
  private readonly openLocalFolder: typeof openLocalFolder;

  constructor({
    executionLocation = 'local-host',
    fileSystemService,
    identityPort,
    openLocalFolder: openLocalFolderOverride,
  }: RuntimeProjectRuntimeLocationServiceOptions) {
    this.executionLocation = executionLocation;
    this.fileSystemService = fileSystemService;
    this.identityPort = identityPort;
    this.openLocalFolder = openLocalFolderOverride ?? openLocalFolder;
  }

  async bindLocalProjectRuntimeLocation(
    project: ProjectRuntimeLocationInput,
    source: LocalFolderMountSource,
  ): Promise<ProjectRuntimeLocationBindingResult> {
    const target = normalizeProjectRuntimeLocationInput(project);
    if (!target) {
      return {
        code: 'unavailable',
        message: 'A project must be selected before binding a local folder.',
        projectId: readProjectId(project),
        status: 'failed',
      };
    }
    const { projectId } = target;

    try {
      await this.fileSystemService.mountFolder(projectId, source);
      const mountState = await this.fileSystemService.getProjectMountState(projectId);
      if (mountState.status !== 'mounted') {
        return {
          code: mountState.status === 'session_required' ? 'session_required' : 'persistence_failed',
          message: 'The local project folder was not retained as an active durable mount.',
          projectId,
          status: 'failed',
        };
      }

      const runtimeLocationId = source.type === 'tauri'
        ? await this.resolveOpaqueRuntimeLocationId(projectId, source.path, mountState)
        : null;
      return {
        host: source.type,
        projectId,
        ...(runtimeLocationId ? { runtimeLocationId } : {}),
        status: 'bound',
      };
    } catch (error) {
      return mapBindingFailure(projectId, error);
    }
  }

  async resolveProjectRuntimeLocation(
    project: ProjectRuntimeLocationInput,
    request: ProjectRuntimeLocationResolutionRequest,
  ): Promise<ProjectRuntimeLocationResolution> {
    const target = normalizeProjectRuntimeLocationInput(project);
    if (!target) {
      return {
        code: 'unavailable',
        message: 'A project must be selected before resolving a runtime location.',
        projectId: readProjectId(project),
        status: 'unavailable',
      };
    }
    const { mountedPath, projectId } = target;

    const activeWorkingDirectory = await this.resolveLocalWorkingDirectory(
      projectId,
      mountedPath,
    );
    if (activeWorkingDirectory) {
      return this.buildResolvedLocation(
        projectId,
        activeWorkingDirectory,
        'active_mount',
      );
    }

    let recoveredMountState: ProjectDeviceMountState | undefined;
    try {
      recoveredMountState = (
        await this.fileSystemService.restoreProjectMount(projectId)
      ).state;
    } catch {
      recoveredMountState = await this.readMountState(projectId);
    }

    const recoveredWorkingDirectory = await this.resolveLocalWorkingDirectory(
      projectId,
      mountedPath,
    );
    if (recoveredWorkingDirectory) {
      return this.buildResolvedLocation(
        projectId,
        recoveredWorkingDirectory,
        'recovered_mount',
      );
    }

    if (!request.allowFolderSelection) {
      return mapUnavailableMountState(
        projectId,
        recoveredMountState ?? (await this.readMountState(projectId)),
      );
    }

    let pickerResult;
    try {
      pickerResult = await this.openLocalFolder();
    } catch (error) {
      return {
        code: 'unavailable',
        message: error instanceof Error && error.message.trim()
          ? error.message.trim()
          : 'The local folder picker could not be opened.',
        projectId,
        status: 'unavailable',
      };
    }

    if (pickerResult.status === 'cancelled') {
      return { projectId, status: 'cancelled' };
    }
    if (pickerResult.status === 'unsupported') {
      return {
        message: pickerResult.message,
        projectId,
        status: 'unsupported',
      };
    }

    const binding = await this.bindLocalProjectRuntimeLocation(
      target,
      pickerResult.source,
    );
    if (binding.status !== 'bound') {
      return {
        code: binding.code,
        message: binding.message,
        projectId,
        status: 'unavailable',
      };
    }

    const selectedWorkingDirectory = await this.resolveLocalWorkingDirectory(
      projectId,
      mountedPath,
    );
    if (!selectedWorkingDirectory) {
      return mapUnavailableMountState(
        projectId,
        await this.readMountState(projectId),
      );
    }

    return {
      location: {
        localWorkingDirectory: selectedWorkingDirectory,
        projectId,
        ...(binding.runtimeLocationId ? { runtimeLocationId: binding.runtimeLocationId } : {}),
        source: 'selected_folder',
      },
      status: 'resolved',
    };
  }

  async resolveProjectLocalWorkingDirectory(
    project: ProjectRuntimeLocationInput,
    request: ProjectRuntimeLocationResolutionRequest,
  ): Promise<string | null> {
    const resolution = await this.resolveProjectRuntimeLocation(project, request);
    return resolution.status === 'resolved'
      ? resolution.location.localWorkingDirectory
      : null;
  }

  async revealProjectInFileManager(
    project: ProjectRuntimeLocationInput,
  ): Promise<boolean> {
    const target = normalizeProjectRuntimeLocationInput(project);
    if (!target) {
      return false;
    }
    const localWorkingDirectory = await this.resolveProjectLocalWorkingDirectory(target, {
      allowFolderSelection: false,
      capability: 'file_system',
    });
    if (!localWorkingDirectory) {
      return false;
    }

    try {
      return await this.fileSystemService.revealProjectInFileManager(
        target.projectId,
        target.mountedPath,
      );
    } catch {
      return false;
    }
  }

  async resolveProjectRuntimeLocationId(
    project: ProjectRuntimeLocationInput,
    capability: ProjectRuntimeLocationCapability,
  ): Promise<string | null> {
    void capability;
    if (this.executionLocation === 'cloud-workspace') {
      return null;
    }
    const resolution = await this.resolveProjectRuntimeLocation(project, {
      allowFolderSelection: false,
      capability,
    });
    return resolution.status === 'resolved'
      ? resolution.location.runtimeLocationId?.trim() || null
      : null;
  }

  async resolveProjectRuntimeLocationExecutionId(
    project: ProjectRuntimeLocationInput,
    capability: ProjectRuntimeLocationCapability,
    options: { allowFolderSelection?: boolean } = {},
  ): Promise<string> {
    const target = normalizeProjectRuntimeLocationInput(project);
    if (!target) {
      throw new ProjectRuntimeLocationExecutionUnavailableError({
        code: 'runtime_location_unavailable',
        message: 'A project must be selected before resolving an execution location.',
        projectId: readProjectId(project),
      });
    }
    if (this.executionLocation === 'cloud-workspace') {
      throw new ProjectRuntimeLocationExecutionUnavailableError({
        code: 'missing_runtime_location_id',
        message: 'No authorized remote runtime location is configured for this project.',
        projectId: target.projectId,
      });
    }
    return requireProjectRuntimeLocationExecutionId(
      await this.resolveProjectRuntimeLocation(target, {
        allowFolderSelection: options.allowFolderSelection ?? false,
        capability,
      }),
    );
  }

  private async buildResolvedLocation(
    projectId: string,
    localWorkingDirectory: string,
    source: 'active_mount' | 'recovered_mount',
  ): Promise<ProjectRuntimeLocationResolution> {
    const mountState = await this.readMountState(projectId);
    const runtimeLocationId = await this.resolveOpaqueRuntimeLocationId(
      projectId,
      localWorkingDirectory,
      mountState,
    );
    return {
      location: {
        localWorkingDirectory,
        projectId,
        ...(runtimeLocationId ? { runtimeLocationId } : {}),
        source,
      },
      status: 'resolved',
    };
  }

  private async resolveOpaqueRuntimeLocationId(
    projectId: string,
    absolutePath: string,
    mountState: ProjectDeviceMountState | undefined,
  ): Promise<string | null> {
    if (mountState?.host !== 'tauri' || !this.identityPort) {
      return null;
    }
    const identity = await this.identityPort.resolveDesktopRuntimeLocationBinding({
      absolutePath,
      projectId,
    });
    return identity?.rootLocator.trim() || null;
  }

  private async readMountState(projectId: string): Promise<ProjectDeviceMountState | undefined> {
    try {
      return await this.fileSystemService.getProjectMountState(projectId);
    } catch {
      return undefined;
    }
  }

  private async resolveLocalWorkingDirectory(
    projectId: string,
    mountedPath?: string,
  ): Promise<string | null> {
    try {
      return await this.fileSystemService.resolveLocalWorkingDirectory(projectId, mountedPath);
    } catch {
      return null;
    }
  }
}
