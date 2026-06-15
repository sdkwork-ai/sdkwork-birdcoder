export interface BirdCoderCreateCodingSessionRequest {
  workspaceId: string;
  projectId: string;
  title?: string;
  hostMode?: 'web' | 'desktop' | 'server';
  engineId: 'codex' | 'claude-code' | 'gemini' | 'opencode';
  modelId: string;
}
