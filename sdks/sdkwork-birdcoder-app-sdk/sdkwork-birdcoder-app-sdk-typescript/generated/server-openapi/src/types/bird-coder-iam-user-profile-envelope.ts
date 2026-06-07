import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderIamUserProfileSummary } from './bird-coder-iam-user-profile-summary';

export interface BirdCoderIamUserProfileEnvelope {
  data: BirdCoderIamUserProfileSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
