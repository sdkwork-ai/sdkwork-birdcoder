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
  ProjectRuntimeLocationResolution,
  ProjectRuntimeLocationResolutionRequest,
} from '../interfaces/IProjectRuntimeLocationService.ts';
import {
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

function normalizeProjectId(projectId: string): string | null {
  return projectId.trim() || null;
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
        message: 'Select a local desktop folder before using this project location.',
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
    projectId: string,
    source: LocalFolderMountSource,
  ): Promise<ProjectRuntimeLocationBindingResult> {
    const normalizedProjectId = normalizeProjectId(projectId);
    if (!normalizedProjectId) {
      return {
        code: 'unavailable',
        message: 'A project must be selected before binding a local folder.',
        projectId: projectId.trim(),
        status: 'failed',
      };
    }

    try {
      await this.fileSystemService.mountFolder(normalizedProjectId, source);
      const mountState = await this.fileSystemService.getProjectMountState(normalizedProjectId);
      if (mountState.status !== 'mounted') {
        return {
          code: mountState.status === 'session_required' ? 'session_required' : 'persistence_failed',
          message: 'The local project folder was not retained as an active durable mount.',
          projectId: normalizedProjectId,
          status: 'failed',
        };
      }

      const runtimeLocationId = source.type === 'tauri'
        ? await this.resolveOpaqueRuntimeLocationId(normalizedProjectId, source.path, mountState)
        : null;
      return {
        host: source.type,
        projectId: normalizedProjectId,
        ...(runtimeLocationId ? { runtimeLocationId } : {}),
        status: 'bound',
      };
    } catch (error) {
      return mapBindingFailure(normalizedProjectId, error);
    }
  }

  async resolveProjectRuntimeLocation(
    projectId: string,
    request: ProjectRuntimeLocationResolutionRequest,
  ): Promise<ProjectRuntimeLocationResolution> {
    const normalizedProjectId = normalizeProjectId(projectId);
    if (!normalizedProjectId) {
      return {
        code: 'unavailable',
        message: 'A project must be selected before resolving a runtime location.',
        projectId: projectId.trim(),
        status: 'unavailable',
      };
    }

    const activeWorkingDirectory = await this.resolveLocalWorkingDirectory(
      normalizedProjectId,
      request.mountedPath,
    );
    if (activeWorkingDirectory) {
      return this.buildResolvedLocation(
        normalizedProjectId,
        activeWorkingDirectory,
        'active_mount',
      );
    }

    let recoveredMountState: ProjectDeviceMountState | undefined;
    try {
      recoveredMountState = (
        await this.fileSystemService.restoreProjectMount(normalizedProjectId)
      ).state;
    } catch {
      recoveredMountState = await this.readMountState(normalizedProjectId);
    }

    const recoveredWorkingDirectory = await this.resolveLocalWorkingDirectory(
      normalizedProjectId,
      request.mountedPath,
    );
    if (recoveredWorkingDirectory) {
      return this.buildResolvedLocation(
        normalizedProjectId,
        recoveredWorkingDirectory,
        'recovered_mount',
      );
    }

    if (!request.allowFolderSelection) {
      return mapUnavailableMountState(
        normalizedProjectId,
        recoveredMountState ?? (await this.readMountState(normalizedProjectId)),
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
        projectId: normalizedProjectId,
        status: 'unavailable',
      };
    }

    if (pickerResult.status === 'cancelled') {
      return { projectId: normalizedProjectId, status: 'cancelled' };
    }
    if (pickerResult.status === 'unsupported') {
      return {
        message: pickerResult.message,
        projectId: normalizedProjectId,
        status: 'unsupported',
      };
    }

    const binding = await this.bindLocalProjectRuntimeLocation(
      normalizedProjectId,
      pickerResult.source,
    );
    if (binding.status !== 'bound') {
      return {
        code: binding.code,
        message: binding.message,
        projectId: normalizedProjectId,
        status: 'unavailable',
      };
    }

    const selectedWorkingDirectory = await this.resolveLocalWorkingDirectory(
      normalizedProjectId,
      request.mountedPath,
    );
    if (!selectedWorkingDirectory) {
      return mapUnavailableMountState(
        normalizedProjectId,
        await this.readMountState(normalizedProjectId),
      );
    }

    return {
      location: {
        localWorkingDirectory: selectedWorkingDirectory,
        projectId: normalizedProjectId,
        ...(binding.runtimeLocationId ? { runtimeLocationId: binding.runtimeLocationId } : {}),
        source: 'selected_folder',
      },
      status: 'resolved',
    };
  }

  async resolveProjectRuntimeLocationId(
    projectId: string,
    capability: ProjectRuntimeLocationCapability,
  ): Promise<string | null> {
    void capability;
    if (this.executionLocation === 'cloud-workspace') {
      return null;
    }
    const resolution = await this.resolveProjectRuntimeLocation(projectId, {
      allowFolderSelection: false,
      capability,
    });
    return resolution.status === 'resolved'
      ? resolution.location.runtimeLocationId?.trim() || null
      : null;
  }

  async resolveProjectRuntimeLocationExecutionId(
    projectId: string,
    capability: ProjectRuntimeLocationCapability,
    options: { allowFolderSelection?: boolean } = {},
  ): Promise<string> {
    const normalizedProjectId = normalizeProjectId(projectId);
    if (!normalizedProjectId) {
      throw new ProjectRuntimeLocationExecutionUnavailableError({
        code: 'runtime_location_unavailable',
        message: 'A project must be selected before resolving an execution location.',
        projectId: projectId.trim(),
      });
    }
    if (this.executionLocation === 'cloud-workspace') {
      throw new ProjectRuntimeLocationExecutionUnavailableError({
        code: 'missing_runtime_location_id',
        message: 'No authorized remote runtime location is configured for this project.',
        projectId: normalizedProjectId,
      });
    }
    return requireProjectRuntimeLocationExecutionId(
      await this.resolveProjectRuntimeLocation(normalizedProjectId, {
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
