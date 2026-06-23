import type { IAdminPolicyService } from '../interfaces/IAdminPolicyService.ts';
import type { BirdCoderAdminBackendClient } from '../ports/BirdCoderAdminBackendClient.ts';

export interface ApiBackedAdminPolicyServiceOptions {
  backendClient: BirdCoderAdminBackendClient;
}

export class ApiBackedAdminPolicyService implements IAdminPolicyService {
  private readonly backendClient: BirdCoderAdminBackendClient;

  constructor({ backendClient }: ApiBackedAdminPolicyServiceOptions) {
    this.backendClient = backendClient;
  }

  async getPolicies() {
    return this.backendClient.listPolicies();
  }
}
