import type { BirdCoderCodingSessionTurnIdeContext } from './bird-coder-coding-session-turn-ide-context';
import type { BirdCoderCodingSessionTurnOptions } from './bird-coder-coding-session-turn-options';

export interface BirdCoderCreateCodingSessionTurnRequest {
  runtimeId?: string;
  engineId?: string;
  modelId?: string;
  requestKind: 'chat' | 'plan' | 'tool' | 'review' | 'apply';
  inputSummary: string;
  /** Whether the turn should stream message.delta events. Defaults to true. */
  stream?: boolean;
  ideContext?: BirdCoderCodingSessionTurnIdeContext;
  options?: BirdCoderCodingSessionTurnOptions;
}
