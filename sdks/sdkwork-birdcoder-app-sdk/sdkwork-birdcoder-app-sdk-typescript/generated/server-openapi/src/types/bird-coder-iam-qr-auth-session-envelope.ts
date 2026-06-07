import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderIamQrAuthSessionSummary } from './bird-coder-iam-qr-auth-session-summary';

export interface BirdCoderIamQrAuthSessionEnvelope {
  data: BirdCoderIamQrAuthSessionSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
