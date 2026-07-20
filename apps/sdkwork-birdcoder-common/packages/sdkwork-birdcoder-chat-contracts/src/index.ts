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

export const BIRDCODER_CHAT_MESSAGE_TOOL_CALL_KINDS = [
  'command',
  'file',
  'search',
  'web',
  'mcp',
  'agent',
  'skill',
  'media',
  'task',
  'approval',
  'question',
  'other',
] as const;

export type BirdCoderChatMessageToolCallKind =
  (typeof BIRDCODER_CHAT_MESSAGE_TOOL_CALL_KINDS)[number];

export type BirdCoderChatMessageToolCallStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'error'
  | 'cancelled'
  | 'waiting';

export type BirdCoderChatMessageToolResultBlock =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'image' | 'audio';
      source: string;
      mimeType?: string;
      title?: string;
    }
  | {
      type: 'resource';
      uri: string;
      name?: string;
      mimeType?: string;
      text?: string;
    }
  | {
      type: 'link';
      url: string;
      title?: string;
      description?: string;
    }
  | {
      type: 'diff';
      content: string;
      path?: string;
    }
  | {
      type: 'list';
      items: readonly string[];
    }
  | {
      type: 'error';
      message: string;
    };

export interface BirdCoderChatMessageToolCall {
  id: string;
  type: string;
  name: string;
  arguments: string;
  kind?: BirdCoderChatMessageToolCallKind;
  status?: BirdCoderChatMessageToolCallStatus;
  output?: string;
  command?: string;
  target?: string;
  serverName?: string;
  title?: string;
  durationMs?: number;
  resultBlocks?: readonly BirdCoderChatMessageToolResultBlock[];
}

export interface BirdCoderChatMessageRecord {
  id: string;
  role: BirdCoderChatMessageRole;
  content: string;
  createdAt: string;
}
