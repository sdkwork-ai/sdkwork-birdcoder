import type {
  BirdCoderApprovalDecisionResult,
  BirdCoderDeleteCodingSessionResult,
  BirdCoderDeleteCodingSessionMessageResult,
  BirdCoderEditCodingSessionMessageRequest,
  BirdCoderEditCodingSessionMessageResult,
  BirdCoderCodingSessionSummary,
  BirdCoderCodingSessionTurn,
  BirdCoderCodeEngineModelConfigSyncResult,
  BirdCoderCreateCodingSessionRequest,
  BirdCoderCreateCodingSessionTurnRequest,
  BirdCoderSyncCodeEngineModelConfigRequest,
  BirdCoderSubmitApprovalDecisionRequest,
  BirdCoderSubmitUserQuestionAnswerRequest,
  BirdCoderUpdateCodingSessionRequest,
  BirdCoderUserQuestionAnswerResult,
} from '@sdkwork/birdcoder-types';

export interface ICoreWriteService {
  createCodingSession(
    request: BirdCoderCreateCodingSessionRequest,
  ): Promise<BirdCoderCodingSessionSummary>;
  updateCodingSession(
    codingSessionId: string,
    request: BirdCoderUpdateCodingSessionRequest,
  ): Promise<BirdCoderCodingSessionSummary>;
  deleteCodingSession(codingSessionId: string): Promise<BirdCoderDeleteCodingSessionResult>;
  deleteCodingSessionMessage(
    codingSessionId: string,
    messageId: string,
  ): Promise<BirdCoderDeleteCodingSessionMessageResult>;
  editCodingSessionMessage(
    codingSessionId: string,
    messageId: string,
    request: BirdCoderEditCodingSessionMessageRequest,
  ): Promise<BirdCoderEditCodingSessionMessageResult>;
  createCodingSessionTurn(
    codingSessionId: string,
    request: BirdCoderCreateCodingSessionTurnRequest,
  ): Promise<BirdCoderCodingSessionTurn>;
  submitApprovalDecision(
    approvalId: string,
    request: BirdCoderSubmitApprovalDecisionRequest,
  ): Promise<BirdCoderApprovalDecisionResult>;
  submitUserQuestionAnswer(
    questionId: string,
    request: BirdCoderSubmitUserQuestionAnswerRequest,
  ): Promise<BirdCoderUserQuestionAnswerResult>;
  syncModelConfig(
    request: BirdCoderSyncCodeEngineModelConfigRequest,
  ): Promise<BirdCoderCodeEngineModelConfigSyncResult>;
}
