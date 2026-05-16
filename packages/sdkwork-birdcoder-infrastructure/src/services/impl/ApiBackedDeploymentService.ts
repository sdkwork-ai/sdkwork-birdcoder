import type {
  BirdCoderDeploymentRecordSummary,
  BirdCoderDeploymentTargetSummary,
  BirdCoderProjectPublishResult,
  BirdCoderPublishProjectRequest,
} from '@sdkwork/birdcoder-types';
import type { IDeploymentService } from '../interfaces/IDeploymentService.ts';
import type {
  BirdCoderAppSdkApiClient,
  BirdCoderBackendSdkApiClient,
} from '../sdkClients.ts';

export interface ApiBackedDeploymentServiceOptions {
  appClient: BirdCoderAppSdkApiClient;
  backendClient: BirdCoderBackendSdkApiClient;
}

export class ApiBackedDeploymentService implements IDeploymentService {
  private readonly appClient: BirdCoderAppSdkApiClient;
  private readonly backendClient: BirdCoderBackendSdkApiClient;

  constructor({ appClient, backendClient }: ApiBackedDeploymentServiceOptions) {
    this.appClient = appClient;
    this.backendClient = backendClient;
  }

  async getDeployments(): Promise<BirdCoderDeploymentRecordSummary[]> {
    return this.appClient.listDeployments();
  }

  async getDeploymentTargets(projectId: string): Promise<BirdCoderDeploymentTargetSummary[]> {
    return this.backendClient.listDeploymentTargets(projectId);
  }

  async publishProject(
    projectId: string,
    request: BirdCoderPublishProjectRequest,
  ): Promise<BirdCoderProjectPublishResult> {
    return this.appClient.publishProject(projectId, request);
  }
}
