import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderDeletedResourceResult } from './bird-coder-deleted-resource-result';

export interface BirdCoderDeletedResourceEnvelope {
  data: BirdCoderDeletedResourceResult;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
