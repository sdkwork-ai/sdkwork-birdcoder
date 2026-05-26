import type {
  BirdCoderIamPolicySummary,
} from '@sdkwork/birdcoder-types';
import type { IAdminPolicyService } from '../interfaces/IAdminPolicyService.ts';
import type { BirdCoderBackendSdkApiClient } from '../sdkClients.ts';

export interface ApiBackedAdminPolicyServiceOptions {
  backendClient: BirdCoderBackendSdkApiClient;
}

export class ApiBackedAdminPolicyService implements IAdminPolicyService {
  private readonly backendClient: BirdCoderBackendSdkApiClient;

  constructor({ backendClient }: ApiBackedAdminPolicyServiceOptions) {
    this.backendClient = backendClient;
  }

  async getPolicies(): Promise<BirdCoderIamPolicySummary[]> {
    return this.backendClient.listPolicies();
  }
}
