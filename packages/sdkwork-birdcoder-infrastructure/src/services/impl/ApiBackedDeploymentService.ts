import type {
  BirdCoderAppAdminApiClient,
  BirdCoderDeploymentRecordSummary,
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
}
