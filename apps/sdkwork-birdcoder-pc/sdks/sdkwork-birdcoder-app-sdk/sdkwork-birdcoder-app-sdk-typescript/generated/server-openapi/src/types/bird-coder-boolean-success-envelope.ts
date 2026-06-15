import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderBooleanSuccessResult } from './bird-coder-boolean-success-result';

export interface BirdCoderBooleanSuccessEnvelope {
  data: BirdCoderBooleanSuccessResult;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
