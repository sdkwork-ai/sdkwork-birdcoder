export interface BirdCoderCreateCodingSessionRequest {
  workspaceId: string;
  projectId: string;
  /** Verified project runtime-location identifier required for coding-session execution. */
  runtimeLocationId: string;
  title?: string;
  hostMode?: 'web' | 'desktop' | 'server';
  engineId: 'codex' | 'claude-code' | 'gemini' | 'opencode';
  modelId: string;
}
