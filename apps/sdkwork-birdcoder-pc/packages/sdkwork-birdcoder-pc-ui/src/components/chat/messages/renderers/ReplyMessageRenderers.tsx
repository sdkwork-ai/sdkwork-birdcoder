import React, { memo } from 'react';
import { Copy, Edit2, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';
import type { ChatMessageViewSource } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { AgentSessionItemPresentation } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { ContentBlockList } from '../contentBlocks/ContentBlockList.tsx';
import {
  resolveMessageActionTargetCopyText,
  resolveMessageActionTargetMessageIds,
} from '../messageActions.ts';
import type { ChatMessageRendererProps } from '../types.ts';
import { RoleHeader } from './RoleHeader.tsx';

function resolveViewMarkdownCopyFallback(view: AgentSessionItemPresentation): string {
  return view.blocks
    .filter((block) => block.type === 'markdown')
    .map((block) => block.content.trim())
    .filter(Boolean)
    .join('\n\n');
}

interface ChatMessageActionBarProps {
  message: ChatMessageViewSource;
  context: ChatMessageRendererProps['context'];
  copyContent: string;
  iconSize: number;
  className: string;
  showEdit?: boolean;
  showRegenerate?: boolean;
}

function ChatMessageActionBar({
  message,
  context,
  copyContent,
  iconSize,
  className,
  showEdit = false,
  showRegenerate = false,
}: ChatMessageActionBarProps) {
  const environment = context.environment;
  const copyLabel = environment?.t('common.copy') ?? 'Copy';
  const editLabel = environment?.t('chat.messageEdit') ?? 'Edit message';
  const regenerateLabel = environment?.t('chat.messageRegenerate') ?? 'Regenerate response';
  const deleteLabel = environment?.t('chat.messageDelete') ?? 'Delete message';
  const actionButtonClassName = 'h-6 w-6 rounded-md text-gray-500 transition-colors hover:bg-white/10 hover:text-gray-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400/70';
  const hasCopyContent = copyContent.trim().length > 0;

  return (
    <div className={className}>
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
      {hasCopyContent ? (
        <Button
          variant="ghost"
          size="icon"
          className={actionButtonClassName}
          title={copyLabel}
          aria-label={copyLabel}
          onClick={() => context.copyMessageToClipboard(copyContent)}
        >
          <Copy size={iconSize} />
        </Button>
      ) : null}
      {showRegenerate && environment?.onRegenerateMessage ? (
        <Button
          variant="ghost"
          size="icon"
          className={actionButtonClassName}
          title={regenerateLabel}
          aria-label={regenerateLabel}
          onClick={() => environment.onRegenerateMessage?.()}
        >
          <RotateCcw size={iconSize} />
        </Button>
      ) : null}
      {environment?.onDeleteMessage ? (
        <Button
          variant="ghost"
          size="icon"
          className={`${actionButtonClassName} hover:bg-red-500/10 hover:text-red-400`}
          title={deleteLabel}
          aria-label={deleteLabel}
          onClick={() =>
            environment.onDeleteMessage?.(
              resolveMessageActionTargetMessageIds(
                context.allMessages,
                context.actionTarget,
                message.id,
              ),
            )
          }
        >
          <Trash2 size={iconSize} />
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

  if (isSidebar) {
    return (
      <div ref={messageRef} className="group flex w-full min-w-0 flex-col items-end">
        <div className="max-w-[90%] min-w-0 overflow-hidden break-words bg-white/5 px-4 py-3 text-gray-200 [overflow-wrap:anywhere] rounded-xl rounded-tr-md">
          <ContentBlockList view={view} context={context} />
        </div>
        {context.showMessageActions ? (
          <ChatMessageActionBar
            message={message}
            context={context}
            copyContent={message.content}
            iconSize={10}
            className="mt-1.5 flex items-center justify-end gap-1 pr-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
            showEdit
          />
        ) : null}
      </div>
    );
  }

  return (
    <div ref={messageRef} className="flex w-full min-w-0 flex-col items-end">
      <div className="max-w-[85%] min-w-0 overflow-hidden break-words bg-white/5 px-4 py-2.5 text-[14px] leading-relaxed text-gray-200 whitespace-pre-wrap [overflow-wrap:anywhere] rounded-xl rounded-tr-md">
        <ContentBlockList view={view} context={context} />
      </div>
      {context.showMessageActions ? (
        <ChatMessageActionBar
          message={message}
          context={context}
          copyContent={message.content}
          iconSize={12}
          className="mt-1 flex items-center gap-1 pr-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
          showEdit
        />
      ) : null}
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

  return (
    <div ref={messageRef} className={`flex w-full min-w-0 max-w-full flex-col ${isSidebar ? 'items-start group' : ''}`}>
      {suppressReplyChrome ? null : (
        <RoleHeader viewKind={view.kind} layout={context.layout} t={context.environment?.t} />
      )}
      <ContentBlockList view={view} context={context} />
      {context.showMessageActions && !suppressReplyChrome ? (
        <ChatMessageActionBar
          message={message}
          context={context}
          copyContent={copyContent}
          iconSize={isSidebar ? 12 : 14}
          className={`${isSidebar ? 'mt-1.5' : 'mt-1.5'} flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100`}
          showRegenerate
        />
      ) : null}
    </div>
  );
});
