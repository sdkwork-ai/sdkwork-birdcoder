import type { BirdCoderCoreWriteApiClient } from '@sdkwork/birdcoder-types';
import type { ICoreWriteService } from '../interfaces/ICoreWriteService.ts';

export interface ApiBackedCoreWriteServiceOptions {
  client: BirdCoderCoreWriteApiClient;
}

export class ApiBackedCoreWriteService implements ICoreWriteService {
  private readonly client: BirdCoderCoreWriteApiClient;

  constructor({ client }: ApiBackedCoreWriteServiceOptions) {
    this.client = client;
  }

  async createCodingSession(request: Parameters<BirdCoderCoreWriteApiClient['createCodingSession']>[0]) {
    return this.client.createCodingSession(request);
  }

  async createCodingSessionTurn(
    codingSessionId: Parameters<BirdCoderCoreWriteApiClient['createCodingSessionTurn']>[0],
    request: Parameters<BirdCoderCoreWriteApiClient['createCodingSessionTurn']>[1],
  ) {
    return this.client.createCodingSessionTurn(codingSessionId, request);
  }

  async submitApprovalDecision(
    approvalId: Parameters<BirdCoderCoreWriteApiClient['submitApprovalDecision']>[0],
    request: Parameters<BirdCoderCoreWriteApiClient['submitApprovalDecision']>[1],
  ) {
    return this.client.submitApprovalDecision(approvalId, request);
  }
}
