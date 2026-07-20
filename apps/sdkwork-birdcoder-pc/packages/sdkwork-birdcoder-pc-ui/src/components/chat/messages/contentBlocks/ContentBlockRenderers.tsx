import React, { memo } from 'react';
import { Archive, Ban, CircleStop, RefreshCw, ShieldX, TriangleAlert } from 'lucide-react';
import type { CommandExecution } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { ChatActivitySummary } from '../activity/ChatActivitySummary.tsx';
import {
  filterCommandExecutions,
  normalizeActivityFileChanges,
} from '../activity/activityBlockSupport.ts';
import { ChatTaskProgress } from '../blocks/ChatTaskProgress.tsx';
import type { ChatMessageContentBlockRendererProps } from './registry.ts';
import { ToolCallCard } from './ToolCallCard.tsx';

const NOTICE_DEFAULT_CONTENT = {
  blocked: 'Agent execution blocked',
  cancelled: 'Generation cancelled',
  compression: 'Conversation context compressed',
  failed: 'Provider request failed',
  retry: 'Retrying provider request',
  stopped: 'Agent execution stopped',
} as const;

function resolveNoticeDetail(
  noticeKind: keyof typeof NOTICE_DEFAULT_CONTENT,
  content: string,
): string {
  const normalizedContent = content.trim();
  const defaultContent = NOTICE_DEFAULT_CONTENT[noticeKind];
  if (normalizedContent === defaultContent || normalizedContent === `${defaultContent}.`) {
    return '';
  }
  if (!normalizedContent.startsWith(defaultContent)) {
    return normalizedContent;
  }

  return normalizedContent
    .slice(defaultContent.length)
    .replace(/^\s*[:\-]\s*/u, '')
    .trim();
}

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
  const sourceMessage = context.allMessages[context.index];
  const disclosureScopeKey = `${context.sessionId}\u0001${
    sourceMessage?.turnId?.trim() || sourceMessage?.id?.trim() || messageId
  }\u0001activity`;

  return (
    <div className={compact ? 'mt-1.5' : 'mt-2'}>
      <ChatActivitySummary
        compact={compact}
        commands={commands}
        copyLabel={copyLabel}
        copyMessageToClipboard={context.copyMessageToClipboard}
        environment={context.environment}
        expandedDisclosureKeys={context.expandedDisclosureKeys}
        fileChanges={fileChanges}
        messageId={messageId}
        disclosureScopeKey={disclosureScopeKey}
        successIconSize={compact ? 13 : 14}
        toggleDisclosure={context.toggleDisclosure}
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

  if (block.noticeKind) {
    const notices = {
      blocked: {
        icon: ShieldX,
        label: context.environment?.t('chat.noticeBlocked') ?? 'Agent execution blocked',
      },
      cancelled: {
        icon: Ban,
        label: context.environment?.t('chat.noticeCancelled') ?? 'Generation cancelled',
      },
      compression: {
        icon: Archive,
        label: context.environment?.t('chat.noticeCompression') ?? 'Conversation context compressed',
      },
      failed: {
        icon: TriangleAlert,
        label: context.environment?.t('chat.noticeFailed') ?? 'Provider request failed',
      },
      retry: {
        icon: RefreshCw,
        label: context.environment?.t('chat.noticeRetry') ?? 'Retrying provider request',
      },
      stopped: {
        icon: CircleStop,
        label: context.environment?.t('chat.noticeStopped') ?? 'Agent execution stopped',
      },
    } as const;
    const notice = notices[block.noticeKind];
    const NoticeIcon = notice.icon;
    const noticeDetail = resolveNoticeDetail(block.noticeKind, block.content);
    const isFailure = block.noticeKind === 'failed';

    return (
      <div
        className={`flex min-w-0 items-center gap-2 py-1 text-[12px] ${isFailure ? 'text-red-300/90' : 'text-gray-500'}`}
        data-chat-system-notice={block.noticeKind}
        role={isFailure ? 'alert' : 'status'}
      >
        <NoticeIcon size={13} className="shrink-0" />
        <span className="shrink-0 font-medium">{notice.label}</span>
        {noticeDetail ? (
          <span className="min-w-0 truncate text-gray-500" title={block.content}>
            {noticeDetail}
          </span>
        ) : null}
      </div>
    );
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

export const ToolCallsContentBlockRenderer = memo(function ToolCallsContentBlockRenderer({
  block,
  context,
}: ChatMessageContentBlockRendererProps) {
  if (block.type !== 'tool-calls' || block.calls.length === 0) {
    return null;
  }

  const compact = context.layout === 'sidebar';
  const sourceMessage = context.allMessages[context.index];
  const disclosureScopeKey = `${context.sessionId}\u0001${
    sourceMessage?.turnId?.trim() || sourceMessage?.id?.trim() || String(context.index)
  }\u0001tool`;

  return (
    <div className={`flex flex-col gap-0.5 ${compact ? 'mt-1.5' : 'mt-2'}`}>
      {block.calls.map((toolCall) => (
        <ToolCallCard
          key={toolCall.id}
          call={toolCall}
          compact={compact}
          copyMessageToClipboard={context.copyMessageToClipboard}
          isExpanded={context.expandedDisclosureKeys.has(`${disclosureScopeKey}\u0001${toolCall.id}`)}
          onToggle={() => context.toggleDisclosure(`${disclosureScopeKey}\u0001${toolCall.id}`)}
          t={context.environment?.t}
        />
      ))}
    </div>
  );
});
