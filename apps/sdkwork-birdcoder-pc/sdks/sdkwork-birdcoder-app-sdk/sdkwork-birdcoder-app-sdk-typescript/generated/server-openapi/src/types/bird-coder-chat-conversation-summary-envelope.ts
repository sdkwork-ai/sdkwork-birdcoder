import type { BirdCoderChatConversationSummary } from './bird-coder-chat-conversation-summary';

export interface BirdCoderChatConversationSummaryEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
