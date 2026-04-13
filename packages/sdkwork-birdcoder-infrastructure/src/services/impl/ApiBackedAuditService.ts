import type {
  BirdCoderAdminAuditEventSummary,
  BirdCoderAppAdminApiClient,
} from '@sdkwork/birdcoder-types';
import type { IAuditService } from '../interfaces/IAuditService.ts';

export interface ApiBackedAuditServiceOptions {
  client: BirdCoderAppAdminApiClient;
}

export class ApiBackedAuditService implements IAuditService {
  private readonly client: BirdCoderAppAdminApiClient;

  constructor({ client }: ApiBackedAuditServiceOptions) {
    this.client = client;
  }

  async getAuditEvents(): Promise<BirdCoderAdminAuditEventSummary[]> {
    return this.client.listAuditEvents();
  }
}
