import type { BirdCoderNativeSessionMessage } from './bird-coder-native-session-message';
import type { BirdCoderNativeSessionSummary } from './bird-coder-native-session-summary';

export interface BirdCoderNativeSessionDetail {
  summary: BirdCoderNativeSessionSummary;
  messages: BirdCoderNativeSessionMessage[];
}
