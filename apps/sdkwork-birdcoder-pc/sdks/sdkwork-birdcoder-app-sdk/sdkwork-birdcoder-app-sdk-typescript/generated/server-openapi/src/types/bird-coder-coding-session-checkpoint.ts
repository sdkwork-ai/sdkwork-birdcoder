export interface BirdCoderCodingSessionCheckpoint {
  id: string;
  codingSessionId: string;
  runtimeId?: string;
  checkpointKind: 'resume' | 'approval' | 'handoff' | 'snapshot';
  resumable: boolean;
  state: Record<string, unknown>;
  createdAt: string;
}
