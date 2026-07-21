import type { BirdCoderChatMessageResourceCitation } from './bird-coder-chat-message-resource-citation';
import type { BirdCoderChatMessageResourceOrigin } from './bird-coder-chat-message-resource-origin';

export interface BirdCoderChatMessageResource {
  id: string;
  kind: 'file' | 'image' | 'audio' | 'uri' | 'citation' | 'skill' | 'mention';
  name?: string;
  path?: string;
  uri?: string;
  mediaSource?: string;
  mimeType?: string;
  description?: string;
  origin?: BirdCoderChatMessageResourceOrigin;
  citation?: BirdCoderChatMessageResourceCitation;
}
