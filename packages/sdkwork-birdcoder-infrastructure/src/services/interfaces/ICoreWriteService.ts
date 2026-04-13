import type {
  BirdCoderApprovalDecisionResult,
  BirdCoderCodingSessionSummary,
  BirdCoderCodingSessionTurn,
  BirdCoderCreateCodingSessionRequest,
  BirdCoderCreateCodingSessionTurnRequest,
  BirdCoderSubmitApprovalDecisionRequest,
} from '@sdkwork/birdcoder-types';

export interface ICoreWriteService {
  createCodingSession(
    request: BirdCoderCreateCodingSessionRequest,
  ): Promise<BirdCoderCodingSessionSummary>;
  createCodingSessionTurn(
    codingSessionId: string,
    request: BirdCoderCreateCodingSessionTurnRequest,
  ): Promise<BirdCoderCodingSessionTurn>;
  submitApprovalDecision(
    approvalId: string,
    request: BirdCoderSubmitApprovalDecisionRequest,
  ): Promise<BirdCoderApprovalDecisionResult>;
}
