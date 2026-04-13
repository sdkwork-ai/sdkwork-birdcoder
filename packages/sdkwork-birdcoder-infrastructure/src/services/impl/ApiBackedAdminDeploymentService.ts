import type {
  BirdCoderAppAdminApiClient,
  BirdCoderDeploymentRecordSummary,
} from '@sdkwork/birdcoder-types';
import type { IAdminDeploymentService } from '../interfaces/IAdminDeploymentService.ts';

export interface ApiBackedAdminDeploymentServiceOptions {
  client: BirdCoderAppAdminApiClient;
}

export class ApiBackedAdminDeploymentService implements IAdminDeploymentService {
  private readonly client: BirdCoderAppAdminApiClient;

  constructor({ client }: ApiBackedAdminDeploymentServiceOptions) {
    this.client = client;
  }

  async getDeployments(): Promise<BirdCoderDeploymentRecordSummary[]> {
    return this.client.listAdminDeployments();
  }
}
