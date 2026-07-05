import type { BirdCoderChatConversationSummary } from './bird-coder-chat-conversation-summary';
import type { PageInfo } from './page-info';

export interface BirdCoderChatConversationSummaryListEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
