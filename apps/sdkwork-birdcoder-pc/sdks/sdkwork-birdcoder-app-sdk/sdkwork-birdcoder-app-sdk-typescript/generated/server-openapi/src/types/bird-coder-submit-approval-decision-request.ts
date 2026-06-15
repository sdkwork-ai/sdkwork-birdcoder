export interface BirdCoderSubmitApprovalDecisionRequest {
  decision: 'approved' | 'denied' | 'blocked';
  reason?: string;
}
