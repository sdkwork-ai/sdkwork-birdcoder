export const BIRDCODER_CHAT_MESSAGE_ROLES = ['user', 'assistant', 'system'] as const;

export type BirdCoderChatMessageRole = (typeof BIRDCODER_CHAT_MESSAGE_ROLES)[number];

export const BIRDCODER_CHAT_MESSAGE_VIEW_KINDS = [
  'user.text',
  'assistant.text',
  'assistant.activity',
  'tool.result',
  'system.notice',
  'planner.plan',
  'reviewer.feedback',
] as const;

export type BirdCoderChatMessageViewKind =
  (typeof BIRDCODER_CHAT_MESSAGE_VIEW_KINDS)[number];

export const BIRDCODER_CHAT_MESSAGE_CONTENT_BLOCK_TYPES = [
  'markdown',
  'activity',
  'file-changes',
  'commands',
  'task-progress',
  'tool-calls',
] as const;

export type BirdCoderChatMessageContentBlockType =
  (typeof BIRDCODER_CHAT_MESSAGE_CONTENT_BLOCK_TYPES)[number];

export interface BirdCoderChatMessageToolCall {
  id: string;
  type: string;
  name: string;
  arguments: string;
}

export interface BirdCoderChatMessageRecord {
  id: string;
  role: BirdCoderChatMessageRole;
  content: string;
  createdAt: string;
}
