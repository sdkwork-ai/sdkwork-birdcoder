import type {
  AgentSessionItemViewSource,
  AgentSessionProtocolNoticeKind,
} from './agent-session-view.ts';
import {
  AGENT_SESSION_ITEM_CONTENT_BLOCK_TYPES as BIRDCODER_AGENT_SESSION_ITEM_CONTENT_BLOCK_TYPES,
  AGENT_SESSION_ITEM_VIEW_KINDS as BIRDCODER_AGENT_SESSION_ITEM_VIEW_KINDS,
  type AgentSessionItemContentBlockType as AgentSessionItemContentBlockType,
  type AgentSessionItemViewKind as AgentSessionItemViewKind,
  type AgentSessionItemView as AgentSessionItemView,
  type AgentSessionItemDisplayRole as AgentSessionItemDisplayRole,
} from './agent-session-view.ts';
export {
  AGENT_SESSION_ITEM_CONTENT_BLOCK_TYPES,
  AGENT_SESSION_ITEM_VIEW_KINDS,
  type AgentSessionItemContentBlockType,
  type AgentSessionItemViewKind,
  type AgentSessionItemView,
  type AgentSessionItemDisplayRole,
} from './agent-session-view.ts';
import {
  hasParsedFileUpdateSummary,
  resolveAgentTurnActivityPresentation,
  resolveAgentSessionActivityFileChangeViews,
  resolveAgentSessionItemVisibleMarkdownContent,
  type AgentTurnActivityPresentation,
} from './agent-session-item-activity-presentation.ts';
import { resolveTaskProgressDisplayState } from './agent-session-item-task-progress.ts';
import {
  normalizeAgentSessionItemReasoning,
  type AgentSessionItemReasoningView as AgentSessionItemReasoningView,
} from './agent-session-item-reasoning.ts';
import {
  normalizeAgentSessionItemResources,
  type AgentSessionItemResourceView as AgentSessionItemResourceView,
} from './agent-session-item-resources.ts';
import {
  isAgentSessionItemFileMutationToolCall,
  normalizeAgentSessionCommand,
  normalizeAgentSessionItemToolResult,
  normalizeAgentSessionItemToolCalls,
  type AgentSessionItemToolCallView,
} from './agent-session-item-tool-calls.ts';

export interface AgentSessionItemMarkdownPresentationBlock {
  type: 'markdown';
  content: string;
  mode: 'basic' | 'rich';
  noticeKind?: AgentSessionProtocolNoticeKind;
}

export interface AgentSessionItemNoticePresentationBlock {
  type: 'notice';
  id: string;
  noticeKind: AgentSessionProtocolNoticeKind;
  title?: string;
  detail?: string;
}

export interface AgentSessionItemReasoningPresentationBlock {
  type: 'reasoning';
  items: readonly AgentSessionItemReasoningView[];
}

export interface AgentSessionItemActivityPresentationBlock {
  type: 'activity';
  sessionItemId: string;
  fileChanges: readonly NonNullable<AgentSessionItemViewSource['fileChanges']>[number][];
  commands: readonly NonNullable<AgentSessionItemViewSource['commands']>[number][];
}

export interface AgentSessionItemFileChangesPresentationBlock {
  type: 'file-changes';
  items: readonly NonNullable<AgentSessionItemViewSource['fileChanges']>[number][];
}

export interface AgentSessionItemCommandsPresentationBlock {
  type: 'commands';
  items: readonly NonNullable<AgentSessionItemViewSource['commands']>[number][];
}

export interface AgentSessionItemTaskProgressValue {
  total: number;
  completed: number;
}

export interface AgentSessionItemTaskProgressPresentationBlock {
  type: 'task-progress';
  progress: AgentSessionItemTaskProgressValue;
}

export interface AgentSessionItemResourcesPresentationBlock {
  type: 'resources';
  items: readonly AgentSessionItemResourceView[];
}

export type { AgentSessionItemToolCallView } from './agent-session-item-tool-calls.ts';
export {
  AGENT_SESSION_ITEM_TOOL_PROTOCOL_ADAPTER_IDS,
  normalizeAgentSessionCommand,
  normalizeAgentSessionItemToolCall,
  normalizeAgentSessionItemToolCalls,
  normalizeAgentSessionItemToolNotice,
  normalizeAgentSessionItemToolNotices,
  normalizeAgentSessionItemToolResult,
  type AgentSessionItemToolProtocolAdapterId,
  type NormalizeAgentSessionItemToolCallOptions,
  type NormalizedAgentSessionItemToolNotice,
  type NormalizeAgentSessionItemToolResultInput,
  type NormalizedAgentSessionCommand,
} from './agent-session-item-tool-calls.ts';

export interface AgentSessionItemToolCallsPresentationBlock {
  type: 'tool-calls';
  calls: readonly AgentSessionItemToolCallView[];
}

