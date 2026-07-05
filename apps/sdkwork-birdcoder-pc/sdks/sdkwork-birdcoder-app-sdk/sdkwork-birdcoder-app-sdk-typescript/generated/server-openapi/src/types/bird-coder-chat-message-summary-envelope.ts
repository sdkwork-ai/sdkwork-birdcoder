import type { BirdCoderChatMessageSummary } from './bird-coder-chat-message-summary';

export interface BirdCoderChatMessageSummaryEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
