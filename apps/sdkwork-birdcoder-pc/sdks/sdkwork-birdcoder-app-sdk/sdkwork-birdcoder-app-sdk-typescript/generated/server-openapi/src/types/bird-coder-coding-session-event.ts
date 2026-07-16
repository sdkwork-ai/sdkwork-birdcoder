export interface BirdCoderCodingSessionEvent {
  id: string;
  codingSessionId: string;
  turnId?: string;
  runtimeId?: string;
  kind: 'session.started' | 'turn.started' | 'message.delta' | 'message.completed' | 'message.deleted' | 'message.edited' | 'tool.call.requested' | 'tool.call.progress' | 'tool.call.completed' | 'artifact.upserted' | 'approval.required' | 'user.question.required' | 'operation.updated' | 'turn.completed' | 'turn.failed';
  /** Event sequence number serialized as an exact decimal string. */
  sequence: string;
  payload: Record<string, unknown>;
  createdAt: string;
}