export type AgentSessionItemPresentationBlock =
  | AgentSessionItemMarkdownPresentationBlock
  | AgentSessionItemNoticePresentationBlock
  | AgentSessionItemReasoningPresentationBlock
  | AgentSessionItemActivityPresentationBlock
  | AgentSessionItemFileChangesPresentationBlock
  | AgentSessionItemCommandsPresentationBlock
  | AgentSessionItemResourcesPresentationBlock
  | AgentSessionItemTaskProgressPresentationBlock
  | AgentSessionItemToolCallsPresentationBlock;

export interface AgentSessionItemPresentationLayoutHints {
  estimatedHeight: number;
  isCompact: boolean;
  hasCollapsibleSections: boolean;
}

export interface AgentSessionItemPresentation {
  sessionItemId: string;
  kind: AgentSessionItemViewKind;
  source: Readonly<AgentSessionItemViewSource>;
  engineId?: string;
  layoutHints: AgentSessionItemPresentationLayoutHints;
  blocks: readonly AgentSessionItemPresentationBlock[];
}

export interface ResolveAgentSessionItemPresentationOptions {
  activitySummary?: AgentTurnActivityPresentation | null;
  engineId?: string;
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
  item: AgentSessionItemViewSource,
): NonNullable<AgentSessionItemViewSource['fileChanges']> {
  return (item.fileChanges ?? []).filter((item) => readActivityPath(item).length > 0);
}

function filterStructuredCommands(
  item: AgentSessionItemViewSource,
): NonNullable<AgentSessionItemViewSource['commands']> {
  return (item.commands ?? []).filter((item) => readActivityCommand(item).length > 0);
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
  item: AgentSessionItemViewSource,
  activitySummary?: AgentTurnActivityPresentation | null,
  engineId?: string,
): boolean {
  if (activitySummary && (activitySummary.fileChanges.length > 0 || activitySummary.commands.length > 0)) {
    return true;
  }
  return filterStructuredFileChanges(item).length > 0
    || filterStructuredCommands(item).length > 0
    || hasParsedFileUpdateSummary(item.content)
    || normalizeAgentSessionItemToolCalls(item.tool_calls, { engineId })
      .some((call) => call.kind === 'command');
}

function resolveProtocolNoticeKind(
  item: AgentSessionItemViewSource,
): AgentSessionProtocolNoticeKind | undefined {
  if (item.role !== 'system' || typeof item.metadata !== 'object' || !item.metadata) {
    return undefined;
  }

  const noticeKind = (item.metadata as Record<string, unknown>).noticeKind;
  return ['blocked', 'cancelled', 'compression', 'failed', 'info', 'retry', 'stopped', 'warning'].includes(
    typeof noticeKind === 'string' ? noticeKind : '',
  )
    ? noticeKind as AgentSessionProtocolNoticeKind
    : undefined;
}

