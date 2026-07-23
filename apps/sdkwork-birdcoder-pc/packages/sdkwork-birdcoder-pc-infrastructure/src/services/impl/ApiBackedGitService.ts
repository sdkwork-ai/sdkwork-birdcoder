import type {
  CommitWorkbenchGitChangesInput,
  CreateWorkbenchGitBranchInput,
  CreateWorkbenchGitWorktreeInput,
  PushWorkbenchGitBranchInput,
  RemoveWorkbenchGitWorktreeInput,
  SwitchWorkbenchGitBranchInput,
  WorkbenchGitDiffView,
  WorkbenchGitOverviewView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IGitService } from '../interfaces/IGitService.ts';
import type {
  ProjectRuntimeLocationResolution,
} from '../interfaces/IProjectRuntimeLocationService.ts';
import {
  ProjectRuntimeLocationExecutionUnavailableError,
  requireProjectRuntimeLocationExecutionId,
} from '../interfaces/IProjectRuntimeLocationService.ts';
import type { BirdCoderAppSdkApiClient } from '../birdCoderSdkClient.ts';
import {
  createTauriProjectGitRuntime,
  isTauriProjectGitRuntimeUnavailableError,
  type TauriProjectGitRuntime,
} from '../../platform/tauriProjectGitRuntime.ts';

export interface ApiBackedGitServiceOptions {
  appClient: BirdCoderAppSdkApiClient;
  resolveProjectRuntimeLocation?: (projectId: string) => Promise<ProjectRuntimeLocationResolution>;
  resolveRemoteRuntimeLocationId?: (projectId: string) => Promise<string | null>;
  /**
   * Compatibility injection for existing hosts. New runtimes provide the
   * semantic runtime-location resolver above so recovery follows one path.
   */
  resolveLocalWorkingDirectory?: (projectId: string) => Promise<string | null>;
  tauriProjectGitRuntime?: TauriProjectGitRuntime;
}

export class ApiBackedGitService implements IGitService {
  private readonly appClient: BirdCoderAppSdkApiClient;
  private readonly resolveProjectRuntimeLocation?: (
    projectId: string,
  ) => Promise<ProjectRuntimeLocationResolution>;
  private readonly resolveRemoteRuntimeLocationId?: (projectId: string) => Promise<string | null>;
  private readonly tauriProjectGitRuntime: TauriProjectGitRuntime;

  constructor({
    appClient,
    resolveProjectRuntimeLocation,
    resolveRemoteRuntimeLocationId,
    resolveLocalWorkingDirectory = async () => null,
    tauriProjectGitRuntime,
  }: ApiBackedGitServiceOptions) {
    this.appClient = appClient;
    this.resolveProjectRuntimeLocation = resolveProjectRuntimeLocation;
    this.resolveRemoteRuntimeLocationId = resolveRemoteRuntimeLocationId;
    this.tauriProjectGitRuntime = tauriProjectGitRuntime ?? createTauriProjectGitRuntime({
      resolveProjectRoot: async (projectId) => {
        if (resolveProjectRuntimeLocation) {
          const resolution = await resolveProjectRuntimeLocation(projectId);
          return resolution.status === 'resolved'
            ? resolution.location.localWorkingDirectory
            : null;
        }

        return resolveLocalWorkingDirectory(projectId);
      },
    });
  }

  private async requireRemoteRuntimeLocationId(projectId: string): Promise<string> {
    if (this.resolveRemoteRuntimeLocationId) {
      const runtimeLocationId = (await this.resolveRemoteRuntimeLocationId(projectId))?.trim();
      if (runtimeLocationId) {
        return runtimeLocationId;
      }

      throw new ProjectRuntimeLocationExecutionUnavailableError({
        code: 'missing_runtime_location_id',
        message: 'Select a Git-capable project runtime location before using remote Git.',
        projectId,
      });
    }

    if (!this.resolveProjectRuntimeLocation) {
      throw new Error(
        'A remote project runtime-location resolver is required before using the remote Git runtime.',
      );
    }

    return requireProjectRuntimeLocationExecutionId(
      await this.resolveProjectRuntimeLocation(projectId),
    );
  }

  private async withTauriRuntimeFallback<T>(
    tauriOperation: (runtime: TauriProjectGitRuntime) => Promise<T>,
    fallback: () => Promise<T>,
  ): Promise<T> {
    try {
      return await tauriOperation(this.tauriProjectGitRuntime);
    } catch (error) {
      if (!isTauriProjectGitRuntimeUnavailableError(error)) {
        throw error;
      }
    }
    return fallback();
  }

