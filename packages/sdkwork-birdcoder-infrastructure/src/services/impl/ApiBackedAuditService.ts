import type {
  BirdCoderAdminAuditEventSummary,
} from '@sdkwork/birdcoder-types';
import type { IAuditService } from '../interfaces/IAuditService.ts';
import type { BirdCoderBackendSdkApiClient } from '../sdkClients.ts';

export interface ApiBackedAuditServiceOptions {
  backendClient: BirdCoderBackendSdkApiClient;
}

export class ApiBackedAuditService implements IAuditService {
  private readonly backendClient: BirdCoderBackendSdkApiClient;

  constructor({ backendClient }: ApiBackedAuditServiceOptions) {
    this.backendClient = backendClient;
  }

  async getAuditEvents(): Promise<BirdCoderAdminAuditEventSummary[]> {
    return this.backendClient.listAuditEvents();
  }
}
