import { CircleAlert } from 'lucide-react';
import { memo } from 'react';
import { ContentBlockList } from '../contentBlocks/ContentBlockList.tsx';
import type { ChatMessageRendererProps } from '../types.ts';

export const UnsupportedMessageRenderer = memo(function UnsupportedMessageRenderer({
  context,
  messageRef,
  view,
}: ChatMessageRendererProps) {
  const title = context.environment?.t('chat.unsupportedMessageContent')
    ?? 'Unsupported session content';

  return (
    <div
      ref={messageRef}
      className="w-full min-w-0 rounded border border-amber-300/20 bg-amber-400/[0.045] px-3 py-2.5 text-gray-300"
      data-chat-message-view-kind="unsupported"
      role="note"
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-amber-200">
        <CircleAlert aria-hidden="true" className="shrink-0" size={14} />
        <span>{title}</span>
      </div>
      <ContentBlockList context={context} view={view} />
    </div>
  );
});