  async getProjectGitOverview(projectId: string): Promise<WorkbenchGitOverviewView> {
    return this.withTauriRuntimeFallback(
      (runtime) => runtime.getProjectGitOverview(projectId),
      async () => this.appClient.intelligence.projects.git.overview.retrieve(projectId, {
        runtimeLocationId: await this.requireRemoteRuntimeLocationId(projectId),
      }),
    );
  }

  async createProjectGitBranch(
    projectId: string,
    request: CreateWorkbenchGitBranchInput,
  ): Promise<WorkbenchGitOverviewView> {
    return this.withTauriRuntimeFallback(
      (runtime) => runtime.createProjectGitBranch(projectId, request),
      async () => this.appClient.intelligence.projects.git.branches.create(projectId, {
        ...request,
        runtimeLocationId: await this.requireRemoteRuntimeLocationId(projectId),
      }),
    );
  }

  async createProjectGitWorktree(
    projectId: string,
    request: CreateWorkbenchGitWorktreeInput,
  ): Promise<WorkbenchGitOverviewView> {
    return this.withTauriRuntimeFallback(
      (runtime) => runtime.createProjectGitWorktree(projectId, request),
      async () => this.appClient.intelligence.projects.git.worktrees.create(projectId, {
        ...request,
        runtimeLocationId: await this.requireRemoteRuntimeLocationId(projectId),
      }),
    );
  }

  async switchProjectGitBranch(
    projectId: string,
    request: SwitchWorkbenchGitBranchInput,
  ): Promise<WorkbenchGitOverviewView> {
    return this.withTauriRuntimeFallback(
      (runtime) => runtime.switchProjectGitBranch(projectId, request),
      async () => this.appClient.intelligence.projects.git.switchBranch(projectId, {
        ...request,
        runtimeLocationId: await this.requireRemoteRuntimeLocationId(projectId),
      }),
    );
  }

  async commitProjectGitChanges(
    projectId: string,
    request: CommitWorkbenchGitChangesInput,
  ): Promise<WorkbenchGitOverviewView> {
    return this.withTauriRuntimeFallback(
      (runtime) => runtime.commitProjectGitChanges(projectId, request),
      async () => this.appClient.intelligence.projects.git.commits.create(projectId, {
        ...request,
        runtimeLocationId: await this.requireRemoteRuntimeLocationId(projectId),
      }),
    );
  }

  async pushProjectGitBranch(
    projectId: string,
    request: PushWorkbenchGitBranchInput,
  ): Promise<WorkbenchGitOverviewView> {
    return this.withTauriRuntimeFallback(
      (runtime) => runtime.pushProjectGitBranch(projectId, request),
      async () => this.appClient.intelligence.projects.git.push(projectId, {
        ...request,
        runtimeLocationId: await this.requireRemoteRuntimeLocationId(projectId),
      }),
    );
  }

  async removeProjectGitWorktree(
    projectId: string,
    request: RemoveWorkbenchGitWorktreeInput,
  ): Promise<WorkbenchGitOverviewView> {
    return this.withTauriRuntimeFallback(
      (runtime) => runtime.removeProjectGitWorktree(projectId, request),
      async () => this.appClient.intelligence.projects.git.removeWorktree(projectId, {
        ...request,
        runtimeLocationId: await this.requireRemoteRuntimeLocationId(projectId),
      }),
    );
  }

  async pruneProjectGitWorktrees(projectId: string): Promise<WorkbenchGitOverviewView> {
    return this.withTauriRuntimeFallback(
      (runtime) => runtime.pruneProjectGitWorktrees(projectId),
      async () => this.appClient.intelligence.projects.git.pruneWorktrees(projectId, {
        runtimeLocationId: await this.requireRemoteRuntimeLocationId(projectId),
      }),
    );
  }

  async getProjectGitDiff(projectId: string): Promise<WorkbenchGitDiffView> {
    return this.withTauriRuntimeFallback(
      (runtime) => runtime.getProjectGitDiff(projectId),
      async () => this.appClient.intelligence.projects.git.diff.retrieve(projectId, {
        runtimeLocationId: await this.requireRemoteRuntimeLocationId(projectId),
      }),
    );
  }
}
