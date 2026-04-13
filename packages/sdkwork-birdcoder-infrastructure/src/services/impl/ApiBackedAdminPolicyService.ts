import type {
  BirdCoderAdminPolicySummary,
  BirdCoderAppAdminApiClient,
} from '@sdkwork/birdcoder-types';
import type { IAdminPolicyService } from '../interfaces/IAdminPolicyService.ts';

export interface ApiBackedAdminPolicyServiceOptions {
  client: BirdCoderAppAdminApiClient;
}

export class ApiBackedAdminPolicyService implements IAdminPolicyService {
  private readonly client: BirdCoderAppAdminApiClient;

  constructor({ client }: ApiBackedAdminPolicyServiceOptions) {
    this.client = client;
  }

  async getPolicies(): Promise<BirdCoderAdminPolicySummary[]> {
    return this.client.listPolicies();
  }
}
