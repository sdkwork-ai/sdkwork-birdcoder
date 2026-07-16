import type { BirdCoderNativeSessionAttributes } from './bird-coder-native-session-attributes';

export interface BirdCoderNativeSessionSummary {
  id: string;
  workspaceId: string;
  projectId: string;
  /** Verified runtime-location identifier bound when the coding session was created. Legacy sessions may omit this field and cannot execute or trigger native-session discovery. */
  runtimeLocationId?: string;
  title: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  hostMode: 'web' | 'desktop' | 'server';
  engineId: 'codex' | 'claude-code' | 'gemini' | 'opencode';
  modelId?: string;
  nativeSessionId?: string;
  nativeAttributes?: BirdCoderNativeSessionAttributes;
  createdAt: string;
  updatedAt: string;
  lastTurnAt?: string;
  /** Normalized activity timestamp in epoch milliseconds used for sorting. */
  sortTimestamp: string;
  /** Most recent transcript mutation timestamp, when available. */
  transcriptUpdatedAt?: string | null;
  kind: 'coding';
}
