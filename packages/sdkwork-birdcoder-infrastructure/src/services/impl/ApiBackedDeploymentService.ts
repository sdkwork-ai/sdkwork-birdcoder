import type {
  BirdCoderAppAdminApiClient,
  BirdCoderDeploymentRecordSummary,
  BirdCoderDeploymentTargetSummary,
  BirdCoderProjectPublishResult,
  BirdCoderPublishProjectRequest,
} from '@sdkwork/birdcoder-types';
import type { IDeploymentService } from '../interfaces/IDeploymentService.ts';

export interface ApiBackedDeploymentServiceOptions {
  client: BirdCoderAppAdminApiClient;
}

export class ApiBackedDeploymentService implements IDeploymentService {
  private readonly client: BirdCoderAppAdminApiClient;

  constructor({ client }: ApiBackedDeploymentServiceOptions) {
    this.client = client;
  }

  async getDeployments(): Promise<BirdCoderDeploymentRecordSummary[]> {
    return this.client.listDeployments();
  }

  async getDeploymentTargets(projectId: string): Promise<BirdCoderDeploymentTargetSummary[]> {
    return this.client.listDeploymentTargets(projectId);
  }

  async publishProject(
    projectId: string,
    request: BirdCoderPublishProjectRequest,
  ): Promise<BirdCoderProjectPublishResult> {
    const method = this.client.publishProject;
    if (typeof method !== 'function') {
      throw new Error('Project publish API is unavailable for the current coding-server runtime.');
    }
    return method.call(this.client, projectId, request);
  }
}
