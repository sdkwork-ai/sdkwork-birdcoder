export interface BirdCoderNativeSessionCommand {
  command: string;
  status: 'running' | 'success' | 'error';
  output?: string;
  kind?: 'approval' | 'command' | 'file_change' | 'task' | 'tool' | 'user_question';
  toolName?: string;
  toolCallId?: string;
  runtimeStatus?: 'initializing' | 'ready' | 'streaming' | 'awaiting_tool' | 'awaiting_approval' | 'awaiting_user' | 'completed' | 'failed' | 'terminated';
  requiresApproval?: boolean;
  requiresReply?: boolean;
}
