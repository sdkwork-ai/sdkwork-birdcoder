import type { BirdCoderCodingSessionTurn } from './bird-coder-coding-session-turn';

export interface BirdCoderCodingSessionTurnEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
