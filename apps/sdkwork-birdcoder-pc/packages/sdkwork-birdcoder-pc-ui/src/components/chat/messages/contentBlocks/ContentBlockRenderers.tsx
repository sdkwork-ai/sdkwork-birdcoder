import React, { memo } from 'react';
import type { CommandExecution } from '@sdkwork/birdcoder-pc-commons/chat/types';
import { ChatActivitySummary } from '../activity/ChatActivitySummary.tsx';
import {
  filterCommandExecutions,
  normalizeActivityFileChanges,
} from '../activity/activityBlockSupport.ts';
import { ChatTaskProgress } from '../blocks/ChatTaskProgress.tsx';
import type { ChatMessageContentBlockRendererProps } from './registry.ts';

function ActivitySummaryBlock({
  block,
  context,
  fileChanges,
  commands,
}: ChatMessageContentBlockRendererProps & {
  fileChanges: ReturnType<typeof normalizeActivityFileChanges>;
  commands: CommandExecution[];
}) {
  if (fileChanges.length === 0 && commands.length === 0) {
    return null;
  }

  const copyLabel = context.environment?.t('common.copy') ?? 'Copy';
  const compact = context.layout === 'sidebar';
  const messageId =
    block.type === 'activity'
      ? block.messageId
      : context.allMessages[context.index]?.id ?? '';

  return (
    <div className={compact ? 'mt-1.5' : 'mt-2'}>
      <ChatActivitySummary
        compact={compact}
        commands={commands}
        copyLabel={copyLabel}
        copyMessageToClipboard={context.copyMessageToClipboard}
        environment={context.environment}
        fileChanges={fileChanges}
        messageId={messageId}
        successIconSize={compact ? 13 : 14}
      />
    </div>
  );
}

export const MarkdownContentBlockRenderer = memo(function MarkdownContentBlockRenderer({
  block,
  context,
}: ChatMessageContentBlockRendererProps) {
  if (block.type !== 'markdown') {
    return null;
  }

  if (!block.content.trim()) {
    return null;
  }

  const proseClassName = context.layout === 'sidebar'
    ? 'prose prose-invert max-w-none prose-headings:my-3 prose-headings:font-semibold prose-headings:leading-snug prose-h1:text-[1rem] prose-h2:text-[0.95rem] prose-h3:text-[0.9rem] prose-h4:text-[0.85rem] prose-p:my-2 prose-p:leading-relaxed prose-li:my-0.5 prose-li:text-[13px] prose-pre:bg-[#18181b] prose-pre:border prose-pre:border-white/10 text-[13px] w-full'
    : 'prose prose-invert max-w-none prose-headings:my-3 prose-headings:font-semibold prose-headings:leading-snug prose-h1:text-[1.02rem] prose-h2:text-[0.96rem] prose-h3:text-[0.9rem] prose-h4:text-[0.85rem] prose-p:my-2 prose-p:leading-relaxed prose-li:my-0.5 prose-li:text-[14px] prose-pre:bg-[#18181b] prose-pre:border prose-pre:border-white/10 text-[14px] text-gray-300 w-full';

  return (
    <div className={proseClassName}>
      {context.renderMarkdownContent(block.content, block.mode)}
    </div>
  );
});

export const ActivityContentBlockRenderer = memo(function ActivityContentBlockRenderer(
  props: ChatMessageContentBlockRendererProps,
) {
  const { block } = props;
  if (block.type !== 'activity') {
    return null;
  }

  return (
    <ActivitySummaryBlock
      {...props}
      fileChanges={normalizeActivityFileChanges(block.fileChanges)}
      commands={filterCommandExecutions(block.commands)}
    />
  );
});

export const FileChangesContentBlockRenderer = memo(function FileChangesContentBlockRenderer(
  props: ChatMessageContentBlockRendererProps,
) {
  const { block } = props;
  if (block.type !== 'file-changes' || block.items.length === 0) {
    return null;
  }

  return (
    <ActivitySummaryBlock
      {...props}
      fileChanges={normalizeActivityFileChanges(block.items)}
      commands={[]}
    />
  );
});

export const CommandsContentBlockRenderer = memo(function CommandsContentBlockRenderer(
  props: ChatMessageContentBlockRendererProps,
) {
  const { block } = props;
  if (block.type !== 'commands' || block.items.length === 0) {
    return null;
  }

  return (
    <ActivitySummaryBlock
      {...props}
      fileChanges={[]}
      commands={filterCommandExecutions(block.items)}
    />
  );
});

export const TaskProgressContentBlockRenderer = memo(function TaskProgressContentBlockRenderer({
  block,
  context,
}: ChatMessageContentBlockRendererProps) {
  if (block.type !== 'task-progress') {
    return null;
  }

  return (
    <div className={context.layout === 'sidebar' ? 'mt-1.5' : 'mt-2'}>
      <ChatTaskProgress taskProgress={block.progress} />
    </div>
  );
});

function formatToolCall(toolCall: unknown): string {
  if (typeof toolCall === 'string') {
    return toolCall;
  }
  try {
    return JSON.stringify(toolCall, null, 2);
  } catch {
    return String(toolCall);
  }
}

export const ToolCallsContentBlockRenderer = memo(function ToolCallsContentBlockRenderer({
  block,
  context,
}: ChatMessageContentBlockRendererProps) {
  if (block.type !== 'tool-calls' || block.calls.length === 0) {
    return null;
  }

  const compact = context.layout === 'sidebar';

  return (
    <div className={`flex flex-col gap-2 ${compact ? 'mt-1.5' : 'mt-2'}`}>
      {block.calls.map((toolCall, index) => (
        <div
          key={`tool-call:${index}`}
          className="rounded-lg border border-white/10 bg-[#141417] px-3 py-2"
        >
          <div className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">Tool call</div>
          <pre className={`text-[11px] text-gray-300 whitespace-pre-wrap overflow-auto ${compact ? 'max-h-40' : 'max-h-56'}`}>
            {formatToolCall(toolCall)}
          </pre>
        </div>
      ))}
    </div>
  );
});
