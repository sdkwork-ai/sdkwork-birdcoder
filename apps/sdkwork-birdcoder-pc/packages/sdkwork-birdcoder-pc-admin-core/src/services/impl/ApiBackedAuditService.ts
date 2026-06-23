import type { IAuditService } from '../interfaces/IAuditService.ts';
import type { BirdCoderAdminBackendClient } from '../ports/BirdCoderAdminBackendClient.ts';

export interface ApiBackedAuditServiceOptions {
  backendClient: BirdCoderAdminBackendClient;
}

export class ApiBackedAuditService implements IAuditService {
  private readonly backendClient: BirdCoderAdminBackendClient;

  constructor({ backendClient }: ApiBackedAuditServiceOptions) {
    this.backendClient = backendClient;
  }

  async getAuditEvents() {
    return this.backendClient.listAuditEvents();
  }
}
