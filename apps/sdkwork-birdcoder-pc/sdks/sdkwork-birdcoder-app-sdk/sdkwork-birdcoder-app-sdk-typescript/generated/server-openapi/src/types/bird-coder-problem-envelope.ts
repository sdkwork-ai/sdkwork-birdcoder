import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderApiProblemDetails } from './bird-coder-api-problem-details';

export interface BirdCoderProblemEnvelope {
  data: BirdCoderApiProblemDetails;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
