import type { BirdCoderDeleteChatConversationResult } from './bird-coder-delete-chat-conversation-result';

export interface BirdCoderDeleteChatConversationEnvelope {
  code: 0;
  data: unknown & Record<string, unknown>;
  /** Server-owned request correlation id. */
  traceId: string;
}
