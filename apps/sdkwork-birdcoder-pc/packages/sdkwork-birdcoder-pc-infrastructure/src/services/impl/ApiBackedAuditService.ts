import type {
  BirdCoderIamAuditEventSummary,
} from '@sdkwork/birdcoder-pc-types';
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

  async getAuditEvents(): Promise<BirdCoderIamAuditEventSummary[]> {
    return this.backendClient.listAuditEvents();
  }
}
