import { memo } from 'react';
import { Loader2 } from 'lucide-react';
import type { ChatMessageLayout, ChatMessageTranslate } from '../types.ts';

export const ChatTurnActiveTail = memo(function ChatTurnActiveTail({
  layout,
  t,
}: {
  layout: ChatMessageLayout;
  t?: ChatMessageTranslate;
}) {
  return (
    <div
      aria-hidden="true"
      className={`flex min-h-5 w-full items-center gap-2 text-gray-500 ${
        layout === 'sidebar' ? 'mt-2 text-[12px]' : 'mt-3 text-[13px]'
      }`}
      data-chat-turn-active-tail="true"
    >
      <Loader2
        className="motion-safe:animate-spin motion-reduce:animate-none"
        size={14}
      />
      <span>{t?.('chat.providerWorking') ?? 'Working'}</span>
    </div>
  );
});
