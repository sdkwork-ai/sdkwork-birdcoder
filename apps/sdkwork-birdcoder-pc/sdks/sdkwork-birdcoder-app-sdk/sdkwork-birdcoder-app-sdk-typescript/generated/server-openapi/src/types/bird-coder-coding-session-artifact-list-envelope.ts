import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderCodingSessionArtifact } from './bird-coder-coding-session-artifact';

export interface BirdCoderCodingSessionArtifactListEnvelope {
  items: BirdCoderCodingSessionArtifact[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
