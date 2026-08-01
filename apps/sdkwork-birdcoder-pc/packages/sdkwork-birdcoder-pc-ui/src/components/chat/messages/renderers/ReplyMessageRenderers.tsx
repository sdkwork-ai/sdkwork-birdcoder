import React, { memo, useEffect, useState } from 'react';
import { Check, Copy, Edit2, LoaderCircle, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';
import type { AgentSessionItemViewSource } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { AgentSessionItemPresentation } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { ContentBlockList } from '../contentBlocks/ContentBlockList.tsx';
import { UserMessageAttachments } from '../UserMessageAttachments.tsx';
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

function resolveViewMarkdownCopyFallback(view: AgentSessionItemPresentation): string {
  return view.blocks
    .filter((block) => block.type === 'markdown')
    .map((block) => block.content.trim())
    .filter(Boolean)
    .join('\n\n');
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
  const rateMessage = (rating: ChatAssistantMessageRating) => {
    const nextRating: ChatAssistantMessageRatingSelection = selectedRating === rating ? null : rating;
    setSelectedRating(nextRating);
    void environment?.onRateMessage?.(message.id, nextRating);
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

  if (isSidebar) {
    return (
      <div ref={messageRef} className="group flex w-full min-w-0 flex-col items-end">
        <h4 className="sr-only select-none">{userRoleHeading}</h4>
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
              className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
            />
          ) : null}
          {textView ? (
            <div
              className={`max-w-[77%] min-w-0 overflow-hidden break-words rounded-2xl bg-white/[0.05] px-3 py-2 text-start text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 [overflow-wrap:anywhere] ${
                canEditMessage ? 'cursor-pointer' : ''
              }`}
              data-chat-user-text="true"
              data-user-message-bubble="true"
              onDoubleClick={canEditMessage ? beginEditingMessage : undefined}
              tabIndex={0}
            >
              <ContentBlockList view={textView} context={context} />
            </div>
          ) : null}
        </div>
        {supplementaryView ? <ContentBlockList view={supplementaryView} context={context} /> : null}
      </div>
    );
  }

  return (
    <div ref={messageRef} className="group flex w-full min-w-0 flex-col items-end">
      <h4 className="sr-only select-none">{userRoleHeading}</h4>
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
            className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
          />
        ) : null}
        {textView ? (
          <div
            className={`max-w-[77%] min-w-0 overflow-hidden break-words rounded-2xl bg-white/[0.05] px-3 py-2 text-start text-[length:calc(var(--birdcoder-ui-font-size,12px)_+_1px)] leading-6 text-gray-100 whitespace-pre-wrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 [overflow-wrap:anywhere] ${
              canEditMessage ? 'cursor-pointer' : ''
            }`}
            data-chat-user-text="true"
            data-user-message-bubble="true"
            onDoubleClick={canEditMessage ? beginEditingMessage : undefined}
            tabIndex={0}
          >
            <ContentBlockList view={textView} context={context} />
          </div>
        ) : null}
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
