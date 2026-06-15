import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderCodingSessionTurn } from './bird-coder-coding-session-turn';

export interface BirdCoderCodingSessionTurnEnvelope {
  data: BirdCoderCodingSessionTurn;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
