import { memo } from 'react';
import { Loader2 } from 'lucide-react';
import type { ChatMessageLayout, ChatMessageTranslate } from '../types.ts';
import type { ChatProviderPresentationProfile } from '../presentation/providerPresentationProfiles.ts';
import { OPENCODE_ALIGNED_CHAT_TRANSCRIPT_POLICY } from '../presentation/providerPresentationProfiles.ts';

export const ChatTurnActiveTail = memo(function ChatTurnActiveTail({
  layout,
  providerProfile,
  t,
}: {
  layout: ChatMessageLayout;
  providerProfile?: ChatProviderPresentationProfile;
  t?: ChatMessageTranslate;
}) {
  const activeTailPolicy = providerProfile?.presentation.activeTail
    ?? OPENCODE_ALIGNED_CHAT_TRANSCRIPT_POLICY.activeTail;
  const label = t?.(activeTailPolicy.labelKey);

  return (
    <div
      aria-hidden="true"
      className={`flex min-h-5 w-full items-center gap-2 text-gray-500 ${
        layout === 'sidebar' ? 'mt-2 text-[12px]' : 'mt-3 text-[13px]'
      }`}
      data-chat-engine={providerProfile?.engineId}
      data-chat-engine-protocol={providerProfile?.protocolAdapterId}
      data-chat-turn-active-tail="true"
    >
      <Loader2
        className="motion-safe:animate-spin motion-reduce:animate-none"
        size={14}
      />
      <span>
        {label && label !== activeTailPolicy.labelKey
          ? label
          : activeTailPolicy.fallbackLabel}
      </span>
    </div>
  );
});
