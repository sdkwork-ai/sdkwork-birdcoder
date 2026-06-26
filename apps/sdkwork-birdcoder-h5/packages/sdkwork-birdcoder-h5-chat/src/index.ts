export {
  BIRDCODER_CHAT_MESSAGE_CONTENT_BLOCK_TYPES,
  BIRDCODER_CHAT_MESSAGE_ROLES,
  BIRDCODER_CHAT_MESSAGE_VIEW_KINDS,
  type BirdCoderChatMessageContentBlockType,
  type BirdCoderChatMessageRecord,
  type BirdCoderChatMessageRole,
  type BirdCoderChatMessageToolCall,
  type BirdCoderChatMessageViewKind,
} from '@sdkwork/birdcoder-chat-contracts';

import { uuid } from '@sdkwork/utils/id';

export const H5_CHAT_VERSION = '0.1.0';

export function createChatMessage(
  role: 'user' | 'assistant',
  content: string,
): import('@sdkwork/birdcoder-chat-contracts').BirdCoderChatMessageRecord {
  return {
    id: uuid(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}
