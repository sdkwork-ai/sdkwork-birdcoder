import type { BirdCoderCodingSessionTurnCurrentFileContext } from './bird-coder-coding-session-turn-current-file-context';

export interface BirdCoderCodingSessionTurnIdeContext {
  workspaceId?: string;
  projectId?: string;
  sessionId?: string;
  currentFile?: BirdCoderCodingSessionTurnCurrentFileContext;
}
