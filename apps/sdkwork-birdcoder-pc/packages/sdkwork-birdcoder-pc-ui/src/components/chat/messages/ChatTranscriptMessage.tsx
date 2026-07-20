import React, { memo, useMemo } from 'react';
import {
  resolveChatTurnActivitySummary,
  resolveChatMessageView,
  type BirdCoderCodeEngineKey,
} from '@sdkwork/birdcoder-pc-workbench/chat/types';
import type { BirdCoderChatMessage } from '@sdkwork/birdcoder-pc-workbench/chat/types';
import { defaultChatMessageRendererRegistry } from './defaultRegistry.ts';
import {
  buildTranscriptSurfaceStyle,
  resolveTranscriptSurfaceIntrinsicSize,
} from './messageLayout.ts';
import type {
  ChatMessageLayout,
  ChatMessageRenderContext,
} from './types.ts';
import type { ChatMessageRendererRegistry } from './registry.ts';

export interface ChatTranscriptMessageProps {
  message: BirdCoderChatMessage;
  index: number;
  sessionId: string;
  layout: ChatMessageLayout;
  engineId?: BirdCoderCodeEngineKey;
  messageRenderKey?: string;
  messageRef?: (element: HTMLDivElement | null) => void;
  context: ChatMessageRenderContext;
  registry?: ChatMessageRendererRegistry;
}

export const ChatTranscriptMessage = memo(function ChatTranscriptMessage({
  message,
  index,
  sessionId,
  layout,
  engineId,
  messageRenderKey,
  messageRef,
  context,
  registry = defaultChatMessageRendererRegistry,
}: ChatTranscriptMessageProps) {
  const activitySummary = useMemo(
    () => resolveChatTurnActivitySummary(context.allMessages, message, { engineId }),
    [context.allMessages, engineId, message],
  );
  const view = useMemo(
    () => resolveChatMessageView(message, { activitySummary, engineId, layout }),
    [activitySummary, engineId, layout, message],
  );
  const entry = useMemo(() => registry.resolve(view), [registry, view]);
  const Renderer = entry.Component;
  const isUser = view.kind === 'user.text';
  const resolvedContext = useMemo(
    () => ({
      ...context,
      index,
      layout,
    }),
    [context, index, layout],
  );

  if (layout === 'sidebar') {
    return (
      <div
        data-transcript-message-index={index}
        ref={messageRef}
        key={messageRenderKey ?? `${sessionId}\u0001${index}\u0001${message.id || 'message'}`}
        className={isUser
          ? 'group flex w-full min-w-0 flex-col items-end'
          : 'group flex w-full min-w-0 max-w-full flex-col items-start'}
        style={buildTranscriptSurfaceStyle(resolveTranscriptSurfaceIntrinsicSize(layout, isUser))}
      >
        <Renderer
          view={view}
          context={resolvedContext}
        />
      </div>
    );
  }

  return (
    <div
      data-transcript-message-index={index}
      ref={messageRef}
      key={messageRenderKey ?? `${sessionId}\u0001${index}\u0001${message.id || 'message'}`}
      className={`group flex w-full min-w-0 px-5 ${isUser ? 'py-2' : 'py-2.5'}`}
      style={buildTranscriptSurfaceStyle(resolveTranscriptSurfaceIntrinsicSize(layout, isUser))}
    >
      <div className={`mx-auto flex w-full min-w-0 max-w-[880px] ${isUser ? 'justify-end' : 'justify-start'}`}>
        <Renderer
          view={view}
          context={resolvedContext}
        />
      </div>
    </div>
  );
});
