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

  async updateCodingSession(
    codingSessionId: Parameters<BirdCoderCoreWriteApiClient['updateCodingSession']>[0],
    request: Parameters<BirdCoderCoreWriteApiClient['updateCodingSession']>[1],
  ) {
    return this.client.updateCodingSession(codingSessionId, request);
  }

  async deleteCodingSession(
    codingSessionId: Parameters<BirdCoderCoreWriteApiClient['deleteCodingSession']>[0],
  ) {
    return this.client.deleteCodingSession(codingSessionId);
  }

  async deleteCodingSessionMessage(
    codingSessionId: Parameters<BirdCoderCoreWriteApiClient['deleteCodingSessionMessage']>[0],
    messageId: Parameters<BirdCoderCoreWriteApiClient['deleteCodingSessionMessage']>[1],
  ) {
    return this.client.deleteCodingSessionMessage(codingSessionId, messageId);
  }

  async editCodingSessionMessage(
    codingSessionId: Parameters<BirdCoderCoreWriteApiClient['editCodingSessionMessage']>[0],
    messageId: Parameters<BirdCoderCoreWriteApiClient['editCodingSessionMessage']>[1],
    request: Parameters<BirdCoderCoreWriteApiClient['editCodingSessionMessage']>[2],
  ) {
    return this.client.editCodingSessionMessage(codingSessionId, messageId, request);
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

  async submitUserQuestionAnswer(
    questionId: Parameters<BirdCoderCoreWriteApiClient['submitUserQuestionAnswer']>[0],
    request: Parameters<BirdCoderCoreWriteApiClient['submitUserQuestionAnswer']>[1],
  ) {
    return this.client.submitUserQuestionAnswer(questionId, request);
  }

  async syncModelConfig(
    request: Parameters<BirdCoderCoreWriteApiClient['syncModelConfig']>[0],
  ) {
    return this.client.syncModelConfig(request);
  }
}
