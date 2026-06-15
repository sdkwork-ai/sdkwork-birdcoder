import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderEditCodingSessionMessageResult } from './bird-coder-edit-coding-session-message-result';

export interface BirdCoderEditCodingSessionMessageResultEnvelope {
  data: BirdCoderEditCodingSessionMessageResult;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
