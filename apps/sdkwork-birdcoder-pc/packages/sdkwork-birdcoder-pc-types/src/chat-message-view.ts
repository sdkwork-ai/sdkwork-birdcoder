import type {
  BirdCoderComparableChatMessageLike,
} from './coding-session.ts';
import type { BirdCoderCodeEngineKey } from './engine.ts';
import {
  hasParsedFileUpdateSummary,
  resolveProjectedActivityFileChanges,
  resolveVisibleMarkdownBlockContent,
} from './chat-message-activity-projection.ts';
import { resolveTaskProgressDisplayState } from './chat-message-task-progress.ts';

export type ChatMessageViewSource = BirdCoderComparableChatMessageLike;

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

export interface ChatMessageMarkdownBlock {
  type: 'markdown';
  content: string;
  mode: 'basic' | 'rich';
}

export interface ChatMessageActivityBlock {
  type: 'activity';
  messageId: string;
  fileChanges: readonly NonNullable<ChatMessageViewSource['fileChanges']>[number][];
  commands: readonly NonNullable<ChatMessageViewSource['commands']>[number][];
}

export interface ChatMessageFileChangesBlock {
  type: 'file-changes';
  items: readonly NonNullable<ChatMessageViewSource['fileChanges']>[number][];
}

export interface ChatMessageCommandsBlock {
  type: 'commands';
  items: readonly NonNullable<ChatMessageViewSource['commands']>[number][];
}

export interface ChatMessageTaskProgressValue {
  total: number;
  completed: number;
}

export interface ChatMessageTaskProgressBlock {
  type: 'task-progress';
  progress: ChatMessageTaskProgressValue;
}

export interface ChatMessageToolCallsBlock {
  type: 'tool-calls';
  calls: readonly unknown[];
}

export type ChatMessageContentBlock =
  | ChatMessageMarkdownBlock
  | ChatMessageActivityBlock
  | ChatMessageFileChangesBlock
  | ChatMessageCommandsBlock
  | ChatMessageTaskProgressBlock
  | ChatMessageToolCallsBlock;

export interface ChatMessageLayoutHints {
  estimatedHeight: number;
  isCompact: boolean;
  hasCollapsibleSections: boolean;
}

export interface BirdCoderChatMessageView {
  messageId: string;
  kind: BirdCoderChatMessageViewKind;
  source: Readonly<ChatMessageViewSource>;
  engineId?: BirdCoderCodeEngineKey;
  layoutHints: ChatMessageLayoutHints;
  blocks: readonly ChatMessageContentBlock[];
}

export interface ResolveChatMessageViewOptions {
  engineId?: BirdCoderCodeEngineKey;
  layout?: 'sidebar' | 'main';
}

function readActivityPath(value: unknown): string {
  if (typeof value !== 'object' || value === null) {
    return '';
  }

  const path = (value as { path?: unknown }).path;
  return typeof path === 'string' ? path.trim() : '';
}

function readActivityCommand(value: unknown): string {
  if (typeof value !== 'object' || value === null) {
    return '';
  }

  const command = (value as { command?: unknown }).command;
  return typeof command === 'string' ? command.trim() : '';
}

function readActivityCommandStatus(value: unknown): string {
  if (typeof value !== 'object' || value === null) {
    return '';
  }

  const status = (value as { status?: unknown }).status;
  return typeof status === 'string' ? status : '';
}

function filterStructuredFileChanges(
  message: ChatMessageViewSource,
): NonNullable<ChatMessageViewSource['fileChanges']> {
  return (message.fileChanges ?? []).filter((item) => readActivityPath(item).length > 0);
}

function filterStructuredCommands(
  message: ChatMessageViewSource,
): NonNullable<ChatMessageViewSource['commands']> {
  return (message.commands ?? []).filter((item) => readActivityCommand(item).length > 0);
}

function countTranscriptContentLines(content: string): number {
  if (content.length === 0) {
    return 1;
  }

  let lineCount = 1;
  for (let index = 0; index < content.length; index += 1) {
    if (content.charCodeAt(index) === 10) {
      lineCount += 1;
    }
  }
  return lineCount;
}

function hasStructuredActivity(message: ChatMessageViewSource): boolean {
  return filterStructuredFileChanges(message).length > 0
    || filterStructuredCommands(message).length > 0
    || hasParsedFileUpdateSummary(message.content);
}

function inferChatMessageViewKind(message: ChatMessageViewSource): BirdCoderChatMessageViewKind {
  switch (message.role) {
    case 'user':
      return 'user.text';
    case 'tool':
      return 'tool.result';
    case 'system':
      return 'system.notice';
    case 'planner':
      return 'planner.plan';
    case 'reviewer':
      return 'reviewer.feedback';
    case 'assistant':
      if (hasStructuredActivity(message) || hasParsedFileUpdateSummary(message.content)) {
        return 'assistant.activity';
      }
      return 'assistant.text';
    default:
      return 'assistant.text';
  }
}

