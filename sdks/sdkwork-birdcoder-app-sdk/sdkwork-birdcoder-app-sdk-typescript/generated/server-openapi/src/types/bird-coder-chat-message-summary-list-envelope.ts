import type { BirdCoderChatMessageSummary } from './bird-coder-chat-message-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderChatMessageSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
