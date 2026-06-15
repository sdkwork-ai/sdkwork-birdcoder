export interface BirdCoderCodingSessionTurn {
  id: string;
  codingSessionId: string;
  runtimeId?: string;
  requestKind: 'chat' | 'plan' | 'tool' | 'review' | 'apply';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  inputSummary: string;
  startedAt?: string;
  completedAt?: string;
}
