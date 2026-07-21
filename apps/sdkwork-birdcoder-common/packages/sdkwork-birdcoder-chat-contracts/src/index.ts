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
  'notice',
  'reasoning',
  'activity',
  'file-changes',
  'commands',
  'resources',
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

export type BirdCoderChatMessageToolCallPresentation = 'notice';

export const BIRDCODER_CHAT_MESSAGE_RESOURCE_KINDS = [
  'file',
  'image',
  'audio',
  'uri',
  'citation',
  'skill',
  'mention',
] as const;

export type BirdCoderChatMessageResourceKind =
  (typeof BIRDCODER_CHAT_MESSAGE_RESOURCE_KINDS)[number];

/**
 * A provider-authored, user-displayable reasoning summary.
 *
 * This contract intentionally cannot carry raw thought content, signatures,
 * or provider envelopes.
 */
export interface BirdCoderChatMessageReasoningItem {
  id: string;
  summary: string;
  title?: string;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export interface BirdCoderChatMessageResourceOrigin {
  kind: 'file' | 'symbol' | 'resource';
  name?: string;
  path?: string;
  uri?: string;
  clientName?: string;
  lineStart?: number;
  lineEnd?: number;
  columnStart?: number;
  columnEnd?: number;
  excerpt?: string;
}

export interface BirdCoderChatMessageResourceCitation {
  lineStart?: number;
  lineEnd?: number;
  note?: string;
  threadIds?: readonly string[];
}

export interface BirdCoderChatMessageResource {
  id: string;
  kind: BirdCoderChatMessageResourceKind;
  name?: string;
  path?: string;
  uri?: string;
  mediaSource?: string;
  mimeType?: string;
  description?: string;
  origin?: BirdCoderChatMessageResourceOrigin;
  citation?: BirdCoderChatMessageResourceCitation;
}

export type BirdCoderChatMessageToolResultBlock =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'image';
      source: string;
      mimeType?: string;
      title?: string;
    }
  | {
      type: 'audio';
      source: string;
      mimeType?: string;
      title?: string;
    }
  | {
      type: 'resource';
      uri?: string;
      name?: string;
      mimeType?: string;
      text?: string;
      description?: string;
      size?: number;
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
      totalItems?: number;
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
  presentation?: BirdCoderChatMessageToolCallPresentation;
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
  reasoning?: readonly BirdCoderChatMessageReasoningItem[];
  createdAt: string;
}
