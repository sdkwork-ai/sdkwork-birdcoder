import type {
  BirdCoderDeploymentRecordSummary,
  BirdCoderDeploymentTargetSummary,
  BirdCoderProjectPublishResult,
  BirdCoderPublishProjectRequest,
} from '@sdkwork/birdcoder-pc-types';
import type { IDeploymentService } from '../interfaces/IDeploymentService.ts';
import type { BirdCoderAppSdkApiClient } from '../sdkClients.ts';

export interface ApiBackedDeploymentServiceOptions {
  appClient: BirdCoderAppSdkApiClient;
}

export class ApiBackedDeploymentService implements IDeploymentService {
  private readonly appClient: BirdCoderAppSdkApiClient;

  constructor({ appClient }: ApiBackedDeploymentServiceOptions) {
    this.appClient = appClient;
  }

  async getDeployments(): Promise<BirdCoderDeploymentRecordSummary[]> {
    return this.appClient.listDeployments();
  }

  async getDeploymentTargets(projectId: string): Promise<BirdCoderDeploymentTargetSummary[]> {
    return this.appClient.listDeploymentTargets(projectId);
  }

  async publishProject(
    projectId: string,
    request: BirdCoderPublishProjectRequest,
  ): Promise<BirdCoderProjectPublishResult> {
    return this.appClient.publishProject(projectId, request);
  }
}