function buildChatMessageContentBlocks(
  message: ChatMessageViewSource,
  kind: BirdCoderChatMessageViewKind,
): ChatMessageContentBlock[] {
  const blocks: ChatMessageContentBlock[] = [];
  const markdownMode: 'basic' | 'rich' = message.role === 'user' ? 'basic' : 'rich';
  const markdownContent = resolveVisibleMarkdownBlockContent(message);

  if (markdownContent.trim().length > 0) {
    blocks.push({
      type: 'markdown',
      content: markdownContent,
      mode: markdownMode,
    });
  }

  const fileChanges = resolveProjectedActivityFileChanges(message);
  const commands = filterStructuredCommands(message);

  if (kind === 'assistant.activity' && (fileChanges.length > 0 || commands.length > 0)) {
    blocks.push({
      type: 'activity',
      messageId: message.id,
      fileChanges,
      commands,
    });
  } else {
    const structuredFileChanges = filterStructuredFileChanges(message);
    if (structuredFileChanges.length > 0) {
      blocks.push({
        type: 'file-changes',
        items: structuredFileChanges,
      });
    }

    if (commands.length > 0) {
      blocks.push({
        type: 'commands',
        items: commands,
      });
    }
  }

  const taskProgressDisplayState = resolveTaskProgressDisplayState(message.taskProgress);
  if (taskProgressDisplayState) {
    blocks.push({
      type: 'task-progress',
      progress: {
        total: taskProgressDisplayState.total,
        completed: taskProgressDisplayState.completed,
      },
    });
  }

  if (message.tool_calls && message.tool_calls.length > 0) {
    blocks.push({
      type: 'tool-calls',
      calls: message.tool_calls,
    });
  }

  if (blocks.length === 0 && kind !== 'user.text') {
    blocks.push({
      type: 'markdown',
      content: '',
      mode: markdownMode,
    });
  }

  return blocks;
}

export function estimateChatMessageViewHeight(
  view: BirdCoderChatMessageView,
  layout: 'sidebar' | 'main' = 'main',
): number {
  const isUser = view.kind === 'user.text';
  const baseHeight = layout === 'sidebar'
    ? (isUser ? 84 : 132)
    : (isUser ? 96 : 144);
  const lineHeight = layout === 'sidebar'
    ? (isUser ? 18 : 22)
    : (isUser ? 20 : 24);

  let extraHeight = 0;
  for (const block of view.blocks) {
    switch (block.type) {
      case 'markdown': {
        const lineCount = countTranscriptContentLines(block.content);
        const wrappedLineCount = Math.ceil(block.content.length / 96);
        const contentLineEstimate = Math.max(lineCount, wrappedLineCount);
        extraHeight += Math.min(720, contentLineEstimate * lineHeight);
        break;
      }
      case 'activity':
        extraHeight += 48 + block.fileChanges.length * 36 + block.commands.length * 44;
        break;
      case 'file-changes':
        extraHeight += block.items.length * 36;
        break;
      case 'commands':
        extraHeight += block.items.length * 44;
        break;
      case 'task-progress':
        extraHeight += 40;
        break;
      case 'tool-calls':
        extraHeight += block.calls.length * 80;
        break;
      default:
        break;
    }
  }

  return baseHeight + extraHeight;
}

function buildChatMessageLayoutHints(
  message: ChatMessageViewSource,
  kind: BirdCoderChatMessageViewKind,
  layout: 'sidebar' | 'main',
  blocks: readonly ChatMessageContentBlock[],
): ChatMessageLayoutHints {
  const view: BirdCoderChatMessageView = {
    messageId: message.id,
    kind,
    source: message,
    layoutHints: {
      estimatedHeight: 0,
      isCompact: layout === 'sidebar',
      hasCollapsibleSections: kind === 'assistant.activity',
    },
    blocks,
  };

  return {
    estimatedHeight: estimateChatMessageViewHeight(view, layout),
    isCompact: layout === 'sidebar',
    hasCollapsibleSections: kind === 'assistant.activity',
  };
}

export function resolveChatMessageView(
  message: ChatMessageViewSource,
  options: ResolveChatMessageViewOptions = {},
): BirdCoderChatMessageView {
  const layout = options.layout ?? 'main';
  const kind = inferChatMessageViewKind(message);
  const blocks = buildChatMessageContentBlocks(message, kind);

  return {
    messageId: message.id,
    kind,
    source: message,
    engineId: options.engineId,
    layoutHints: buildChatMessageLayoutHints(message, kind, layout, blocks),
    blocks,
  };
}

export function resolveChatMessageViews(
  messages: readonly ChatMessageViewSource[],
  options: ResolveChatMessageViewOptions = {},
): BirdCoderChatMessageView[] {
  return messages.map((message) => resolveChatMessageView(message, options));
}

export function estimateTranscriptMessageHeight(
  message: ChatMessageViewSource,
  options: ResolveChatMessageViewOptions = {},
): number {
  const layout = options.layout ?? 'main';
  const view = resolveChatMessageView(message, { ...options, layout });
  return estimateChatMessageViewHeight(view, layout);
}

export function buildChatMessageViewSynchronizationSignature(
  view: BirdCoderChatMessageView,
): string {
  const message = view.source;
  const blockSignature = view.blocks
    .map((block) => {
      switch (block.type) {
        case 'markdown':
          return `md:${block.mode}:${block.content.length}:${block.content}`;
        case 'activity':
          return `act:${block.fileChanges.length}:${block.commands.length}`;
        case 'file-changes':
          return `fc:${block.items.length}`;
        case 'commands':
          return `cmd:${block.items.length}:${block.items.map((item) => readActivityCommandStatus(item)).join(',')}`;
        case 'task-progress':
          return `tp:${block.progress.completed}/${block.progress.total}`;
        case 'tool-calls':
          return `tc:${block.calls.length}`;
        default:
          return 'unknown';
      }
    })
    .join('|');

  return [
    view.kind,
    view.engineId ?? '',
    message.role,
    message.id,
    message.content,
    blockSignature,
  ].join('\u0001');
}
