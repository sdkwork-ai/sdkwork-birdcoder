import React, { memo, useEffect, useState } from 'react';
import {
  Check,
  Clock3,
  Copy,
  CornerUpLeft,
  Edit2,
  History,
  LoaderCircle,
  ShieldAlert,
  Target,
  TerminalSquare,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';
import type {
  AgentSessionItemPresentation,
  AgentSessionItemViewSource,
  AgentSessionHookStatsView,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { ContentBlockList } from '../contentBlocks/ContentBlockList.tsx';
import { UserMessageAttachments } from '../UserMessageAttachments.tsx';
import { ChatTurnRatingDialog } from '../blocks/ChatTurnRatingDialog.tsx';
import { resolveUserMessageDisplay } from '../userMessageDisplay.ts';
import {
  resolveMessageActionTargetCopyText,
} from '../messageActions.ts';
import type {
  ChatAssistantMessageRating,
  ChatAssistantMessageRatingSelection,
  ChatMessageRendererProps,
} from '../types.ts';
import { RoleHeader } from './RoleHeader.tsx';

interface UserMessageSourceView {
  kind: 'codex-delegation' | 'automation-heartbeat';
  sourceSessionId?: string;
  automationId?: string;
}

function resolveUserMessageSource(
  message: AgentSessionItemViewSource,
): UserMessageSourceView | null {
  const raw = (message.metadata as Record<string, unknown> | undefined)
    ?.providerUserMessageSource;
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const kind = record.kind;
  if (kind !== 'codex-delegation' && kind !== 'automation-heartbeat') {
    return null;
  }
  const sourceSessionId = typeof record.sourceSessionId === 'string'
    ? record.sourceSessionId
    : undefined;
  const automationId = typeof record.automationId === 'string'
    ? record.automationId
    : undefined;
  return {
    kind,
    ...(sourceSessionId ? { sourceSessionId } : {}),
    ...(automationId ? { automationId } : {}),
  };
}

/**
 * Codex desktop delivery gating (`codex.userMessage.hookBlocked`): a user
 * message whose `deliveryStatus` is `'not-sent'` was blocked by a hook
 * before it entered the conversation; `blockedSources` names the hooks.
 */
interface HookBlockedStatusView {
  blockedSources: string[];
  hookStats?: AgentSessionHookStatsView;
}

function resolveHookBlockedStatus(
  message: AgentSessionItemViewSource,
): HookBlockedStatusView | null {
  const metadata = message.metadata as Record<string, unknown> | undefined;
  if (metadata?.deliveryStatus !== 'not-sent') {
    return null;
  }
  const blockedSources = Array.isArray(metadata.blockedSources)
    ? metadata.blockedSources.filter(
      (source): source is string => typeof source === 'string' && source.trim().length > 0,
    )
    : [];
  const hookStats = typeof metadata.hookStats === 'object' && metadata.hookStats !== null
    ? metadata.hookStats as AgentSessionHookStatsView
    : undefined;
  return {
    blockedSources,
    ...(hookStats && typeof hookStats.count === 'number' ? { hookStats } : {}),
  };
}

function resolveHookStats(message: AgentSessionItemViewSource): AgentSessionHookStatsView | null {
  const metadata = message.metadata as Record<string, unknown> | undefined;
  if (typeof metadata?.hookStats !== 'object' || metadata.hookStats === null) {
    return null;
  }
  const stats = metadata.hookStats as AgentSessionHookStatsView;
  return typeof stats.count === 'number' ? stats : null;
}

function buildHookStatsSummary(
  stats: AgentSessionHookStatsView,
  t?: (key: string, options?: Record<string, unknown>) => string,
): string {
  const title = t?.('chat.hookStatsSummaryTitle') ?? 'Hooks summary';
  const ran = t?.('chat.hookStatsRanCount') ?? 'Ran';
  const blocked = t?.('chat.hookStatsBlockedCount') ?? 'Blocked';
  const errors = t?.('chat.hookStatsErrorCount') ?? 'Errors';
  const repeat = t?.('chat.hookStatsRepeatCount', { count: 0 }) ?? '';
  const lines = [title, `${ran}: ${stats.count}`];
  if (stats.blockedCount && stats.blockedCount > 0) {
    lines.push(`${blocked}: ${stats.blockedCount}`);
  }
  if (stats.errorCount && stats.errorCount > 0) {
    lines.push(`${errors}: ${stats.errorCount}`);
  }
  for (const run of stats.runs ?? []) {
    const parts: string[] = [];
    if (run.eventName) parts.push(run.eventName);
    if (run.source) parts.push(run.source);
    if (run.count && run.count > 1) parts.push(`\u00d7${run.count}`);
    if (parts.length > 0) {
      lines.push(parts.join(' \u00b7 '));
    }
    if (run.statusMessage) lines.push(run.statusMessage);
  }
  return lines.join('\n');
}

function UserMessageSourceLabel({
  message,
  t,
}: {
  message: AgentSessionItemViewSource;
  t?: (key: string, options?: Record<string, unknown>) => string;
}) {
  const source = resolveUserMessageSource(message);
  if (!source) {
    return null;
  }
  if (source.kind === 'automation-heartbeat') {
    return (
      <div className="mb-1 flex items-center gap-1 text-[12px] text-gray-500">
        <Clock3 size={12} aria-hidden="true" />
        <span>{t?.('chat.userMessageSentByScheduledTask') ?? 'Sent by scheduled task'}</span>
      </div>
    );
  }
  return (
    <div className="mb-1 flex items-center gap-1 text-[12px] text-gray-500">
      <CornerUpLeft size={12} aria-hidden="true" />
      <span>{t?.('chat.userMessageDelegatedFromCodex') ?? 'Sent by Codex from another chat'}</span>
    </div>
  );
}

/**
 * Codex desktop blocked-message status (`codex.userMessage.hookBlocked`):
 * shown below a user message whose delivery was blocked by a hook, with the
 * blocking hook identities rendered as sources.
 */
function HookBlockedStatus({
  message,
  t,
}: {
  message: AgentSessionItemViewSource;
  t?: (key: string, options?: Record<string, unknown>) => string;
}) {
  const status = resolveHookBlockedStatus(message);
  if (!status) {
    return null;
  }
  const blockedLabel = t?.('chat.userMessageHookBlocked') ?? 'Hook blocked this message';
  const detail = status.blockedSources.length > 0
    ? `${blockedLabel} \u00b7 ${status.blockedSources.join(', ')}`
    : blockedLabel;
  return (
    <div
      className="mt-1 flex items-center gap-1 text-[11px] text-amber-300/80"
      data-chat-user-message-hook-blocked="true"
      title={detail}
    >
      <ShieldAlert size={11} aria-hidden="true" />
      <span className="min-w-0 truncate">{blockedLabel}</span>
    </div>
  );
}

/**
 * Codex desktop supplementary user-message statuses (`codex.userMessage.goal`
 * / `codex.userMessage.hookFeedback`): "Sent as goal" when the message set
 * the thread goal, and "Hook feedback" when the message is merged feedback
 * from a Stop hook. Rendered below the bubble like the blocked-message line.
 */
function UserMessageStatusLines({
  message,
  t,
}: {
  message: AgentSessionItemViewSource;
  t?: (key: string, options?: Record<string, unknown>) => string;
}) {
  const metadata = message.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    return null;
  }
  const goalLabel = t?.('chat.userMessageSentAsGoal') ?? 'Sent as goal';
  const hookFeedbackLabel = t?.('chat.userMessageHookFeedback') ?? 'Hook feedback';
  const priorConversationLabel = t?.('chat.userMessagePriorConversation')
    ?? 'References prior conversation';
  return (
    <>
      {metadata.goal === true ? (
        <div
          className="mt-1 flex items-center gap-1 text-[11px] text-gray-500"
          data-chat-user-message-goal="true"
        >
          <Target size={11} aria-hidden="true" />
          <span className="min-w-0 truncate">{goalLabel}</span>
        </div>
      ) : null}
      {metadata.hookFeedback === true ? (
        <div
          className="mt-1 flex items-center gap-1 text-[11px] text-gray-500"
          data-chat-user-message-hook-feedback="true"
        >
          <TerminalSquare size={11} aria-hidden="true" />
          <span className="min-w-0 truncate">{hookFeedbackLabel}</span>
        </div>
      ) : null}
      {metadata.referencesPriorConversation === true ? (
        <div
          className="mt-1 flex items-center gap-1 text-[11px] text-gray-500"
          data-chat-user-message-prior-conversation="true"
        >
          <History size={11} aria-hidden="true" />
          <span className="min-w-0 truncate">{priorConversationLabel}</span>
        </div>
      ) : null}
    </>
  );
}

function resolveViewMarkdownCopyFallback(view: AgentSessionItemPresentation): string {
  return view.blocks
    .filter((block) => block.type === 'markdown')
    .map((block) => block.content.trim())
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Codex desktop message timestamp (`Jol`/`Zol`): same-day messages show
 * the time only, the last 7 days add the weekday, older messages show the
 * month and day. `full` adds the complete date for tooltips.
 */
export function formatConversationMessageTimestamp(timestamp: number, full: boolean): string {
  const date = new Date(timestamp);
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (full) {
    return `${date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}, ${time}`;
  }
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return time;
  }
  const ageMs = now.getTime() - date.getTime();
  if (ageMs >= 0 && ageMs < 7 * 24 * 3_600 * 1_000) {
    return `${date.toLocaleDateString(undefined, { weekday: 'short' })}, ${time}`;
  }
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
}

interface ChatMessageActionBarProps {
  message: AgentSessionItemViewSource;
  context: ChatMessageRendererProps['context'];
  copyContent: string;
  iconSize: number;
  className: string;
  showEdit?: boolean;
  showRating?: boolean;
  showFork?: boolean;
  /** Codex desktop shows the sent time only on hover; user messages carry none. */
  showTimestamp?: boolean;
}

function ContinueInNewChatIcon({ size }: { size: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height={size}
      viewBox="0 0 20 20"
      width={size}
    >
      <path d="M15.8 11.535c.367 0 .665.298.665.665v5a.665.665 0 0 1-.665.665h-5a.665.665 0 1 1 0-1.33h3.394l-3.565-3.564a.666.666 0 0 1 .942-.942l3.564 3.565V12.2c0-.367.298-.665.665-.665Zm0-9.4c.367 0 .665.298.665.665v5a.665.665 0 0 1-1.33 0V4.405l-5.128 5.128c-.323.324-.558.565-.842.74a2.668 2.668 0 0 1-.771.319c-.324.078-.662.073-1.12.073H1.93a.665.665 0 1 1 0-1.33h5.345c.52 0 .673-.005.809-.037.136-.033.266-.086.385-.16.12-.072.23-.177.598-.545l5.128-5.128H10.8a.665.665 0 0 1 0-1.33h5Z" />
    </svg>
  );
}

function ChatMessageActionBar({
  message,
  context,
  copyContent,
  iconSize,
  className,
  showEdit = false,
  showRating = false,
  showFork = false,
  showTimestamp = true,
}: ChatMessageActionBarProps) {
  const environment = context.environment;
  const copyLabel = environment?.t('chat.messageCopyLabel') ?? 'Copy message';
  const copiedLabel = environment?.t('chat.messageCopiedLabel') ?? 'Copied';
  const editLabel = environment?.t('chat.messageEdit') ?? 'Edit message';
  const forkLabel = environment?.t('chat.messageFork') ?? 'Continue in new chat from here';
  const [copied, setCopied] = useState(false);
  const [forking, setForking] = useState(false);
  const initialRating = message.metadata?.assistantRating === 'up'
    ? 'thumbs_up'
    : message.metadata?.assistantRating === 'down'
      ? 'thumbs_down'
      : null;
  const [selectedRating, setSelectedRating] = useState<ChatAssistantMessageRating | null>(initialRating);
  useEffect(() => {
    setSelectedRating(
      message.metadata?.assistantRating === 'up'
        ? 'thumbs_up'
        : message.metadata?.assistantRating === 'down'
          ? 'thumbs_down'
          : null,
    );
  }, [message.metadata?.assistantRating]);
  useEffect(() => {
    if (!copied) {
      return undefined;
    }
    const timeout = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [copied]);
  const actionButtonClassName = 'h-6 w-6 rounded-md text-gray-500 transition-colors hover:bg-white/10 hover:text-gray-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70';
  const hasCopyContent = copyContent.trim().length > 0;
  const hookStats = resolveHookStats(message);
  const hooksLabel = environment?.t('chat.hookStatsLabel') ?? 'Hooks';
  const [ratingDialog, setRatingDialog] = useState<ChatAssistantMessageRating | null>(null);
  const rateMessage = (rating: ChatAssistantMessageRating) => {
    const nextRating: ChatAssistantMessageRatingSelection = selectedRating === rating ? null : rating;
    if (nextRating === null) {
      setSelectedRating(null);
      setRatingDialog(null);
      void environment?.onRateMessage?.(message.id, null);
      return;
    }
    // Codex desktop opens the feedback reason dialog after the thumbs
    // selection; the rating is committed on submit.
    setSelectedRating(nextRating);
    setRatingDialog(rating);
  };

  return (
    <div className={className}>
      {hasCopyContent ? (
        <Button
          variant="ghost"
          size="icon"
          className={actionButtonClassName}
          title={copied ? copiedLabel : copyLabel}
          aria-label={copied ? copiedLabel : copyLabel}
          onClick={() => {
            void Promise.resolve(context.copyMessageToClipboard(copyContent)).then((didCopy) => {
              if (didCopy !== false) {
                setCopied(true);
              }
            });
          }}
        >
          {copied ? <Check size={iconSize} /> : <Copy size={iconSize} />}
        </Button>
      ) : null}
      {hookStats ? (
        <Button
          variant="ghost"
          size="icon"
          className={actionButtonClassName}
          title={buildHookStatsSummary(hookStats, environment?.t)}
          aria-label={hooksLabel}
          data-chat-hook-stats="true"
        >
          <TerminalSquare size={iconSize} />
        </Button>
      ) : null}
      {showRating && environment?.onRateMessage ? (
        <>
          <Button
            variant="ghost"
            size="icon"
            className={actionButtonClassName}
            title={environment.t('chat.messageGoodResponse')}
            aria-label={environment.t('chat.messageGoodResponse')}
            aria-pressed={selectedRating === 'thumbs_up'}
            onClick={() => rateMessage('thumbs_up')}
          >
            <ThumbsUp size={iconSize} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={actionButtonClassName}
            title={environment.t('chat.messageBadResponse')}
            aria-label={environment.t('chat.messageBadResponse')}
            aria-pressed={selectedRating === 'thumbs_down'}
            onClick={() => rateMessage('thumbs_down')}
          >
            <ThumbsDown size={iconSize} />
          </Button>
        </>
      ) : null}
      {showFork && environment?.onForkMessage ? (
        <Button
          variant="ghost"
          size="icon"
          className={actionButtonClassName}
          title={forkLabel}
          aria-label={forkLabel}
          aria-busy={forking || undefined}
          disabled={forking}
          onClick={async () => {
            if (forking) return;
            setForking(true);
            try {
              await environment.onForkMessage?.(message.id);
            } finally {
              setForking(false);
            }
          }}
        >
          {forking ? <LoaderCircle className="animate-spin" size={iconSize} /> : <ContinueInNewChatIcon size={iconSize} />}
        </Button>
      ) : null}
      {showEdit && environment?.beginEditingMessage ? (
        <Button
          variant="ghost"
          size="icon"
          className={actionButtonClassName}
          title={editLabel}
          aria-label={editLabel}
          onClick={() => environment.beginEditingMessage?.(message.id, message.content)}
        >
          <Edit2 size={iconSize} />
        </Button>
      ) : null}
      {showTimestamp && typeof message.timestamp === 'number' && Number.isFinite(message.timestamp) ? (
        <span
          className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-gray-500 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          data-chat-message-sent-time="true"
          title={formatConversationMessageTimestamp(message.timestamp, true)}
        >
          {formatConversationMessageTimestamp(message.timestamp, false)}
        </span>
      ) : null}
      {ratingDialog ? (
        <ChatTurnRatingDialog
          messageId={message.id}
          onClose={() => setRatingDialog(null)}
          onSubmit={(messageId, rating) => {
            void environment?.onRateMessage?.(messageId, rating);
          }}
          rating={ratingDialog}
          t={environment?.t}
        />
      ) : null}
    </div>
  );
}

export const UserTextMessageRenderer = memo(function UserTextMessageRenderer({
  view,
  context,
  messageRef,
}: ChatMessageRendererProps) {
  const message = view.source;
  const isSidebar = context.layout === 'sidebar';
  const display = resolveUserMessageDisplay(view);
  const textView = display.textBlocks.length > 0
    ? { ...view, blocks: display.textBlocks }
    : null;
  const supplementaryView = display.supplementaryBlocks.length > 0
    ? { ...view, blocks: display.supplementaryBlocks }
    : null;
  const userRoleHeading = context.environment?.t('chat.conversationRoleHeadingUser') ?? 'You said:';
  const canEditMessage = Boolean(context.environment?.beginEditingMessage);
  const beginEditingMessage = () => {
    context.environment?.beginEditingMessage?.(message.id, message.content);
  };
  const noContentLabel = context.environment?.t('chat.userMessageNoContent') ?? '(No content)';
  const userBubbleClassName = `max-w-[77%] min-w-0 overflow-hidden break-words rounded-2xl bg-white/[0.05] px-3 py-2 text-start text-[length:calc(var(--birdcoder-ui-font-size,12px)_+_1px)] leading-6 text-gray-100 whitespace-pre-wrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 [overflow-wrap:anywhere] ${
    canEditMessage ? 'cursor-pointer' : ''
  }`;

  if (isSidebar) {
    return (
      <div ref={messageRef} className="group flex w-full min-w-0 flex-col items-end">
        <h4 className="sr-only select-none">{userRoleHeading}</h4>
        <UserMessageSourceLabel message={message} t={context.environment?.t} />
        <HookBlockedStatus message={message} t={context.environment?.t} />
        <UserMessageStatusLines message={message} t={context.environment?.t} />
        <UserMessageAttachments
          audios={display.audioAttachments}
          context={context}
          files={display.fileAttachments}
          images={display.imageAttachments}
        />
        <div className="flex w-full items-center justify-end gap-1">
          {context.showMessageActions ? (
            <ChatMessageActionBar
              message={message}
              context={context}
              copyContent={message.content}
              iconSize={12}
              showTimestamp={false}
              className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
            />
          ) : null}
          {textView ? (
            <div
              className={`${userBubbleClassName} text-gray-200`}
              data-chat-user-text="true"
              data-user-message-bubble="true"
              onDoubleClick={canEditMessage ? beginEditingMessage : undefined}
              tabIndex={0}
            >
              <ContentBlockList view={textView} context={context} />
            </div>
          ) : (
            <div
              className={`${userBubbleClassName} text-gray-500`}
              data-chat-user-text="true"
              data-user-message-bubble="true"
              data-chat-user-message-empty="true"
              onDoubleClick={canEditMessage ? beginEditingMessage : undefined}
              tabIndex={0}
            >
              {noContentLabel}
            </div>
          )}
        </div>
        {supplementaryView ? <ContentBlockList view={supplementaryView} context={context} /> : null}
      </div>
    );
  }

  return (
    <div ref={messageRef} className="group flex w-full min-w-0 flex-col items-end">
      <h4 className="sr-only select-none">{userRoleHeading}</h4>
      <UserMessageSourceLabel message={message} t={context.environment?.t} />
      <HookBlockedStatus message={message} t={context.environment?.t} />
      <UserMessageAttachments
        audios={display.audioAttachments}
        context={context}
        files={display.fileAttachments}
        images={display.imageAttachments}
      />
      <div className="flex w-full items-center justify-end gap-1">
        {context.showMessageActions ? (
          <ChatMessageActionBar
            message={message}
            context={context}
            copyContent={message.content}
            iconSize={12}
            showTimestamp={false}
            className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
          />
        ) : null}
        {textView ? (
          <div
            className={userBubbleClassName}
            data-chat-user-text="true"
            data-user-message-bubble="true"
            onDoubleClick={canEditMessage ? beginEditingMessage : undefined}
            tabIndex={0}
          >
            <ContentBlockList view={textView} context={context} />
          </div>
        ) : (
          <div
            className={`${userBubbleClassName} text-gray-500`}
            data-chat-user-text="true"
            data-user-message-bubble="true"
            data-chat-user-message-empty="true"
            onDoubleClick={canEditMessage ? beginEditingMessage : undefined}
            tabIndex={0}
          >
            {noContentLabel}
          </div>
        )}
      </div>
      {supplementaryView ? <ContentBlockList view={supplementaryView} context={context} /> : null}
    </div>
  );
});
export const AssistantReplyMessageRenderer = memo(function AssistantReplyMessageRenderer({
  view,
  context,
  messageRef,
}: ChatMessageRendererProps) {
  const message = view.source;
  const isSidebar = context.layout === 'sidebar';
  const copyContent = resolveMessageActionTargetCopyText(
    context.allMessages,
    context.actionTarget,
    resolveViewMarkdownCopyFallback(view),
  );
  const hasAuthoredMarkdown = view.blocks.some(
    (block) => block.type === 'markdown' && !block.noticeKind && block.content.trim().length > 0,
  );
  const hasStructuredActivity = view.blocks.some(
    (block) => block.type !== 'markdown' || Boolean(block.noticeKind),
  );
  const suppressReplyChrome = !hasAuthoredMarkdown && hasStructuredActivity;
  const providerMessageCompleted = message.metadata?.providerMessageCompleted;
  const messageCompleted = typeof providerMessageCompleted === 'boolean'
    ? providerMessageCompleted
    : message.metadata?.transient !== true;
  const assistantRoleHeading = context.environment?.t('chat.conversationRoleHeadingAssistant')
    ?? 'ChatGPT said:';

  return (
    <div ref={messageRef} className={`group flex w-full min-w-0 max-w-full flex-col ${isSidebar ? 'items-start' : ''}`}>
      <h4 className="sr-only select-none">{assistantRoleHeading}</h4>
      {suppressReplyChrome ? null : (
        <RoleHeader viewKind={view.kind} layout={context.layout} t={context.environment?.t} />
      )}
      <ContentBlockList view={view} context={context} />
      {context.showMessageActions && messageCompleted && !suppressReplyChrome ? (
        <ChatMessageActionBar
          message={message}
          context={context}
          copyContent={copyContent}
          iconSize={isSidebar ? 12 : 14}
          className="mt-1.5 flex h-5 items-center justify-start gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
          showRating
          showFork
        />
      ) : null}
    </div>
  );
});
