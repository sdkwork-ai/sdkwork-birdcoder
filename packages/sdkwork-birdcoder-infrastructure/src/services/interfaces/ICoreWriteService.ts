import type {
  BirdCoderApprovalDecisionResult,
  BirdCoderDeleteCodingSessionResult,
  BirdCoderCodingSessionSummary,
  BirdCoderCodingSessionTurn,
  BirdCoderCreateCodingSessionRequest,
  BirdCoderCreateCodingSessionTurnRequest,
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
}
