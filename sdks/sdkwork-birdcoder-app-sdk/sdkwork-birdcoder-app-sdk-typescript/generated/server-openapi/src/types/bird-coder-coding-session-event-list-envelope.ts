import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderCodingSessionEvent } from './bird-coder-coding-session-event';

export interface BirdCoderCodingSessionEventListEnvelope {
  items: BirdCoderCodingSessionEvent[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
