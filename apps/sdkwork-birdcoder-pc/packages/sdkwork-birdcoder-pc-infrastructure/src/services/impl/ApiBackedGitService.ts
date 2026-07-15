import type {
  BirdCoderCommitProjectGitChangesRequest,
  BirdCoderCreateProjectGitBranchRequest,
  BirdCoderCreateProjectGitWorktreeRequest,
  BirdCoderProjectGitDiff,
  BirdCoderProjectGitOverview,
  BirdCoderPushProjectGitBranchRequest,
  BirdCoderRemoveProjectGitWorktreeRequest,
  BirdCoderSwitchProjectGitBranchRequest,
} from '@sdkwork/birdcoder-pc-types';
import type { IGitService } from '../interfaces/IGitService.ts';
import type { BirdCoderAppSdkApiClient } from '../sdkClients.ts';
import {
  createBrowserDeploymentWorkspaceRuntime,
  isBrowserDeploymentWorkspaceUnavailableError,
  type BrowserDeploymentWorkspaceRuntime,
} from '../../platform/browserDeploymentWorkspaceRuntime.ts';
import {
  createTauriProjectGitRuntime,
  isTauriProjectGitRuntimeUnavailableError,
  type TauriProjectGitRuntime,
} from '../../platform/tauriProjectGitRuntime.ts';

export interface ApiBackedGitServiceOptions {
  appClient: BirdCoderAppSdkApiClient;
  browserDeploymentRuntime?: BrowserDeploymentWorkspaceRuntime;
  resolveLocalWorkingDirectory?: (projectId: string) => Promise<string | null>;
  tauriProjectGitRuntime?: TauriProjectGitRuntime;
}

export class ApiBackedGitService implements IGitService {
  private readonly appClient: BirdCoderAppSdkApiClient;
  private readonly browserDeploymentRuntime: BrowserDeploymentWorkspaceRuntime;
  private readonly tauriProjectGitRuntime: TauriProjectGitRuntime;

  constructor({
    appClient,
    browserDeploymentRuntime,
    resolveLocalWorkingDirectory = async () => null,
    tauriProjectGitRuntime,
  }: ApiBackedGitServiceOptions) {
    this.appClient = appClient;
    this.browserDeploymentRuntime = browserDeploymentRuntime ?? createBrowserDeploymentWorkspaceRuntime();
    this.tauriProjectGitRuntime = tauriProjectGitRuntime ?? createTauriProjectGitRuntime({
      resolveProjectRoot: resolveLocalWorkingDirectory,
    });
  }

  private async withLocalRuntimeFallback<T>(
    browserOperation: (runtime: BrowserDeploymentWorkspaceRuntime) => Promise<T>,
    tauriOperation: (runtime: TauriProjectGitRuntime) => Promise<T>,
    fallback: () => Promise<T>,
  ): Promise<T> {
    try {
      return await browserOperation(this.browserDeploymentRuntime);
    } catch (error) {
      if (!isBrowserDeploymentWorkspaceUnavailableError(error)) {
        throw error;
      }
    }
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
    return this.withLocalRuntimeFallback(
      (runtime) => runtime.getProjectGitOverview(projectId),
      (runtime) => runtime.getProjectGitOverview(projectId),
      () => this.appClient.getProjectGitOverview(projectId),
    );
  }

  async createProjectGitBranch(
    projectId: string,
    request: BirdCoderCreateProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.withLocalRuntimeFallback(
      (runtime) => runtime.createProjectGitBranch(projectId, request),
      (runtime) => runtime.createProjectGitBranch(projectId, request),
      () => this.appClient.createProjectGitBranch(projectId, request),
    );
  }

  async createProjectGitWorktree(
    projectId: string,
    request: BirdCoderCreateProjectGitWorktreeRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.withLocalRuntimeFallback(
      (runtime) => runtime.createProjectGitWorktree(projectId, request),
      (runtime) => runtime.createProjectGitWorktree(projectId, request),
      () => this.appClient.createProjectGitWorktree(projectId, request),
    );
  }

  async switchProjectGitBranch(
    projectId: string,
    request: BirdCoderSwitchProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.withLocalRuntimeFallback(
      (runtime) => runtime.switchProjectGitBranch(projectId, request),
      (runtime) => runtime.switchProjectGitBranch(projectId, request),
      () => this.appClient.switchProjectGitBranch(projectId, request),
    );
  }

  async commitProjectGitChanges(
    projectId: string,
    request: BirdCoderCommitProjectGitChangesRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.withLocalRuntimeFallback(
      (runtime) => runtime.commitProjectGitChanges(projectId, request),
      (runtime) => runtime.commitProjectGitChanges(projectId, request),
      () => this.appClient.commitProjectGitChanges(projectId, request),
    );
  }

  async pushProjectGitBranch(
    projectId: string,
    request: BirdCoderPushProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.withLocalRuntimeFallback(
      (runtime) => runtime.pushProjectGitBranch(projectId, request),
      (runtime) => runtime.pushProjectGitBranch(projectId, request),
      () => this.appClient.pushProjectGitBranch(projectId, request),
    );
  }

  async removeProjectGitWorktree(
    projectId: string,
    request: BirdCoderRemoveProjectGitWorktreeRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.withLocalRuntimeFallback(
      (runtime) => runtime.removeProjectGitWorktree(projectId, request),
      (runtime) => runtime.removeProjectGitWorktree(projectId, request),
      () => this.appClient.removeProjectGitWorktree(projectId, request),
    );
  }

  async pruneProjectGitWorktrees(projectId: string): Promise<BirdCoderProjectGitOverview> {
    return this.withLocalRuntimeFallback(
      (runtime) => runtime.pruneProjectGitWorktrees(projectId),
      (runtime) => runtime.pruneProjectGitWorktrees(projectId),
      () => this.appClient.pruneProjectGitWorktrees(projectId),
    );
  }

  async getProjectGitDiff(projectId: string): Promise<BirdCoderProjectGitDiff> {
    return this.withLocalRuntimeFallback(
      (runtime) => runtime.getProjectGitDiff(projectId),
      (runtime) => runtime.getProjectGitDiff(projectId),
      () => this.appClient.getProjectGitDiff(projectId),
    );
  }
}