function resolveToolNoticeFallback(call: AgentSessionItemToolCallView): string {
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

function composeToolNoticeBlock(call: AgentSessionItemToolCallView): AgentSessionItemNoticePresentationBlock | null {
  if (call.presentation !== 'notice') {
    return null;
  }

  const name = call.name.trim() === 'tool' ? '' : call.name.trim();
  const description = call.title?.trim() ?? '';
  const isRedundantName = Boolean(name && description.includes(`"${name}"`));
  const title = isRedundantName ? '' : name;
  const noticeKind: AgentSessionProtocolNoticeKind = call.status === 'error'
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

function inferAgentSessionItemViewKind(
  item: AgentSessionItemViewSource,
  activitySummary?: AgentTurnActivityPresentation | null,
  engineId?: string,
): AgentSessionItemViewKind {
  switch (item.role) {
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
        hasStructuredActivity(item, activitySummary, engineId)
        || hasParsedFileUpdateSummary(item.content)
      ) {
        return 'assistant.activity';
      }
      return 'assistant.text';
    default:
      return 'assistant.text';
  }
}

function buildAgentSessionItemPresentationBlocks(
  item: AgentSessionItemViewSource,
  kind: AgentSessionItemViewKind,
  activitySummary?: AgentTurnActivityPresentation | null,
  engineId?: string,
): AgentSessionItemPresentationBlock[] {
  const blocks: AgentSessionItemPresentationBlock[] = [];
  const markdownMode: 'basic' | 'rich' = item.role === 'user' ? 'basic' : 'rich';
  const markdownContent = item.role === 'tool'
    ? ''
    : resolveAgentSessionItemVisibleMarkdownContent(item);
  const noticeKind = resolveProtocolNoticeKind(item);

  const reasoning = ['assistant', 'planner', 'reviewer'].includes(item.role)
    ? normalizeAgentSessionItemReasoning(item.reasoning)
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

  const resources = normalizeAgentSessionItemResources(item.resources);
  if (resources.length > 0) {
    blocks.push({
      type: 'resources',
      items: resources,
    });
  }

  const fileChanges = activitySummary?.fileChanges ?? resolveAgentSessionActivityFileChangeViews(item);
  const normalizedToolCalls = normalizeAgentSessionItemToolCalls(item.tool_calls, { engineId });
  const toolResultCallId = item.tool_call_id?.trim() ?? '';
  // Combined provider entries already carry the authoritative lifecycle in tool_calls.
  // Their text content is a compact summary, not a second generic tool result.
  const hasAuthoritativeStructuredToolCall = normalizedToolCalls.length > 0 && (
    !toolResultCallId || normalizedToolCalls.some((call) => call.id === toolResultCallId)
  );
  const normalizedToolResult = item.role === 'tool' && !hasAuthoritativeStructuredToolCall
    ? normalizeAgentSessionItemToolResult({
        content: item.content,
        id: item.tool_call_id,
        name: item.name,
      }, { engineId })
    : null;
  const allNormalizedToolCalls = normalizedToolResult
    ? [...normalizedToolCalls, normalizedToolResult]
    : normalizedToolCalls;

  const toolNoticeBlocks = allNormalizedToolCalls.flatMap((call) => {
    const notice = composeToolNoticeBlock(call);
    return notice ? [notice] : [];
  });
  if (toolNoticeBlocks.length > 0) {
    blocks.unshift(...toolNoticeBlocks);
  }
  const normalizedCommands = allNormalizedToolCalls.flatMap((call) => {
    const command = normalizeAgentSessionCommand(call);
    return command ? [command] : [];
  });
  const commandsByKey = new Map<string, NonNullable<AgentSessionItemViewSource['commands']>[number]>();
  const commandValues = [
    ...normalizedCommands,
    ...(activitySummary?.commands ?? filterStructuredCommands(item)),
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
      sessionItemId: item.id,
      fileChanges,
      commands,
    });
  } else {
    const structuredFileChanges = filterStructuredFileChanges(item);
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

  const taskProgressDisplayState = resolveTaskProgressDisplayState(item.taskProgress);
  if (taskProgressDisplayState) {
    blocks.push({
      type: 'task-progress',
      progress: {
        total: taskProgressDisplayState.total,
        completed: taskProgressDisplayState.completed,
      },
    });
  }

  const commandToolCallIds = new Set(normalizedCommands.map((command) => command.toolCallId));
  const toolCalls = allNormalizedToolCalls.filter((call) => {
    if (call.presentation === 'notice') {
      return false;
    }
    if (commandToolCallIds.has(call.id)) {
      return false;
    }
    if (fileChanges.length > 0 && isAgentSessionItemFileMutationToolCall(call)) {
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

export function estimateAgentSessionItemPresentationHeight(
  view: AgentSessionItemPresentation,
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

function buildAgentSessionItemPresentationLayoutHints(
  item: AgentSessionItemViewSource,
  kind: AgentSessionItemViewKind,
  layout: 'sidebar' | 'main',
  blocks: readonly AgentSessionItemPresentationBlock[],
): AgentSessionItemPresentationLayoutHints {
  const view: AgentSessionItemPresentation = {
    sessionItemId: item.id,
    kind,
    source: item,
    layoutHints: {
      estimatedHeight: 0,
      isCompact: layout === 'sidebar',
      hasCollapsibleSections:
        kind === 'assistant.activity' || blocks.some((block) => block.type === 'reasoning'),
    },
    blocks,
  };

  return {
    estimatedHeight: estimateAgentSessionItemPresentationHeight(view, layout),
    isCompact: layout === 'sidebar',
    hasCollapsibleSections:
      kind === 'assistant.activity' || blocks.some((block) => block.type === 'reasoning'),
  };
}

export function resolveAgentSessionItemPresentation(
  item: AgentSessionItemViewSource,
  options: ResolveAgentSessionItemPresentationOptions = {},
): AgentSessionItemPresentation {
  const layout = options.layout ?? 'main';
  const kind = inferAgentSessionItemViewKind(item, options.activitySummary, options.engineId);
  const blocks = buildAgentSessionItemPresentationBlocks(
    item,
    kind,
    options.activitySummary,
    options.engineId,
  );

  return {
    sessionItemId: item.id,
    kind,
    source: item,
    engineId: options.engineId,
    layoutHints: buildAgentSessionItemPresentationLayoutHints(item, kind, layout, blocks),
    blocks,
  };
}

export function resolveAgentSessionItemPresentations(
  items: readonly AgentSessionItemViewSource[],
  options: ResolveAgentSessionItemPresentationOptions = {},
): AgentSessionItemPresentation[] {
  return items.map((item) => resolveAgentSessionItemPresentation(item, options));
}

export function estimateTranscriptSessionItemHeight(
  item: AgentSessionItemViewSource,
  options: ResolveAgentSessionItemPresentationOptions = {},
): number {
  const layout = options.layout ?? 'main';
  const view = resolveAgentSessionItemPresentation(item, { ...options, layout });
  return estimateAgentSessionItemPresentationHeight(view, layout);
}

export function buildAgentSessionItemPresentationSynchronizationSignature(
  view: AgentSessionItemPresentation,
): string {
  const item = view.source;
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
    item.role,
    item.id,
    item.content,
    blockSignature,
  ].join('\u0001');
}
