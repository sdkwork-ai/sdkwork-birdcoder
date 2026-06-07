import type { BirdCoderApiListMeta } from './bird-coder-api-list-meta';
import type { BirdCoderNativeSessionProviderSummary } from './bird-coder-native-session-provider-summary';

export interface BirdCoderNativeSessionProviderSummaryListEnvelope {
  items: BirdCoderNativeSessionProviderSummary[];
  meta: BirdCoderApiListMeta;
  /** Server-generated request correlation identifier. */
  requestId: string;
  /** Response emission timestamp. */
  timestamp: string;
}
