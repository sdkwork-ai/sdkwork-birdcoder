import type { IAdminDeploymentService } from '../interfaces/IAdminDeploymentService.ts';
import type { BirdCoderAdminBackendClient } from '../ports/BirdCoderAdminBackendClient.ts';

export interface ApiBackedAdminDeploymentServiceOptions {
  backendClient: BirdCoderAdminBackendClient;
}

export class ApiBackedAdminDeploymentService implements IAdminDeploymentService {
  private readonly backendClient: BirdCoderAdminBackendClient;

  constructor({ backendClient }: ApiBackedAdminDeploymentServiceOptions) {
    this.backendClient = backendClient;
  }

  async getDeployments() {
    return this.backendClient.listGovernanceDeployments();
  }
}
