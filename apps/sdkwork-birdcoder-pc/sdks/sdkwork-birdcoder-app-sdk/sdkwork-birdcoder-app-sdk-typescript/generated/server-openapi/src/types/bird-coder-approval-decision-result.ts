export interface BirdCoderApprovalDecisionResult {
  approvalId: string;
  checkpointId: string;
  codingSessionId: string;
  decision: 'approved' | 'denied' | 'blocked';
  decidedAt: string;
  operationId?: string;
  operationStatus: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'rolled_back';
  reason?: string;
  runtimeId?: string;
  runtimeStatus: 'initializing' | 'ready' | 'streaming' | 'awaiting_tool' | 'awaiting_approval' | 'awaiting_user' | 'completed' | 'failed' | 'terminated';
  turnId?: string;
}
