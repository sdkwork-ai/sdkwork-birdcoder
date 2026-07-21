import type {
  BirdCoderComparableChatMessageLike,
  BirdCoderProtocolNoticeKind,
} from './coding-session.ts';
import type { BirdCoderCodeEngineKey } from './engine.ts';
import {
  BIRDCODER_CHAT_MESSAGE_CONTENT_BLOCK_TYPES,
  BIRDCODER_CHAT_MESSAGE_VIEW_KINDS,
  type BirdCoderChatMessageContentBlockType,
  type BirdCoderChatMessageViewKind,
  type BirdCoderChatMessageRecord,
  type BirdCoderChatMessageRole,
} from '@sdkwork/birdcoder-chat-contracts';
export {
  BIRDCODER_CHAT_MESSAGE_CONTENT_BLOCK_TYPES,
  BIRDCODER_CHAT_MESSAGE_VIEW_KINDS,
  type BirdCoderChatMessageContentBlockType,
  type BirdCoderChatMessageViewKind,
  type BirdCoderChatMessageRecord,
  type BirdCoderChatMessageRole,
};
import {
  hasParsedFileUpdateSummary,
  resolveChatTurnActivitySummary,
  resolveProjectedActivityFileChanges,
  resolveVisibleMarkdownBlockContent,
  type ChatTurnActivitySummary,
} from './chat-message-activity-projection.ts';
import { resolveTaskProgressDisplayState } from './chat-message-task-progress.ts';
import {
  projectChatMessageReasoning,
  type BirdCoderChatMessageReasoningItem,
} from './chat-message-reasoning.ts';
import {
  projectChatMessageResources,
  type BirdCoderChatMessageResource,
} from './chat-message-resources.ts';
import {
  isChatMessageFileMutationToolCall,
  projectChatMessageCommand,
  projectChatMessageToolResult,
  projectChatMessageToolCalls,
  type ChatMessageToolCall,
} from './chat-message-tool-calls.ts';

export type ChatMessageViewSource = BirdCoderComparableChatMessageLike;

export interface ChatMessageMarkdownBlock {
  type: 'markdown';
  content: string;
  mode: 'basic' | 'rich';
  noticeKind?: BirdCoderProtocolNoticeKind;
}

export interface ChatMessageNoticeBlock {
  type: 'notice';
  id: string;
  noticeKind: BirdCoderProtocolNoticeKind;
  title?: string;
  detail?: string;
}

