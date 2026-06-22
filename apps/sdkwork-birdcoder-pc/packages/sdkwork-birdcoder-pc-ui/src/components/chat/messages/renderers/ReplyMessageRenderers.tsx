import React, { memo } from 'react';
import { Copy, Edit2, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@sdkwork/birdcoder-pc-ui-shell';
import type { ChatMessageViewSource } from '@sdkwork/birdcoder-pc-commons/chat/types';
import type { BirdCoderChatMessageView } from '@sdkwork/birdcoder-pc-commons/chat/types';
import { ContentBlockList } from '../contentBlocks/ContentBlockList.tsx';
import {
  resolveMessageActionTargetCopyText,
  resolveMessageActionTargetMessageIds,
} from '../messageActions.ts';
import type { ChatMessageRendererProps } from '../types.ts';
import { RoleHeader } from './RoleHeader.tsx';

function resolveViewMarkdownCopyFallback(view: BirdCoderChatMessageView): string {
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

  return (
    <div className={className}>
      {showEdit && environment?.beginEditingMessage ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded-md transition-colors"
          title="Edit"
          onClick={() => environment.beginEditingMessage?.(message.id, message.content)}
        >
          <Edit2 size={iconSize} />
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded-md transition-colors"
        title={copyLabel}
        onClick={() => context.copyMessageToClipboard(copyContent)}
      >
        <Copy size={iconSize} />
      </Button>
      {showRegenerate && environment?.onRegenerateMessage ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-gray-500 hover:text-gray-300 hover:bg-white/10 rounded-md transition-colors"
          title="Regenerate"
          onClick={() => environment.onRegenerateMessage?.()}
        >
          <RotateCcw size={iconSize} />
        </Button>
      ) : null}
      {environment?.onDeleteMessage ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
          title="Delete"
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
      <div ref={messageRef} className="group flex flex-col items-end">
        <div className="max-w-[90%] bg-white/5 text-gray-200 rounded-xl rounded-tr-md px-4 py-3">
          <ContentBlockList view={view} context={context} />
        </div>
        {context.showMessageActions ? (
          <ChatMessageActionBar
            message={message}
            context={context}
            copyContent={message.content}
            iconSize={10}
            className="mt-1.5 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-1"
            showEdit
          />
        ) : null}
      </div>
    );
  }

  return (
    <div ref={messageRef} className="flex w-full flex-col items-end">
      <div className="max-w-[85%] bg-white/5 text-gray-200 px-4 py-2.5 rounded-xl rounded-tr-md text-[14px] whitespace-pre-wrap leading-relaxed">
        <ContentBlockList view={view} context={context} />
      </div>
      {context.showMessageActions ? (
        <ChatMessageActionBar
          message={message}
          context={context}
          copyContent={message.content}
          iconSize={12}
          className="mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-2"
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

  return (
    <div ref={messageRef} className={`flex flex-col w-full ${isSidebar ? 'items-start group' : 'min-w-0'}`}>
      <RoleHeader viewKind={view.kind} layout={context.layout} />
      <ContentBlockList view={view} context={context} />
      {context.showMessageActions ? (
        <ChatMessageActionBar
          message={message}
          context={context}
          copyContent={copyContent}
          iconSize={isSidebar ? 12 : 14}
          className={`${isSidebar ? 'mt-1.5' : 'mt-1.5'} flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}
          showRegenerate
        />
      ) : null}
    </div>
  );
});
