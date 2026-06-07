import type { BirdCoderApiMeta } from './bird-coder-api-meta';
import type { BirdCoderNativeSessionDetail } from './bird-coder-native-session-detail';

export interface BirdCoderNativeSessionDetailEnvelope {
  data: BirdCoderNativeSessionDetail;
  meta: BirdCoderApiMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
