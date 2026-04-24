import type {
  BirdCoderAppAdminApiClient,
  BirdCoderCommitProjectGitChangesRequest,
  BirdCoderCreateProjectGitBranchRequest,
  BirdCoderCreateProjectGitWorktreeRequest,
  BirdCoderProjectGitOverview,
  BirdCoderPushProjectGitBranchRequest,
  BirdCoderRemoveProjectGitWorktreeRequest,
  BirdCoderSwitchProjectGitBranchRequest,
} from '@sdkwork/birdcoder-types';
import type { IGitService } from '../interfaces/IGitService.ts';

export interface ApiBackedGitServiceOptions {
  client: BirdCoderAppAdminApiClient;
}

export class ApiBackedGitService implements IGitService {
  private readonly client: BirdCoderAppAdminApiClient;

  constructor({ client }: ApiBackedGitServiceOptions) {
    this.client = client;
  }

  async getProjectGitOverview(projectId: string): Promise<BirdCoderProjectGitOverview> {
    return this.client.getProjectGitOverview(projectId);
  }

  async createProjectGitBranch(
    projectId: string,
    request: BirdCoderCreateProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.client.createProjectGitBranch(projectId, request);
  }

  async createProjectGitWorktree(
    projectId: string,
    request: BirdCoderCreateProjectGitWorktreeRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.client.createProjectGitWorktree(projectId, request);
  }

  async switchProjectGitBranch(
    projectId: string,
    request: BirdCoderSwitchProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.client.switchProjectGitBranch(projectId, request);
  }

  async commitProjectGitChanges(
    projectId: string,
    request: BirdCoderCommitProjectGitChangesRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.client.commitProjectGitChanges(projectId, request);
  }

  async pushProjectGitBranch(
    projectId: string,
    request: BirdCoderPushProjectGitBranchRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.client.pushProjectGitBranch(projectId, request);
  }

  async removeProjectGitWorktree(
    projectId: string,
    request: BirdCoderRemoveProjectGitWorktreeRequest,
  ): Promise<BirdCoderProjectGitOverview> {
    return this.client.removeProjectGitWorktree(projectId, request);
  }

  async pruneProjectGitWorktrees(projectId: string): Promise<BirdCoderProjectGitOverview> {
    return this.client.pruneProjectGitWorktrees(projectId);
  }
}
