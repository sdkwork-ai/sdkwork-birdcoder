import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderDeleteCodingSessionMessageResult } from './bird-coder-delete-coding-session-message-result';

export interface BirdCoderDeleteCodingSessionMessageResultEnvelope {
  data: BirdCoderDeleteCodingSessionMessageResult;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
