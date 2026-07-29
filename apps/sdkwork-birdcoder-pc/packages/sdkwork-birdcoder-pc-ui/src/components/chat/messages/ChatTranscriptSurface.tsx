import type { ReactNode } from 'react';
import {
  buildTranscriptSurfaceStyle,
  resolveTranscriptSurfaceIntrinsicSize,
} from './messageLayout.ts';
import type { ChatProviderPresentationProfile } from './presentation/providerPresentationProfiles.ts';
import type { ChatTranscriptTurnPresentation } from './presentation/transcriptTurnPresentation.ts';
import type { ChatMessageLayout } from './types.ts';

export interface ChatTranscriptSurfaceProps {
  children: ReactNode;
  index: number;
  isUser: boolean;
  layout: ChatMessageLayout;
  messageKey: string;
  messageRef?: (element: HTMLDivElement | null) => void;
  providerProfile?: ChatProviderPresentationProfile;
  turn: ChatTranscriptTurnPresentation;
}

export function ChatTranscriptSurface({
  children,
  index,
  isUser,
  layout,
  messageKey,
  messageRef,
  providerProfile,
  turn,
}: ChatTranscriptSurfaceProps) {
  const sharedProps = {
    'data-chat-density': providerProfile?.presentation.density,
    'data-chat-engine': providerProfile?.engineId,
    'data-chat-engine-protocol': providerProfile?.protocolAdapterId,
    'data-chat-transcript-layout': layout,
    'data-chat-transcript-style': providerProfile?.presentation.transcriptStyle,
    'data-chat-turn-end': turn.isEnd ? 'true' : undefined,
    'data-chat-turn-key': turn.key,
    'data-chat-turn-position': turn.position,
    'data-chat-turn-start': turn.isStart ? 'true' : undefined,
    'data-transcript-message-index': index,
    'data-transcript-message-key': messageKey,
    ref: messageRef,
    style: buildTranscriptSurfaceStyle(
      resolveTranscriptSurfaceIntrinsicSize(layout, isUser),
    ),
  } as const;

  if (layout === 'sidebar') {
    return (
      <div
        {...sharedProps}
        className={isUser
          ? 'group flex w-full min-w-0 flex-col items-end'
          : 'group flex w-full min-w-0 max-w-full flex-col items-start'}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      {...sharedProps}
      className={`group flex w-full min-w-0 px-5 ${
        isUser
          ? `${turn.isStart ? 'pt-6' : 'pt-3'} pb-0`
          : `${turn.isStart ? 'pt-6' : 'pt-3'} ${turn.isEnd ? 'pb-3' : 'pb-0'}`
      }`}
    >
      <div
        className={`mx-auto flex w-full min-w-0 max-w-[880px] flex-col ${
          isUser ? 'items-end' : 'items-start'
        }`}
        data-chat-transcript-track="true"
      >
        {children}
      </div>
    </div>
  );
}
