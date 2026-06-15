import type {
  BirdCoderCommitProjectGitChangesRequest,
  BirdCoderCreateProjectGitBranchRequest,
  BirdCoderCreateProjectGitWorktreeRequest,
  BirdCoderProjectGitOverview,
  BirdCoderPushProjectGitBranchRequest,
  BirdCoderRemoveProjectGitWorktreeRequest,
  BirdCoderSwitchProjectGitBranchRequest,
} from '@sdkwork/birdcoder-pc-types';
import type { IGitService } from '../interfaces/IGitService.ts';
import type { BirdCoderAppSdkApiClient } from '../sdkClients.ts';

export interface ApiBackedGitServiceOptions {
  appClient: BirdCoderAppSdkApiClient;
}

export class ApiBackedGitService implements IGitService {
  private readonly appClient: BirdCoderAppSdkApiClient;

  constructor({ appClient }: ApiBackedGitServiceOptions) {
    this.appClient = appClient;
  }

  async getProjectGitOverview(projectId: string): Promise<BirdCoderProjectGitOverview> {
    return this.appClient.getProjectGitOverview(projectId);
  }

  async createProjectGitBranch(
    projectId: string,
    request: BirdCoderCreateProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.appClient.createProjectGitBranch(projectId, request);
  }

  async createProjectGitWorktree(
    projectId: string,
    request: BirdCoderCreateProjectGitWorktreeRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.appClient.createProjectGitWorktree(projectId, request);
  }

  async switchProjectGitBranch(
    projectId: string,
    request: BirdCoderSwitchProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.appClient.switchProjectGitBranch(projectId, request);
  }

  async commitProjectGitChanges(
    projectId: string,
    request: BirdCoderCommitProjectGitChangesRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.appClient.commitProjectGitChanges(projectId, request);
  }

  async pushProjectGitBranch(
    projectId: string,
    request: BirdCoderPushProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.appClient.pushProjectGitBranch(projectId, request);
  }

  async removeProjectGitWorktree(
    projectId: string,
    request: BirdCoderRemoveProjectGitWorktreeRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.appClient.removeProjectGitWorktree(projectId, request);
  }

  async pruneProjectGitWorktrees(projectId: string): Promise<BirdCoderProjectGitOverview> {
    return this.appClient.pruneProjectGitWorktrees(projectId);
  }
}
