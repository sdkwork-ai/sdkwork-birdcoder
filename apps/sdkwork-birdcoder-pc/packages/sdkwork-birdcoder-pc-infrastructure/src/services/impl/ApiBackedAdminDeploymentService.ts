import type {
  BirdCoderDeploymentRecordSummary,
} from '@sdkwork/birdcoder-pc-types';
import type { IAdminDeploymentService } from '../interfaces/IAdminDeploymentService.ts';
import type { BirdCoderBackendSdkApiClient } from '../sdkClients.ts';

export interface ApiBackedAdminDeploymentServiceOptions {
  backendClient: BirdCoderBackendSdkApiClient;
}

export class ApiBackedAdminDeploymentService implements IAdminDeploymentService {
  private readonly backendClient: BirdCoderBackendSdkApiClient;

  constructor({ backendClient }: ApiBackedAdminDeploymentServiceOptions) {
    this.backendClient = backendClient;
  }

  async getDeployments(): Promise<BirdCoderDeploymentRecordSummary[]> {
    return this.backendClient.listGovernanceDeployments();
  }
}
