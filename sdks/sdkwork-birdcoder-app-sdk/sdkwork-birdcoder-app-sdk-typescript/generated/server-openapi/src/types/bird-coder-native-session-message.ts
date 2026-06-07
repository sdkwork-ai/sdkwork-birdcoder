import type { BirdCoderNativeSessionCommand } from './bird-coder-native-session-command';

export interface BirdCoderNativeSessionMessage {
  id: string;
  codingSessionId: string;
  turnId?: string;
  role: 'user' | 'assistant' | 'system' | 'tool' | 'reviewer' | 'planner';
  content: string;
  commands?: BirdCoderNativeSessionCommand[];
  tool_calls?: Record<string, unknown>[];
  tool_call_id?: string;
  fileChanges?: Record<string, unknown>[];
  taskProgress?: Record<string, unknown>;
  metadata?: Record<string, string>;
  createdAt: string;
}
