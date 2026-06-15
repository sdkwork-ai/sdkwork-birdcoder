import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderCodingSessionCheckpoint } from './bird-coder-coding-session-checkpoint';

export interface BirdCoderCodingSessionCheckpointListEnvelope {
  items: BirdCoderCodingSessionCheckpoint[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