export interface ChatMessageReasoningBlock {
  type: 'reasoning';
  items: readonly BirdCoderChatMessageReasoningItem[];
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

export interface ChatMessageResourcesBlock {
  type: 'resources';
  items: readonly BirdCoderChatMessageResource[];
}

export type { ChatMessageToolCall } from './chat-message-tool-calls.ts';
export {
  CHAT_MESSAGE_TOOL_PROTOCOL_ADAPTER_IDS,
  projectChatMessageCommand,
  projectChatMessageToolCall,
  projectChatMessageToolCalls,
  projectChatMessageToolNotice,
  projectChatMessageToolNotices,
  projectChatMessageToolResult,
  type ChatMessageToolProtocolAdapterId,
  type ProjectChatMessageToolCallOptions,
  type ProjectedChatMessageToolNotice,
  type ProjectChatMessageToolResultInput,
  type ProjectedChatMessageCommand,
} from './chat-message-tool-calls.ts';

export interface ChatMessageToolCallsBlock {
  type: 'tool-calls';
  calls: readonly ChatMessageToolCall[];
}

export type ChatMessageContentBlock =
  | ChatMessageMarkdownBlock
  | ChatMessageNoticeBlock
  | ChatMessageReasoningBlock
  | ChatMessageActivityBlock
  | ChatMessageFileChangesBlock
  | ChatMessageCommandsBlock
  | ChatMessageResourcesBlock
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
  activitySummary?: ChatTurnActivitySummary | null;
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

function hasStructuredActivity(
  message: ChatMessageViewSource,
  activitySummary?: ChatTurnActivitySummary | null,
  engineId?: BirdCoderCodeEngineKey,
): boolean {
  if (activitySummary && (activitySummary.fileChanges.length > 0 || activitySummary.commands.length > 0)) {
    return true;
  }
  return filterStructuredFileChanges(message).length > 0
    || filterStructuredCommands(message).length > 0
    || hasParsedFileUpdateSummary(message.content)
    || projectChatMessageToolCalls(message.tool_calls, { engineId })
      .some((call) => call.kind === 'command');
}

function resolveProtocolNoticeKind(
  message: ChatMessageViewSource,
): BirdCoderProtocolNoticeKind | undefined {
  if (message.role !== 'system' || typeof message.metadata !== 'object' || !message.metadata) {
    return undefined;
  }

  const noticeKind = (message.metadata as Record<string, unknown>).noticeKind;
  return ['blocked', 'cancelled', 'compression', 'failed', 'info', 'retry', 'stopped', 'warning'].includes(
    typeof noticeKind === 'string' ? noticeKind : '',
  )
    ? noticeKind as BirdCoderProtocolNoticeKind
    : undefined;
}

function resolveToolNoticeFallback(call: ChatMessageToolCall): string {
  for (const block of call.resultBlocks ?? []) {
    if (block.type === 'text' && block.text.trim()) {
      return block.text.trim();
    }
    if (block.type === 'error' && block.message.trim()) {
      return block.message.trim();
    }
  }
  return call.output?.trim() ?? '';
}

function projectToolNoticeBlock(call: ChatMessageToolCall): ChatMessageNoticeBlock | null {
  if (call.presentation !== 'notice') {
    return null;
  }

  const name = call.name.trim() === 'tool' ? '' : call.name.trim();
  const description = call.title?.trim() ?? '';
  const isRedundantName = Boolean(name && description.includes(`"${name}"`));
  const title = isRedundantName ? '' : name;
  const noticeKind: BirdCoderProtocolNoticeKind = call.status === 'error'
    ? 'failed'
    : call.status === 'cancelled'
      ? 'cancelled'
      : 'info';
  const resultDetail = resolveToolNoticeFallback(call);
  const detail = noticeKind === 'failed' || noticeKind === 'cancelled'
    ? resultDetail || description
    : description || (!title ? resultDetail : '');
  if (!title && !detail) {
    return null;
  }

  return {
    type: 'notice',
    id: call.id,
    noticeKind,
    ...(title ? { title } : {}),
    ...(detail ? { detail } : {}),
  };
}

function inferChatMessageViewKind(
  message: ChatMessageViewSource,
  activitySummary?: ChatTurnActivitySummary | null,
  engineId?: BirdCoderCodeEngineKey,
): BirdCoderChatMessageViewKind {
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
      if (
        hasStructuredActivity(message, activitySummary, engineId)
        || hasParsedFileUpdateSummary(message.content)
      ) {
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
  activitySummary?: ChatTurnActivitySummary | null,
  engineId?: BirdCoderCodeEngineKey,
): ChatMessageContentBlock[] {
  const blocks: ChatMessageContentBlock[] = [];
  const markdownMode: 'basic' | 'rich' = message.role === 'user' ? 'basic' : 'rich';
  const markdownContent = message.role === 'tool'
    ? ''
    : resolveVisibleMarkdownBlockContent(message);
  const noticeKind = resolveProtocolNoticeKind(message);

  const reasoning = ['assistant', 'planner', 'reviewer'].includes(message.role)
    ? projectChatMessageReasoning(message.reasoning)
    : [];
  if (reasoning.length > 0) {
    blocks.push({
      type: 'reasoning',
      items: reasoning,
    });
  }

  if (markdownContent.trim().length > 0) {
    blocks.push({
      type: 'markdown',
      content: markdownContent,
      mode: markdownMode,
      ...(noticeKind ? { noticeKind } : {}),
    });
  }

  const resources = projectChatMessageResources(message.resources);
  if (resources.length > 0) {
    blocks.push({
      type: 'resources',
      items: resources,
    });
  }

  const fileChanges = activitySummary?.fileChanges ?? resolveProjectedActivityFileChanges(message);
  const projectedToolCalls = projectChatMessageToolCalls(message.tool_calls, { engineId });
  const toolResultCallId = message.tool_call_id?.trim() ?? '';
  // Combined provider entries already carry the authoritative lifecycle in tool_calls.
  // Their text content is a compact summary, not a second generic tool result.
  const hasAuthoritativeStructuredToolCall = projectedToolCalls.length > 0 && (
    !toolResultCallId || projectedToolCalls.some((call) => call.id === toolResultCallId)
  );
  const projectedToolResult = message.role === 'tool' && !hasAuthoritativeStructuredToolCall
    ? projectChatMessageToolResult({
        content: message.content,
        id: message.tool_call_id,
        name: message.name,
      }, { engineId })
    : null;
  const allProjectedToolCalls = projectedToolResult
    ? [...projectedToolCalls, projectedToolResult]
    : projectedToolCalls;

  const toolNoticeBlocks = allProjectedToolCalls.flatMap((call) => {
    const notice = projectToolNoticeBlock(call);
    return notice ? [notice] : [];
  });
  if (toolNoticeBlocks.length > 0) {
    blocks.unshift(...toolNoticeBlocks);
  }
  const projectedCommands = allProjectedToolCalls.flatMap((call) => {
    const command = projectChatMessageCommand(call);
    return command ? [command] : [];
  });
  const commandsByKey = new Map<string, NonNullable<ChatMessageViewSource['commands']>[number]>();
  const commandValues = [
    ...projectedCommands,
    ...(activitySummary?.commands ?? filterStructuredCommands(message)),
  ];
  for (let commandIndex = 0; commandIndex < commandValues.length; commandIndex += 1) {
    const commandValue = commandValues[commandIndex];
    if (typeof commandValue !== 'object' || commandValue === null) {
      continue;
    }
    const command = commandValue as {
      command?: unknown;
      kind?: unknown;
      toolCallId?: unknown;
    };
    if (typeof command.command !== 'string' || !command.command.trim()) {
      continue;
    }
    const toolCallId = typeof command.toolCallId === 'string'
      ? command.toolCallId.trim()
      : '';
    const key = toolCallId || `command-occurrence-${commandIndex}`;
    commandsByKey.set(key, commandValue);
  }
  const commands = [...commandsByKey.values()];

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

  const commandToolCallIds = new Set(projectedCommands.map((command) => command.toolCallId));
  const toolCalls = allProjectedToolCalls.filter((call) => {
    if (call.presentation === 'notice') {
      return false;
    }
    if (commandToolCallIds.has(call.id)) {
      return false;
    }
    if (fileChanges.length > 0 && isChatMessageFileMutationToolCall(call)) {
      return false;
    }
    return true;
  });
  if (toolCalls.length > 0) {
    blocks.push({
      type: 'tool-calls',
      calls: toolCalls,
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
      case 'notice':
        extraHeight += 32 + Math.min(96, (block.detail?.length ?? 0) / 4);
        break;
      case 'reasoning':
        extraHeight += 44;
        break;
      case 'activity':
        extraHeight += 48 + block.fileChanges.length * 36 + block.commands.length * 44;
        break;
      case 'file-changes':
        extraHeight += block.items.length * 36;
        break;
      case 'commands':
        extraHeight += block.items.length * 44;
        break;
      case 'resources':
        extraHeight += block.items.length * 58;
        break;
      case 'task-progress':
        extraHeight += 40;
        break;
      case 'tool-calls':
        extraHeight += block.calls.reduce((total, call) => {
          const argumentLines = call.arguments.trim()
            ? Math.ceil(call.arguments.length / 72)
            : 1;
          return total + 56 + Math.min(240, argumentLines * 16);
        }, 0);
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
      hasCollapsibleSections:
        kind === 'assistant.activity' || blocks.some((block) => block.type === 'reasoning'),
    },
    blocks,
  };

  return {
    estimatedHeight: estimateChatMessageViewHeight(view, layout),
    isCompact: layout === 'sidebar',
    hasCollapsibleSections:
      kind === 'assistant.activity' || blocks.some((block) => block.type === 'reasoning'),
  };
}

export function resolveChatMessageView(
  message: ChatMessageViewSource,
  options: ResolveChatMessageViewOptions = {},
): BirdCoderChatMessageView {
  const layout = options.layout ?? 'main';
  const kind = inferChatMessageViewKind(message, options.activitySummary, options.engineId);
  const blocks = buildChatMessageContentBlocks(
    message,
    kind,
    options.activitySummary,
    options.engineId,
  );

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
        case 'notice':
          return `notice:${block.id}:${block.noticeKind}:${block.title ?? ''}:${block.detail ?? ''}`;
        case 'reasoning':
          return `reasoning:${JSON.stringify(block.items)}`;
        case 'activity':
          return `act:${block.fileChanges.length}:${block.commands.length}`;
        case 'file-changes':
          return `fc:${block.items.length}`;
        case 'commands':
          return `cmd:${block.items.length}:${block.items.map((item) => readActivityCommandStatus(item)).join(',')}`;
        case 'resources':
          return `res:${block.items.map((item) => item.id).join(',')}`;
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
