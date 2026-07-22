import type { LocalFolderMountSource, ProjectDeviceMountState } from '@sdkwork/birdcoder-pc-contracts-commons';
import { openLocalFolder } from '../../platform/openLocalFolder.ts';
import type { IFileSystemService } from '../interfaces/IFileSystemService.ts';
import type {
  IProjectRuntimeLocationService,
  ProjectRuntimeLocationBindingResult,
  ProjectRuntimeLocationRegistrationPort,
  ProjectRuntimeLocationRegistrationResult,
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
  openLocalFolder?: typeof openLocalFolder;
  registrationPort?: ProjectRuntimeLocationRegistrationPort;
}

function normalizeProjectId(projectId: string): string | null {
  const normalizedProjectId = projectId.trim();
  return normalizedProjectId || null;
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
        message: 'This project is mounted in a browser and does not have a local desktop path.',
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

/**
 * Resolves the local execution side of a project runtime location. It keeps
 * native paths inside the local adapter and delegates registration only to an
 * injected composed-SDK adapter with a trusted desktop target binding.
 */
export class RuntimeProjectRuntimeLocationService implements IProjectRuntimeLocationService {
  private readonly fileSystemService: IFileSystemService;
  private readonly executionLocation: BirdCoderExecutionLocation;
  private readonly openLocalFolder: typeof openLocalFolder;
  private readonly registrationPort?: ProjectRuntimeLocationRegistrationPort;
  private readonly synchronizationTasks = new Map<
    string,
    Promise<ProjectRuntimeLocationRegistrationResult>
  >();

  constructor({
    executionLocation = 'local-host',
    fileSystemService,
    openLocalFolder: openLocalFolderOverride,
    registrationPort,
  }: RuntimeProjectRuntimeLocationServiceOptions) {
    this.executionLocation = executionLocation;
    this.fileSystemService = fileSystemService;
    this.openLocalFolder = openLocalFolderOverride ?? openLocalFolder;
    this.registrationPort = registrationPort;
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

      let runtimeLocationId: string | undefined;
      const registration = await this.inspectAndScheduleDesktopSynchronization(
        normalizedProjectId,
        source.type === 'tauri' ? source.path : null,
        mountState,
      );
      runtimeLocationId = registration.runtimeLocationId;

      return {
        host: source.type,
        projectId: normalizedProjectId,
        remoteSynchronization: registration.remoteSynchronization,
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
      const registration = await this.inspectAndScheduleDesktopSynchronization(
        normalizedProjectId,
        activeWorkingDirectory,
        await this.readMountState(normalizedProjectId),
      );
      return {
        location: {
          localWorkingDirectory: activeWorkingDirectory,
          projectId: normalizedProjectId,
          remoteSynchronization: registration.remoteSynchronization,
          ...(registration.runtimeLocationId
            ? { runtimeLocationId: registration.runtimeLocationId }
            : {}),
          source: 'active_mount',
        },
        status: 'resolved',
      };
    }

    let recoveredMountState: ProjectDeviceMountState | undefined;
    try {
      recoveredMountState = (await this.fileSystemService.restoreProjectMount(normalizedProjectId)).state;
    } catch {
      recoveredMountState = await this.readMountState(normalizedProjectId);
    }

    const recoveredWorkingDirectory = await this.resolveLocalWorkingDirectory(
      normalizedProjectId,
      request.mountedPath,
    );
    if (recoveredWorkingDirectory) {
      const registration = await this.inspectAndScheduleDesktopSynchronization(
        normalizedProjectId,
        recoveredWorkingDirectory,
        await this.readMountState(normalizedProjectId),
      );
      return {
        location: {
          localWorkingDirectory: recoveredWorkingDirectory,
          projectId: normalizedProjectId,
          remoteSynchronization: registration.remoteSynchronization,
          ...(registration.runtimeLocationId
            ? { runtimeLocationId: registration.runtimeLocationId }
            : {}),
          source: 'recovered_mount',
        },
        status: 'resolved',
      };
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
      const message = error instanceof Error && error.message.trim()
        ? error.message.trim()
        : 'The local folder picker could not be opened.';
      return {
        code: 'unavailable',
        message,
        projectId: normalizedProjectId,
        status: 'unavailable',
      };
    }

    if (pickerResult.status === 'cancelled') {
      return {
        projectId: normalizedProjectId,
        status: 'cancelled',
      };
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
        remoteSynchronization: binding.remoteSynchronization,
        ...(binding.runtimeLocationId ? { runtimeLocationId: binding.runtimeLocationId } : {}),
        source: 'selected_folder',
      },
      status: 'resolved',
    };
  }

  async resolveRemoteProjectRuntimeLocationId(
    projectId: string,
    capability: ProjectRuntimeLocationCapability,
  ): Promise<string | null> {
    const normalizedProjectId = normalizeProjectId(projectId);
    if (!normalizedProjectId || !this.registrationPort) {
      return null;
    }

    return await this.registrationPort.resolvePreferredProjectRuntimeLocationId(
      normalizedProjectId,
      capability,
    );
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
      const runtimeLocationId = await this.resolveRemoteProjectRuntimeLocationId(
        normalizedProjectId,
        capability,
      );
      if (!runtimeLocationId) {
        throw new ProjectRuntimeLocationExecutionUnavailableError({
          code: 'missing_runtime_location_id',
          message:
            'This server workspace has no verified terminal runtime location. Bind an authorized runtime before creating a coding session.',
          projectId: normalizedProjectId,
        });
      }
      return runtimeLocationId;
    }

    const resolution = await this.resolveProjectRuntimeLocation(normalizedProjectId, {
      allowFolderSelection: options.allowFolderSelection ?? false,
      capability,
    });
    if (
      resolution.status === 'resolved'
      && resolution.location.remoteSynchronization !== 'registered'
      && this.registrationPort
    ) {
      const mountState = await this.readMountState(normalizedProjectId);
      if (mountState?.host === 'tauri') {
        const registration = await this.synchronizeDesktopRuntimeLocation({
          absolutePath: resolution.location.localWorkingDirectory,
          displayName: mountState.displayName,
          projectId: normalizedProjectId,
        });
        if (
          registration.remoteSynchronization === 'registered'
          && registration.runtimeLocationId?.trim()
        ) {
          return registration.runtimeLocationId.trim();
        }
      }
    }
    return requireProjectRuntimeLocationExecutionId(resolution);
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

  private async inspectAndScheduleDesktopSynchronization(
    projectId: string,
    absolutePath: string | null,
    mountState: ProjectDeviceMountState | undefined,
  ): Promise<ProjectRuntimeLocationRegistrationResult> {
    if (!absolutePath || mountState?.host !== 'tauri' || !this.registrationPort) {
      return { remoteSynchronization: 'not_configured' };
    }

    const input = {
      absolutePath,
      displayName: mountState.displayName,
      projectId,
    };
    let registration: ProjectRuntimeLocationRegistrationResult;
    try {
      registration = await this.registrationPort.inspectLocalDesktopRuntimeLocation(input);
    } catch {
      registration = { remoteSynchronization: 'pending' };
    }

    if (registration.remoteSynchronization !== 'not_configured') {
      void this.synchronizeDesktopRuntimeLocation(input).catch(() => undefined);
    }

    return registration;
  }

  private synchronizeDesktopRuntimeLocation(input: {
    absolutePath: string;
    displayName: string | null;
    projectId: string;
  }): Promise<ProjectRuntimeLocationRegistrationResult> {
    if (!this.registrationPort) {
      return Promise.resolve({ remoteSynchronization: 'not_configured' });
    }

    const taskKey = `${input.projectId}\u001f${input.absolutePath}`;
    const activeTask = this.synchronizationTasks.get(taskKey);
    if (activeTask) return activeTask;

    const task = this.registrationPort.synchronizeLocalDesktopRuntimeLocation(input);
    this.synchronizationTasks.set(taskKey, task);
    void task.finally(() => {
      globalThis.setTimeout(() => {
        if (this.synchronizationTasks.get(taskKey) === task) {
          this.synchronizationTasks.delete(taskKey);
        }
      }, 0);
    }).catch(() => undefined);
    return task;
  }
}
