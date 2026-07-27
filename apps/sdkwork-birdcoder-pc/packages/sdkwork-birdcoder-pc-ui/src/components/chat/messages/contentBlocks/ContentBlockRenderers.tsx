import React, { memo } from 'react';
import { Archive, Ban, CircleStop, Copy, Info, RefreshCw, ShieldX, TriangleAlert } from 'lucide-react';
import type { AgentSessionCommandView } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { ChatActivitySummary } from '../activity/ChatActivitySummary.tsx';
import {
  filterCommandExecutions,
  normalizeActivityFileChanges,
} from '../activity/activityBlockSupport.ts';
import { ChatTaskProgress } from '../blocks/ChatTaskProgress.tsx';
import { ChatLifecycleEvents } from '../blocks/ChatLifecycleEvents.tsx';
import { ChatInteractionEvents } from '../blocks/ChatInteractionEvents.tsx';
import { buildChatContentPreview } from '../contentPreview.ts';
import { CHAT_MESSAGE_INLINE_CODE_PROSE_CLASSNAME } from '../messageLayout.ts';
import type { ChatMessageContentBlockRendererProps } from './registry.ts';
import { ToolCallCard } from './ToolCallCard.tsx';

const NOTICE_DEFAULT_CONTENT = {
  blocked: 'Agent execution blocked',
  cancelled: 'Generation cancelled',
  compression: 'Conversation context compressed',
  failed: 'Provider request failed',
  info: 'Provider information',
  retry: 'Retrying provider request',
  stopped: 'Agent execution stopped',
  warning: 'Provider warning',
} as const;

const MAX_NOTICE_DETAIL_PREVIEW_CHARACTERS = 4_000;

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
  commands: AgentSessionCommandView[];
}) {
  const visibleFileChanges = context.suppressInlineFileChanges ? [] : fileChanges;
  if (visibleFileChanges.length === 0 && commands.length === 0) {
    return null;
  }

  const copyLabel = context.environment?.t('common.copy') ?? 'Copy';
  const compact = context.layout === 'sidebar';
  const sessionItemId =
    block.type === 'activity'
      ? block.sessionItemId
      : context.allMessages[context.index]?.id ?? '';
  const sourceMessage = context.allMessages[context.index];
  const disclosureScopeKey = `${context.sessionId}\u0001${
    sourceMessage?.turnId?.trim() || sourceMessage?.id?.trim() || sessionItemId
  }\u0001activity`;

  return (
    <div className={`w-full min-w-0 max-w-full ${compact ? 'mt-1' : 'mt-1.5'}`}>
      <ChatActivitySummary
        compact={compact}
        commands={commands}
        copyLabel={copyLabel}
        copyMessageToClipboard={context.copyMessageToClipboard}
        environment={context.environment}
        expandedDisclosureKeys={context.expandedDisclosureKeys}
        fileChanges={visibleFileChanges}
        messageId={sessionItemId}
        disclosureScopeKey={disclosureScopeKey}
        engineId={context.engineId}
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
      info: {
        icon: Info,
        label: context.environment?.t('chat.noticeInfo') ?? 'Provider information',
      },
      retry: {
        icon: RefreshCw,
        label: context.environment?.t('chat.noticeRetry') ?? 'Retrying provider request',
      },
      stopped: {
        icon: CircleStop,
        label: context.environment?.t('chat.noticeStopped') ?? 'Agent execution stopped',
      },
      warning: {
        icon: TriangleAlert,
        label: context.environment?.t('chat.noticeWarning') ?? 'Provider warning',
      },
    } as const;
    const noticeKind = block.noticeKind;
    const notice = notices[noticeKind];
    const NoticeIcon = notice.icon;
    const noticeDetail = resolveNoticeDetail(noticeKind, block.content);
    const noticeDetailPreview = buildChatContentPreview(noticeDetail, {
      maxCharacters: MAX_NOTICE_DETAIL_PREVIEW_CHARACTERS,
      tailCharacters: 1_000,
    });
    const isFailure = noticeKind === 'failed';
    const isWarning = noticeKind === 'warning';
    const copyLabel = context.environment?.t('common.copy') ?? 'Copy';

    return (
      <div
        className={`flex min-w-0 items-start gap-2 py-1 text-[12px] ${
          isFailure
            ? 'text-red-300/90'
            : isWarning
              ? 'text-amber-200/90'
              : 'text-gray-500'
        }`}
        data-chat-system-notice={noticeKind}
        role="note"
      >
        <NoticeIcon size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span className="shrink-0 font-medium">{notice.label}</span>
        {noticeDetailPreview.text ? (
          <span
            className={`min-w-0 flex-1 whitespace-pre-wrap break-words ${isWarning ? 'text-amber-200/75' : 'text-gray-500'}`}
          >
            {noticeDetailPreview.text}
          </span>
        ) : null}
        {noticeDetailPreview.isTruncated ? (
          <button
            type="button"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
            title={copyLabel}
            aria-label={`${copyLabel}: ${notice.label}`}
            onClick={() => context.copyMessageToClipboard(block.content)}
          >
            <Copy size={11} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    );
  }

  const layoutProseClassName = context.layout === 'sidebar'
    ? 'prose prose-invert w-full max-w-none break-words text-[length:var(--birdcoder-ui-font-size,12px)] text-gray-300 [overflow-wrap:anywhere] prose-headings:my-3 prose-headings:font-semibold prose-headings:leading-snug prose-h1:text-[1rem] prose-h2:text-[0.95rem] prose-h3:text-[0.9rem] prose-h4:text-[0.85rem] prose-p:my-2 prose-p:leading-relaxed prose-li:my-0.5 prose-li:text-[length:var(--birdcoder-ui-font-size,12px)] prose-a:break-words prose-pre:max-w-full prose-pre:bg-transparent prose-pre:p-0'
    : 'prose prose-invert w-full max-w-none break-words text-[length:calc(var(--birdcoder-ui-font-size,12px)_+_1px)] leading-6 text-gray-200 [overflow-wrap:anywhere] prose-headings:my-3 prose-headings:font-semibold prose-headings:leading-snug prose-headings:text-gray-100 prose-h1:text-[1.08rem] prose-h2:text-[1rem] prose-h3:text-[0.94rem] prose-h4:text-[0.88rem] prose-p:my-2 prose-p:leading-6 prose-li:my-0.5 prose-li:text-[length:calc(var(--birdcoder-ui-font-size,12px)_+_1px)] prose-li:leading-6 prose-a:break-words prose-strong:text-gray-100 prose-pre:max-w-full prose-pre:bg-transparent prose-pre:p-0';
  const proseClassName = `${layoutProseClassName} ${CHAT_MESSAGE_INLINE_CODE_PROSE_CLASSNAME}`;

  return (
    <div className={proseClassName}>
      {context.renderMarkdownContent(block.content, block.mode)}
    </div>
  );
});

