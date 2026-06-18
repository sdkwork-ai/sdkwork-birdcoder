import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderIamOAuthAuthorizationSummary } from './bird-coder-iam-oauth-authorization-summary';

export interface BirdCoderIamOAuthAuthorizationEnvelope {
  data: BirdCoderIamOAuthAuthorizationSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
