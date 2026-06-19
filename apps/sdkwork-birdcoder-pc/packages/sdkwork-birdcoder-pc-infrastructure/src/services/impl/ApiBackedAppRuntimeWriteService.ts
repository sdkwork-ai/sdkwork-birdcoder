import type { IAppRuntimeWriteService } from '../interfaces/IAppRuntimeWriteService.ts';
import type { BirdCoderAppRuntimeWriteSdkApiClient } from '../sdkClients.ts';

export interface ApiBackedAppRuntimeWriteServiceOptions {
  client: BirdCoderAppRuntimeWriteSdkApiClient;
}

export class ApiBackedAppRuntimeWriteService implements IAppRuntimeWriteService {
  private readonly client: BirdCoderAppRuntimeWriteSdkApiClient;

  constructor({ client }: ApiBackedAppRuntimeWriteServiceOptions) {
    this.client = client;
  }

  async createCodingSession(request: Parameters<BirdCoderAppRuntimeWriteSdkApiClient['createCodingSession']>[0]) {
    return this.client.createCodingSession(request);
  }

  async updateCodingSession(
    codingSessionId: Parameters<BirdCoderAppRuntimeWriteSdkApiClient['updateCodingSession']>[0],
    request: Parameters<BirdCoderAppRuntimeWriteSdkApiClient['updateCodingSession']>[1],
  ) {
    return this.client.updateCodingSession(codingSessionId, request);
  }

  async deleteCodingSession(
    codingSessionId: Parameters<BirdCoderAppRuntimeWriteSdkApiClient['deleteCodingSession']>[0],
  ) {
    return this.client.deleteCodingSession(codingSessionId);
  }

  async deleteCodingSessionMessage(
    codingSessionId: Parameters<BirdCoderAppRuntimeWriteSdkApiClient['deleteCodingSessionMessage']>[0],
    messageId: Parameters<BirdCoderAppRuntimeWriteSdkApiClient['deleteCodingSessionMessage']>[1],
  ) {
    return this.client.deleteCodingSessionMessage(codingSessionId, messageId);
  }

  async editCodingSessionMessage(
    codingSessionId: Parameters<BirdCoderAppRuntimeWriteSdkApiClient['editCodingSessionMessage']>[0],
    messageId: Parameters<BirdCoderAppRuntimeWriteSdkApiClient['editCodingSessionMessage']>[1],
    request: Parameters<BirdCoderAppRuntimeWriteSdkApiClient['editCodingSessionMessage']>[2],
  ) {
    return this.client.editCodingSessionMessage(codingSessionId, messageId, request);
  }

  async createCodingSessionTurn(
    codingSessionId: Parameters<BirdCoderAppRuntimeWriteSdkApiClient['createCodingSessionTurn']>[0],
    request: Parameters<BirdCoderAppRuntimeWriteSdkApiClient['createCodingSessionTurn']>[1],
  ) {
    return this.client.createCodingSessionTurn(codingSessionId, request);
  }

  async submitApprovalDecision(
    codingSessionId: Parameters<BirdCoderAppRuntimeWriteSdkApiClient['submitApprovalDecision']>[0],
    checkpointId: Parameters<BirdCoderAppRuntimeWriteSdkApiClient['submitApprovalDecision']>[1],
    request: Parameters<BirdCoderAppRuntimeWriteSdkApiClient['submitApprovalDecision']>[2],
  ) {
    return this.client.submitApprovalDecision(codingSessionId, checkpointId, request);
  }

  async submitUserQuestionAnswer(
    codingSessionId: Parameters<BirdCoderAppRuntimeWriteSdkApiClient['submitUserQuestionAnswer']>[0],
    questionId: Parameters<BirdCoderAppRuntimeWriteSdkApiClient['submitUserQuestionAnswer']>[1],
    request: Parameters<BirdCoderAppRuntimeWriteSdkApiClient['submitUserQuestionAnswer']>[2],
  ) {
    return this.client.submitUserQuestionAnswer(codingSessionId, questionId, request);
  }

  async syncModelConfig(
    request: Parameters<BirdCoderAppRuntimeWriteSdkApiClient['syncModelConfig']>[0],
  ) {
    return this.client.syncModelConfig(request);
  }
}
