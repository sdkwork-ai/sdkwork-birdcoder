export interface BirdCoderUserQuestionAnswerResult {
  questionId: string;
  codingSessionId: string;
  answer?: string;
  answeredAt: string;
  optionId?: string;
  optionLabel?: string;
  rejected: boolean;
  runtimeId?: string;
  runtimeStatus: 'initializing' | 'ready' | 'streaming' | 'awaiting_tool' | 'awaiting_approval' | 'awaiting_user' | 'completed' | 'failed' | 'terminated';
  turnId?: string;
}
