import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderNativeSessionSummary } from './bird-coder-native-session-summary';

export interface BirdCoderNativeSessionSummaryListEnvelope {
  items: BirdCoderNativeSessionSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
