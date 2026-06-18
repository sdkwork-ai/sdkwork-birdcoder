import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderProjectPublishResult } from './bird-coder-project-publish-result';

export interface BirdCoderProjectPublishResultEnvelope {
  data: BirdCoderProjectPublishResult;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
