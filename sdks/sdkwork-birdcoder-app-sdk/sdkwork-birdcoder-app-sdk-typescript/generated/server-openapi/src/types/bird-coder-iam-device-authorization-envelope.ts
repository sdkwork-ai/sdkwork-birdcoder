import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderIamDeviceAuthorizationSummary } from './bird-coder-iam-device-authorization-summary';

export interface BirdCoderIamDeviceAuthorizationEnvelope {
  data: BirdCoderIamDeviceAuthorizationSummary;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