export const NoticeContentBlockRenderer = memo(function NoticeContentBlockRenderer({
  block,
  context,
}: ChatMessageContentBlockRendererProps) {
  if (block.type !== 'notice') {
    return null;
  }

  const fallbackTitle = context.environment?.t('chat.noticeInfo') ?? 'Provider information';
  const title = block.title?.trim() || (!block.detail?.trim() ? fallbackTitle : '');
  const detail = block.detail?.trim() ?? '';
  const detailPreview = buildChatContentPreview(detail, {
    maxCharacters: MAX_NOTICE_DETAIL_PREVIEW_CHARACTERS,
    tailCharacters: 1_000,
  });
  const copyLabel = context.environment?.t('common.copy') ?? 'Copy';
  const copyContent = [title, detail].filter(Boolean).join(': ');

  return (
    <div
      className="flex min-w-0 items-start gap-2 py-1 text-[12px] text-gray-500"
      data-chat-tool-notice={block.noticeKind}
      role="note"
    >
      <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        {title ? <span className="font-medium text-gray-400">{title}</span> : null}
        {title && detailPreview.text ? ': ' : null}
        {detailPreview.text ? <span>{detailPreview.text}</span> : null}
      </span>
      {detailPreview.isTruncated ? (
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70"
          title={copyLabel}
          aria-label={`${copyLabel}: ${title || fallbackTitle}`}
          onClick={() => context.copyMessageToClipboard(copyContent)}
        >
          <Copy size={11} aria-hidden="true" />
        </button>
      ) : null}
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

  const sourceMessage = context.allMessages[context.index];
  const disclosureKey = `${context.sessionId}\u0001${
    sourceMessage?.turnId?.trim() || sourceMessage?.id?.trim() || String(context.index)
  }\u0001task-progress`;

  return (
    <div className={`w-full min-w-0 ${context.layout === 'sidebar' ? 'mt-1' : 'mt-1.5'}`}>
      <ChatTaskProgress
        isExpanded={context.expandedDisclosureKeys.has(disclosureKey)}
        onToggle={() => context.toggleDisclosure(disclosureKey)}
        taskProgress={block.progress}
        t={context.environment?.t}
      />
    </div>
  );
});

export const LifecycleContentBlockRenderer = memo(function LifecycleContentBlockRenderer({
  block,
  context,
}: ChatMessageContentBlockRendererProps) {
  if (block.type !== 'lifecycle' || block.events.length === 0) {
    return null;
  }
  const sourceMessage = context.allMessages[context.index];
  const disclosureScopeKey = `${context.sessionId}\u0001${
    sourceMessage?.turnId?.trim() || sourceMessage?.id?.trim() || String(context.index)
  }\u0001lifecycle`;
  return (
    <div className={`w-full min-w-0 ${context.layout === 'sidebar' ? 'mt-1' : 'mt-1.5'}`}>
      <ChatLifecycleEvents
        copyMessageToClipboard={context.copyMessageToClipboard}
        disclosureScopeKey={disclosureScopeKey}
        events={block.events}
        expandedDisclosureKeys={context.expandedDisclosureKeys}
        t={context.environment?.t}
        toggleDisclosure={context.toggleDisclosure}
      />
    </div>
  );
});

export const InteractionsContentBlockRenderer = memo(function InteractionsContentBlockRenderer({
  block,
  context,
}: ChatMessageContentBlockRendererProps) {
  if (block.type !== 'interactions' || block.items.length === 0) {
    return null;
  }
  const sourceMessage = context.allMessages[context.index];
  const disclosureScopeKey = `${context.sessionId}\u0001${
    sourceMessage?.turnId?.trim() || sourceMessage?.id?.trim() || String(context.index)
  }\u0001interaction`;
  return (
    <div className={`w-full min-w-0 ${context.layout === 'sidebar' ? 'mt-1' : 'mt-1.5'}`}>
      <ChatInteractionEvents
        copyMessageToClipboard={context.copyMessageToClipboard}
        disclosureScopeKey={disclosureScopeKey}
        expandedDisclosureKeys={context.expandedDisclosureKeys}
        interactions={block.items}
        t={context.environment?.t}
        toggleDisclosure={context.toggleDisclosure}
      />
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
