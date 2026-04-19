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
    return this.client.publishProject(projectId, request);
  }
}
