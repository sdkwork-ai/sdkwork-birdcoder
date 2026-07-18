import type {
  BirdCoderCommitProjectGitChangesRequest,
  BirdCoderCreateProjectGitBranchRequest,
  BirdCoderCreateProjectGitWorktreeRequest,
  BirdCoderProjectGitDiff,
  BirdCoderProjectGitOverview,
  BirdCoderPushProjectGitBranchRequest,
  BirdCoderRemoveProjectGitWorktreeRequest,
  BirdCoderSwitchProjectGitBranchRequest,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import type { IGitService } from '../interfaces/IGitService.ts';
import type {
  ProjectRuntimeLocationResolution,
} from '../interfaces/IProjectRuntimeLocationService.ts';
import { requireProjectRuntimeLocationExecutionId } from '../interfaces/IProjectRuntimeLocationService.ts';
import type { BirdCoderAppSdkApiClient } from '../sdkClients.ts';
import {
  createTauriProjectGitRuntime,
  isTauriProjectGitRuntimeUnavailableError,
  type TauriProjectGitRuntime,
} from '../../platform/tauriProjectGitRuntime.ts';

export interface ApiBackedGitServiceOptions {
  appClient: BirdCoderAppSdkApiClient;
  resolveProjectRuntimeLocation?: (projectId: string) => Promise<ProjectRuntimeLocationResolution>;
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
  private readonly tauriProjectGitRuntime: TauriProjectGitRuntime;

  constructor({
    appClient,
    resolveProjectRuntimeLocation,
    resolveLocalWorkingDirectory = async () => null,
    tauriProjectGitRuntime,
  }: ApiBackedGitServiceOptions) {
    this.appClient = appClient;
    this.resolveProjectRuntimeLocation = resolveProjectRuntimeLocation;
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
    if (!this.resolveProjectRuntimeLocation) {
      throw new Error(
        'A project runtime-location resolver is required before using the remote Git runtime.',
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

  async getProjectGitOverview(projectId: string): Promise<BirdCoderProjectGitOverview> {
    return this.withTauriRuntimeFallback(
      (runtime) => runtime.getProjectGitOverview(projectId),
      async () => this.appClient.getProjectGitOverview(
        projectId,
        await this.requireRemoteRuntimeLocationId(projectId),
      ),
    );
  }

  async createProjectGitBranch(
    projectId: string,
    request: BirdCoderCreateProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.withTauriRuntimeFallback(
      (runtime) => runtime.createProjectGitBranch(projectId, request),
      async () => this.appClient.createProjectGitBranch(projectId, {
        ...request,
        runtimeLocationId: await this.requireRemoteRuntimeLocationId(projectId),
      }),
    );
  }

  async createProjectGitWorktree(
    projectId: string,
    request: BirdCoderCreateProjectGitWorktreeRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.withTauriRuntimeFallback(
      (runtime) => runtime.createProjectGitWorktree(projectId, request),
      async () => this.appClient.createProjectGitWorktree(projectId, {
        ...request,
        runtimeLocationId: await this.requireRemoteRuntimeLocationId(projectId),
      }),
    );
  }

  async switchProjectGitBranch(
    projectId: string,
    request: BirdCoderSwitchProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.withTauriRuntimeFallback(
      (runtime) => runtime.switchProjectGitBranch(projectId, request),
      async () => this.appClient.switchProjectGitBranch(projectId, {
        ...request,
        runtimeLocationId: await this.requireRemoteRuntimeLocationId(projectId),
      }),
    );
  }

  async commitProjectGitChanges(
    projectId: string,
    request: BirdCoderCommitProjectGitChangesRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.withTauriRuntimeFallback(
      (runtime) => runtime.commitProjectGitChanges(projectId, request),
      async () => this.appClient.commitProjectGitChanges(projectId, {
        ...request,
        runtimeLocationId: await this.requireRemoteRuntimeLocationId(projectId),
      }),
    );
  }

  async pushProjectGitBranch(
    projectId: string,
    request: BirdCoderPushProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.withTauriRuntimeFallback(
      (runtime) => runtime.pushProjectGitBranch(projectId, request),
      async () => this.appClient.pushProjectGitBranch(projectId, {
        ...request,
        runtimeLocationId: await this.requireRemoteRuntimeLocationId(projectId),
      }),
    );
  }

  async removeProjectGitWorktree(
    projectId: string,
    request: BirdCoderRemoveProjectGitWorktreeRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.withTauriRuntimeFallback(
      (runtime) => runtime.removeProjectGitWorktree(projectId, request),
      async () => this.appClient.removeProjectGitWorktree(projectId, {
        ...request,
        runtimeLocationId: await this.requireRemoteRuntimeLocationId(projectId),
      }),
    );
  }

  async pruneProjectGitWorktrees(projectId: string): Promise<BirdCoderProjectGitOverview> {
    return this.withTauriRuntimeFallback(
      (runtime) => runtime.pruneProjectGitWorktrees(projectId),
      async () => this.appClient.pruneProjectGitWorktrees(
        projectId,
        await this.requireRemoteRuntimeLocationId(projectId),
      ),
    );
  }

  async getProjectGitDiff(projectId: string): Promise<BirdCoderProjectGitDiff> {
    return this.withTauriRuntimeFallback(
      (runtime) => runtime.getProjectGitDiff(projectId),
      async () => this.appClient.getProjectGitDiff(
        projectId,
        await this.requireRemoteRuntimeLocationId(projectId),
      ),
    );
  }
}
