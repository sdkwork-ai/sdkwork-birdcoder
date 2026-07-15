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

export interface ApiBackedGitServiceOptions {
  appClient: BirdCoderAppSdkApiClient;
  browserDeploymentRuntime?: BrowserDeploymentWorkspaceRuntime;
}

export class ApiBackedGitService implements IGitService {
  private readonly appClient: BirdCoderAppSdkApiClient;
  private readonly browserDeploymentRuntime: BrowserDeploymentWorkspaceRuntime;

  constructor({ appClient, browserDeploymentRuntime }: ApiBackedGitServiceOptions) {
    this.appClient = appClient;
    this.browserDeploymentRuntime = browserDeploymentRuntime ?? createBrowserDeploymentWorkspaceRuntime();
  }

  private async withBrowserDeploymentFallback<T>(
    operation: (runtime: BrowserDeploymentWorkspaceRuntime) => Promise<T>,
    fallback: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation(this.browserDeploymentRuntime);
    } catch (error) {
      if (!isBrowserDeploymentWorkspaceUnavailableError(error)) {
        throw error;
      }
      return fallback();
    }
  }

  async getProjectGitOverview(projectId: string): Promise<BirdCoderProjectGitOverview> {
    return this.withBrowserDeploymentFallback(
      (runtime) => runtime.getProjectGitOverview(projectId),
      () => this.appClient.getProjectGitOverview(projectId),
    );
  }

  async createProjectGitBranch(
    projectId: string,
    request: BirdCoderCreateProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.withBrowserDeploymentFallback(
      (runtime) => runtime.createProjectGitBranch(projectId, request),
      () => this.appClient.createProjectGitBranch(projectId, request),
    );
  }

  async createProjectGitWorktree(
    projectId: string,
    request: BirdCoderCreateProjectGitWorktreeRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.withBrowserDeploymentFallback(
      (runtime) => runtime.createProjectGitWorktree(projectId, request),
      () => this.appClient.createProjectGitWorktree(projectId, request),
    );
  }

  async switchProjectGitBranch(
    projectId: string,
    request: BirdCoderSwitchProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.withBrowserDeploymentFallback(
      (runtime) => runtime.switchProjectGitBranch(projectId, request),
      () => this.appClient.switchProjectGitBranch(projectId, request),
    );
  }

  async commitProjectGitChanges(
    projectId: string,
    request: BirdCoderCommitProjectGitChangesRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.withBrowserDeploymentFallback(
      (runtime) => runtime.commitProjectGitChanges(projectId, request),
      () => this.appClient.commitProjectGitChanges(projectId, request),
    );
  }

  async pushProjectGitBranch(
    projectId: string,
    request: BirdCoderPushProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.withBrowserDeploymentFallback(
      (runtime) => runtime.pushProjectGitBranch(projectId, request),
      () => this.appClient.pushProjectGitBranch(projectId, request),
    );
  }

  async removeProjectGitWorktree(
    projectId: string,
    request: BirdCoderRemoveProjectGitWorktreeRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.withBrowserDeploymentFallback(
      (runtime) => runtime.removeProjectGitWorktree(projectId, request),
      () => this.appClient.removeProjectGitWorktree(projectId, request),
    );
  }

  async pruneProjectGitWorktrees(projectId: string): Promise<BirdCoderProjectGitOverview> {
    return this.withBrowserDeploymentFallback(
      (runtime) => runtime.pruneProjectGitWorktrees(projectId),
      () => this.appClient.pruneProjectGitWorktrees(projectId),
    );
  }

  async getProjectGitDiff(projectId: string): Promise<BirdCoderProjectGitDiff> {
    return this.withBrowserDeploymentFallback(
      (runtime) => runtime.getProjectGitDiff(projectId),
      () => this.appClient.getProjectGitDiff(projectId),
    );
  }
}
